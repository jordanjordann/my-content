# docs/archive/

Superseded and completed documents. Nothing here is current — for current state read
[`../HANDOFF-2026-08-05.md`](../HANDOFF-2026-08-05.md).

They are kept, not deleted, because several still hold the **only** record of a decision, a source
trace, or a lesson that no live document repeats. One line each on what that is.

> **Note on paths inside the archived handoffs.** Their file references (`docs/design/…`,
> `docs/TDD-…`) point at pre-archive locations and were deliberately **not** rewritten — they are
> dated snapshots, and editing them would falsify the record. Map any such path onto
> `archive/specs/`.

## `handoffs/`

Dated session handoffs, each superseding the last. Newest first.

- **`HANDOFF-2026-08-03.md`** — the #96 engagement-count chain. **Still the only full record of the disputed Base UI tooltip re-open risk** (item 3: the `useDismiss.js` source trace vs. the Playwright counter-evidence, and the argument against adopting `Popover.Trigger`), and the definitive write-up of the linear-vs-gamma contrast error together with the *process* failure behind it — two agents agreeing via the same wrong method is one piece of evidence, not two.
- **`HANDOFF-2026-07-25.md`** — the #72 style-fingerprint and #71 carousel session. Holds the **#71 carousel mime-type catch** (a live bug that passed a fully green suite) and the worktree-isolation lessons that became standing dispatch policy.
- **`HANDOFF-2026-07-23.md`** — the schema-redesign build-out. Holds the **#69/#70 same-deploy sequencing constraint** and the reasoning for deliberately holding PR #92 open unmerged.
- **`HANDOFF-2026-07-22-session2.md`** — mid-migration snapshot. Holds the corrections made to `TDD-analysis-schema-redesign.md` §12 and the "append, never clobber" rule for `verified-facts.md`.
- **`HANDOFF-2026-07-22.md`** — the earliest handoff (session 1, 07-21 → 07-22). Carries a superseded banner. Mainly of interest for the original "six things that will bite you" framing and the pre-ScrapeCreators starting state.

## `specs/`

Completed PRDs, TDDs, and approved designs. All shipped; kept for the decision record, not as plans.

- **`TDD-analysis-schema-redesign.md`** — the implementation design behind the current schema. **§12 is the reason this file matters:** its still-unresolved items (carousel token headroom, `OTHER` classification rates, the 2 legacy `analyses` rows) were lifted into `HANDOFF-2026-08-05.md` before archiving, but §12 has the full framing.
- **`TDD-fingerprint-read-override-api.md`** — the design #73 was built from, including decisions D1–D7 and the OWNER-1/2/3 resolutions. Still cited by `RUNBOOK.md` §4 for migration 011's rationale.
- **`TDD-engagement-count-display-states.md`** — #96's design, including review decisions D1–D3 (State 4 widening, tooltip flip ownership, on-surface contrast QA).
- **`PRD-engagement-count-display-states.md`** — the four display states and their treatments as owner-settled. Its §7 records the five wording questions the owner reviewed and declined on 2026-08-05.
- **`DESIGN-engagement-count-display-states.md`** + **`engagement-count-display-states-mockup.html`** — approved design for #96. **The mockup is authored on a WHITE surface** while the app is hard-locked to dark mode, so its `slate-*` values must never be transplanted literally — see `RUNBOOK.md` §8.4, which links here.
- **`DESIGN-analysis-tier1-style-section.md`** + **`analysis-tier1-style-mockup.html`** — the Direction A tabbed-modal design shipped by #70, with its 9 sub-decisions and the rejected Direction B kept as history.

## `retrospective-001.md`

The repo's only retrospective. Records the architecture/code-style pass that established the current
module conventions (the `*Section`/`*Card`/`*Grid` suffix rule, barrel placement, inlining), with the
full file-by-file rename list. Useful as the precedent for *why* `AGENTS.md`'s module conventions
read the way they do.
