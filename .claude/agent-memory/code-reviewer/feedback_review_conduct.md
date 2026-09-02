---
name: review-conduct
description: How a review is run and delivered on this repo — never fix, never merge, verify every claim independently, explicit MERGE/DO NOT MERGE, ~25 tool-call budget
metadata:
  type: feedback
---

Merged from the former `feedback_review_method`, `feedback_review_protocol`, `feedback_review_standards`,
`feedback_review_rigor` and `feedback_review_verdict_conventions`. Nothing here was summarised away.

## 1. Standing rules

- **Review and comment only. Never fix the code. Never merge** — the owner confirms every merge personally.
- **Never take a claim from the PR body or the developer's report as evidence.** Re-run the tests,
  re-compute the ratios, re-read the authority-doc section yourself. Reviews here are adversarial
  verification, not a read-through.
- **Verify every premise in the brief and in the PR description independently.** The two reliable tells:
  **a conditional carrying a stated default**, and **a claim sourced from the wrong place**. Name each
  error explicitly instead of quietly working around it. See [[verify-the-brief]].
- **Do not manufacture findings.** If a PR is clean, say so plainly. Equally, do not wave something
  through because the developer disclosed it — rule on it with arithmetic.
- **Give (and honour) an explicit tool-call budget and say the number.** ~25 tool calls is the standing
  figure for a review here. Read the full diff in one call; no per-file diffing, no Playwright, no test
  scripts, no DB seeding. Mutation runs are worth the calls.
- Next.js here is **16.2.10 with breaking changes vs. training data**. Never review a Next API claim from
  memory — read `node_modules/next/dist/docs/` and quote the actual section. PR authors cite doc paths;
  check the path exists and says what they claim. `node_modules/` is absent from agent worktrees — read
  docs from the shared checkout. (Caveat: the docs cannot settle every toolchain question — see
  [[differential-build-proof]].)
- **Never spend ScrapeCreators or Gemini credits. Never create/modify/destroy Railway or Turso infra.**
  Production Turso is read-only `SELECT` via `~/.turso/turso db shell lasa` (binary is **not** on `PATH`);
  the local `my-content.db` is a stale fossil that has already caused two wrong diagnoses.

**Why:** the owner's briefs were wrong roughly 25 times in a prior session. Independent verification is
the whole value of the review.

## 2. Mutation discipline (short form; full playbook in [[mutation-proof-playbook]])

- Re-run every reported mutation proof yourself, **one at a time, not batched**. Batching lets a kill from
  one mutation mask a survivor in another.
- For each mutation state whether the killing assertion is on a **label / error class / named field /
  structural count** or merely on a **value**. A value-only kill is weak evidence; a label/error kill is
  strong.
- **Revert every mutation with the Edit tool, never `git checkout --`.** Edit fails loudly if the file
  drifted; `checkout` would silently discard unrelated work in a parallel worktree. Finish with
  `git diff --stat` empty and the suite back at its baseline count.
- **Mutation-prove every negative assertion.** For every `not.toMatch` / `not.toContain` /
  `.not.toThrow()`, break the thing under test and confirm *that specific assertion* fails — not just
  that some test in the file fails. Check the AssertionError text.
- Sweep for the `?? ""` / `split(...)[1] ?? ""` pattern in tests: a fallback empty string makes every
  subsequent negative assertion vacuous unless a positive assertion pins the haystack non-empty.
- **Flag any test that cannot fail.** Asserting "class X exists somewhere in the tree" proves nothing —
  assert which element carries it, and verify the negative half fails when violated.
- **Fixtures that hand-copy production values are a standing defect class here.** Test fixtures
  duplicating design-token values (e.g. `DARK_TOKENS` in `tests/helpers/contrast.ts` transcribing `.dark`
  oklch values from `app/globals.css`) pass forever after the real token breaks. Always mutate the real
  source and confirm a test fails.
- **A test expectation changed to accommodate a code change is only correct if the consumer contract
  agrees.** Check the design spec, not test parity, before accepting an edited expectation.

**Why:** PR #184 alone produced *three* vacuous assertions (e.g. `expect(block).not.toMatch(/-\d/)` against
a fixture whose buggy path could never emit a negative) and *three* inaccurate body claims (a type probe
that did not exist; "parser rejects extra fields" when it silently drops them; a blocker-3 bullet
describing the rejected widening as the shipped fix after the code had been reverted to the opposite).
Green tests and a confident body are not evidence on their own here. This project shipped non-compliant
colour twice (#101, #102), needed a patch in #113, and audit finding M11 shipped a contrast measurement
against four surfaces the element never sits on.

## 3. What else to re-run, never quote

- Re-run `tsc --noEmit`, `lint`, `build` and the full suite rather than quoting the PR body's table.
- Verify the rebase claim: `git merge-base --is-ancestor origin/main <branch>` plus
  `rev-list --left-right --count`. A separately-green branch proves nothing.
- **Always merge current `origin/main` into the branch and re-run the full chain** before any verdict.
  Blockers are frequently discharged by a *different* PR merged after the review.
- Re-read the PR body on **every** pass, including passes where only code changed. Follow-up bullets go
  stale when an approach is reverted, and the body becomes the squash-merge commit message — so every
  claim in it must be literally true at HEAD. Wording that overstates what a test does is a
  blocking-level accuracy issue, not a style nit.
- **`Closes #NNN` has silently failed at least twice in this repo — always verify issue state after every
  merge.**

## 4. Verdict and routing conventions

- **End with an explicit MERGE / DO NOT MERGE**, one per PR.
- Structure findings as **Blocking / High / Medium**, plus an explicit **"verified correct"** section
  listing premises checked and confirmed — the owner uses that to know what was actually checked versus
  assumed.
- **Findings that belong to a future ticket must be posted on that ticket's issue**, not left as a doc
  comment in source or in a PR body. The next implementer reads the ticket, not a file they haven't
  opened. This was a blocking item on PR #179.
- **Verify doc corrections by content, not line number** — line numbers shift between review and fix.
- Stale rationale in a PR body (e.g. a deferral blamed on a now-closed ticket) is a **note, not a
  blocker**, but ask for the edit before merge so the merge commit doesn't record a false reason.
- Deferred non-blocking findings get their own issue; on re-review, confirm only that the PR didn't
  silently change them — **do not re-raise them as blocking**.
- Post the review with `gh pr comment N --body-file <file>`, then verify the body is non-blank.
- **`gh pr review --request-changes` / `--approve` always fails here**: every PR is authored by
  `jordanjordann`, the same account the CLI is authenticated as, and GitHub refuses self-review
  ("Can not request changes on your own pull request"). Skip it entirely — go straight to
  `gh pr comment` and put the verdict as the first line of the body.
- `npm run build` cannot be reproduced in a throwaway worktree: Turbopack rejects the symlinked
  `node_modules` ("Symlink [project]/node_modules is invalid, it points out of the filesystem root").
  Report the checkbox as **un-reproduced, not failing**, and say whether the diff touches any
  `app/`/`lib/` source — if it doesn't, a build regression isn't mechanically possible.
- **When a reviewer reviews their own proposal or their own blocker, they must argue the opposite case
  first.** This produced the most valuable finding in both #257 and #263 r2/r3. Do it unprompted.
- **When two agents independently disagree with the boss, the boss is wrong** (owner ruling relayed in
  the 2026-08-20 consolidation brief).

**Why:** the owner runs a multi-agent workflow with parallel worktrees, so review context goes stale fast
and findings evaporate unless they land on the owning ticket.

Related: [[mutation-proof-playbook]], [[verify-the-brief]], [[review-worktree-and-gates]],
[[owner-preferences]].
