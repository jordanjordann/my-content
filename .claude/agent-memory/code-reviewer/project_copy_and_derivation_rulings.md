---
name: project-copy-and-derivation-rulings
description: Two hard-stop rulings — agents never author user-facing copy, and every quantity has exactly one canonical derivation (the carousel TR-1 precedent)
metadata:
  type: project
---

Merged from the former `project_no_invented_copy` and `project_carousel_derivation_ruling`.

## 1. No invented copy — a hard stop

Any new user-facing string an agent writes is a **hard-stop violation** unless it traces to an approved
source (`docs/design/*`, PRD, or an explicit owner/designer decision). Tickets call this out inline — e.g.
#205: *"it is a label map, not new user-facing prose — if a new visible word is required beyond
`comments`, stop and route it to the designer."*

**Why:** copy is owned by the designer/owner, not engineering. Wrong-but-plausible copy ships silently
because it type-checks and reads naturally. PR #210 added
`ENGAGEMENT_HIDDEN_TRIGGER_LABEL.comments = "Why is the comment count hidden?"` — a sentence found in no
design doc — while the PR body claimed "no new prose."

**How to apply:** on every review, grep each added string literal against `docs/` and `.claude/` before
accepting it. **"Needed for `Record` exhaustiveness" is not a justification** — `Exclude<>`/`Partial<>` on
the key type gets exhaustiveness with no invented string. **Dead/unreachable copy still counts as a
violation.** And never quote copy from a ticket body — quote the shipped `constants.ts`.

## 2. One canonical derivation per quantity (TR-1) — the carousel ruling

Binding tech-lead ruling (#175/#176, TDD §0.7 TR-1…TR-3), delivered by PR #180 (2026-08-09), head of the
3B queue #175 → #142 → #143 → #144.

Every carousel slide **count** is `getCarouselEdges(raw).length` and every slide **index** is an index into
that same pre-filter `edge_sidecar_to_children.edges` array. Two fields may carry the number
(`carouselItemCount` in `fetcher/adapter.ts`, `LaterSlideReach.slideCount` in `performance/`), but exactly
one expression computes it. **The cross-assertion that the two agree on a null-node fixture is a mandatory
regression detector for this ruling.** The F3 thumbnail rule is "first edge that has a node", named in the
test.

**Why:** three file-local copies of an unsafe `getCarouselChildren()` helper were the transmission
mechanism for a class of silently-shifted indices/counts; PR #167 fixed one copy and left two live. Doc
comments were judged insufficient as guards, so the compacted array was **deleted** rather than patched.

**How to apply:** reject any new `.filter()` / `.map(e => e.node).filter(Boolean)` that is then indexed or
counted. Any reintroduced second derivation of the slide count should fail the cross-assertion — if it
doesn't, the test has decayed. Null `node` entries are a **synthetic, unobserved** shape (labelled
SYNTHETIC MUTANT fixtures); **never let one be cited as an observation in
`.claude/context/verified-facts.md`.**

The general form of TR-1 is in [[owner-preferences]]: two expressions computing the same quantity into the
same output is a defect in itself, even when they currently agree.

Related: [[owner-preferences]], [[project-3c-analyses-table]], [[review-conduct]].
