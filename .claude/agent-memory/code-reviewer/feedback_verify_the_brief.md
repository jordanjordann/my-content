---
name: verify-the-brief
description: The brief is a claim to check, not a fact — nine catalogued forms of brief error, the raw-facts-verify/derived-figures-do-not rule, and the run-or-compute rule for any runtime mechanism claim (including my own)
metadata:
  type: feedback
---

Merged from the former `feedback_verify_brief_premises` plus the outstanding PENDING-EDITS appendices
(forms 4-7) staged 2026-08-19.

**Standing instruction from the owner: "verify the premises in this brief and report every one that is
wrong."** It has caught a real error in every session it has been used. Read the ticket body in full
**before** the diff, and confirm any "this was not requested / not specified" or "this ticket inherits X"
assertion against the ticket's own text and the design docs. When it conflicts with the ticket/TDD, the
docs win.

## The catalogued forms

**1 — Inventing scope creep.** On PR #231 the brief stated in a PRIORITY section that the mode-chip
`text-[10px]` → `text-[9px]` change "was not in the ticket, not in the brief", and instructed that it be
reverted. Ticket #218 §4 authorised it verbatim under the heading *"One optional ride-along"*, and
`AUDIT-3C-table-fidelity.md` L7 documented the drift. Acting on the brief would have forced a correct,
approved change out of the PR.

**2 — Inventing missing scope.** On PR #233 the brief asserted the ticket **inherited** work — the M2
`<td>` vertical rules "from TDD §16.3", and resolving `ROW_HEIGHT_PX`'s 68px. Both wrong. §16.3 makes the
`<td>` borders **conditional** on 3C-S1 taking the vertical-rules option, and 3C-S1 took the stated
default; §16.3 and the ticket both **forbid** touching the 68px, which is an owner question parked in
§16.5. The developer had already checked and declined the brief, and he was right.

**3 — A wrong label on approved copy.** On PR #234 the brief said the engagement-tooltip copy was `T3`,
landed in PR #212, when `T3` is `DESIGN-3B` §4.7 / amendment **B9**, the Counts-column tooltip, which is
PROPOSED and explicitly forbidden by ticket #223. The approved strings are `T1`/`T2` in §4.6 / **B7**,
which is what the developer shipped. A label mismatch in a brief is not evidence of a wrong-copy bug —
resolve the label against the doc's own amendment table before ruling.

**4 — A different ticket's root cause, imported.** On PR #258 (#251) the brief supplied the
`hasReachFields()` / `reach.ts` / follower-denominator chain — which belongs to #254 — for an FE-only
display ticket, and asserted the developer "was told to keep an explicit clamp", a requirement absent from
#251. The developer correctly rejected both. The clamp itself is a genuine latent bug, but belongs in its
own ticket, not bolted onto the PR under review.

**5 — A relayed empirical claim (the most dangerous form).** On PR #257 round 2 the brief was not merely
mistaken about scope — it relayed a **developer's own empirical finding** and asked me to confirm it:
"Next's Edge static scanner flags any `import("node:...")` specifier literal present in the file,
reachable or not." A differential build refuted it. The real trigger was the *shape of the runtime check*
(`if (NEXT_RUNTIME !== "nodejs") return;` leaves Node code at function top level;
`if (NEXT_RUNTIME === "nodejs") { ... }` gets dead-code-eliminated by Turbopack before the Edge scan). The
brief also told me to settle it against `node_modules/next/dist/docs/`, which cannot settle it — the docs
never mention the scanner. **A relayed empirical claim carries no evidentiary weight, and "check the docs"
is not always an available route.** See [[differential-build-proof]].

