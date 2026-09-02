---
name: project-migrations-safety
description: Migration-runner safety work (#277/#278/#305, #306, #307) — what is settled, what is still open, and the recurring SQL-scanning trap
metadata:
  type: project
---

`scripts/migrate.ts` runs as Railway's `preDeployCommand` against the **production Turso database**, and `migrations/012_performance_block.sql` contains an unconditional `DELETE FROM analyses;`. Never run migrations against a real or remote DB during review — throwaway `mkdtemp` + `file:` libsql only.

**Why:** a re-run of 012 (triggered by renaming the file, or restoring/dropping `_migrations` to a pre-012 state) destroys every analysis row and rebuilds `analyses` with 012's narrower CHECK while `_migrations` still claims 013 applied. Verified by execution, not theory.

**Settled as of 2026-08-27 (PR #305, round 4 — approved merge-ready, docs-only conditions):**
- Owner ruled (option B) that hardening 012 *from the inside* is wrong: an in-file guard would keep row counts at 1 -> 1 on a forced re-run, blinding #307's planned row-count tripwire while the perf block is destroyed anyway. 012 is reverted to `main` (blob `6631af32`) and left unguarded **on purpose**.
- Protection moves to the runner: ticket **#307** (row-count tripwire + checksum-column check + interactive-transaction check), designed in `docs/TDD-migration-runner-guard.md`. #307 depends on #305 merging first.
- Atomicity (#277) and checksum adopt-on-first-sight (#278) verified correct. First deploy: `14 total, 0 applied, 0 unchanged, 14 adopted-legacy-checksum`, exit 0, 012's DELETE does not run. Second deploy: `14 total, 0 applied, 14 unchanged, 0 adopted`.
- Baselines: `main` @ `67dba0b` = 980 tests; #305 merged = 1027 (the branch adds all 47 tests of `tests/server/db/migrate.test.ts`).
- Open on merge and intentionally so: the rename hole, the `_migrations`-restore hole, and the `END;` hole below.

**Recurring trap — scanning SQL for transaction control.** Three consecutive rounds were blocked on the same function pair, `stripCommentsAndStrings` / `hasResidualTransactionControl`:
- Round 2: raw-text `\bCOMMIT\b` scan false-positived on comments, string literals and identifiers (fail-closed).
- Round 3: the "fix" blanked **string literals before comments**, so an apostrophe in a comment (`don't`, `it's`) opened a phantom string that swallowed real SQL forward — fail-**open** on a real second transaction block in **5** of the 14 files (009, 010, 011, 012, 014; the PR body only reported 3). 8 of 14 files have an apostrophe inside a comment. No fixed-order multi-pass regex can be correct; only a single left-to-right scan is.
- Round 4: single-pass tokeniser (`--`, `/* */`, `'…'` with `''`, `"…"`/backtick with doubled-quote escape, `[…]`), blanking with spaces so offsets line up. Verified correct under 21 adversarial cases; ~0.1 ms per real file, no backtracking. This is the right design — do not re-litigate it.

**Still-open scanner hole (flagged round 4, must land in #307):** `RESIDUAL_TRANSACTION_STATEMENT` only knows `BEGIN TRANSACTION` and `COMMIT`. SQLite's `END` (a COMMIT synonym) and bare `BEGIN;` are invisible, so a second block shaped `… END; BEGIN; … ` passes the check. Executed proof: `tx.execute("END")` inside `client.transaction("write")` is **accepted silently and durably commits** (work before it survives a later `tx.rollback()`); the next statement then throws `TRANSACTION_CLOSED`, leaving the body half-applied with **no `_migrations` row** — the exact window #277 exists to close. `BEGIN` inside the tx does throw, so `BEGIN;`-first shapes stay fail-closed. **Do not "just add END" to the regex** — the split-on-`;` scan currently leaves `CREATE TRIGGER … BEGIN … END;` correctly quiet, and adding `END` would false-positive on every trigger. Needs trigger-aware handling.

**How to apply:** when reviewing anything in this area, test the scanner against real migration content, not synthetic snippets; check the fail *direction* (a fail-open check here is worse than no check, by the same argument that got the 012 guard reverted); and check the *vocabulary* of the statement regex, not just the stripper — round 4 showed the weak point had moved from the stripper to the token list.

Related: [[feedback-review-method]], [[mutation-proof-playbook]]
