---
name: owner-preferences
description: The owner's standing engineering preferences and the settled rulings that must not be re-litigated
metadata:
  type: user
---

The owner is the product owner and **confirms every merge personally; a reviewer never merges.**

## Standing preferences that decide close calls

- **Reliability over coverage.** Prefer the option that cannot produce a confident-looking wrong number,
  even at the cost of scoring fewer posts. A loud failure beats a plausible fabricated figure. Full
  treatment in [[guard-strictness]].
- **Doc comments are not guards.** Prefer making the illegal state unrepresentable (e.g. keep a boolean,
  delete the number it could be rendered as) over documenting that nobody should misuse a field.
- **One canonical derivation per quantity** (TR-1). Two expressions computing the same quantity into the
  same output is a defect in itself, **even when they currently agree** — agreement maintained by care
  rather than by construction is the thing the rule exists to forbid. This **outranks a ticket's "Files
  Affected" list**: scope does not suspend it, and importing an existing pure primitive does not widen a
  ticket's write surface. When a developer justifies a duplicated derivation on scope grounds, that is a
  scope argument, not a correctness one — say so.
- When adjudicating whether work discharges a ticket, answer plainly whether the *next* ticket will extend
  or rebuild it — the owner wants that **before** the next ticket is dispatched, not after.

## Settled rulings — do not re-litigate

| Ruling | Statement |
| --- | --- |
| **OR-25** | **No retry on prose-guard failure.** CONFIRMED since 2026-08-06 (TDD §0.6, restated §13 E7). A violation burns a billed Gemini call and fails the analysis; the owner understands and accepts that. Recording it as "under consideration" was an error, corrected 2026-08-18. The UX pain point (a failed analysis leaves no trace, user sees a generic error) is retained as a **separate error-surface question** — it is **not** a reopening. **Statements only, never a button** — anyone who wants retry behaviour needs a **new** owner ruling. |
| **OR-27** | **R-12.7.1 is DIRECTIONAL, not a blanket ban** on `__typename`/`is_video` inside `reach.ts` (ruled 2026-08-19, TDD §3 / §3.1 item 3). It forbids using a content-kind signal to **suppress, override or shortcut a reach field that is present**; `hasReachFields()` stays the first gate and always wins when the keys exist. It does **not** forbid consulting a **positive** video signal **inside the branch that has already resolved to `NONE`**, to distinguish "this content kind has no reach field" from "this is video and the reach field did not come back". PR #152's BLOCKING-1 is **not** reopened — that was the suppressing direction. §3.1's `analysis_mode` derivation stays **FALSIFIED** on items 1, 2 and 4; OR-27 does not revive it. |
| **Frozen multiplier (TDD §14.8a / D8)** | **A stored `MEASURED` multiplier is NEVER recomputed.** The live derivation is gated behind `perf_multiplier != null` as a hard, unconditional early return. |
| **No backfill / no recompute / no migration** | No backfill job, no recompute job, no writes, no migration 014 for 3B/3C (`014_jobs.sql` stays reserved for the 3A queue, TDD §10.2/§15). Stored `perf_*` values are FROZEN without an explicit owner ruling. |
| **Never delete analyses to "fix" a display bug** | Lossy and unapproved. The owner's fallback remark *"we can always remove the old data"* is **NOT approved**: rows are permanent inputs to one another, and 5 paid ScrapeCreators+Gemini runs were imported to production specifically to avoid re-spending. |
| **NO `LIMIT` in `baseline.ts`** | **An observation AND a prohibition — not a fix instruction. This has been MISREAD TWICE.** `baseline.ts` contains no `LIMIT` by design; adding one to `fetchCandidateRows()` would corrupt `computeBaseline()`'s median, since it is the same query. Details in [[project-performance-read-model]]. |
| **Read-path check order** | DESIGN-3C §3 requires **own-metric-unresolved to be checked ABOVE pool size on the read path**, deliberately unlike the write path. **Do NOT "fix" it to match the write path.** |
| **`INSUFFICIENT_HISTORY` and `THIN_SAMPLE` both stay** | `INSUFFICIENT_HISTORY` is declared and intentionally **never produced** by `judgement.ts` (§5.3, DESIGN-3B §5.5); its muted `—` is a ruling, not an oversight. `THIN_SAMPLE` stays as a guard and a declared `ConfidenceReason`, not as a state a user reaches. |
| **The prose guard is never widened** | Close a prompt/guard mismatch by tightening the instruction (`ANGKA_ENGAGEMENT` as the only quotable figure), never by widening `assertNumeralsAreReal`'s allow-list. |
| **R-D18 kept / R-D19 rejected** | Engagement header colour is invariant across all button states; the hover underline is rejected and the missing affordance is accepted knowingly. See [[project-3c-analyses-table]]. |
| **M11 is the owner's own task** | Kind-badge contrast over photography (TDD §16.5, no ticket). Do not assign it or fold a fix into another PR. |
| **PIN rotation declined** | Relayed by the owner, 2026-08-20 consolidation brief. No doc citation located in-repo — treat the brief as the source. |
| **The repo stays PUBLIC** | Relayed by the owner, 2026-08-20 consolidation brief. No doc citation located in-repo — treat the brief as the source. Consequence: the data-exposure surface (tracked `my-content.db`, unedited IG fixtures) is a live concern, not a theoretical one. |

## Method lessons the owner has ruled on

- "Verify the premises in this brief and report every one that is wrong." (See [[verify-the-brief]].)
- When a reviewer reviews their own proposal or their own blocker, **argue the opposite case first**.
- **When two agents independently disagree with the boss, the boss is wrong.**
- **Raw facts verify, derived figures do not.**
- A test expectation changed to accommodate a code change is only correct **if the consumer contract
  agrees**.
- **When you replace a signal, producer and consumer must ship together** — violating this caused a real
  production regression (PR #263, a BE/FE split on a "new field, old reader" seam).
- **Self-exclusion applies to the median, not just the count.**
- Adding a required field to a type causes a TypeScript **inference cascade on unrelated sibling consts** —
  never "fix" those with `!`, `as`, `any`, or `@ts-expect-error`.
- **`Closes #NNN` has silently failed at least twice in this repo** — always verify issue state after
  every merge.
- **The repo's `my-content.db` is a stale fossil, never cite it**; production Turso is the only source of
  truth.
- **Give reviewers an explicit tool-call budget and say the number.**

## ⚠️ UNRESOLVED CONFLICT — ScrapeCreators credit balance

Four disagreeing figures are recorded in the repo. **Do NOT resolve this by measuring — measuring costs
real credits.** Quote none of them as current; quote the range and the conflict.

| Figure | Source | Date |
| --- | --- | --- |
| **31,986** — explicitly a **STALE UPPER BOUND**, directly observed | `.claude/context/agent-state.md` | 2026-08-07 (marked stale as of 2026-08-19; ≥6 billed analyses since) |
| **31,984** — *inferred*, not observed | `docs/RUNBOOK.md` §5 | 2026-08-06 V1/V3 session |
| **31,994** — recorded in `agent-state.md` as superseded historical | `docs/RUNBOOK.md` §5 (per agent-state) | 2026-07-22 |
| **~25k** | `.claude/context/fixtures/README.md` | 2026-07-21 |

The ~25k figure is the outlier and is *older* than the ~31.9k readings, so it cannot be a later
drawdown — at least one of these is simply wrong. Flag it to the owner rather than picking one.

Related: [[review-conduct]], [[guard-strictness]], [[project-performance-read-model]],
[[project-production-data-and-qa]].
