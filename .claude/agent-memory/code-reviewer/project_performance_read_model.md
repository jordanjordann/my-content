---
name: project-performance-read-model
description: Rulings governing lib/server/analysis/performance — read-path check order differs from the write path ON PURPOSE, tier2 consumers must ship with producers, no LIMIT in baseline.ts
metadata:
  type: project
---

Merged from the #252/#263 review notes `perf-baseline-write-path-order` and
`readmodel-discriminator-consumer-gap`.

## 1. The read path's check order deliberately differs from the write path — do NOT "align" them

`computeBaseline()` (**write** path) checks pool-size-below-threshold FIRST, then own-metric-unresolved,
then median-zero.

**DESIGN-3C §3 (the read path, #252) deliberately hoists own-metric-unresolved ABOVE the pool-size
check**, because no amount of further analysis recovers a count Instagram never published.

**Why this matters:** briefs and reviewers repeatedly restate the required read-path order as "match
`computeBaseline()` exactly", which is wrong at the top level and would reintroduce the
cold-start-on-an-uncomparable-row defect. **Treat "matches the write path" as a claim to check against
DESIGN-3C, not as a goal.** This is a prohibition, not a to-do.

The write path's own order, for reference, must still be reused as-is on the write side:
`pool < MIN -> COLD_START; own metric null -> NOT_COMPARABLE/POST_METRIC_UNRESOLVED; median == 0 ->
MEDIAN_ZERO; else MEASURED`.

## 2. `baseline.ts` has NO `LIMIT` — that is an OBSERVATION and a PROHIBITION, not a fix instruction

**This has been MISREAD TWICE as an instruction to add one. It is not.**

`lib/server/analysis/performance/baseline.ts` contains **no `LIMIT` anywhere in the file**.
`fetchCandidateRows()` and `fetchLiveEligibleComparatorIds()` return the whole pool, by design.

**Adding a `LIMIT` to `fetchCandidateRows()` would corrupt `computeBaseline()`'s median — it is the same
query.** Any PR or brief proposing a `LIMIT` there is proposing a data-corruption bug. The correct fix for
an over-threshold displayed count is a **display clamp**, not SQL. Reject the SQL route on sight.

## 3. Producer and consumer must ship together (this caused a real production regression)

When reviewing changes to `lib/server/analysis/performance/readModel.ts`'s `tier2`, **always** check
`lib/api/analyses/helpers.ts` (`deriveMultiplierCell`, ~line 387/391/405) and
`AnalysisScoreExplainPopover/helpers.ts` (~line 69).

PR #263 (ticket #252) nulled `tier2.median` for `POST_METRIC_UNRESOLVED` rows server-side but did not
migrate these consumers, which still routed on `tier2.median != null` / `tier2.median === 0` rather than on
the `state`/`reason` discriminator the PR added. Production row `391b7615` silently flipped from the
not-comparable statement back to the cold-start progress cell — **a regression of #251/#258 shipped by a
BE/FE split on a "new field, old reader" seam.** CI was green because the consumer tests build their own
`tier2` fixtures and never see real route output.

**RULE: when you replace a signal, producer and consumer must ship together.** Any PR that changes what
`tier2` fields contain is incomplete until the consumer switch **and** an end-to-end test (route response
-> `deriveMultiplierCell`) land with it. A green suite across a server/client type boundary with
duplicated types (`lib/api/analyses/types.ts` mirrors `readModel.ts`'s `PerformanceTier2` by hand) proves
nothing about the wire.

## 4. Other invariants in this area

- **Self-exclusion applies to the MEDIAN, not just the count.** The pool map must carry ids alongside
  values.
- **A stored `MEASURED` multiplier is NEVER recomputed** (frozen-multiplier guarantee, TDD §14.8a / D8).
  The frozen branch must be a hard, unconditional early return gated on `perf_multiplier != null` as the
  very first check. No backfill, no recompute job, no migration, no writes.
- `computeBaseline()` **throws** on mixed denominators. Do not port that onto the read path — it would 500
  the analyses list.
- `BASELINE_MIN_SAMPLE` (server, default 5, env `PERFORMANCE_BASELINE_MIN_SAMPLE`) formerly had an FE twin
  `BASELINE_MIN_SAMPLE_DISPLAY` (hardcoded 5). **The FE constant was deleted by #260 / PR #261**; the
  threshold is now per-row `PerformanceTier2.minSample`, clamped with `Math.min` in `deriveMultiplierCell`
  (`lib/api/analyses/helpers.ts:405`). Any doc still naming the old constant is stale.
- Shipped state-3 copy lives at `lib/api/analyses/constants.ts:18`:
  `this creator's usual is set — this post's own count wasn't published`. **#251's body proposes
  different, never-shipped copy. Never quote copy from a ticket body; quote `constants.ts`.**

- **`fetchLiveEligibleComparatorIds` pre-seeds every requested pool key with `[]`** (`baseline.ts:412-415`)
  precisely so a caller never distinguishes "not fetched" from "fetched, zero eligible". So the routes'
  `liveComparators.get(...) ?? null` **cannot** yield `null` for a requested pool — the only `livePool ==
  null` sources are the four-condition gate failing (`perfBucketKey` / `perfMultiplier` / `profileId` /
  `schemaVersion`), and prod has zero rows with any of the first three NULL. Use this before ruling on any
  "this degrade branch is reachable" claim.
- It also **skips candidates whose own metric is `null`** (`if (metric == null) continue;`), which means a
  step-2 (`ownMetric == null`) row can never be in its own pool — so `excludeSelf` on the step-2 branch is
  provably a no-op. PR #271: mutating it to raw `livePool.length` survives the whole suite, correctly.
  That is a test-quality finding, not a bug — don't block on it.

## 5. The `NOT_COMPARABLE` reason union is exhaustiveness-enforced only via `AnalysisTableRow`

Since #271 the union has **three** members (`POST_METRIC_UNRESOLVED`,
`POST_METRIC_UNRESOLVED_NO_BASELINE` = `this post's own count wasn't published`, `MEDIAN_ZERO`) and is
hand-retyped in **three** places (server `readModel.ts`, `lib/api/analyses/types.ts`'s
`PerformanceTier2Reason`, and `AnalysisTableMultiplierCell.reason`). Proven by mutation, both directions:
removing a copy key → `TS2741` at `constants.ts`; adding a union member → `TS7053` at
`AnalysisTableRow.tsx:254` indexing `NOT_COMPARABLE_MULTIPLIER_CELL_COPY`. **The server→FE hop has no
structural link**, so a server-only addition still compiles and renders `undefined` — the §3 seam again.

Related: [[guard-strictness]], [[project-production-data-and-qa]], [[mutation-proof-playbook]],
[[verify-the-brief]].
