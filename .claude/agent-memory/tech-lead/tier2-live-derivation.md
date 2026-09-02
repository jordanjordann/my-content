# Tier 2 live derivation — cold-start count, live multiplier, and the clamp (#206, #251, #252, #260, #262, #263)

Merged from the former `cold-start-count-clamp.md`, `live-multiplier.md` and the staged
`ticket-252-refresh` note. Newest facts first where they supersede older ones.

## Shipped state after PR #263 (`026a7aa`, 2026-08-20) — and what #262 has left

#263 shipped the BE half of #252 **plus most of the FE**. `deriveMultiplierCell`
(`lib/api/analyses/helpers.ts`) already switches on `tier2.state`/`tier2.reason`; the tuple derivation is
deleted. Verified done, do not re-ticket:

- Popover carve-out needed **zero edits** — `AnalysisScoreExplainPopover.tsx:74,82` guard on
  `multiplierCell.kind`, which now derives from `state`.
- DESIGN-3C §4.3 live-sample-size leak is fixed: `buildTier2` step 2 emits `frozenSampleSize(row)`; only
  the two cold-start branches carry a live/pool count.
- §4.4 sorting/grouping needed **no code at all**. Sorting is server-side SQL
  (`lib/server/db.ts:109,151`, `ORDER BY a.perf_multiplier IS NULL ASC, …`); grouping is
  `groupAnalysisRows` = scored/sink/failed. Neither has any cold-start-progress notion. Anyone ticketing
  "make sorting state-aware" is inventing work.
- §4.5 screen reader needed no code — the state-3 cell is one `<p>` of statement text.

**#262's only remaining work is the below-threshold short-form string — and it is NOT FE-only.** For a
`NOT_COMPARABLE`/`POST_METRIC_UNRESOLVED` row, step 2 returns **before** the live pool is measured and
emits the frozen `sampleSize`, so `PerformanceTier2` carries **no signal for "the live pool cleared the
threshold"**. The variant needs a new BE reason + a new FE reader → **one PR, both halves** (the #263
round-2 blocker was exactly a "new field, old reader" seam).

**Open implementation question left in #262:** which string when `livePool == null` (the explicit degrade
path in `buildTier2`). Recommended default is the SHORT form — it is true in every pool condition; the
long form's opening clause is not.

### `buildTier2` branch map (`readModel.ts`, @ `026a7aa`)

