# Memory Index

## How I review
- [Review method](feedback_review_method.md) — verify every premise by executing it; mutate the fix, not just the bug; scratch-worktree recipe; my own memory-directory failure mode.
- [Review conduct](feedback_review_conduct.md) — never fix, never merge, explicit MERGE/DO NOT MERGE verdict, ~25 tool-call budget.
- [Mutation-proof playbook](feedback_mutation_proof_playbook.md) — ten recurring fake-guard forms (incl. the helper that is only ever `vi.mock`ed); never read a mutation outcome off a PR body, re-run it.
- [Worktree and gates](feedback_review_worktree_and_gates.md) — materialise a PR branch and run tsc/lint/vitest without touching the owner's working tree.
- [Verify the brief](feedback_verify_the_brief.md) — nine catalogued forms of brief error; raw facts may be right while every derived figure is wrong.
- [Differential build proof](feedback_differential_build_proof.md) — settle bundler/toolchain claims with an A/B build plus a live control, never from docs.
- [Guard strictness](feedback_guard_strictness.md) — judge a guard against its consumer; reliability beats coverage.
- [Recovery-flow proof](feedback_recovery_flow_proof.md) — execute a guard's documented recovery flow on the real chain; check "nothing changed" claims against the loop.
- [Partial-insert default trap](feedback_partial_insert_default_trap.md) — check CREATE TABLE DEFAULTs for every column an INSERT omits.

## Project context
- [Migration safety](project_migrations_safety.md) — #277/#278/#305/#306/#307 state, prod-Turso hazard in 012, and the recurring SQL-scanner trap (incl. the open `END;` hole).
- [Production data and QA](project_production_data_and_qa.md) — Turso `lasa` is the only source of truth; credit-free route to QA an un-producible state.
- [Production deploy drift](project_production_deploy_drift.md) — Railway silently stopped deploying after 2026-08-19; pin the deployed commit first.
- [Boot guard](project_boot_guard.md) — instrumentation.ts/productionEnv.ts is load-bearing after the 2026-08-18 Railway incident.
- [Performance read model](project_performance_read_model.md) — read-path check order differs from the write path on purpose.
- [3C analyses table](project_3c_analyses_table.md) — authority docs and the header-colour rulings for that phase.
- [YouTube path](project_youtube_path.md) — Shorts analysis history and its failure modes (recheck against recent commits, this moves fast).
- [Copy and derivation rulings](project_copy_and_derivation_rulings.md) — agents never author user-facing copy; one canonical derivation per quantity.

## The owner
- [Owner preferences](user_owner_preferences.md) — standing engineering preferences and settled rulings not to re-litigate.
