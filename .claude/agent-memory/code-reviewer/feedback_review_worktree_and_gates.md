---
name: review-worktree-and-gates
description: How to materialise a PR branch safely, run tsc/lint/vitest against it, and prove a removal claim — without ever mutating the owner's working tree
metadata:
  type: feedback
---

Merged from the former `feedback_pr_verification_worktree`, `feedback_prove_removal_against_the_ref`, and
the #263/#260 `review-worktree-gates` + `reviewer-verification-toolkit` notes.

## 1. Never check a ref out in place

When a review needs to actually run a PR branch (mutation tests, build, contrast recomputation), create a
**disposable worktree** and work there. **Never** run `git checkout <ref> -- .` or `git checkout -- .`
inside the agent's own worktree or the shared checkout.

**Why:** the checkout usually starts dirty (locally modified `AGENTS.md`, `my-content.db`).
`git checkout <ref> -- .` overwrites index *and* working tree for every path, silently destroying the
owner's uncommitted edits with no way to recover them — this happened during the PR #229 review.
Check `git status --short` first; if anything is dirty, a separate worktree is mandatory, not optional.

## 2. The recipe that works

```
git fetch origin pull/N/head:prN
git worktree add /tmp/prN-review prN            # or: git -C <own-worktree> worktree add /tmp/<name> origin/<branch> --detach
ln -s <main-checkout>/node_modules /tmp/prN-review/node_modules
git worktree remove --force /tmp/prN-review     # cleanup
```

A worktree-isolated reviewer cannot `cd` into another agent's worktree, and is refused any git command
that `cd`s into `/Users/jordanatha/Projects/my-content` — hence the fetch-into-own-worktree route.

What works and what doesn't under the symlink:
- `tsc --noEmit`, `npm run lint`, `npx vitest run` — **all work**. Also
  `npx --prefix /tmp/<name> tsc --noEmit -p /tmp/<name>/tsconfig.json` and
  `npm --prefix /tmp/<name> run lint`.
- **`npm run build` cannot be verified this way.** Turbopack rejects the symlinked `node_modules` with
  `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. That is an
  environment artifact — say so rather than reporting a false build failure. CI runs the real build.
- vitest/jsdom setup files resolve against the *real* path — run `vitest run --root /private/tmp/<name>`,
  not `/tmp/<name>`, or ~20 jsdom files fail with `Cannot find module '/@fs/private/tmp/...'`. That
  failure is an artifact, not a regression.

**Running the suite is safe:** `tests/api/analyses/route.test.ts` sets `TURSO_DATABASE_URL = ":memory:"`
and `tests/setup/blockLiveFetch.ts` throws on any un-stubbed fetch, so no production DB and no paid API is
reachable from the suite.

## 3. Prove a removal against the ref, not the disk

To verify a removal/deletion claim, grep the **PR ref**:
`git grep -niE "<pat>" origin/<branch> -- . ':!package-lock.json'`.

**Why:** the reviewing agent's worktree sits on `main`, so a plain `grep -rn` reports the *pre-PR* state.
During the PR #245 review this produced ~20 phantom "dangling reference" hits — every one of them was code
the PR deletes. Reporting them would have been a fabricated request-changes. The same applies to an
acceptance criterion of the form `grep -rn "<CONSTANT>" app lib tests` returns zero hits: run it against
the branch.

Three extra rules learned on #245:
- Grep **distinctive substrings**, not whole words (`ollam`, not `ollama`) — an earlier miss in this repo
  was caused by an `&apos;` HTML entity splitting a string.
- Grep the **transitive** dependency too, not just the named one (`ollama` pulled `whatwg-fetch`; the
  lockfile is only clean if both are gone).
- Docs with an amend-not-delete header rule (the TDD) are *expected* to retain a struck-through superseded
  row. Operational docs (RUNBOOK) are not — a dead env var name left in a production env matrix is a real
  hazard, since that table gets copy-pasted into deploy config.

`node_modules/<pkg>` still being present proves nothing: the shared checkout is installed from `main`. Say
the claim is unverified rather than asserting it either way.

## 4. Blast-radius queries

`~/.turso/turso db shell lasa "SELECT ..."`, read-only, `SELECT` only. **Always include `profile_id` in the
SELECT** — baseline pools are per `(profile_id, perf_bucket_key)`, and a row in the same bucket but a
different profile inflates a naive count. See [[project-production-data-and-qa]].

Related: [[mutation-proof-playbook]], [[review-conduct]], [[differential-build-proof]].
