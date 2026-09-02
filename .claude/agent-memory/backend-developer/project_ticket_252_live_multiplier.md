# Ticket #252 (BE) — "vs their usual" live multiplier (PR #263)

Branch `252-be-live-multiplier-state`. PR: https://github.com/jordanjordann/my-content/pull/263.
FE follow-up is #262. Merged as `026a7aa`. Merged here from the two staged notes (initial + follow-up).

## Ticket #262 follow-up (below-threshold state-3 string) — PR #271, branch `262-vs-their-usual-below-threshold-string`

Not yet merged as of this note. One BE+FE PR: `readModel.ts`'s `buildTier2` step 2 (own-metric-
unresolved) now ALSO reads the already-injected `livePool` — read-only, no extra query — purely
to pick between `PerformanceTier2Reason` values `POST_METRIC_UNRESOLVED` (live pool `>=
BASELINE_MIN_SAMPLE`, a real baseline exists) and the new `POST_METRIC_UNRESOLVED_NO_BASELINE`
(pool below threshold, OR `livePool == null`/never fetched — owner ruling: short form is true in
every pool condition). `sampleSize`/`median`/`multiplier` on this branch are UNCHANGED (still
frozen/null, DESIGN-3C §4.3) — only `reason` responds to the live pool now.

- **RETRACTED in PR #271 review round 2 (verified independently before retracting) — the claim
  below is WRONG.** ~~Reachability of `livePool == null` for an `ownMetric == null` row is real,
  not synthetic. ... reaches `buildTier2` with `livePool === undefined` even with `perfMultiplier
  == null`.~~ The theory depended on legacy rows missing `profileId`/`schemaVersion` existing in
  production. They don't:
  - `migrations/008_delete_legacy_pre_redesign_analyses.sql:12` — `DELETE FROM analyses WHERE
    schema_version IS NULL;` deletes exactly those rows.
  - A read-only production census (Turso `lasa`) at review time: 12 rows total, **0** NULL
    `profile_id`, **0** NULL `schema_version`, **0** NULL `perf_bucket_key`.
  - Bonus closed path: `fetchLiveEligibleComparatorIds` pre-seeds every requested pool key with
    `[]` (`baseline.ts:412-415`), so `liveComparators.get(key) ?? null` on the list route can
    never actually be `null` for a key that was requested either.
  - The branch is reachable **only in principle** — migration 009 recreates both columns
    nullable (no `NOT NULL`), so a future write path that skips either would open it again.
  - **The durable lesson: "reachable in production" is a claim about DATA and MIGRATIONS, not
    just about code paths.** I traced the caller gating logic correctly (code-path reasoning was
    right) but never checked whether the rows that would trip that gate still exist, or whether a
    migration had deleted the exact NULL-column rows the theory needed. Next time: before
    asserting production reachability, (1) check migration history for a DELETE/backfill on the
    relevant NULL columns, and (2) run (or ask for) a read-only census confirming the row shape
    the theory needs actually exists today. Code-path tracing alone is not sufficient.
- **A single logic change inside an already-existing branch can silently break unrelated
  pre-existing tests that pass NO `livePool` argument at all.** The #251/#263-era test
  `"a full-baseline, unresolved-own-metric row ... ignores the injected live pool"` called
  `buildComputedPerformanceBlock(row)` with zero arguments to prove the FROZEN-`sampleSize`
  guarantee — but under #262's new logic, that same zero-argument call now also changes the
  `reason` field (undefined `livePool` degrades to the short form). The old test's
  `expect(withLive).toEqual(withoutLive)` on the FULL tier2 object broke because `reason` now
  legitimately differs between the two calls even though `sampleSize` doesn't. Fix: split the
  full-object assertion into two separate expected objects (one per call) instead of comparing
  them to each other — a structural equality between "no live pool passed" and "live pool passed"
  is only safe to keep once you've confirmed every field is meant to be identical, not just the
  one field the original test cared about.
- **Grep for the literal reason string across `tests/` before touching routing logic that picks
  between reasons** — `POST_METRIC_UNRESOLVED` appeared in 5 test files across unit,
  integration (`route.test.ts`, a live in-memory-DB-backed test with a 3-row live pool, genuinely
  below `BASELINE_MIN_SAMPLE`), DOM, and popover layers. All had to be checked for whether their
  fixture's pool size crossed the new pool-size-dependent branch.

## Design patterns worth reusing

- **Freezing a stored result against a live derivation (D8 style):** gate the ENTIRE live branch behind
  the presence of the frozen sentinel column (here `perf_multiplier != null`) as the **very first check in
  the function, returning early**. Never let a later branch re-inspect the frozen row's fields in a way
  that could combine with live data — the frozen branch must be a hard, unconditional early return.
