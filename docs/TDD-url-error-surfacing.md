# TDD — Surface URL errors that are already computed but dropped (#285, #289)

**Author:** John (Tech Lead)
**Date:** 2026-09-02
**Status:** Ready for dev
**Source tickets:** GitHub #285 (P1, audit F-14), #289 (P2, audit run 4 Track B3)
**Scope:** Frontend only. No PRD (audit bugs). No design spec (no new visual pattern — see §6).
**Non-goal:** any backend change. Both failure reasons already exist in data today.

---

## 1. Problem statement

Two independent places in `app/app/analyses` compute or receive an error string and then throw it
away. Nothing about the underlying data needs to change; this is purely a rendering gap.

| # | Where | What is dropped |
|---|---|---|
| #285 | `UrlChipInput.tsx` — `handleKeyDown`, `handlePaste` | `validateUrl(url)`'s return value. The result is read only inside `if (!error)`, so lint never flags it. Input is cleared regardless, so the user's text is gone too. |
| #289 | `AnalysesContent.tsx` L107–118 | `result.failedUrls[].error` — the server's per-URL reason (e.g. `"Content not found — it may be deleted or the URL is wrong."`). Client renders only a count. |

### Verified current behaviour (read from source, not assumed)

`app/app/analyses/components/chips/UrlChipInput/helpers.ts`:

```ts
export const URL_REGEX =
  /^https?:\/\/(www\.)?(instagram\.com\/(reel|p)\/[\w-]+|youtube\.com\/shorts\/[\w-]+)/i;

export function validateUrl(url: string): string | null {
  if (!URL_REGEX.test(url.trim())) {
    return "Must be an Instagram Reel/Post or YouTube Short URL";
  }
  return null;
}
```

`app/api/analyze/route.ts` (the producer — unchanged by this work):

```ts
failedUrls.push({ url, index, error: error instanceof Error ? error.message : "Analysis failed." });
...
return NextResponse.json({ analysisIds, analysesCreated: analysisIds.length, failedUrls });
```

`lib/api/analyses/types.ts:466` already types it exactly:
`failedUrls: { url: string; index: number; error: string }[]`.

So the response shape is confirmed from our own route handler — no external-API verification is
needed for this work (`.claude/context/verified-facts.md` is not in play here).

### Note on the existing chip error channel

`UrlChip` has an optional `error` field and `UrlChipInput` has an `onDismissError` prop with a 3s
auto-dismiss `useEffect`. **That channel is per-chip, and it is currently dead**: `NewAnalysisModal`
never constructs a chip with `error`, and never passes `onDismissError`. #285 is an *input-level*
failure — the URL never becomes a chip at all — so it cannot reuse the per-chip channel without
inventing "ghost chips" for invalid input, which is worse UX (a chip implies "accepted"). We
therefore add an input-level error, exactly as #285's own "Suggested fix direction" prescribes. The
per-chip channel is left untouched and still unused; killing it is out of scope (see §7).

---

## 2. Architectural pattern

Existing pattern in this feature area, which we follow:

- `lib/api/analyses/api.ts` — raw fetch, no transformation.
- `lib/api/analyses/hooks.ts` — TanStack Query hooks; **all data transformation happens here**
  (AGENTS.md data-transformation rule).
- `lib/api/analyses/helpers.ts` — pure transform functions called by the hooks (e.g.
  `isUntrustedYoutubeMetadataOnly`, precedent from #294).
- `app/app/analyses/components/**` — presentation only; formatting (colour, truncation, pluralising)
  allowed, parsing/reshaping not.

Consequences for this TDD:

- **#289 transformation belongs in the hook, not in `AnalysesContent`.** `useAnalyzeContentMutation`
  is a `useMutation`, which has no `select`. The equivalent seam is the `mutationFn`: `await` the
  raw response and return an already-shaped `AnalyzeOutcome`. `AnalysesContent.onSuccess` then
  consumes a finished object and does zero reshaping.
- **#285 has no server data at all** — `inputError` is component-local UI state (the same class as
  `collapsed` in `AnalysisProgressPanel`). Local `useState` inside `UrlChipInput` is correct; the
  transformation rule does not apply.
