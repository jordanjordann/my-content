# TDD — Style fingerprint read + human override API (issue #73)

**Author:** John (Tech Lead) · **Date:** 2026-08-03 · **Base:** `main` @ `101e126`
**Source ticket:** [#73](https://github.com/jordanjordann/my-content/issues/73) (`[BE] Style fingerprint read + human override API`)
**Builds on:** [#72](https://github.com/jordanjordann/my-content/issues/72) (CLOSED, PR #99, migration `010`)

---

## 0. Finding: the `blocked` label on #73 is STALE

The handoff and the label disagree. The label is wrong. Evidence, each traced to the thing that owns
the claim:

| Claim | Source | Result |
|---|---|---|
| #73's only stated dependency is "**Blocked on #72.**" | `gh issue view 73` — body, "Dependencies" line. No other blocker is named. | — |
| #72 is closed | `gh issue view 72` → `state: CLOSED`, `closedAt: 2026-07-25T02:51:00Z` | Dependency satisfied |
| #72's code actually shipped, not just the issue | `migrations/010_profile_style_fingerprints.sql`, `lib/server/fingerprint/{aggregate,repository,service,types,constants}.ts`, `tests/server/fingerprint/{aggregate,service}.test.ts` all present on `main` | Dependency satisfied |
| #65 (taxonomy guards, which step 2 of #73 says to reuse) is closed and present | `gh issue view 65` → CLOSED; `lib/analysis/taxonomy/helpers.ts` exports `isTopicNiche`, `isHookType`, `isFormatArchetype`, `isCtaType`, `isCtaTiming`, `isBeatType`, `isPacing` | Available |
| The auth pattern step 4 says to match exists | `app/api/analyses/route.ts:15` — `if (!(await isAuthenticated()))` → 401; `lib/server/auth/auth.ts` | Available |
| Recompute is already wired into the pipeline (needed by AC "run a 6th analysis") | `lib/server/analysis/pipeline/index.ts:320-326` | Available |
| #73 has **zero** comments — nothing anywhere explains the label | `gh issue view 73 --comments` → `comments: []` | No hidden blocker |

**Why the label is still there:** it was never removed when #72 merged. Corroborating evidence that
labels are not maintained in this repo: **#72 itself is CLOSED while still carrying the `blocked`
label.** The label is a leftover, not a signal.

**The one thing in #73 that reads like a blocker is not one.** The ticket's `NEEDS OWNER DECISION —
the confidence indicator` section flags that PRD §6.1's "based on N videos" indicator has no host
surface (no profile page, no generation surface). The ticket **already resolves this itself**: ship
the data (`sampleSize`, `sourceAnalysisIds`), render it when Phase 4/5 builds the host. That is a
deferral of rendering, not a missing decision, and it blocks no backend work. It is carried below as
**[OWNER-1]** for confirmation, not as a gate.

**Verdict: not blocked. Dev work can start.** Recommended action on the issue: remove the `blocked`
label (done — see §9), keep #73 open as the parent, execute via the three sub-tickets in §8.

---

## 1. What #72 already shipped (the surface #73 builds on)

Read this before writing code; do not re-derive it.

- **Table** `profile_style_fingerprints` (migration `010`, 11 columns, UNIQUE index on `profile_id`).
  `computed` and `overrides` are two separate JSON columns **on purpose** — see the 30-line rationale
  comment at `migrations/010_profile_style_fingerprints.sql:1-32` and `docs/RUNBOOK.md` §4, row 010.
- **`repository.ts`**
  - `getFingerprintRow(profileId)` → `StyleFingerprint | null`.
  - `upsertFingerprint(input)` — the `ON CONFLICT … DO UPDATE SET` list **deliberately never
    mentions `overrides`** (`repository.ts:105-112`). Override-safety is a SQL-level property here,
    not a convention.
  - `setFingerprintOverrides(profileId, overrides | null)` — writes the **whole** blob; rejects keys
    in `PROVENANCE_FIELDS`. Explicitly documented as "not wired to an API route by this ticket …
    exposed here as the primitive a future ticket's endpoint … calls" (`repository.ts:139-150`).
    **That future ticket is #73.**
  - `getCompletedV2Analyses(profileId, schemaVersion)` — corpus query (`status='completed' AND
    schema_version=?`).
- **`service.ts`**
  - `recomputeFingerprint(profileId)` — returns `null` below `MIN_ANALYSES_FOR_FINGERPRINT` (5).
  - `getFingerprint(profileId)` → `FingerprintView | null` — the read-time merge
    `{...computed, consistencyIndex, ...overrides, …provenance, overriddenKeys}` (`service.ts:73-83`).
- **`constants.ts`** — `MIN_ANALYSES_FOR_FINGERPRINT = 5`, `FINGERPRINT_VERSION = 1`,
  `PROVENANCE_FIELDS = ["profileId","fingerprintVersion","schemaVersion","createdAt","updatedAt"]`.

**The override-merge bug #72 already shipped and fixed** is recorded as a regression test:
`tests/server/fingerprint/service.test.ts:192` — *"an override on `consistencyIndex` genuinely wins
at read time (regression: read-merge previously clobbered it)"*. The cause was ordering: a field
spread **after** the `...overrides` spread silently beats the override. **Every merge decision in §3
below is made with that failure mode in view — the ordering in `getFingerprint` is load-bearing and
must not be edited casually.**

---

## 2. Gap analysis — #73's ask vs. what exists

| #73 requires | Exists? | Work needed |
|---|---|---|
| `GET`/`PATCH` route at `app/api/profiles/[id]/fingerprint/route.ts` | No — `app/api/profiles/` does not exist at all | Create (Ticket B) |
| Merged read payload | Yes — `getFingerprint()` | Extend with `sampleSize`/`sourceAnalysisIds` guarantees + `computedAt` (Ticket A) |
| 404 when no fingerprint | Partially — `getFingerprint()` returns `null`; nothing maps it to 404 | Route-level (Ticket B) |
| `PATCH` writes only `overrides` | Yes at SQL level — `setFingerprintOverrides` | Reuse; but it is a **whole-blob replace**, not a partial patch |
| **Partial** patch, `null` removes a key | **No** | New `patchFingerprintOverrides` (Ticket A) |
| Validate override keys + enum values | **No** — only provenance-key rejection exists | New `validation.ts` (Ticket A) |
| Auth | Yes — `isAuthenticated()` | Wire (Ticket B) |
| Client module `lib/api/fingerprint/*` | No | Create (Ticket C) |
| `computedAt` in payload | **No such field or column** | See D2 |

---

## 3. Design decisions

### D1 — `sampleSize` and `sourceAnalysisIds` become NON-overridable

They currently live inside `ComputedFingerprint` (`types.ts:61-62`), so they are spread **before**
`...overrides` in `getFingerprint` — meaning a human override on `sampleSize` **wins at read time**
today. That is the exact shape of the bug regression-tested at `service.test.ts:192`, pointed the
other way.

These two fields are the provenance of the "based on N videos" confidence indicator (PRD §6.1). A
human-editable `sampleSize` is a confidence indicator that can lie about how much evidence it stands
on. They are not a "read of the creator" a human could plausibly correct — they are a count of rows.

**Decision:** introduce `NON_OVERRIDABLE_FIELDS = [...PROVENANCE_FIELDS, "sampleSize",
"sourceAnalysisIds"]` in `lib/server/fingerprint/constants.ts`, and use it in all three places:
write-time rejection (`400`), the `overriddenKeys` filter, and a defensive strip of those keys from
`overrides` before the read-merge spread (for any legacy blob written before the guard).
`PROVENANCE_FIELDS` stays as-is for the row-identity meaning it already has.

`consistencyIndex` **remains overridable** — that was #72's deliberate decision and it has a test.

### D2 — `computedAt` needs a real column (migration `011`)

#73 asks the payload to carry `computedAt`. There is no such column. The only candidates are
`created_at` (first ever compute) and `updated_at` (last write of **any** kind, including a `PATCH`).
Returning `updated_at` as `computedAt` produces a value that is wrong the moment anyone edits an
override — a plausible-looking number standing in for something the row does not actually know. That
is precisely the fabrication class migration 010's design comment exists to prevent.

**Decision:** migration `011_fingerprint_computed_at.sql` adds a nullable `computed_at TEXT`,
backfilled `= updated_at` for existing rows, written **only** by `upsertFingerprint` (both the
`INSERT` and the `ON CONFLICT … SET` list) and **never** by the overrides writer.

> SQLite constraint (not a preference): `ALTER TABLE … ADD COLUMN` cannot take a non-constant default
> such as `datetime('now')`, and cannot add `NOT NULL` without one. Hence: nullable column + explicit
> backfill `UPDATE`. `mapRow` reads `row.computed_at ?? row.updated_at` so a legacy row can never
> surface `null`.

`createdAt`/`updatedAt` stay in the payload with their existing, honest meanings.

### D3 — `PATCH` merge semantics: shallow, top-level, `null` deletes, in TypeScript, in a transaction

Semantics (RFC 7396-shaped, deliberately **not** recursive):

- `{ "verbalTonePatterns": [...] }` → replaces that top-level key in `overrides`.
- `{ "verbalTonePatterns": null }` → **removes** the key from `overrides` (reverts to `computed`).
  A literal `null` is never stored.
- Keys not mentioned in the patch are untouched.
- If the merge empties the object, the column is set to SQL `NULL`, not `'{}'` — absence stays
  unambiguous, matching the "no `is_stale` flag" reasoning in migration 010.
- `computed` is never read-modified-written by this path. `PATCH` touches one column.

**Considered and rejected: SQLite's `json_patch()`.** It would be a single atomic statement and it
implements the `null`-deletes rule natively, but it merges **recursively** into nested objects — and
`dateRange` (`types.ts:63`) is a nested object, so `{dateRange:{earliest:"x"}}` would silently
half-merge instead of replacing the key. It also yields `'{}'` rather than `NULL` on full deletion.
Both are the kind of silent, shape-dependent behaviour this module has already been bitten by.

**Implementation:** read-modify-write inside `db.transaction("write")` (`@libsql/client@^0.17.4`).
Single-operator PIN-auth app, so contention is theoretical — the transaction is there so it stays
theoretical.

### D4 — Validation is an allow-list, per key, reusing #65's guards

New `lib/server/fingerprint/validation.ts`. An override key not in the known-key allow-list → `400`
(never silently ignored). Per-key rules:

| Key group | Rule |
|---|---|
| `topicNicheDistribution`, `formatArchetypeDistribution`, `hookTypeDistribution`, `ctaTypeDistribution`, `ctaTimingDistribution`, `pacingDistribution` | Array of `{value,count,share}`. `value` must pass the matching guard from `lib/analysis/taxonomy/helpers.ts` (`isTopicNiche`, `isFormatArchetype`, `isHookType`, `isCtaType`, `isCtaTiming`, `isPacing`). `count` non-negative integer, `share` in `[0,1]`, no duplicate `value`. If non-empty, `Σ share` = 1 ± 0.01 — `types.ts:24` documents that invariant, and a consumer is entitled to rely on it. |
| `verbalTonePatterns` | Same entry shape, but `value` is a free-text tone tag (no taxonomy) — non-empty trimmed string. |
| `typicalBeatSequence` | `string[]`, every member passes `isBeatType`. |
| `audienceCalloutRate` | number in `[0,1]`. |
| `medianCutsPerMinute`, `medianBeatCount` | positive number **or** JSON `null`… **see the null trap below.** |
| `dateRange` | `{earliest: string\|null, latest: string\|null}`, ISO-parseable, `earliest <= latest`. |
| `captionStyleExemplars`, `hookTextExemplars`, `onScreenTextExemplars` | `string[]` — **subset of the corresponding `computed` array**, see D5. |
| `consistencyIndex` | number in `[0,1]`. |
| anything else | `400` |

> **The `null` trap, and it is a real one.** D3 makes top-level `null` mean *delete this override*.
> But `medianCutsPerMinute` and `medianBeatCount` are legitimately `null`-valued in `computed`
> (`types.ts:45,49`). The two meanings collide: there is **no way to express "override this to
> null"** under D3, and there must not be a second, subtler encoding invented for it. Resolution:
> `null` **always** means delete, for every key, no exceptions — and since deleting reverts to
> `computed`, the only case you would want (`computed` is a number, human says "actually unknown") is
> unreachable. **Flagged as [OWNER-2]**; the safe default is shipped, not silently decided. Do not
> add a sentinel value for this without an owner ruling.

### D5 — Exemplar overrides may only *remove*, never *author*

`captionStyleExemplars` / `hookTextExemplars` / `onScreenTextExemplars` are documented as
**verbatim** creator text, "never synthesised/summarised" (`types.ts:54-59`). They feed the brief
generator directly. An override that can add arbitrary strings lets a human put words the creator
never said into a corpus the generator will treat as the creator's own voice.

**Decision:** every element of an exemplar override must already be present in that field's
`computed` array. Pruning a bad exemplar and reordering are allowed; authoring is `400`. This keeps
the verbatim guarantee true after a human edit, which is the only way it stays worth anything.

### D6 — `PATCH` on a profile with no fingerprint row is a `404`, not a silent no-op

`setFingerprintOverrides` issues a bare `UPDATE … WHERE profile_id = ?` (`repository.ts:166-173`)
which affects 0 rows and resolves successfully when no row exists. A `PATCH` that returns `200` while
having written nothing is a lie the UI cannot detect. The row's existence is checked **inside** the
transaction; absent → `404` with the same body as `GET`'s 404.

### D7 — the `404` body carries the honest count, not a zeroed fingerprint

#73 step 1 is emphatic: no empty or zeroed object. Agreed. But "how many more videos do I need" is a
real question the caller has, and the answer is a fact, not an inference:

```jsonc
{ "error": "No style fingerprint for this profile.",
  "reason": "NO_FINGERPRINT", "analysisCount": 3, "required": 5 }
```

`analysisCount` comes from a new `countCompletedV2Analyses(profileId, schemaVersion)` (same predicate
as `getCompletedV2Analyses`, `COUNT(*)` form). An unknown `profileId` returns
`reason: "PROFILE_NOT_FOUND"` and no counts — a nonexistent profile and a cold-start profile are
different states and must not be flattened into one.

---

## 4. API design

**Route:** `app/api/profiles/[id]/fingerprint/route.ts` · `runtime = "nodejs"` · `[id]` is
`profiles.id` (the UUID), matching the FK in migration 010.
Both handlers open with the `isAuthenticated()` → `401` guard, copied from `app/api/analyses/route.ts:15`.

### `GET`

`200`:

```jsonc
{
  // every ComputedFingerprint key, per-key overridden where an override exists
  "topicNicheDistribution": [{ "value": "FINANCE", "count": 4, "share": 0.8 }],
  "verbalTonePatterns": [...], "typicalBeatSequence": [...],
  "audienceCalloutRate": 0.6, "medianCutsPerMinute": 12, "medianBeatCount": 5,
  "captionStyleExemplars": [...], "hookTextExemplars": [...], "onScreenTextExemplars": [...],
  "dateRange": { "earliest": "2026-05-01", "latest": "2026-07-20" },
  "consistencyIndex": 0.71,
  // provenance — never overridable (D1)
  "profileId": "…", "sampleSize": 5, "sourceAnalysisIds": ["…"],
  "fingerprintVersion": 1, "schemaVersion": 2,
  "computedAt": "2026-07-25 02:51:00",   // D2 — recompute time, not last edit
  "createdAt": "…", "updatedAt": "…",
  "overriddenKeys": ["verbalTonePatterns"]
}
```

| Status | When |
|---|---|
| 200 | Fingerprint row exists |
| 401 | Unauthenticated |
| 404 | No fingerprint row (`NO_FINGERPRINT`) or unknown profile (`PROFILE_NOT_FOUND`) — D7 |
| 500 | Unexpected |

### `PATCH`

Request: a flat object of override keys. Example:

```jsonc
{ "verbalTonePatterns": [{ "value": "santai", "count": 5, "share": 1 }],
  "medianBeatCount": null }   // ← removes the override, reverts to computed
```

| Status | When |
|---|---|
| 200 | Merged view after the write — same body as `GET` 200, so the client needs no second round-trip |
| 400 | Unknown key, non-overridable key (D1), failed value validation (D4/D5), non-object body |
| 401 | Unauthenticated |
| 404 | No fingerprint row / unknown profile (D6, D7) |

`400` body: `{ "error": "…", "invalidKeys": ["hookTypeDistribution"] }`. **Nothing is written on a
`400` — validate the entire patch before opening the transaction.**

---

## 5. File tree changes

```
migrations/
  011_fingerprint_computed_at.sql                     CREATE   (D2)
lib/server/fingerprint/
  constants.ts                                        MODIFY   NON_OVERRIDABLE_FIELDS (D1)
  types.ts                                            MODIFY   computedAt on StyleFingerprint + FingerprintView;
                                                               FingerprintPatch, FingerprintValidationError
  validation.ts                                       CREATE   (D4, D5)
  repository.ts                                       MODIFY   mapRow computed_at; upsert writes computed_at;
                                                               patchFingerprintOverrides(); countCompletedV2Analyses()
  service.ts                                          MODIFY   getFingerprint strips NON_OVERRIDABLE keys;
                                                               applyFingerprintOverridePatch() orchestrator
  index.ts                                            MODIFY   barrel re-exports
app/api/profiles/[id]/fingerprint/
  route.ts                                            CREATE   GET + PATCH (§4)
lib/api/fingerprint/
  api.ts constants.ts hooks.ts types.ts index.ts      CREATE   client module (Ticket C)
tests/server/fingerprint/
  overrides.test.ts                                   CREATE   validation + patch-merge + override survival
tests/api/profiles/
  fingerprint.route.test.ts                           CREATE   status codes, auth, no-write-on-400
tests/server/db/migrations.schema.test.ts             MODIFY   column count moves 11 → 12
docs/RUNBOOK.md                                       MODIFY   §4 migrations table (011), §7 test layout
```

---

## 6. Client module (`lib/api/fingerprint/`) — AGENTS.md compliance

- `api.ts` — `fetchFingerprint(profileId)`, `patchFingerprintOverrides(profileId, patch)`. Returns the
  server payload **as-is**, no reshaping. A `404` resolves to a typed `{ reason, analysisCount }`
  absence value rather than throwing — cold start is a normal state, not an error.
- `hooks.ts` — `useFingerprint(profileId)` (`useQuery` + `select` for any derivation, e.g. an
  `isOverridden(key)` lookup set and a `topDistributionValue` helper),
  `useUpdateFingerprintOverrides()` (`useMutation`, invalidates the fingerprint query key).
- `types.ts` / `constants.ts` (query keys) / `index.ts` barrel. **All transformation lives in
  `hooks.ts`'s `select`** — AGENTS.md "Data transformation rules".

---

## 7. Risks

1. **Merge-order regression (highest).** `getFingerprint`'s spread order is load-bearing and has
   already produced one shipped bug (`service.test.ts:192`). Ticket A must add an assertion for
   *each* newly-protected key, not just a happy path.
2. **No route-level test precedent in this repo** — `tests/` is entirely node-env unit tests and there
   is no rendering/smoke test at all (HANDOFF 2026-08-03, item 2). Ticket B introduces the first route
   test; expect to mock `@/lib/server/auth` with `vi.mock`. Budget for that, and do not let a green
   suite stand in for actually calling the endpoint.
3. **Migration 011 touches a shared schema test.** `tests/server/db/migrations.schema.test.ts` and
   RUNBOOK §4/§7 both encode current counts. Both change in Ticket A or CI goes red.
4. **No profile-id source on the client.** The analyses list payload exposes `username`, not
   `profileId` (`app/api/analyses/route.ts` mapper). Ticket C therefore ships a data layer with no
   caller — deliberate, matching #73's own deferral. Surfacing `profileId` belongs to the Phase 4/5
   ticket that builds the host surface.
5. **Corpus shrink below 5** with a row already present is still undefined behaviour (#72 flagged it;
   HANDOFF "Deferred/accepted"). `GET` will keep returning the stale row. Unchanged by this work, and
   not silently resolved here.

---

## 8. Ticket breakdown

### [A] `[BE]` Fingerprint override validation, partial-patch primitive, and `computed_at`

- **Dependencies:** None. Blocks B.
- **Goal:** Make the lib layer able to validate and partially patch `overrides`, and to report an
  honest `computedAt`, with no HTTP surface yet.
- **Files:** `migrations/011_fingerprint_computed_at.sql` (Create); `lib/server/fingerprint/
  {constants,types,repository,service,index}.ts` (Modify); `lib/server/fingerprint/validation.ts`
  (Create); `tests/server/fingerprint/overrides.test.ts` (Create);
  `tests/server/db/migrations.schema.test.ts`, `docs/RUNBOOK.md` (Modify).
- **Steps:** D1 constant + all three usages · D2 migration, backfill, `mapRow`, `upsertFingerprint`
  (overrides writer must NOT touch `computed_at`) · D4/D5 `validateOverridePatch(patch, computed)`
  returning `{ok:true}|{ok:false, invalidKeys}` · D3 `patchFingerprintOverrides` in a
  `db.transaction("write")`, empty → SQL `NULL`, row missing → typed not-found (D6) ·
  `countCompletedV2Analyses` (D7).
- **Verification:** override on `sampleSize` rejected AND cannot win at read time; `{key:null}`
  removes; last override removed → column is `NULL`; invalid enum → invalid, nothing written;
  exemplar not in `computed` → invalid; recompute updates `computed_at`, a `PATCH` does not; full
  suite green.

### [B] `[BE]` `GET`/`PATCH /api/profiles/[id]/fingerprint`

- **Dependencies:** **Blocked on A.**
- **Goal:** Expose §4 behind `isAuthenticated()`.
- **Files:** `app/api/profiles/[id]/fingerprint/route.ts` (Create);
  `tests/api/profiles/fingerprint.route.test.ts` (Create).
- **Steps:** auth guard first in both handlers (`app/api/analyses/route.ts:15` is the pattern) ·
  `await params` for `[id]` (`app/api/analyses/[id]/route.ts:8-17`) · map `getFingerprint() === null`
  → D7 404 · `PATCH`: parse → validate whole patch → transaction → return the fresh merged view ·
  document the `null`-deletes rule in a header comment on the file.
- **Verification:** 4 analyses → 404 with `analysisCount:4`; 5 → 200 `sampleSize:5`; `PATCH`
  `verbalTonePatterns` → `overriddenKeys` contains it; invalid enum → 400 and a follow-up `GET` is
  byte-identical to before; `{key:null}` reverts; unauth → 401 on both verbs; unknown profile →
  `PROFILE_NOT_FOUND`.

### [C] `[FE]` `lib/api/fingerprint` client module

- **Dependencies:** Contract is frozen by this TDD §4, so it **can be written in parallel with B** —
  but do not merge it before B, it cannot be verified against a live route until then.
- **Goal:** Typed client + hooks per AGENTS.md, ready for the Phase 4/5 host surface.
- **Files:** `lib/api/fingerprint/{api,hooks,types,constants,index}.ts` (Create);
  `tests/lib/api/fingerprint/helpers.test.ts` (Create, if any pure helper lands).
- **Verification:** `api.ts` contains zero reshaping; `404` surfaces as a typed absence, not a throw;
  mutation invalidates the query key; `npm run typecheck` and `npm run lint` clean.

**QA:** manual, by the owner, after B merges. Fold into the existing #74 Phase 2 QA pass.

---

## 9. Actions taken on the issue tracker

- `blocked` label **removed** from #73 (stale — §0), with an explanatory comment linking this doc.
- #73 kept **open as the parent**; A/B/C created as sub-tickets referencing it.

## 10. Open items for the owner (neither blocks A/B/C)

- **[OWNER-1]** Confirm the confidence indicator ("based on N videos") renders in Phase 4/5, not now.
  #73's own text recommends this; the data ships regardless. If you want something visible in Phase 2,
  it needs a design pass from Jessica and is not currently ticketed.
- **[OWNER-2]** D4's `null` collision: `null` means *delete the override*, so "override this to
  null/unknown" is not expressible. Safe default shipped. Ruling needed only if you actually want it.
- **[OWNER-3]** D5 restricts exemplar overrides to a subset of `computed` (prune, never author). If
  the agency needs to *add* exemplar text by hand, that is a different feature with different risks.
