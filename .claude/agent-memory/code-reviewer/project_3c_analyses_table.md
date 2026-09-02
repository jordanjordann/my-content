---
name: project-3c-analyses-table
description: The 3C analyses-table phase — authority docs, the standing "assume a real user-visible bug exists" posture, and the R-D18/R-D19 header-colour rulings
metadata:
  type: project
---

Merged from the former `project_3c_phase_3`, `project_review_standards_3c_phase`, and
`project_3c_header_colour_rulings`.

## 1. Authority documents for any 3C review

Read the cited section; do not trust the PR's paraphrase.

- `docs/design/DESIGN-3C-analyses-table.md` — **§2.2 is the column-layout authority (not §5)**. §9 is
  colour/contrast/tokens; §9.1 is the measurement method, §9.2 the text role table. **§3 is the read-path
  routing rule** (see [[project-performance-read-model]]).
- `docs/TDD-3A-3B-3C-phase-3.md` §16 — the remediation plan, per-ticket. §16.5 parks the unruled owner
  questions.
- `docs/design/AUDIT-3C-table-fidelity.md` — the numbered findings (M*/L*) each ticket cites.

**§9.1 explicitly says its own hex values are "dark-surface stand-ins," not normative** — the floor
(≥4.5:1 on all four surfaces) is the normative thing. Reviews that treat the doc's hexes as exact targets
produce false findings.

Phase 3 is a fidelity remediation split into two buckets of small parallel FE tickets, each one PR, each
owning a disjoint set of files. When a PR cites a finding ID, open the audit entry and the design section
before ruling. Check the ticket's "Collision constraints" block against the diff. Parallel tickets in
flight around Aug 2026 included #216 (strings, `lib/api/analyses/helpers.ts`, `AnalysisDataTable.tsx`),
#217 (`AnalysisEngagementCell/**`, `globals.css`), #218 (caption clamp), #221 (header type/casing, depends
on #217's `--teal` token), #222 (density, `Early` badge). **Verify current ticket state with `gh` — this
list decays fast.**

## 2. Review posture: assume a real user-visible bug exists

Review has found a real user-visible bug on **every** code ticket in this phase, and the automated suite
caught **none** of them on its own. **Green + tsc-clean is the normal state of a broken PR here.**

The defects are of a kind types and tests do not see — a hardcoded placeholder never bound to data (#205),
a wiring seam where two fields share a type so a mis-wire type-checks, a guard applied to one of several
sibling classifiers.

Highest-yield patterns:
- **Sibling asymmetry** — when a fix is added to one function, check the neighbours in the same file that
  take the same raw input. (#210 guarded `classifyLikeCount` against the `-1` sentinel but left
  `classifyViewCount`/`playCount` in the same file unguarded, rendering a literal `-1`.) Same idea at
  route level: see the uncovered-sibling form in [[mutation-proof-playbook]].
- **Tests that cannot fail** — assertions whose subject no code path in that test can produce.
- **PR body vs. diff** — the body becomes the squash-commit message, so every sentence must be literally
  true at HEAD. Body claims have repeatedly overstated what the diff delivers.
- **A unit test that passed a prop explicitly can never catch a bug in how the caller wires that prop** —
  demand a full-table integration test at the seam (precedent:
  `Analysis147ScoreCellIntegration.dom.test.tsx`).

## 3. Header-colour rulings — R-D18 KEPT, R-D19 REJECTED. Do not re-raise either.

**R-D18 (kept)** — the two engagement column headers (`engagementReach` → `text-accent`,
`engagementFollowers` → `text-teal`) keep their colour in **all** states. Originally (PR #229) applied
unconditionally on the sort `<button>`; **since amendment A10 / PR #268 the colour lives on the `<th>` and
the surviving states are idle / hover / focus-visible / sticky-scrolled only** — there is no active-sort
state left. R-D18 is *not* withdrawn; A10 names it as explicitly surviving.

**R-D19 (rejected)** — the proposed hover underline is **rejected**. Those two headers therefore have no
hover affordance at all; **the owner accepted that cost knowingly. Do not raise it as a review finding.**

**Why:** R6 (reach- vs follower-denominated misread) is the PRD's highest-severity risk, and colour is §4's
distinguisher 3 — losing it exactly when the column is the active sort defeated the point. The docs
recording both rulings were still in an unmerged PR (#230) as of 2026-08-14.

**How to apply:** when reviewing anything touching `AnalysisDataTable/components/headers/`, treat
colour-invariance across states as a hard requirement **and check it is pinned by a test** — after #268
the suite asserts only the idle classes, so a re-added `hover:text-*` / `focus-visible:text-*` on those
two `<th>`s would pass green. Historically the arrow and the focus ring were likewise deletable with the
whole suite green (#229).

## 4. Sorting is GONE — amendment A10 / issue #266 / PR #268 (2026-08-20)

Owner ruled the 8-column sort removed entirely, not fixed. The one order is the literal
`ORDER BY a.updated_at DESC`, **no tiebreak** (`, a.id ASC` was proposed and DECLINED), no `sortBy`/
`sortDir` params (supplying them now returns **200 and is ignored** — that is the ruled contract, not a
regression), no `aria-sort`, all 8 headers plain text. `R-S1`/`R-S2`/`R-S3` and `R-D19` are **withdrawn**;
`R-D6`/`R-D12`/`R-D18`, grouping, §6.2 filtering and §6.3 column visibility explicitly survive. `OR-8`
(`posted DESC`) is superseded — the key is `updated_at`, because re-analyze is an `UPDATE` that never
touches `created_at`.

**Why:** the shipped sort ordered by the *stored* `perf_multiplier` while #263 made the *displayed* value
live-derived, so most rows showing a number sorted as absent. The live value cannot be computed inside the
`LIMIT`/`OFFSET` query. Owner chose "no answer" over "a wrong answer".

**How to apply:** never propose a tiebreak, a `UNIQUE` constraint, an index on `updated_at`
(`idx_analyses_updated_at` already exists) or a test asserting stability between rows sharing an
`updated_at` — tied-row order is explicitly undefined and accepted. Any future header work starts from a
static-text `<th>`.

**Still unruled (TDD §16.5, no ticket):** `Carousel ×10` (L6), failed-row reason-text colour (L9), and
**M11** (kind-badge contrast over photography). **M11 is the owner's own task** — do not assign it, do not
propose a fix as part of another PR.

Related: [[review-conduct]], [[project-copy-and-derivation-rulings]], [[mutation-proof-playbook]].