1. stored `perfMultiplier != null` → `MEASURED`, frozen, live pool irrelevant.
2. `ownMetric == null` → `NOT_COMPARABLE`/`POST_METRIC_UNRESOLVED`, `median: null`, frozen `sampleSize`,
   **regardless of pool size**. A write-time NOT_COMPARABLE row is NOT short-circuited — it re-enters live
   routing (#263 review Findings 1-3 removed that branch).
3. `livePool == null` → degrade to `COLD_START` off the frozen count.
4. `poolSize < BASELINE_MIN_SAMPLE` → `COLD_START`, live `sampleSize`.
5. live `median === 0` → `NOT_COMPARABLE`/`MEDIAN_ZERO`, `median: 0`.
6. else `MEASURED` with a live multiplier.

### The popover `median != null` / `multiplier != null` reads are NOT a defect (re-derived 2026-08-20)

`buildOperandRows` (`.../popovers/AnalysisScoreExplainPopover/helpers.ts:69,75`). The real branch key on
the `This creator's usual` line is **`bucketNoun != null`**, and `bucketNoun` is non-null only for
`kind === "measured" | "cold-start"` (`AnalysisScoreExplainPopover.tsx:74`). So: cold start → `median`
null anyway; `MEDIAN_ZERO` → `median` is `0` (non-null!) but `bucketNoun` is null, so the line is
suppressed by the noun guard, not the median guard. `multiplier != null` ≡ `state === "MEASURED"` by the
type invariant. Both reads guard an **interpolated value**, not a state decision. Leave them.

**Corollary — the "the `median of N` operand line silently disappeared for not-comparable rows" worry is
a non-event.** Since #251 those rows have had `kind: "not-comparable"` → `bucketNoun == null` → the line
was **already** suppressed, before #263 nulled the median. No design decision is owed.

### ⚠️ #266 IS NOW "REMOVE SORTING ENTIRELY" — owner ruling 2026-08-20. Read this before the section below.

**Ruling: drop the sorting entirely. The default and only order is `updated_at DESC` — most recently
analysed first.**

> **⚠️ KEY CHANGED 2026-08-20 (2nd revision): `created_at` → `updated_at`.** Earlier revisions of this
> file, of #266 and of PR #267 said `created_at DESC`. **They are superseded.** Reason: re-analyze is
> an **UPDATE** not an INSERT (`pipeline/index.ts:80-89`) and never touches `created_at`, so a
> re-analysed row would not surface. `updated_at` is ALSO already indexed
> (`idx_analyses_updated_at ON analyses(updated_at DESC)`, `migrations/013_...sql:181`, verified
> @ `9c91a1d`); `created_at` has NO index. The old "re-analyze open question" is CLOSED by this change.

The owner chose NONE of options A–E. Reasoning: the sort *lies* (orders by STORED multiplier;
5 of 7 displaying rows have none stored) — removing it replaces a wrong answer with no answer. He
accepted that `3b495116` / `7b6948fe` lose their correct ordering too. He also explicitly chose FULL
removal over the alternative of keeping a single date-column sort toggle. All 8 headers become plain
text. **Overrides state-routing §4.4, analyses-table §6.1 (R-S1/R-S2/R-S3) and SUPERSEDES OR-8 —
owner-approved.** `updated_at` is deliberately NOT `post_date`. Do not re-litigate.

**Doc amendment = PR #267** (doc-only, A10, branch `docs/266-remove-sorting-ruling`, **unmerged** —
owner confirms every merge). Head `834d917` (2026-08-20) swaps the key to `updated_at DESC` in A10,
§6.1 and state-routing §4.4, records the re-analyze reasoning + the index + the re-derived tie
evidence. `da74463` before it dropped the `id ASC` tiebreak and recorded it as declined. Docs-only proof:
`git diff --name-only main HEAD | grep -v '^docs/' | wc -l` → `0`. #266's body was rewritten the same
day to match. **Always leave the checkout back on `main` when done.**

**Scope is `[BE+FE]`, ONE ticket ONE PR** — the original `[BE]` label was WRONG. Sorting is NOT a
hidden server detail:
- **User-facing controls exist**: every sortable header is a `<button>` with arrow, `aria-sort` and a
  `, currently ascending/descending` accessible name (`AnalysisTableColumnHeaders.tsx:27,45-49,94,151,167`).
- **Query params exist**: `?sortBy=&sortDir=` parsed + allow-listed + **400 on unknown**
  (`app/api/analyses/route.ts:25,41,124-135,145`). Also `lib/api/analyses/api.ts:29-30`,
  `types.ts:438-439`, `AnalysesContent.tsx:37-48`, `AnalysisDataTable.tsx:83-86,99-100,120-123,303-305`,
  `.../AnalysisDataTable/constants.ts:17-55,102`, `types.ts:11,55-57`.

**Sorting is an 8-FIELD GENERAL feature, not multiplier-only** (`SORT_COLUMN_EXPRESSIONS`
`db.ts:103-112`: creator, posted, reach, contentScore, performanceScore, multiplier, engagementReach,
engagementFollowers). The ruling kills all eight.

**GROUPING IS NOT ENTANGLED — it STAYS.** `groupAnalysisRows`
(`.../AnalysisDataTable/helpers.ts:16-33`) takes **only** `rows`; it never reads `sortBy`/`sortDir`/any
sort column. Verified @ `9c91a1d`. Anyone claiming one can't go without the other is wrong.