- Module conventions: `UrlChipInput` and `AnalysisProgressPanel` are already conforming module
  directories. New pure functions go in each module's own `helpers.ts`, new strings in
  `constants.ts`, new prop/state types in `types.ts`.

---

## 3. Tech risks / edge cases

1. **Uncontrolled → controlled input.** `UrlChipInput`'s `<input>` is uncontrolled today
   (`e.currentTarget.value = ""`). "Do not clear the field on invalid input" plus "put un-added
   pasted URLs back in the field" both require React to own the value. Making it controlled is a
   small, contained refactor but it *is* a behaviour change to focus/caret handling — worth an
   explicit test. Low risk: single input, no form library.
2. **Paste is partially successful.** 5 URLs, 3 invalid → the current loop adds 2 and silently drops
   3. We must add the 2 *and* report the 3. Do not make paste all-or-nothing; that would regress the
   working case.
3. **`aria-live` churn.** Putting the live region inside a node that mounts/unmounts kills the
   announcement in some screen readers. The region must be **always mounted** and only its *text*
   changes. Same rule applies to the progress panel's failure list.
4. **Existing `maxChips` hole (out of scope, do not fix here).** `handlePaste` calls `onAdd` in a
   loop with no capacity check, so pasting 20 URLs creates 20 chips even though `maxChips = 10`.
   This is a pre-existing bug unrelated to error surfacing. Flagged in §7, not ticketed here.
5. **Toast length.** Batch is capped at 10 URLs, so a failure list cannot be unbounded — but 10 full
   sentences in a Sonner toast is unreadable. Toast shows reasons only for small batches; the panel
   is the full record. Thresholds in §4.3.
6. **Duplicate reasons.** A batch of 5 dead links yields 5 identical error strings. Acceptable for
   v1 — each line is keyed to its own URL, which is precisely what #289 asks for ("the user cannot
   tell *which* two failed"). Do not de-duplicate.

---

## 4. Design

### 4.1 #285 — input-level validation error in `UrlChipInput`

**State (local to `UrlChipInput`):**

```ts
const [value, setValue] = useState("");        // input becomes controlled
const [inputError, setInputError] = useState<string | null>(null);
```

**Behaviour table:**

| Action | Chips | Input value | `inputError` |
|---|---|---|---|
| Enter, empty/whitespace-only | unchanged | unchanged | `null` (no-op, no error — an empty submit is not a mistake worth shouting about) |
| Enter, valid URL | +1 chip | cleared | `null` |
| Enter, invalid URL | unchanged | **kept**, so the user can correct it | `validateUrl(...)` result |
| Typing (`onChange`) | unchanged | updated | cleared to `null` |
| Paste, all valid | +N chips | cleared | `null` |
| Paste, all invalid | unchanged | rejected URLs, space-joined | summary message (below) |
| Paste, mixed | +valid only | rejected URLs, space-joined | summary message |