**6 — Right raw facts, wrong derived figures (the quietest form).** On PR #259 (#254) the brief's
**primary** facts were right (row IDs, multipliers, test counts, which rows had been deleted — all
confirmed against Turso), but every figure **derived** from them was wrong. It labelled `391b7615`
`NOT_COMPARABLE` when the row is actually `perf_tier_used = REACH_ONLY` + `perf_tier1_denominator =
FOLLOWERS` (i.e. the #254 defect itself — `NOT_COMPARABLE` is the *baseline* outcome, a different column).
It said the `6 of 5` clamp was "firing in production today, five rows" when exactly **one** row
(`7b6948fe`) stores `perf_baseline_sample_size = 6`; the five rows storing `5` render `5 of 5`, which is
correct. It said "live pool is 7" when eight reach-bearing reels exist.
**RULE: raw facts verify, derived figures do not.** A brief whose row IDs check out has not thereby earned
its counts and labels. Cheap test: re-derive each number from the same `SELECT` rather than accepting it
because the neighbouring fact was right. Three sessions running, every error was in a count or label
derived from a correct row ID or SHA.

**7 — A fact question disguised as a judgement call.** On PR #257 round 3 the brief asked me to **judge
whether the developer's evidence was sufficient**, framing it as opinion. It was a fact question with a
wrong answer. He verified the flush-safe `writeSync(2, ...)` fix by redirecting stderr **to a file** and
called that "non-TTY equivalent to piping through `cat`". In Node, writes to a regular file are
**synchronous** and writes to a **pipe** are **asynchronous**; a file redirect is precisely the non-TTY
case that looks clean even with unfixed `console.error`, so his run demonstrated nothing. The fix was
still correct — proved with an actual `2>&1 1>/dev/null | cat` run. **When a brief invites a judgement
call about evidence quality, check first whether the question is actually empirical.**

**8 — A correct total with a wrong itemisation ("reconciled per-file").** On PR #268 (#266) the brief
relayed the developer's claim: tests 908 vs a 918 baseline, "net −10, claimed reconciled per-file". The
**total was right** (verified by counting `^\s*it\(` per changed test file at both SHAs: −5/−1/−4/0/0),
but the PR body's own itemisation summed to **−9** and mis-described the pagination file as "−6 deleted
+2 new" when it is 9 → 4 (6 deleted, **1** added — the order test was a *rewrite*, not a new test).
An itemisation that does not sum to its own total is a reconciliation nobody actually performed.
**Cheap check, ~1 tool call:** `for f in <changed test files>; do count it( at base vs head; done` — never
accept the narrative, and never accept the total as evidence the narrative is right. Sibling of form 6.

## 9 — MY OWN mechanism claim, asserted without running anything (the one that cost the most)

On PR #269 round 1 I reported that `tests/server/analysis/media/prepareParts.mimeType.test.ts` "makes a
real, unmocked network fetch to a hardcoded signed CDN URL". **Every clause was false.** `downloadMedia`
is mocked at line 7, the bytes come from a local literal at line 32, the URL is only string-parsed and
never dereferenced, and the `_nc_sig` parameter I named is not in the file at all. It propagated through
the boss to the owner and burned real time before a tech lead refuted it; a follow-up issue was filed and
then closed. **Never re-raise it.**

**Why it happened:** the URL *looked* like a signed CDN URL, and I reasoned from its shape to a mechanism
instead of reading the mock and running the test. Forms 5–8 are about distrusting *other people's*
mechanism claims; this is the same failure turned inward.

**How to apply:** any assertion of the form "this code does X at runtime" — makes a fetch, hits the DB,
spends a credit, gets dead-code-eliminated, is reversible, is inert — is a **run-or-compute claim**, not a
read-the-diff claim. Before writing it into a review: run it, mutate it, or compute it. If none of those
is affordable, write "unverified" and say what would settle it. Two cheap wins on #269 round 2 that came
from obeying this: I *computed* the base64 decode proving unscrubbed IG media ids (`3849791579544422862`)
still encode the "scrubbed" shortcodes (`DVtNQtmCQnO`) rather than merely suspecting it, and I *grepped
`scripts/migrate.ts`* to confirm the developer's filename-only/no-checksum claim rather than ruling on it
from memory of how migration runners usually work. State the method inline in the review comment so the
reader can tell a proof from a suspicion. See [[mutation-proof-playbook]], [[review-worktree-and-gates]].

**Form 5 again, PR #271 (#262).** The developer claimed a `livePool == null` degrade branch was
"reachable in production, not hypothetical", via "legacy pre-redesign rows missing
`profileId`/`schemaVersion`". Refuted in two `SELECT`s + one grep: `migrations/008` is literally
`DELETE FROM analyses WHERE schema_version IS NULL`, and the prod census is 12 rows / 0 NULL
`profile_id` / 0 NULL `schema_version` / 0 NULL `perf_bucket_key`. The branch is reachable only in
principle (migration 009 recreates both columns nullable). **A test named `reachability: ...` that
calls the unit function directly proves the branch resolves, never that a route produces it** —
reachability is a route-path claim, i.e. run-or-compute (form 9). The behaviour was still correct,
so this was a *reported wrong premise*, not a change request; say so explicitly or the next reviewer
re-blocks on it.

## 10 — MY OWN measurement instrument, unvalidated (form 9's sibling, caught in time)

During the 2026-08-21 live audit I nearly filed two fabricated findings, both from trusting a
measurement I wrote rather than the thing measured:

- **"No visible focus ring anywhere."** Every button computed `outline: none` and
  `box-shadow: rgba(0,0,0,0) 0px 0px 0px 0px` — which looks conclusive. It was wrong on two counts:
  the ring does not live in `box-shadow`, and my screenshot used `locator.screenshot()`, which
  clips to the element's own bounding box and therefore **cuts off a ring drawn outside it**.
  Settled by pixel-diffing a *padded* `page.screenshot({clip})` focused vs unfocused: 9–15% of
  pixels changed, max channel delta ~254. A clear orange ring renders. **Focus indicators pass.**
- **"All text fails WCAG AA (~1.25:1)."** This theme emits `lab(67.48 -3.0 -10.6)`. My parser
  scraped the three numbers and treated them as RGB 0-255. Re-measured by painting each colour into
  a 1×1 canvas and reading back real sRGB: **6.7–18:1, passing everywhere.** The uniformity of the
  wrong answer (~1.25 for *everything*) was the tell.

**How to apply:** a computed-style read or a hand-rolled colour/geometry calculation is an
*instrument*, and an unvalidated instrument is not evidence. Before filing, ask: (a) does this
number have an implausible shape — everything failing identically, a near-white background on a
dark theme? (b) can I settle it with a **direct observation** (a pixel diff, a rendered crop)
instead of a derived one? Prefer the direct observation. And **report the retraction in the
findings** — a reviewer who quietly drops a wrong number teaches nobody.

## Precedence when a TDD contradicts itself

A TDD's **prose is authoritative over its own file-tree/summary counts**, and the **ticket's numbered
implementation steps outrank both**. On #315 the TDD's §4.5 tree said "3 `rowsAffected` assertions" while
§4.2's prose described 4 and ticket #312's steps 3/4/5 mandated 4 sites. The developer followed the prose
and was right. Resolve these by counting the ticket's steps, not by counting the tree — and say which
document is the error, so the next reviewer doesn't re-litigate it.

## Related method rulings

- **When a reviewer reviews their own proposal or their own blocker, they must argue the opposite case
  first.** Highest-yield habit on #257 and #263.
- **When two agents independently disagree with the boss, the boss is wrong.**
- **Give reviewers an explicit tool-call budget and say the number.**

## How to apply

Whenever a brief singles out a change as unrequested, out of scope, inherited, or "guilty until proven
innocent", quote the ticket/TDD line that authorises or forbids it before ruling — watch for conditionals
with a stated default, which is what both #233 rulings turned on. If the brief is wrong, **say so
explicitly in the review comment** so the finding is not re-raised by the next reviewer.

Related: [[review-conduct]], [[guard-strictness]], [[project-production-data-and-qa]].