**⚠️ NO TIEBREAK — owner ruling 2026-08-20. The clause is EXACTLY `ORDER BY a.updated_at DESC`.**
An earlier revision of this file and of #266 called `, a.id ASC` "mandatory, not decorative".
**The owner considered it and DECLINED it.** That earlier claim is WRONG — do not reinstate it.
Tied-row order is **explicitly undefined and accepted**.

**EVERY writer of `analyses.updated_at` @ `9c91a1d`** (enumerated for the owner, all `WHERE id = ?`,
all inside the analysis pipeline): `pipeline/index.ts:85` (re-analyze reset), `:290` (metadata/perf),
`:362` (`status='completed'`), `:402` (`status='failed'`). **NO non-analysis writer exists** — the
other `updated_at = datetime('now')` writes hit **different tables**:
`fingerprint/repository.ts:142,200,319` → `profile_style_fingerprints`,
`profiles/repository.ts:87` → `profiles`. Proof: `grep -rn "UPDATE analyses" lib app scripts` →
only `pipeline/index.ts:83,275,360,402`. Accepted consequence: **a row climbs the list while its own
pipeline runs** (it did NOT move under `created_at`).

`updated_at` is `TEXT NOT NULL DEFAULT (datetime('now'))` (`migrations/013_...sql:49`) —
**one-second granularity, no UNIQUE, but IT IS INDEXED** (`idx_analyses_updated_at ON analyses(updated_at DESC)`,
`013:181`). `created_at` has NO index. No `IS NULL` key needed and **no path can set `updated_at` NULL**
(all four writers assign `datetime('now')`; non-null default), so SQLite's "NULLs last under DESC"
never applies.

**Tie evidence — RE-DERIVED for `updated_at` (do NOT reuse the `created_at` argument; its premise
changed). Read-only Turso `lasa`, 2026-08-20 @ `9c91a1d`:**
- **Stage writes CANNOT create cross-row ties** — all four hit the SAME row, so they overwrite, not
  multiply. A tie needs two DIFFERENT rows whose *last* write lands in the same second. (The
  "several stages fire per run ⇒ more ties" worry is mechanically wrong.)
- Batch path **strictly sequential** (`app/api/analyze/route.ts:53-64`), proved directly in prod:
  row N's `updated_at` == row N+1's `created_at` **to the second** (`16:12:23`, `16:13:18`, `16:14:08`).
- Per-row runtime **43–118 s**; smallest consecutive `updated_at` gap **50 s** — same order as
  `created_at`. **Ties are NOT more likely under `updated_at`.** The declined-tiebreak evidence holds.
- Production 2026-08-20: **12 rows, 12 distinct `updated_at`, 12 distinct `created_at`, 0 NULL.**
- `analyses.id` = app-generated **UUIDv4** (`randomUUID()`, `pipeline/index.ts:1,68`), TEXT PK, **zero**
  ordering info — by rowid: `b04d7d23…, dea20a90…, 46477354…, 66143a31…, ac3b449e…`.

**Accepted risk (owner told plainly, accepted, DO NOT re-argue):** two rows finishing in the same
second (two tabs, a retry, a future job queue) can tie; under `LIMIT ? OFFSET ?` a non-deterministic
tiebreak can duplicate a row across pages or drop it. Low-risk at current scale (single user, 12 rows).
**3A's job queue would raise the likelihood.** **Never propose a UNIQUE constraint or a new index —
that is a migration, and migrations are prohibited.** `idx_analyses_updated_at` already exists.