**Paste summary message** (new constant in the module's `constants.ts`):

- exactly 1 rejected: reuse `validateUrl`'s message verbatim —
  `"Must be an Instagram Reel/Post or YouTube Short URL"`.
- more than 1 rejected: `` `${n} URLs were not added — must be an Instagram Reel/Post or YouTube Short URL` ``.

Keeping the single-URL wording identical to the Enter path means #285's stated acceptance string
("the message the code already computes") is satisfied on both paths.

**New pure helper** in `.../UrlChipInput/helpers.ts` — this is the testable core, kept out of the
component:

```ts
export type PasteResult = { accepted: string[]; rejected: string[] };
export function partitionPastedUrls(text: string): PasteResult;
```

Implemented as `splitPastedUrls(text)` then partition on `validateUrl(u) === null`. `splitPastedUrls`
and `validateUrl` are unchanged.

**Rendering** — added as a sibling under the `<input>`, always mounted:

```tsx
<p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-destructive">
  {inputError ?? ""}
</p>
```

- `role="status"` + `aria-live="polite"`: announced without stealing focus. Not `role="alert"` — a
  typo while typing is not an interruption-worthy event, and the message is adjacent to the field.
- `min-h-[1rem]` reserves the line so the dialog does not jump when the message appears.
- `text-destructive` is the same semantic token `Chip.tsx` already uses for its error state — no new
  colour, no new token, so the existing contrast suite (`tests/helpers/contrast.ts`) still covers it.
- The `<input>` gets `aria-invalid={!!inputError}` and `aria-describedby` pointing at the message id
  (use `useId()`), so the reason is read out when the field regains focus.

**No auto-dismiss.** The per-chip channel's 3s timer is deliberately *not* copied to the input error:
3 seconds is below the WCAG 2.2.1 threshold for user-adjustable timed content, and the message must
stay visible while the user edits the URL it refers to. It clears on the next keystroke instead.

**`maxChips` interaction:** when `isFull`, the `<input>` is unmounted today and replaced by the
"Maximum N URLs reached" line. The error paragraph moves *outside* the `!isFull` branch so it stays
mounted (risk 3) — but it is rendered as empty text in that state.

### 4.2 #289 — per-URL failure reasons, transformed in the hook

**New types** in `lib/api/analyses/types.ts` (next to `AnalyzeResponse`):

```ts
/** One failed URL, normalised for display. Ticket #289. */
export type AnalyzeFailure = {
  url: string;
  /** The server's own reason from `AnalyzeResponse.failedUrls[].error`, never a generic stand-in. */
  reason: string;
};

/** `AnalyzeResponse` after hook-layer transformation. Ticket #289. */
export type AnalyzeOutcome = {
  analysisIds: string[];
  created: number;
  /** Number of URLs submitted — the denominator the progress panel shows. */
  requested: number;
  failures: AnalyzeFailure[];
};
```

**New pure helper** in `lib/api/analyses/helpers.ts`:

```ts
export function toAnalyzeOutcome(response: AnalyzeResponse, requestedUrls: string[]): AnalyzeOutcome;
```

Rules it must implement:

1. `created = response.analysesCreated`, `requested = requestedUrls.length`.
2. `failures = response.failedUrls.map(f => ({ url: f.url, reason: f.error?.trim() || FALLBACK }))`
   where `FALLBACK = "Analysis failed."` — only ever used if the server sends an empty string.
   Never overwrite a non-empty server reason.
3. **Reconciliation guard:** if `created + response.failedUrls.length < requested`, some URL neither
   succeeded nor was reported as failed. Append one synthetic failure per unaccounted URL (matched by
   position against `requestedUrls`, using `failedUrls[].index` and `analysisIds.length` to work out
   which) with reason `"No result was returned for this URL."`. This is why the helper takes
   `requestedUrls` at all — without it the panel can still render "0/1 processed" with an empty
   reason list, which is the exact dead end #289 is about.
4. Pure, no `Date`, no I/O — unit-testable in isolation.

**Hook change** (`lib/api/analyses/hooks.ts`):

```ts
export function useAnalyzeContentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ urls, prompt }: { urls: string[]; prompt: string }) =>
      toAnalyzeOutcome(await analyzeContent(urls, prompt), urls),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.lists() }); },
  });
}
```

`lib/api/analyses/api.ts` is **not** touched (API layer returns data as-is).

### 4.3 #289 — rendering

**`ProgressState` gains one optional field** (`.../progress/AnalysisProgressPanel/types.ts`):

```ts
export interface ProgressState {
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
  /** Ticket #289 — per-URL server reasons. Empty/absent on the happy path. */
  failures?: AnalyzeFailure[];
}
```

Optional, so every existing `setProgress` call site (the `"classifying"` kick-off, the `onError`
spread) keeps compiling unchanged.

**`AnalysisProgressPanel`** renders, inside the existing `{!collapsed && ...}` block, directly under
the `{current}/{total} URLs processed` line:

```tsx
<div aria-live="polite">
  {failures.length > 0 && (
    <ul className="mt-2 space-y-1">
      {failures.map((f, i) => (
        <li key={`${f.url}-${i}`} className="text-xs">
          <span className="text-muted-foreground">{formatFailedUrl(f.url)}</span>
          {" — "}
          <span className="text-destructive">{f.reason}</span>
        </li>
      ))}
    </ul>
  )}
</div>
```

- The wrapper `div` is always mounted (risk 3); only the `<ul>` inside it toggles.
- `formatFailedUrl` — **new pure helper** in the panel's own `helpers.ts` (presentation formatting in
  the UI layer, which the AGENTS.md rule explicitly allows). Returns `host + pathname` truncated to
  60 chars; falls back to the raw string if `new URL()` throws. Deliberately a separate function from
  `UrlChipInput`'s `shortenUrl` (which returns pathname only) — a bare `/shorts/xyz` with no host is
  ambiguous in a failure list. Do not import across component modules.
