---
name: feedback-review-method
description: How Jordan wants PR reviews done in this repo — verify every premise by executing it, never trust a claim in a brief or PR body
metadata:
  type: feedback
---

Verify every premise by executing it — including the dispatcher's brief, the developer's PR body, the tech lead's design, and your own findings from prior review rounds. Never accept a claim as settled because someone stated it.

**Why:** Every dispatch in the #305 series found at least one wrong premise. Two dispatch briefs contained factual errors; a round-1 report claimed to have written memory files that did not exist (this happened twice — see below); a round-2 test suite passed 35/35 while the code under test was gutted. Claims in this repo have repeatedly been confidently wrong.

**How to apply:**
- Confirm file reverts with **blob SHAs** (`git rev-parse branch:path`), not by reading a diff that omits the file. Absence from a diff is weaker evidence than a SHA match.
- Reproduce first/second-deploy behavior by **building a prod-shaped database** on a throwaway local `file:` libsql DB and running the real exported functions. Assert on row **contents** (checksums equal on-disk hashes), not row existence.
- Import the **real shipped function** from `scripts/*.ts` into a scratch harness in `/tmp` rather than reimplementing it — a copy can drift from what ships.
- Always run at least one mutation the developer did **not** list. Both the round-2 and round-3 blocking findings came from exactly that, and from nowhere else.
- Ask whether the test **fixtures resemble the real inputs**. Hollow tests in this repo have consistently used tiny synthetic snippets missing the one property (e.g. an apostrophe inside a SQL comment) that every real file has.
- Distinguish explicitly in the report between what you executed and what you only read. Jordan asks for this every round.
- **Mutate the fix, not just the bug.** The strongest finding of round 4 came from deleting each *branch* of the new function one at a time and re-running the suite: 4 of 5 capabilities could be removed with 47/47 still green, and one of those removals flipped a real case from detected to fail-open. A test that only pins down the one mutation the developer reproduced is the same hollow-test class as the previous rounds, wearing a better disguise.
- **When a check is a scanner, review its vocabulary separately from its parser.** Rounds 2–3 were parser bugs; round 4's residual hole was a missing *token* (`END` as a COMMIT synonym) in an otherwise-correct parser. Ask "what synonyms/aliases does the target language have?" as its own question.
- **Establish severity by executing the consequence, not by reasoning about it.** "The scan misses `END;`" is a shrug until you run `END` inside the real driver's transaction and watch it commit durably. That one 20-line throwaway script turned a P3 into a P2.
- Reviewing a branch without disturbing the main checkout: `git worktree add --detach /tmp/<scratch> <ref>`, symlink the main repo's `node_modules` in, run vitest/tsc/lint there, then `git worktree remove --force`. Mutating tracked files inside that throwaway worktree is fine; mutating them in the main checkout is not.

Related: [[project-migrations-safety]]

**Known failure of my own:** the agent memory directory has twice been reported as empty and rewritten from scratch. It is **untracked**, so per-agent git worktrees never see it — an empty listing from inside a worktree is an artefact, not the truth. The real directory lives at `/Users/jordanatha/Projects/my-content/.claude/agent-memory/code-reviewer/` and holds ~16 files. When running in a worktree, read memory via that absolute path before concluding anything is missing, and never overwrite a file you have not read.