**Ruling 4:** the implementation must carry a comment at the ORDER BY site saying the secondary key was
deliberately declined by owner ruling 2026-08-20 (#266), naming `updated_at`'s granularity, so nobody
"fixes" it. It is an AC in #266.

**Consequence for tests:** `tests/server/db/analyses.pagination.test.ts:117-148` ("identical sort key,
`a.id ASC` tiebreaker alone") must be **DELETED, not re-pointed** — there is no guaranteed order between
two rows sharing an `updated_at`. And do NOT add an identical-`updated_at` stability test or AC; an
earlier #266 draft asked for exactly that and it is now wrong.

**RESOLVED (was open):** the re-analyze `UPDATE`-not-`INSERT` question is what CAUSED the key change.
Nothing left open there. #266 gained an AC: a re-analysed row moves to position 1 while `created_at`
stays put.

**The default COLUMN changes.** Old default = `posted` DESC = `a.post_date` (OR-8). New = `updated_at`
DESC. Different columns, visibly different order (`dea20a90`: post_date 2024-12-26, updated_at
2026-08-17 → it moves). Intended by "most recently analysed first". Don't silently keep `post_date`.
`a.updated_at` is ALREADY in the list `SELECT` (`lib/server/db.ts:188`), so no column plumbing needed.

**Tests asserting the old ordering** (all must change; a changed expectation is only right if the
consumer contract agrees — quote the ruling + A10 in the PR):
`tests/server/db/analyses.pagination.test.ts` :177-187 default-sort (rewrite; the insert helper :24-58
never sets `created_at`, so all rows land in the same second — set it explicitly or the assert is
vacuous), :163-176 N1 guard (delete), :188-236 four R-S1/AC-14 sink tests (delete), :80-116/:117-148/
:149-162 pagination (KEEP, re-point at `created_at`, add an identical-`created_at` case);
`tests/api/analyses/route.test.ts:323-324` 400-on-unknown-sortBy (delete);
`tests/lib/api/analyses/hooks.dom.test.tsx:33,137-186` (params shape only, assertion unchanged);
`tests/app/.../AnalysisDataTable.dom.test.tsx:585-604` aria-sort (delete);
`tests/app/.../headers/AnalysisTableColumnHeaders.dom.test.tsx` :127-158/:159-181/:182-211/:337+
(sort affordances — rewrite/delete) but **:243-336 R-D6/R-D12 tooltip sibling+count MUST keep passing**.

**Two FE traps.** (1) R-D6 requires the sort button and the engagement tooltip trigger to be SIBLINGS
under one `<th>`, exactly two triggers table-wide (R-D12) — removing the button restructures that
`<th>`; the trigger stays. (2) `AnalysesContent` builds an IDENTICAL params object for its two
`useAnalysesQuery` calls so TanStack dedupes them into ONE request (PR #203 blocker 1) — strip
`sortBy`/`sortDir` from **both** call sites or the dedupe re-breaks into two full-corpus fetches.

Deleting `buildOrderByClause` also removes the PR #196 N1 `hasOwnProperty` guard's attack surface —
no caller-controlled string reaches the `ORDER BY` at all. That is an improvement; never reintroduce one.

---

### Live-MEASURED rows sort as absent → original #266 defect analysis (2026-08-20, SUPERSEDED by the ruling above)

A row whose multiplier is derived LIVE has stored `perf_multiplier IS NULL`, so the server sort buries it
with the unmeasurable rows while the cell shows a real `N.N×`. Scope is **`[BE]` only** — sorting is
server-side SQL **and paginated** (`lib/server/db.ts:210`, `LIMIT ? OFFSET ?`), so the FE receives one
pre-ordered page and has no correct behaviour available. Deliberately kept OUT of #262.

Exact locations, re-verified @ `026a7aa`:
- Producer: `readModel.ts:262-273` (stored → frozen MEASURED) vs **`readModel.ts:359`** (live MEASURED
  while `row.perfMultiplier == null`). #263 broke the old equivalence "`perf_multiplier IS NULL`" ≡ "no
  multiplier displayed"; before #263 the sort key was correct *by construction*.
- Consumer: `lib/server/db.ts:109` (`multiplier: "a.perf_multiplier"`) and **`:151`**
  (`ORDER BY ${column} IS NULL ASC, ${column} ${dir}, a.id ASC`, the R-S1/AC-14 sink rule). The ORDER BY
  is doing exactly what it was designed to do; its **input** is now wrong.

**The hard constraint that shapes the whole solution space:** the live multiplier is NOT computable inside
the list query — it needs `baseline.ts`'s per-pool median with self-exclusion + 72h floor + `metricFor()`,
which run in app code *after* the page is selected. **Ordering by a value the DB cannot compute is in
tension with `LIMIT`/`OFFSET`.** Options presented in #266, none chosen: A accept+document, B reproduce the
derivation in SQL (drift risk — the #263 producer/consumer seam again), C persist (BLOCKED, needs
migration/backfill), D sort in app layer (kills pagination for one field), E group-only by "displayable"
(fixes grouping, leaves ordering arbitrary — arguably a worse lie). **Touches DESIGN-3C §4.4, which
declined to change sort semantics — owner ruling required before any option.**

### Doc location trap — RESOLVED 2026-08-20

The state routing spec is **`docs/design/DESIGN-3C-vs-their-usual-state-routing.md`**. It is **not**
`docs/design/DESIGN-3C-analyses-table.md` — that file's §3 is *Row anatomy*; its cold-start/`vs their
usual` material is §5.3/§5.4. Two briefs cited the wrong file+section pair.

It is now landed on `main` via **PR #265** (doc-only, status flipped to approved 2026-08-20), branch
`docs/land-design-3c-state-routing`. **Do not merge `design/252-vs-their-usual-routing`** — it is based on
`f4a7e92` (pre-#263); `git diff --stat main design/252-vs-their-usual-routing` = 18 files / 1035 deletions
and merging it REVERTS #263 across `readModel.ts`, `baseline.ts`, `helpers.ts`, both route files and 9 test
files. The doc was brought across file-wise onto a branch cut from `main` instead.

**Doc-vs-shipped gaps left standing in #265 (not reconciled, owner's call):** §2/§3-rule-2's
below-threshold short string `this post's own count wasn't published` is NOT shipped (that is #262's
remaining work; both pool conditions still render #251's full string from
`lib/api/analyses/constants.ts:18`); §4.4 is partially overtaken by #266; §5's census is stale.

## Owner ruling (2026-08-19, on #252)

`tier2.multiplier` is **LIVE when stored `perf_multiplier IS NULL`**. This finishes the fix #206 started
for `sampleSize`. **Stored `MEASURED` multipliers stay FROZEN** (TDD §14.8a / D8). **No backfill, no
recompute job, no writes.** Recorded in TDD §14.8a via PR #256 (doc-only).

The owner's fallback remark *"we can always remove the old data"* is **NOT approved**. Deleting rows is
expensive (5 paid ScrapeCreators+Gemini runs were imported to production to avoid re-spending) and lossy
(the giorrando reel bucket is one post short of the 6 needed).

## The `6 of 5 reels` defect (#260) and its fix

`AnalysisTableRow.tsx:247` rendered `{content.sampleSize} of {BASELINE_MIN_SAMPLE_DISPLAY}` with no clamp:
the numerator was LIVE and unbounded, the denominator a hardcoded FE `5`.

Chain (verified 2026-08-19 at `e5319a4`):
1. `app/api/analyses/route.ts:199` — `liveColdStartSampleSize = eligibleIds.size - (self ? 1 : 0)`.
2. `lib/server/analysis/performance/readModel.ts:197-205` (`buildTier2`) — when
   `perfMultiplier == null && perfBaselineMedian == null`, the live count **replaces** the frozen
   `perfBaselineSampleSize`. (#206 / TDD §14.8a.)
3. `lib/server/analysis/performance/baseline.ts` — **no `LIMIT` anywhere in the file**.
   `fetchCandidateRows()` (:310-357) and `fetchLiveEligibleComparatorIds()` (:379-427) return the whole
   pool.
4. `lib/api/analyses/helpers.ts:395` — cold-start fallthrough carried `tier2.sampleSize` straight through.
5. `.../AnalysisDataTable/constants.ts:114` — `BASELINE_MIN_SAMPLE_DISPLAY = 5`, hardcoded. Its own JSDoc
   (:105-113) already flagged the drift and named the real fix ("ideally the response would carry the
   threshold").
6. `lib/server/analysis/performance/constants.ts:40-66` — `BASELINE_MIN_SAMPLE`, default 5,
   env-overridable via `PERFORMANCE_BASELINE_MIN_SAMPLE`.

Cold-start classification is FROZEN; the displayed count is LIVE. **That mismatch is the root cause**; the
env var is only a second, independent way for the two numbers to diverge.

**⚠️ Do NOT "fix" it with SQL. Adding a `LIMIT` to `fetchCandidateRows()` would corrupt
`computeBaseline()`'s median — it is the same query.** The `LIMIT`'s absence is an observation and a
prohibition, not a to-do. The fix is a display clamp plus killing the duplicated constant.

**Shipped state (#260 / PR #261):** `BASELINE_MIN_SAMPLE_DISPLAY` was **deleted**. The threshold is now
per-row `PerformanceTier2.minSample`, clamped with `Math.min` in `deriveMultiplierCell`
(`lib/api/analyses/helpers.ts:405`). Any doc still naming the old constant is stale.

## Key code facts (verified, main @ `b25d889`)

- `baseline.ts` `fetchLiveEligibleComparatorIds()` **already computes `metricFor()` per candidate and
  discards the value**, keeping only the id to count it. Returning the values costs zero extra I/O.
  Median is per-pool, not per-row — **not** an N+1.
- One grouped query per chunk of ≤100 pools (`POOL_CHUNK_SIZE`). Batching is #206's D3.
- A row's own metric at read time = `metricFor()` over `perfReachValue` / `likeCount` / `commentCount`, all
  already on `PerformanceBlockRow`. No new query, no migration.
- **`computeBaseline()`'s check order must be reused on the write path**: `pool < MIN` → `COLD_START`;
  own metric null → `NOT_COMPARABLE` / `POST_METRIC_UNRESOLVED`; `median == 0` → `MEDIAN_ZERO`; else
  `MEASURED`. **The READ path deliberately differs** — DESIGN-3C §3 hoists own-metric-unresolved ABOVE the
  pool-size check. Do not align them.
- **Hazard:** `computeBaseline()` THROWS on mixed denominators. Do not port that onto the read path — it
  would 500 the analyses list.
- **Hazard:** self-exclusion applies to the **MEDIAN** too, not just the count. The pool map must carry ids
  alongside values.
- **Shipped state-3 copy** (`lib/api/analyses/constants.ts:18`):
  `this creator's usual is set — this post's own count wasn't published`. **#251's body proposes
  different, never-shipped copy — never quote copy from a ticket body; quote `constants.ts`.**

## Production numbers — historical, re-derive before use

**2026-08-19 (a):** 10 rows — 2 MEASURED (`3b495116`, `7b6948fe`), 1 NOT_COMPARABLE (`391b7615`), 7 cold
start. Pool `giorrando / instagram:reel:full_video`, schema 3: 8 completed rows, all past the 72h floor, 7
with a non-null `perf_reach_value` → **live eligible set = 7**. The five cold-start rows in that pool
(`dea20a90`, `66143a31`, `ac3b449e`, `5eddbdce`, `adb00cf0`) each derived `7 - 1 = 6` and rendered
`6 of 5 reels` **with no env var set**.

**2026-08-19 (b), the #252 read:** 10 completed rows — 7 COLD_START, 3 NOT_COMPARABLE, 0 MEASURED;
NOT_COMPARABLE ids `9470151e`, `391b7615`, `a439b95b` (all median 7698, sample 5, NULL reach). giorrando
reel pool = 5 reach-bearing reels → each row sees 4 comparators → the ruling changed **zero** rows that day
until a 6th reel landed. Live median of `[5492, 7229, 7698, 169050, 740570]` = 7698 == stored median
(cross-validates).

**2026-08-20 (the #266 read):** 10 completed rows. 2 stored-MEASURED (`3b495116` 8.2204, `7b6948fe`
0.2391). Pool `giorrando / instagram:reel:full_video` schema 3 = **7 reach-bearing rows** past the floor, so
every member sees 6 comparators ≥ `BASELINE_MIN_SAMPLE` 5 — the pool has now crossed the threshold, unlike
on 08-19. Result: **5 rows are live-MEASURED** (`dea20a90`, `adb00cf0`, `5eddbdce`, `ac3b449e`, `66143a31`)
with stored `perf_multiplier IS NULL`. `391b7615` = NOT_COMPARABLE (own reach NULL). `b04d7d23` (giorrando
carousel:images_only) and `46477354` (anaball.id reel) are each a pool of 1 → COLD_START. So **5 of the 7
rows that display a multiplier sort as absent** — #266 is the majority case, not an edge case.

**2026-08-20 (b), the #266 tiebreak read):** **12 rows, 12 distinct `created_at`.** Two new rows since
the (a) read: `6c6129ba` (`2026-08-20 04:01:46`) and `acd54b96` (`2026-08-20 04:02:41`). Full
`created_at` sequence by rowid: `b04d7d23` 08-17 16:09:53, `dea20a90` 16:11:40, `46477354` 16:12:23,
`66143a31` 16:13:18, `ac3b449e` 16:14:08, `5eddbdce` 16:52:29, `adb00cf0` 16:59:28, `391b7615` 08-18
15:21:10, `3b495116` 08-19 03:35:18, `7b6948fe` 03:40:50, then the two 08-20 rows. All 12 completed.
So any "10 rows" figure in an older ticket revision or brief is STALE.

**The reads disagree because the census drifts within hours — that is the point. Always re-derive.**

## Test coverage reality

There is no `AnalysisTableRow` DOM test **file**, but the row IS rendered and the cold-start string IS
asserted at
`tests/app/app/analyses/components/grids/AnalysisDataTable/AnalysisDataTable.dom.test.tsx:636`
(`"2 of 5 carousels"`). **Claims of "zero coverage on that cell" are too strong** — the gap is specifically
the over-threshold case.

## Standing lessons

- **Production census drifts fast.** Any ticket quoting a row census goes stale within days. Re-derive with
  `~/.turso/turso db shell lasa "SELECT ..."` (read-only, **not** on `PATH`). The repo's `my-content.db` is
  a **PRE-DEPLOY SNAPSHOT / stale fossil** — it has 8 completed rows including `581a798a`, and **`581a798a`
  does not exist in production**. Never cite it.
- **`perf_baseline_sample_size` is NOT what renders** — `buildTier2()` substitutes a live comparator count
  for cold-start rows. Deriving a blast radius from the stored column is wrong.
- **Never derive a pool size by eyeballing the row list.** The eligibility predicate is
  `(profile_id, perf_bucket_key, schema_version)` + `status='completed'` + `MATURITY_FLOOR_HOURS` (72h) +
  `metricFor()` resolving (a REACH bucket needs a non-null `perf_reach_value`). Run it as SQL.
- **Raw facts verify, derived figures do not.** Three sessions running, the errors were in counts and
  labels derived from correct row IDs and SHAs. Two brief premises for #260 were wrong in the two familiar
  ways: a **census from the wrong source** ("9 rows, no MEASURED row, NOT_COMPARABLE = `9470151e` +
  `391b7615`" — actually 10 rows, 2 MEASURED, 1 NOT_COMPARABLE, and `9470151e` was not in production at
  all), and **severity derived from a conditional carrying a stated default** ("latent, only fires if
  `PERFORMANCE_BASELINE_MIN_SAMPLE` is tuned" — false; the live count alone overflows the fixed `5`).
  On #252 the brief itself was wrong twice ("changes zero rows", "two rows not three").
- **No credits table.** Production schema is `_migrations`, `settings`, `profiles`,
  `profile_style_fingerprints`, `analyses`. No `credits_remaining` anywhere — it cannot be refreshed
  without a billed call.

## Corrections applied to #252 in the 2026-08-19 refresh

zero-rows caveat → 5 rows; 0/3/7 census → 2/1/7; "3 rows" → 1 row; clamp section → deleted as obsolete;
sample-size leak folded into BE (cannot be gated before `state` exists).
