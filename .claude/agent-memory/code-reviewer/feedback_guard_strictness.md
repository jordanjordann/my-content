---
name: guard-strictness
description: How to rule on a guard — strictness is judged against the consumer, never in isolation; reliability beats coverage; a value-presence null check is not state inference
metadata:
  type: feedback
---

Merged from the former `feedback_guard_strictness_matches_consumer`, `feedback_reliability_over_coverage`,
`project_owner_reliability_preference`, and the #263 r3 `review-discriminator-vs-value-guard` note.

## 1. Strictness is judged against the consumer

A validation guard should be **exactly as strict as the code path it protects** — no looser, no stricter.
Before filing "this `=== \"true\"` would miss `1` / `TRUE`" as a finding, grep the consumer and check what
*it* compares.

On PR #247 the brief flagged `RESET_PIN === "true"` in `lib/server/env/productionEnv.ts` as a likely hole.
It is not. `lib/server/auth/auth.ts:87` uses the identical strict comparison, so `RESET_PIN=1` genuinely
does not wipe the PIN. Loosening the guard would have started failing deploys that were actually safe.
Note this repo *also* has a lenient `resolveBooleanEnv` in `lib/server/auth/constants.ts` (accepts
`true|1|false|0`, trimmed, case-insensitive) used for other flags — so "the repo's convention" is
genuinely split, and only the specific consumer settles it.

**State the finding as "guard and consumer disagree", never as "the guard is too strict" in isolation.**
If they disagree, the fix usually belongs in the consumer, not the guard — say which file owns it, since
that is often outside the PR's scope.

## 2. Reliability over coverage (owner's standing tie-breaker)

When adjudicating a design trade-off, choose the option that **cannot produce a confident-looking wrong
number**, even if it means scoring/analysing fewer posts. **Doc comments are never a guard — only code
is.** A guard that admits an invented figure is worse than one that fails loudly, even when the loud
failure burns a billed API call.

**Why:** the product's output (Indonesian judgement prose with percentages) gets pasted straight into
client decks, so a fabricated or mislabelled figure escapes every UI safeguard. Coverage loss is
recoverable; a wrong number in a client deck is not. A `NumeralFabricationError` is information the owner
wants.

**Precedent — PR #184 blocker 3 (#142).** The fabrication guard's `realNumerals` allow-list was widened to
admit context-block figures so compliant prose would stop throwing. The correct call was to **narrow the
prompt** (`ANGKA_ENGAGEMENT` as the only quotable figure) rather than **widen the guard** — widening was a
laundering surface, since `assertNumeralsAreReal` matches *values*, never labels.
**The prose guard is never widened** (settled ruling, see [[owner-preferences]]).

**How to apply:** when a developer proposes widening an allow-list, loosening a guard, or adding a
fallback so that more cases succeed — say plainly that it is the wrong direction and name the narrowing
alternative. When Half A (prompt text, `prompts/user.ts`) and Half B (the guard, `prose/guard.ts`)
disagree, close the gap by tightening the instruction, not by loosening the guard. Any residual mismatch
must fail in the safe direction: throwing on something the text did not literally forbid is acceptable;
permitting something the guard should catch is not.

## 3. State inference vs. value-presence guard — do not conflate

When auditing for "code that infers state from value-nullness", separate two patterns that look identical
textually:

- **State inference (the bug):** `median != null` used to *route* between rendered states. Breaks the
  moment a state legitimately carries a null value.
- **Value-presence guard (fine):** `median != null` guarding a line that is about to *interpolate*
  `median`. Nothing branches on it.

On PR #263 round 3, `buildOperandRows` read `tier2.median != null` / `tier2.multiplier != null` after the
routing bug was fixed elsewhere. Textually it was the pattern I had blocked on; functionally it was a
display guard equivalent to the `state` test under the new invariants. Blocking on it would have been a
false positive.

**Ask: "does anything branch on this, or does it only decide whether to print the value it just tested?"**
Still worth a non-blocking nit to switch to the canonical `state` read, so the file leaves no pattern that
reads as precedent.

## 3b. "Last attempt failed" is not "never succeeded" — check whether the marker can coexist with real data

When a PR adds a failure/error marker column and then gates something on `!row.marker`, ask whether the
marker can be set on a row that **also carries real, previously-fetched data**. It usually can, and the
gate then overshoots the decision the PR body actually states.

**Why:** PR #302 r2 (#291) added `profiles.lookup_failed_at` and gated `analyses.profile_id` on
`profile && !profile.lookupFailedAt`. The PR body's ruling was about a *failure-only* row, but the
predicate also fires for a row with a real `follower_count` whose 8-day-stale refresh threw once
(reachable on the **Instagram** path via any transient ScrapeCreators error — Instagram never throws on a
missing count, only on network failure). Result: an `analyses` row asserting `follower_count = 260675`
**and** `profile_id = NULL`, silently dropping that analysis out of its own creator's
`(profile_id, perf_bucket_key, schema_version)` baseline pool for >=6h — and forever if the failure
persists, since only a successful `upsertProfile` clears the marker. A YouTube ticket regressing the
Instagram path, uncovered by any test.

**How to apply:** demand a discriminator for "this row has never had a successful fetch" — usually a
sentinel the same PR already introduced (`lastFetchedAt !== PROFILE_NEVER_FETCHED_SENTINEL`) — rather than
"the most recent attempt failed". Also argue the opposite case first: an identity FK like `profile_id` is
not a freshness signal, so the conservative ruling is defensible for a never-fetched row and indefensible
one inch beyond it.

**Resolved on #302 r3 (accepted).** The landed discriminator is a pure **string equality against a value
sentinel** (`profile.lastFetchedAt !== PROFILE_NEVER_FETCHED_SENTINEL`, wrapped in a
`profile is Profile` type predicate). Two things make it the right shape, worth reusing and worth saying
out loud when approving one: (a) no `Date.now()`, no parse, no comparison operator, so **clock skew and
timestamp-format drift cannot make it wrong** — unlike the `isStale`/`isLookupFailureFresh` helpers next
to it; (b) it holds across *repeat* failures only because `recordProfileLookupFailure`'s `ON CONFLICT`
branch never touches `last_fetched_at`. **Always verify (b) at the repository, not the doc comment** —
the whole guard collapses if any future `ON CONFLICT` bumps that column. Enumerate all five states before
approving: never-fetched / N-failures-never-succeeded / real-then-one-failure / real-then-N-failures /
failed-then-succeeded.

**And re-mutate every call site of the fix, one round later.** #302 r3 fixed the same field at two
`computePerformanceBlock` calls; the author's report said "reverted `audienceSourceFetchedAt` → test
fails", true at site 1 and false at site 2, where the mutation survived all 978 tests — the identical
uncovered-sibling gap (playbook form 7) I had blocked on one round earlier, recurring on the very field
being fixed. When the code at HEAD is correct, that is a test-quality finding and does **not** block.

## 4. Type strengthening is not type loosening

A required (non-optional) property addition is a **strengthening**; a cascade of `TS2322`/`TS18047` from it
is expected fallout, not a loosening. Check for `?`, widened unions, `as`, `any`, `!` in *production* code
before calling it a weakening — `!` inside test assertion chains is normal ergonomics. And **never "fix"
the cascade with `!`, `as`, `any`, or `@ts-expect-error`**: fix the fixtures.

Related: [[owner-preferences]], [[review-conduct]], [[verify-the-brief]],
[[project-performance-read-model]].