- Failures are shown for **both** `step === "error"` (0 created) and `step === "complete"` with
  partial failures. The panel already renders when collapsed=false by default.
- No cap / "+N more": the batch is capped at 10 URLs upstream, so the list is bounded by design.

**`AnalysesContent.handleAnalyze` `onSuccess`** — now consuming `AnalyzeOutcome` (`result.created`,
`result.failures`), no reshaping:

- `created === 0`:
  - `setProgress({ step: "error", current: 0, total: result.requested, message: "No analyses were created", failures: result.failures })`
  - toast: `toast.error("Analysis failed", { description: buildFailureSummary(result.failures) })`
- `created > 0`:
  - `setProgress({ step: "complete", current: result.created, total: result.requested, message: \`Analysis complete — ${result.created} analyses created\`, failures: result.failures })`
  - toast: `toast.success(...)` with description = created count, plus
    `buildFailureSummary(result.failures)` appended when there are failures.

**`buildFailureSummary(failures)`** — new pure helper in
`app/app/analyses/components/AnalysesContent/helpers.ts` (new file; the module currently has only
`AnalysesContent.tsx` + `index.tsx`):

- `0` failures → `""` (caller omits the clause).
- `1` failure → the reason itself, verbatim: `"Content not found — it may be deleted or the URL is wrong."`
- `2–3` failures → reasons joined with `" · "`, each truncated to 80 chars.
- `4+` failures → `` `${n} URLs failed — see the progress panel for details` ``.

This is #289's "surface it in the toast when the batch is small" acceptance, made concrete.

`onError` (network/500 path) is unchanged apart from passing `failures: []`.

### 4.4 Stale comments (cleanup, no behaviour change)

Three comment sites still say the metadata-only fallback is caused by `yt-dlp` being bot-blocked.
Ticket #295 removed `yt-dlp` from the YouTube path entirely (`lib/server/analysis/fetcher/router.ts`
and `lib/server/analysis/pipeline/index.ts` both document this) — Gemini now fetches the video
server-side from a bare `fileData.fileUri`, so our egress IP being blocked is irrelevant.

The accurate cause today: `metadata_only` is the pipeline's **conservative default** analysis mode,
written before the Gemini call and upgraded to `full_video` only once `hasVideoModalityEvidence()`
confirms Gemini actually consumed the video. A row stays `metadata_only` when that evidence never
arrived (or the process died mid-flight). Rows that predate #295 are the historical yt-dlp cases.

Sites (line numbers as of `4da13f5`; re-locate by text, code has moved before):

