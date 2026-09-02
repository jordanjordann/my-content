---
name: differential-build-proof
description: Settle bundler/toolchain claims with an A/B build that includes a live control — never from docs, source reading, or a relayed empirical report
metadata:
  type: feedback
---

When a PR's design rests on a claim about what a bundler does (what it scans, inlines, eliminates, or
traces), prove it with a differential build in a throwaway worktree. Always build the **control** — the
form known to produce the symptom — in the same harness first, so that a null result on the variant is
provably not just a dead harness.

**Why:** PR #257 shipped a three-file split, ~50 lines of explanatory comment, and a disclosed unguarded
failure path, all to satisfy a constraint that did not exist. The developer's claim ("Next's Edge scan
flags any `node:` specifier literal, reachable or not") was plausible and even matched Next's *webpack*
plugin source — but the project builds with **Turbopack**, which dead-code-eliminates the
`NEXT_RUNTIME === "nodejs"` block before scanning. Reading the docs could not have caught it; the docs
never mention the scanner. Reading `next/dist` source actively misled, because the file I read was not the
active code path. Only the A/B build settled it. Running the control first was what made the null result
trustworthy.

**Second lesson from the same review:** verify the *residual* risk too, not just the fix. Deleting the
emitted chunk the fallback path resolves to reproduced a live silent-hang (`Failed to prepare server`,
container Up, HTTP 500) — turning a disclosed theoretical gap into a blocking finding.

**Third: watch the harness.** A stray `.env` copied into `.next/standalone/` by `next build` silently
re-supplied the env var under test and produced a false negative on **both** branches. If a guard appears
not to fire on main *and* the PR, suspect the harness before the code.

**Fourth — measure the control's exit code, not just its output.** On #257 round 3 the control
(`if (NEXT_RUNTIME !== "nodejs") return;`) made `next build` print two Edge warnings — `A Node.js API is
used (process.exit)` and `A Node.js module is loaded ('node:fs')` — and still **exit 0**.
`.github/workflows/ci.yml:62` only runs `npm run build`, so that regression class is **visible but not
gated**: it lands in the log and CI stays green. Then ask the second question: what does the failure
actually *cost at runtime*? Here, nothing — the `NEXT_RUNTIME` test is still evaluated in the Edge
compilation, so the Node APIs are never executed whether or not they were eliminated from the chunk.
**"Undocumented optimisation" is not automatically "unsafe" — the deciding question is the blast radius
when it stops holding.** Approving a design that depends on Turbopack DCE was correct on that basis, and
the reasoning should be reused rather than re-litigated.

**How to apply:** for any bundler/runtime claim — control build, then variant build, then grep the emitted
artefact to confirm the code is genuinely absent rather than merely un-warned. Report which toolchain is
actually active (`next build` prints it).

Related: [[verify-the-brief]], [[mutation-proof-playbook]], [[review-worktree-and-gates]],
[[project-boot-guard]].
