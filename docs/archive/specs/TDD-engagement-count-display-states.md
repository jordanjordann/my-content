# TDD — Engagement Count Display States

**Status:** Ready for dev handoff (with one raised blocker — see §2)
**Author:** John (tech lead)
**Created:** 2026-07-25
**Source of truth:** `docs/archive/specs/PRD-engagement-count-display-states.md` (four states + treatments owner-settled, §3) and `docs/archive/specs/DESIGN-engagement-count-display-states.md` (presentation, owner-confirmed 2026-07-25, PR #98). GitHub #96.
**Dependencies referenced:** migration 009 (`play_count`, `like_count`, `like_and_view_counts_disabled` DB columns — merged, PR #95/#71), ticket #70 tooltip pattern (`DimensionScoreRow`).

Reading conventions:

- **[PRD]** / **[DESIGN]** — settled upstream. Do not relitigate.
- **[TL]** — a technical decision made in this document within the latitude the PRD/design grant. Build to it; if it proves wrong, raise it, do not silently deviate.
- **[RAISED]** — a blocker/gap I found that invalidates a stated assumption. Flagged to the owner; see §2.

---

## 1. Summary

Display-layer feature: render four distinct engagement-count states (Hidden / "0" / "—" / plays-labelled-as-plays) consistently for **views and likes** across three surfaces — analyses table, cards, detail modal. State classification is done **once** in the query-hook `select` layer (per `AGENTS.md`); components receive an already-classified discriminated union and only do presentation.

The four states, the "plays" treatment (Direction A quiet inline suffix), info-blue icon, English tooltip copy, abbreviated numbers, and non-numeric-sorts-to-bottom are all owner-settled — see the PRD/design docs. This TDD is the technical mapping only.

---

## 2. [RAISED] Blocker — the persisted columns are not surfaced through the read path

The PRD/ticket state this is **frontend-only** because `play_count`, `like_count`, and `like_and_view_counts_disabled` are "already persisted." That is true at the **DB + write** layer (migration 009 adds the columns; `lib/server/analysis/pipeline/index.ts` and `.../fetcher/adapter.ts` populate them). **But the read path does not expose them to the frontend.** Verified on `main`:

- `lib/server/db.ts` — `getAnalysesList()` (list) and `getAnalysisDetail()` (detail) SELECT and map **`view_count` only**. Neither selects `play_count`, `like_count`, or `like_and_view_counts_disabled`.
- `app/api/analyses/route.ts` and `app/api/analyses/[id]/route.ts` — response objects carry `viewCount` only.
- `lib/api/analyses/types.ts` — `AnalysisListItem` and `AnalysisDetail` have `viewCount: number | null` and **no** `playCount`, `likeCount`, or `likeAndViewCountsDisabled`.

**Consequence:** States 1 (Hidden, needs `likeAndViewCountsDisabled`) and 4 (plays, needs `playCount`) cannot be classified, and **likes cannot be displayed at all** (there is no `likeCount` on the client), without first widening the read path. This is server-side plumbing (`db.ts` + API routes) plus a shared type change — it crosses the "frontend-only" boundary the PRD assumed.

Per my mandate I am **not** silently absorbing this into a FE ticket. It is a discrete prerequisite, captured as **Ticket T0 [BE]** below and flagged to the owner. It is small (surfacing three already-persisted columns, no new schema, no new fetching), but it is a hard blocker for T1–T3.

`like_and_view_counts_disabled` is stored `0/1/NULL`; convert to boolean with the repo's existing `toNullableBoolean` convention (`lib/server/profiles/repository.ts`) so `null` ("unknown") is preserved, never coerced to `false`.

---

## 3. Additional scope finding (not a blocker, but affects sizing)

The PRD frames this as fixing counts "shown in the list/table, cards, and detail modal." In reality, on `main` today:

- **Detail modal** (`AnalysisDetailModal.tsx` ~L195) is the **only** surface that renders a count today: `{formatViews(data.viewCount)} views`, gated on `viewCount != null`. No likes.
- **Table** (`AnalysisDataTable.tsx`) has **no Views or Likes column at all** (columns: Thumb, Platform, Title, Score, + 7 dimensions, Actions). It is **not sortable** (no sort state/handlers; headers are plain `<TableHead>`).
- **Cards** (`AnalysisCard.tsx`) render **no counts at all** (prompt, date, mediaType, platform badge, status, score only).

So for table and cards this feature **adds new count UI** (columns / a metric row) as specified in design §5.1–5.2 — it is not merely re-styling an existing number. This is within the approved design (the mockup shows these columns/rows), but implementers should size it as new UI, not a tweak.

**[TL] Sorting is forward-looking.** The design's "non-numeric states sort to the bottom" (§5.1) presupposes a sortable count column. The table is **not sortable today**, and adding sorting is out of scope for this feature. Implement **right-alignment** of the count columns now (cheap, correct, matches design), and record the sort-to-bottom rule as a spec note for whoever adds column sorting later. Do **not** build a sort mechanism as part of this feature. Confirmed acceptable given the owner's decision was about *how* non-numeric values sort *if* sorting exists.

---

## 4. State-derivation layer (the core [TL] design)

Per `AGENTS.md` + PRD §5, classification is data transformation and lives in the query-hook `select`, not in components. Components must never branch on raw `viewCount`/`playCount`/`likeAndViewCountsDisabled`.

### 4.1 The classified shape — a discriminated union

Add to `lib/api/analyses/types.ts`:

```ts
export type CountState =
  | { kind: "hidden" }                          // State 1 — creator disabled counts
  | { kind: "zero" }                            // State 2 — genuine measured 0
  | { kind: "unknown" }                         // State 3 — null / never fetched
  | { kind: "count"; value: number }            // normal non-zero value (views or likes)
  | { kind: "plays"; value: number };           // State 4 — views==0 but play_count>0 (Reels-only, structural)
```

`plays` is a distinct `kind` from `count` so the component renders the mandatory inline "plays" label without re-deriving anything (design §2, §4). Likes can only ever be `hidden | zero | unknown | count` — the `plays` kind is unreachable for likes, which is correct.

### 4.2 The classifier — a pure helper

Add to `lib/api/analyses/helpers.ts` (pure, unit-testable):

```ts
export function classifyViewCount(input: {
  viewCount: number | null;
  playCount: number | null;
  likeAndViewCountsDisabled: boolean | null;
}): CountState {
  if (input.likeAndViewCountsDisabled === true) return { kind: "hidden" };
  // State 4 — REVISED 2026-07-28 (decision D1, §8): `viewCount == null` is
  // admitted here alongside `viewCount === 0`. See §8/D1 for why.
  if (
    (input.viewCount === 0 || input.viewCount == null) &&
    input.playCount != null &&
    input.playCount > 0
  )
    return { kind: "plays", value: input.playCount };      // State 4
  if (input.viewCount === 0) return { kind: "zero" };
  if (input.viewCount == null) return { kind: "unknown" };
  return { kind: "count", value: input.viewCount };
}

export function classifyLikeCount(input: {
  likeCount: number | null;
  likeAndViewCountsDisabled: boolean | null;
}): CountState {
  if (input.likeAndViewCountsDisabled === true) return { kind: "hidden" };
  if (input.likeCount == null) return { kind: "unknown" };
  if (input.likeCount === 0) return { kind: "zero" };
  return { kind: "count", value: input.likeCount };
}
```

**Ordering rationale (do not reorder):** `hidden` wins first (the flag overrides everything). State 4 is checked before `zero`/`unknown` so a false-zero **or absent** view with real plays becomes `plays`, never `0` and never `—`. Carousels need no special-casing: `playCount` is structurally `null` on carousel children (design §8), so the State-4 branch simply cannot fire for them — they fall through to `zero` or `unknown` for free. Do not branch on `mediaType`.

### 4.3 Wiring into `select`

`lib/api/analyses/hooks.ts` already transforms in `select`:

- `selectIndexedAnalyses` (list): for each analysis, attach `viewCountState` and `likeCountState` (both `CountState`) to the indexed item. Extend `AnalysisListItemIndexed` with these two fields.
- `selectProxiedAnalysisDetail` (detail): attach `viewCountState` and `likeCountState` to the returned `AnalysisDetail` (or a `…Classified` extension type — implementer's call, keep it typed).

Because classification lives in `select`, all three surfaces consume the identical derived value and cannot drift (satisfies US-05 by construction). Components read `analysis.viewCountState` / `analysis.likeCountState` only.

---

## 5. Presentation layer

### 5.1 Shared presentational component — one source of visual truth

**[TL]** Create a single reusable presentational module consumed by all three surfaces, so the four treatments are defined once. Proposed location and module (per `AGENTS.md` module conventions):

```
app/app/analyses/components/counts/EngagementCount/
├── index.tsx                 # barrel
├── EngagementCount.tsx       # renders a CountState -> the correct treatment
├── types.ts                  # EngagementCountProps { state: CountState; metric: "views" | "likes"; ... }
├── constants.ts              # tooltip copy, info-blue class token
├── helpers.ts                # formatAbbrev(n) -> "116.3K" (moved/shared from modal helpers)
└── components/
    └── CountInfoTooltip.tsx  # info-blue tooltip trigger, reusing the #70 mechanism
```

Rendering rules by `state.kind` (design §2):

| kind | render | notes |
|---|---|---|
| `hidden` | `Hidden` + info-blue circled-`i` trigger | muted text (slate-500); tooltip on hover **and** focus |
| `zero` | `0` | full-strength text (not muted) — it is real data |
| `unknown` | `—` (em dash) | muted (slate-400), no icon, no tooltip |
| `count` | `formatAbbrev(value)` | + metric word where the surface shows one ("views"/"likes") |
| `plays` | `formatAbbrev(value)` + inline muted `plays` | **"plays" is always-visible text, never tooltip-only** (design §4, PRD §6 risk). Never render "0 views". |

`metric` prop drives the surrounding label word and the tooltip's accessible name ("Why is the view count hidden?" vs "…like count…"), design §7. The single tooltip **copy** string is the same for views and likes (design §3).

### 5.2 Number formatting

An abbreviation helper already exists: `formatViews` in `.../AnalysisDetailModal/helpers.ts` (`>=1M -> "x.xM"`, `>=1k -> "x.xK"`, else `toLocaleString()`). **[TL]** Promote this to the shared `EngagementCount/helpers.ts` as `formatAbbrev` and have the modal import it, rather than duplicating. It already produces the design's "116.3K" form.

### 5.3 Tooltip — reuse the #70 mechanism, rendered info-blue

Design §2/§6/§7 and PRD §5 mandate reusing the `DimensionScoreRow` (#70) tooltip **mechanism**, not inventing a new one. That component is coupled to scorecard props, so the mechanism should be **replicated in `CountInfoTooltip`** using the identical, proven a11y pattern (verified in `DimensionScoreRow.tsx`):

- trigger is a real focusable `<button type="button">` with `aria-describedby={open ? id : undefined}` (use `useId()`),
- opens on `onMouseEnter`/`onFocus`, closes on `onMouseLeave`/`onBlur` and `Escape`,
- tooltip is a `<div role="tooltip" id={id}>` — **not** a native `title` attribute (native `title` is not reliably keyboard/SR reachable — #70's own note),
- **divergence from #70 (design-approved):** #70's trigger uses `text-muted-foreground`; here the icon is **info-blue** and rendered as a standalone info affordance (more prominent, per design §2). Info-blue is verified non-conflicting with the app's error(red)/warning(amber) grammar in `app/app/analyses/`.

Tooltip copy (English, design §3): _"The creator turned off view and like counts on this post. This is a creator setting — not zero, and not missing data."_ Owner may swap for the shorter fallback in design §3; keep it in `constants.ts` as a single source.

Tooltip positioning: default above/right, flip near a viewport/container edge (top table rows, top of cards) — design §6. **[TL] REVISED 2026-07-28 (decision D2, §8):** hand-rolled `absolute right-0 top-full` is acceptable for T1 (component not mounted anywhere yet) but **must not survive into the table**. `components/ui/table.tsx` wraps every table in `<div className="relative w-full overflow-auto">`, so an absolutely-positioned popup inside a `<TableCell>` is clipped/scroll-jailed by that ancestor — this is a containment bug, not just a missing flip. Fix it **once, in the shared `CountInfoTooltip`**, by rendering through the repo's existing Base UI popover primitive (`components/ui/popover.tsx`, `@base-ui/react/popover` — `Portal` escapes the overflow ancestor and `Positioner` does collision-aware side/align flipping natively). **Owned by T3 (#103); T2 (#102) inherits it and only verifies.** Do not implement edge detection by hand and do not duplicate the logic per surface.

### 5.4 Surface wiring

- **Detail modal** (`AnalysisDetailModal.tsx` ~L194–203): replace the `viewCount != null && …{formatViews} views` block with `<EngagementCount metric="views" state={viewCountState} />`; add a sibling `<EngagementCount metric="likes" state={likeCountState} />` line with the ❤️ glyph. Stacked full-word lines per design §5.3.
- **Cards** (`AnalysisCard.tsx`): add a metric row (design §5.2) with 👁 views/plays and ❤️ likes, each an `EngagementCount`. Compact form (icon + value, metric word optional).
- **Table** (`AnalysisDataTable.tsx`): add a **Views** column and a **Likes** column (design §5.1), each a `<TableHead className="text-right">` / right-aligned `<TableCell>` rendering `EngagementCount`. State 1/3 stay right-aligned in-column. **No sorting** (see §3).

---

## 6. Testing

- **Unit (helpers):** table-driven tests for `classifyViewCount` / `classifyLikeCount` covering all branches: disabled→hidden (views & likes); `view=0,play>0`→plays; `view=0,play=null`→zero; `view=0,play=0`→zero; `view=null`→unknown; `view=5`→count; likes null→unknown, 0→zero, 42→count; and disabled overriding a present count. Confirms State 4 cannot fire for carousels (`play=null`).
- **Component:** `EngagementCount` renders the correct glyph/label/icon per `kind`; `plays` shows the inline "plays" word; `hidden` exposes a focusable `role="tooltip"` reachable by keyboard and dismissible on `Escape`; `zero` is full-strength, `unknown` is muted "—".
- **Integration/QA (manual):** one fixture row per state on each of the three surfaces; verify no surface shows a bare `0` for hidden/unknown/false-zero; greyscale check (WCAG 1.4.1); verify likes switch to Hidden under the disabled flag.
- **[TL] ADDED 2026-07-28 — mandatory on-surface visual QA (decision D3, §8).** Automated tooling cannot catch this class of defect: jsdom does not compute colour or contrast, so testing-library assertions pass on unreadable output. #101 review found light-mode slate values shipped into an app hard-locked to dark mode (~1.9:1 on the primary number, and the prominence hierarchy **inverted** — `unknown` louder than a real `zero`). Root cause: the approved mockup was authored on a white page, so design §2's slate values are **mockup-surface** values, not app-surface values. Therefore T2 and T3 each carry a blocking AC: render all four states on the **real running app** (dark surface), against **both `--background` and `--card`**, take a greyscale pass (WCAG 1.4.1 — state must not be conveyed by hue alone), measure contrast with a real tool, require **≥4.5:1** for every count value and label, confirm `zero` reads at least as prominent as `unknown`, and attach the measured numbers + screenshots to the ticket. Reviewer-visible evidence, not a self-certified checkbox.

---

## 7. Ticket map

| Ticket | Type | Depends on | Scope |
|---|---|---|---|
| T0 | [BE] | — (blocker for all) | Surface `playCount`/`likeCount`/`likeAndViewCountsDisabled` through `db.ts` reads, API routes, and FE types |
| T1 | [FE] | T0 | `CountState` union + classifier helpers + wire into `select` (list & detail) + `EngagementCount` component (+ `CountInfoTooltip`) |
| T2 | [FE] | T1 | Wire detail modal + cards |
| T3 | [FE] | T1 | Wire table (add Views/Likes columns, right-aligned; no sorting) |

T2 and T3 are independent of each other and can run in parallel once T1 lands.

**Sequencing hazard (recorded 2026-07-28):** T2 is **not** deprioritisable. Since #100 (T0) merged, `AnalysisDetailModal.tsx` (~L195–202) still renders the raw `{data.viewCount != null && … {formatAbbrev(data.viewCount)} views}` block, so a reel arriving as `viewCount: 0, playCount: 116333` now displays **"0 views"** to the user — the exact defect epic #96 exists to fix. T1 (#101) does not introduce this and correctly leaves the modal unwired, but the live surface stays wrong until T2 lands. Ship T2 immediately behind T1.

---

## 8. Decision log — questions escalated from the #101 review (2026-07-28)

### D1 — `viewCount === null` alongside a real `playCount` (review finding N9): **widen State 4**

The original §4.2 required `viewCount === 0` exactly, so `viewCount: null, playCount: 116333` classified as `unknown` and rendered `—` while a real, usable number sat in the payload. The implementation on #101 matched the TDD exactly; the TDD was wrong. Widened to `(viewCount === 0 || viewCount == null) && playCount > 0`.

**Is the state reachable? Evidence, with confidence stated rather than blurred.**

There are exactly two code paths that produce `viewCount == null` in `lib/server/analysis/fetcher/adapter.ts` (~L251–252):

```
const viewCount = countsDisabled ? null : (firstVideoPart?.viewCount ?? null);
const playCount = firstVideoPart?.playCount ?? null;   // NOT gated on countsDisabled
```

1. **`countsDisabled === true`.** `viewCount` is forced to `null` while `playCount` passes through ungated, so `{viewCount: null, playCount: > 0}` genuinely occurs. This one is **harmless by structural guarantee**: the same expression `raw.like_and_view_counts_disabled === true` that nulls `viewCount` also sets `likeAndViewCountsDisabled: true` in the same returned object, and `hidden` is checked first in the classifier. The user sees "Hidden", correctly. No change needed for this path.
2. **`firstVideoPart.viewCount === null` with counts enabled.** `resolveCounts()` (`lib/server/analysis/media/resolveMediaParts.ts` ~L38–39) sets `viewCount = num(node.video_view_count)`, and `num()` returns `null` for an absent, non-numeric or non-finite value. On the wire type, `video_view_count?: number` is **optional** (`lib/server/scrapecreators/types.ts` L112/L137) while `video_play_count` is a separate optional field. Nothing in the adapter, the resolver, or the type couples their presence. So a reel node that omits `video_view_count` but carries `video_play_count: 116333` produces `{viewCount: null, playCount: 116333}` with `likeAndViewCountsDisabled` falsy — and the un-widened classifier rendered `—`.

**Confidence, explicitly:** path 2 is **not unreachable-by-construction — it is merely unobserved.** All three committed reel fixtures (`.claude/context/fixtures/scrapecreators-instagram/ig_reel_{1_zero_view_count,2,3}.json`) happen to carry a numeric `video_view_count`, so we have *no counterexample*, which is a far weaker claim than a *guarantee*. The binding is optional at the type level and the adapter has no invariant enforcing it. Absence of a counterexample in three fixtures is not a structural guarantee, and the TDD will not pretend otherwise. Settled from committed fixtures + source only; no live API call was made.

**Why widening is safe (it cannot create a false "plays"):** the branch only fires when `playCount > 0`. `playCount` is `null` by structure for carousel children (verified-facts: `video_play_count` is present-but-always-`null` on all 7 carousel video children — the reel/carousel semantics invert by type and must never be merged into one field), and the YouTube fetcher (`fetcher/youtube.ts` L118) sets `viewCount` only and never populates `playCount`. So the widened arm is reachable only for the exact case it is meant to serve: an Instagram reel with a real play count and no trustworthy view count. The reel-vs-carousel field inversion is preserved untouched.

**Related observation, not in scope here:** the adapter's own `displayedCountIsPlayCount` (resolveMediaParts ~L48) uses the same narrow `viewCount === 0` test, so the server-side prompt fallback (`prompts/user.ts` L19) has the identical blind spot. Display is fixed by D1; the prompt-side equivalent is a separate, lower-stakes call and is **not** being folded in silently.

### D2 — tooltip edge-flip (review finding N3): **required, owned by T3 (#103)**

`CountInfoTooltip`'s hard-coded `absolute right-0 top-full` is a faithful copy of #70 and is fine for #101, where the component is mounted on no surface. It must not survive into the table. See §5.3: the problem on the table is not aesthetic — `components/ui/table.tsx` renders `<div className="relative w-full overflow-auto">` around every table, which clips and scroll-jails an absolutely-positioned popup in a `<TableCell>`. The fix is a component-level swap to the existing Base UI popover primitive (portal + collision-aware positioner), which resolves clipping and flipping together and costs far less than hand-rolled edge detection. Assigned to **T3 (#103)** because that is the surface that structurally breaks; **T2 (#102) inherits and verifies only**, so the behaviour is implemented once. If T2 merges first it may ship the current positioning unchanged. The design §6 requirement is **met, not dropped**.

### D3 — on-surface contrast QA: added as a blocking AC on T2 and T3

See §6. Also raised to the designer: design §2's slate values need restating in **app-surface (dark)** terms, since they were authored against a white mockup page and will otherwise be copied verbatim into a future ticket and reproduce the #101 defect.