- `lib/api/analyses/types.ts:438` — `"(yt-dlp bot-blocked)"`
- `lib/api/analyses/helpers.ts:522-523` — `` `yt-dlp` is bot-blocked from the production server (#288) ``
- `app/app/analyses/components/sections/UntrustedAnalysisWarningSection/UntrustedAnalysisWarningSection.tsx:11`
  — `` `yt-dlp` is bot-blocked from the production server, so some stored YouTube analyses... ``

Comment text only. No logic, no exports, no test changes.

---

## 5. File tree changes

```
app/app/analyses/components/
├── chips/UrlChipInput/
│   ├── UrlChipInput.tsx                     (MODIFY — controlled input, inputError state, live region)
│   ├── helpers.ts                           (MODIFY — add partitionPastedUrls)
│   ├── types.ts                             (MODIFY — add PasteResult)
│   ├── constants.ts                         (CREATE — paste summary message builder inputs)
│   └── index.tsx                            (MODIFY — export new helper/type if used externally)
├── AnalysesContent/
│   ├── AnalysesContent.tsx                  (MODIFY — consume AnalyzeOutcome, pass failures)
│   ├── helpers.ts                           (CREATE — buildFailureSummary)
│   └── constants.ts                         (CREATE — toast thresholds/strings)
├── progress/AnalysisProgressPanel/
│   ├── AnalysisProgressPanel.tsx            (MODIFY — render failure list)
│   ├── types.ts                             (MODIFY — ProgressState.failures?)
│   └── helpers.ts                           (CREATE — formatFailedUrl)
└── sections/UntrustedAnalysisWarningSection/
    └── UntrustedAnalysisWarningSection.tsx  (MODIFY — comment only)

lib/api/analyses/
├── types.ts                                 (MODIFY — AnalyzeFailure, AnalyzeOutcome; + comment fix)
├── helpers.ts                               (MODIFY — toAnalyzeOutcome; + comment fix)
├── hooks.ts                                 (MODIFY — mutationFn returns AnalyzeOutcome)
└── api.ts                                   (UNCHANGED — API layer stays raw)

tests/
├── app/app/analyses/components/chips/UrlChipInput/UrlChipInput.dom.test.tsx          (CREATE)
├── app/app/analyses/components/progress/AnalysisProgressPanel/Failures.dom.test.tsx  (CREATE)
├── app/app/analyses/components/AnalysesContent/AnalysesContent.dom.test.tsx          (MODIFY)
└── lib/api/analyses/toAnalyzeOutcome.test.ts                                          (CREATE)
```

No backend files. No migrations. No env vars. No new dependencies.

---

## 6. UI/UX check — is a new pattern needed?

No, and this was checked deliberately before writing the tickets:

- The inline field error is a `<p>` using `text-destructive`, the same semantic token `Chip.tsx`
  already uses. Standard form feedback, not a new component.
- The failure list reuses the progress panel's existing expanded region and its existing
  `text-xs text-muted-foreground` typography.
- Toasts use the existing Sonner `toast.error` / `toast.success` calls — only the `description`
  string changes.

Nothing here invents a new visual pattern, so no design-spec round trip is required. If a reviewer
wants a distinct "partial failure" panel state (e.g. amber rather than green when
`created > 0 && failures.length > 0`), that is a design decision and must go back to Jessica — it is
**not** in these tickets.

---

## 7. Known gaps deliberately left open

1. `handlePaste` ignores `maxChips` — pasting more than 10 URLs creates more than 10 chips.
   Pre-existing, unrelated to error surfacing. **Ticketed: [#322](https://github.com/jordanjordann/my-content/issues/322)** — must land after T1 (#318), which rewrites the same function.
2. The per-chip `error` / `onDismissError` channel remains dead code after this work.
   **Ticketed: [#323](https://github.com/jordanjordann/my-content/issues/323)** — must land after T1 (#318), which replaces it with a component-level `inputError` live region.
   Checked `tests/app/app/analyses/deadCode.dom.test.tsx`: it is scoped to ticket #149
   (`AnalysisGrid`/`AnalysisCard`) and does **not** reference the chip error channel, so it does not
   break — but it is the right home for the new "stays deleted" assertion.
3. `failedUrls[].index` is carried by the server but unused by the client after this work; the
   reconciliation guard (§4.2 rule 3) is the only consumer.

---

## 8. Implementation order

1. **T1 (#285)** — `UrlChipInput`. Fully independent, no shared files.
2. **T2 (#289a)** — data layer: `types.ts` + `helpers.ts` + `hooks.ts`. Blocks T3.
3. **T3 (#289b)** — rendering: `AnalysesContent` + `AnalysisProgressPanel`. Depends on T2.
4. **T4** — stale comments. Independent, but touches `lib/api/analyses/types.ts` and `helpers.ts`,
   which T2 also touches — land T4 **after** T2 to avoid a pointless conflict, or fold it into T2's
   PR if the same dev takes both.

T1 can run fully in parallel with T2. T2→T3 is strictly sequential (T3 consumes T2's `AnalyzeOutcome`
type).