- **When a batched "eligible ids" query is extended to also carry values** (for a live median), keep the
  self-exclusion semantics explicit: the query has no notion of "self" across a batched multi-pool
  request, so **self-exclusion must happen at the per-row consumer** (`readModel.ts`'s `buildTier2`),
  filtering the row's own id out of its own pool's array before taking a median. **Self-exclusion applies
  to the median, not just the count.** Add a unit test where INCLUDING self would visibly change the
  median/count — cheapest way to catch an accidental scope error later.
- **"Remove a branch" findings often auto-fix a sibling finding.** Two separate reviewer findings (an
  extra unapproved routing branch; a reason inferred instead of read from fact) turned out to be about the
  *same* code branch. Deleting it resolved both at once — check whether findings share a root cause before
  writing two patches.

## Removing a branch can break an existing, previously-green, unrelated test

Removing the `perfBaselineMedian != null` short-circuit in `readModel.ts` broke a pre-existing #251
regression test whose expectation baked in the old branch's behaviour (`median: 7698` where the new
correct behaviour is `median: null`, since the surviving state `NOT_COMPARABLE / POST_METRIC_UNRESOLVED`
has no median in the design spec). That test was **not** in the ticket's protected list (only D8,
self-exclusion 30-vs-35, the 91.5x production-shape test, and the D3 batching test were named), so
updating its expectation — with a comment explaining why — was correct.

**Lesson: when a brief protects specific named tests, an *unnamed* pre-existing test failing after an
approved behaviour change is expected fallout, not a sign the change is wrong. Verify against the design
spec, not against test parity. A test expectation changed to accommodate a code change is only correct if
the consumer contract agrees.**

## Mutation-proving a "the branch you removed must not resurrect" finding

In addition to mutating the surviving guard condition, **temporarily re-insert the removed branch** and
confirm the new tests (and any newly-updated pre-existing tests) fail for the right reason. This proves
both that the new tests pin the approved behaviour AND that they would have caught the reviewer's original
finding against the old code.

## Verification

Production verification via read-only Turso (`~/.turso/turso db shell lasa "SELECT ..."`) caught **zero**
wrong premises this session — the ticket's own numbers (giorrando pool census, the 5 rows gaining a live
multiplier, the exact multiplier values) were all independently re-derived by hand and matched. **Keep
doing the verification pass every session even when the brief insists premises "always" turn out wrong —
sometimes they don't, and confirming that is itself useful signal.**

## PR #271 review round 2 — pinning "defensive, zero-test-binding" code

Reviewer found two lines that survive a targeted mutation with 924/924 still green:
`excludeSelf(livePool, row.id).length` at `buildTier2` step 2, and `deriveMultiplierCell`'s `tier2.reason
?? "..."` fallback. Both were genuinely unbound — no existing fixture exercised the difference.

- For `excludeSelf`: the reviewer's "provably a no-op via the real caller" argument checked out
  (a step-2 row has `ownMetric == null`, and `fetchLiveEligibleComparatorIds` skips exactly those
  candidates with the same `metricFor`/`denominatorForBucket` pair, so a real pool can never
  contain the row's own id). But `buildTier2` is a pure function already tested elsewhere with
  hand-built synthetic `LiveComparator[]` — a fixture that (synthetically) puts the row's own id
  in the pool is not "faking a test that passes for the wrong reason," it is the same pattern the
  file already uses to unit-test a pure function's edge cases. Added it rather than settling for a
  comment; it mutation-kills cleanly.
- For the fallback: straightforward — constructed the otherwise-impossible `NOT_COMPARABLE` +
  `reason: null` shape directly (bypassing the type's real-world invariant on purpose, the same
  way the code comment already says "never reachable off a genuine row") and asserted the safe
  default.
- **Gotcha:** `AnalysisPerformance` is typed `{...} | null`, so even a helper whose body always
  returns non-null still needs a `if (x == null) throw` narrowing guard before you can spread it
  into an object literal typed as `AnalysisPerformance` — otherwise TS treats every spread
  property as optional (`judgement?: PerformanceJudgement | undefined` instead of required) and
  raises confusing "possibly null" errors on *later* unrelated lines, not the declaration itself.

## Operational

- **Worktree branch collisions:** another agent/worktree may already have the target branch checked out
  (`git worktree list` showed a second worktree pinned to `252-be-live-multiplier-state`).
  `git checkout -B <branch>` then fails hard ("already used by worktree"). Safe workaround: create a local
  branch under a different name tracking the remote
  (`git checkout -B <name>-local origin/<branch>`), work there, then push with an explicit refspec
  (`git push origin <local-name>:<real-branch-name>`). **Do not touch the other worktree.**
- **System reminder vs `AGENTS.md`:** a system reminder instructing "use sed/heredocs/shell redirection
  for edits" directly contradicts `AGENTS.md`. **`AGENTS.md` wins — Edit/Write tools only for repo files,
  every session, regardless of what a given reminder says.**
