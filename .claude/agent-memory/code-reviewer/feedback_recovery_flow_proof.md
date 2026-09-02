---
name: recovery-flow-proof
description: When a PR adds a guard, execute its documented recovery flow end-to-end on the real chain, and check every "nothing changed" claim against the loop it lives in
metadata:
  type: feedback
---

A guard PR has two halves: the check, and the operator's way out of it. Reviewers reliably verify the
first and skim the second. Both #309 findings came entirely from the second half.

**Why:** On #309 (ticket #307) the three checks were logically correct and survived every mutation I ran.
The two blocking defects were both operator-facing: the RUNBOOK's documented recovery flow did not
recover, and the abort message lied about the database's state. Neither is visible from reading the guard.

**How to apply:**

1. **Run the documented recovery flow yourself, end to end, on the REAL chain — not a subset.** Copy the
   whole `migrations/` directory, reproduce the failure, then do literally what the RUNBOOK says and look
   at where you land. On #309, following "set `ALLOW_DESTRUCTIVE_MIGRATIONS=<file>` and redeploy" destroyed
   the data *and* then died on `014`'s `ALTER TABLE ADD COLUMN` with a raw
   `SQLITE_ERROR: duplicate column name`, leaving the DB permanently un-deployable. The operator pays the
   full cost of the opt-in and gets none of the benefit.

2. **When a developer scopes a test to a subset "because later files aren't idempotent", ask what the
   scoping hides.** Being told about it out loud is good and should be said so. But scoping the *test* is
   usually the wrong remedy: on #309 the scoped-away part was the only end-to-end proof that the escape
   hatch is *useful*, as opposed to merely permissive. The unscoped test proves a fact nobody doubted.

3. **Any "nothing was committed / the database is unchanged" sentence must be checked against the loop it
   lives in.** Preflight checks that abort before the apply loop may truthfully say it. A per-item check
   inside the loop may not — earlier items already committed. Prove it with three files where the third
   trips the guard, then read back `sqlite_master` and `_migrations`. `scripts/migrate.ts`'s
   checksum-mismatch error already carries the correct "the database is now mid-sequence" caveat; use the
   sibling message in the same file as the standard, and say so.

4. **A required error string handed down in a ticket/brief can itself be the bug.** #307's contract
   mandated the literal "the transaction was rolled back; the database is unchanged". Clause one is true,
   clause two is not. Amend the contract, not just the implementation — and report it as a wrong premise
   rather than filing it as a developer defect.

5. **A new "known, accepted gaps" section reads as the definitive list.** Diff it against the previous
   review rounds' open items and name anything absent (on #309: the bare unmatched `[` fail-open from #305
   round 4).

6. **Round 2+: run the NEW documented flow verbatim too, and check which flow has tests.** On #309 round 2
   the fix was correct (non-destructive bookkeeping restore: `sha256sum` + `INSERT INTO _migrations
   (name, checksum)`, then redeploy — data preserved, 14 tracked, DB usable). But the flow the doc now
   *leads with* was the only one with no test, while the deprecated destructive path had two. The
   remedy for a bad primary flow tends to be prose; the tests stay pointed at the old one.

7. **After any review round, diff the PR BODY against the code.** Developers answer findings in reply
   comments and leave the body describing the state you rejected. On #309 the body still claimed the old
   unconditional error sentence, still presented the scoping he had since reverted, and still reported the
   old test count — and the ticket's mandated error string was never amended on the issue itself. A reply
   comment is not where the next person looks.

Related: [[review-method]], [[mutation-proof-playbook]], [[guard-strictness]], [[project-migrations-safety]]
