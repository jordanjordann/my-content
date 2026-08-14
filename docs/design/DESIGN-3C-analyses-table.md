# Design Decision Record — Phase 3C, the Analyses Table

**Status:** **APPROVED — 2026-08-07, by the owner.** This is the mockup-review checkpoint that caveat **C2** of the PRD reserved, and the owner has ruled: the 9-column table, **Direction A** for the engagement split (§4), Comfortable density, and pagination with newest-analysis-first as the default sort. The full record, including what is and is not covered, is in **§12**. Development may proceed against this file within that scope; anything §11 still lists as open is not covered by the sign-off. **As of 2026-08-09, §11 lists nothing as open** — Q4 was ruled 2026-08-07 and **Q2 (Status column cut) and Q3 (Style column default-off) were ruled 2026-08-09**, each separately from and after the sign-off. The shipping column set is stated in full in **§2.2**.
**Author:** Jessica (UI/UX)
**Created:** 2026-08-06
**Mockup:** [`docs/design/3c-analyses-table-mockup.html`](./3c-analyses-table-mockup.html) — open in a browser. It carries a Direction A / Direction B toggle at the top.
**Primary input:** `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md` §8 (the table), §12.3 (the comparability requirement), §13.7 (what the table must explain).
**Companion:** [`DESIGN-3B-score-explainability.md`](./DESIGN-3B-score-explainability.md) — the explainability surfaces, including every copy string this table renders. **The two documents are one design; read both.**
**Precedent it must not contradict:** [`DESIGN-engagement-count-display-states.md`](./DESIGN-engagement-count-display-states.md) — the four count states (`Hidden` / `0` / `—` / `N plays`) are already owner-confirmed and are **reused verbatim** here. This document does not invent a second visual language for "the count is missing."

### Amendment record

| # | Date | What changed | Why |
|---|---|---|---|
| **A1** | 2026-08-07 | **Cold-start copy is bucket-scoped, never creator-scoped.** The bare `3 of 5` in §2.2 is withdrawn; the state is fully specified in the new **§5.3**. | **R-14.2.5 / R-8.4.9** (PRD §14.2, merged in PR #160) forbid any cold-start string that says "5 posts" or otherwise frames the threshold per creator. The bare figure told a creator with 8 analysed posts something false about what they were waiting for. |
| **A2** | 2026-08-07 | **New absent-reason state `REACH_NOT_ON_FIRST_SLIDE`**, fully specified in the new **§5.4**, with a new rule **R-D4** in §4.1. | Raised by code review on PR #161, on top of **OR-26** (TDD §0, §3.1, §5.3). The sentence "the count is on a later slide" is a non-answer without the count beside it — and a non-answer is what **R-13.5.3a** exists to forbid. |

| **A4** | 2026-08-09 | **Two corrections, no design change.** (a) **§6.3 — the Style opt-in does NOT persist.** The line *"the user's choice persists … within the session"* is **superseded by the owner's 2026-08-09 ruling: no persistence at all** — no `sessionStorage`, no `localStorage`, no URL param, no per-user storage; it resets to hidden on every load. The sharpened consequence is recorded with it: the column picker is the **only** route to the Style columns on **every** load, so a missing picker entry ships Style as dead code. (b) **§12 — the `TDD` §0.2 vs §12 record disagreement is CLOSED**, reconciled by the tech lead in merged **PR #178** (`TDD` §0.7); the design record was found correct and the governing instrument for Q2/Q3 is the 2026-08-09 ruling. | (a) §6.3 merged in PR #174 with the session-persistence minimum I had proposed while escalating the real question; the owner then ruled the other way, and a stale line here means **#149** gets built with persistence nobody asked for. (b) The flag was addressed; leaving it phrased as open invites someone to re-litigate a settled record. **No column, width, order, string, colour, density or interaction changes.** |
| **A3** | 2026-08-09 | **Record-keeping pass, no design change. §11 Q2 and Q3 are ruled and recorded as ruled everywhere this document restated them as open** — §2.1, §2.2, §6.2, §6.3, §11 (preamble, Q2, Q3, Q4) and §12. **Q2: the Status column is CUT. Q3: the Style column ships DEFAULT-OFF** — built and available, hidden until the user opts in via the column picker. §2.2 now states the shipping column set in full. | Both rulings **confirm what this document already proposed**, so no column, width, order, string, colour or interaction changes; what changes is that §2.2 is a decision rather than a recommendation, and **#145 / #146 / #149 are scoped from it**. Also flags, for the tech lead, that `TDD` §0.2 (OR-4 / OR-5) and this document's §12 disagree about the *record* of when Q2/Q3 were decided — the substance agrees. |

| **A5** | 2026-08-13 | **Two approved strings are revised. Copy only — both behaviours are correct and unchanged.** (a) **§4's `Eng. / followers` reason** becomes **`measured against reach instead`**; `no follower measure here` is withdrawn and preserved as the withdrawn string. (b) **§4.1's R-D1 table footer** becomes **`No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.`**; the old sentence is withdrawn and preserved. The mockup's three occurrences of (a) and one of (b) are updated with them. | **Owner review of four real analyses, 2026-08-13 — the first time a real reader met either string on real rows, and both were misread.** (a) *"some of the reels they are saying 'no follower measure here' while one of them have the data"* — the sentence describes a property of **this post's denominator choice** but its grammar describes a property of **the creator's data**, so read down one creator's column it says something false and visibly contradicted by the row above it. The replacement names the column that holds the figure, which makes a row-to-row difference read as routing rather than a gap. The `Eng. / reach` mirror strings **stay split on content kind** (R-13.5.2) and are untouched. (b) *"theres that text too, i dont understand what it means"* — **R-D1's no-aggregate decision is settled and is not reopened** (R-12.3.3); the copy answered an unasked question, referred to a totals row that is not on screen, and said `different things` without naming a unit. The replacement follows the register that already works for this exact fact (`DESIGN-3B` §5 row 5: *"measured in different units — views and plays"*), declines first and names both denominators. It **stays always-visible** (R-13.6.2 — see R-D11). **No column, width, order, colour, density, interaction or sort behaviour changes**, no numeral is introduced, and no string frames the format threshold at creator level (R-C1). **`TDD` §1142 carries the old (a) string and is flagged for amendment by the tech lead — this document does not edit the TDD.** *(Issue [#207](https://github.com/jordanjordann/my-content/issues/207); shipped by #146; #199 is the sibling string's selection logic, not its wording.)* |

| **A6** | 2026-08-13 | **Two owner requests, both affordance decisions in this document with their copy in the companion.** (a) **New §4.2** — a tooltip on each engagement column, triggered from the **column header, once per column, never per cell or per row**, with accessible names `How is engagement against reach worked out?` / `How is engagement against followers worked out?`, reusing the shipped ticket-#70 trigger contract. New rules **R-D5…R-D11**; R-D11 also pins the R-D1 footer as always-visible plain text. Copy is the companion's new §4.6. (b) **§5.1 gains a note**: two of the three Performance-cell states that shipped as a bare `—` now render sentences (companion §5 rows 8 and 9, §5.5), with row 8 keeping the row's single `ⓘ` and row 9 carrying none; `INSUFFICIENT_HISTORY` keeps the `—` on purpose. | (a) **Direct owner request, 2026-08-13:** *"please make a tooltip to explain the formula of eng/reach and eng/followers."* Direction A separates the two columns structurally but never explained what either divides by. **§5.1's one-`ⓘ`-per-row ruling is respected, not excepted:** that ruling is about per-row glyph density (*"four `ⓘ` glyphs per row × 50 rows is visual noise that would train users to ignore all of them"*), and this adds **zero** glyphs per row and **two** to the whole table, in a header that renders once — and the fact being explained is a property of the column, so a per-cell trigger would repeat one identical sentence on every row. R-D9 keeps every denominator qualifier and every `≈` at L1, so nothing load-bearing moves behind a hover (R-13.6.2, R-8.4.7). (b) **Direct owner request, 2026-08-13:** *"Also a little explanation about why the performance score is '-' rather than just '-'."* PR #198's round-3 review **deliberately deferred** this — the muted `—` was correct *"because no approved copy exists for those states and inventing one is worse"* — and the copy now exists, written where copy is written. **No column, width, order, colour, density, sort or filter behaviour changes; no new component and no second tooltip mechanism.** *(Owner requests, 2026-08-13 session; PR #198 review round 3.)* |

| **A7** | 2026-08-13 | **PROPOSED — awaiting owner sign-off; nothing in it may be built until the owner approves it.** **New §4.3 — the Counts column tooltip, and a ruling that the comments slot has no `hidden` state.** (a) A **single header trigger on the `Counts` column**, reusing the shipped ticket-#70 contract, **adding zero glyphs per row** and one to the whole table; its copy is the companion's new **§4.7** (`T3` / `T3-compact`). New rules **R-D12…R-D16**. (b) **The comments slot renders `AVAILABLE` / `ZERO` / `UNKNOWN` only** — the companion verified in code that `HIDDEN` is unreachable for a comment count — so the invented trigger `Why is the comment count hidden?` is withdrawn, and the shipped `Hidden` per-cell `ⓘ` stays scoped to the two metrics `like_and_view_counts_disabled` governs. (c) **Mockup correction:** row 5's Counts cell drew `Hidden · Hidden`, a state that cannot occur — on the one captured counts-disabled payload the comment count came through anyway — so it now draws a real comment figure beside the hidden reach and likes. | **PR [#210](https://github.com/jordanjordann/my-content/pull/210) review, note N1.** A developer wiring the real comment count into this cell needed a label for a comment count with no number, found no approved copy, and invented one — pointed at the views/likes sentence, so the app would have answered a question about comments with a fact about views. **§5.1's one-`ⓘ`-per-row ruling is respected, not excepted:** that ruling is about per-row glyph density, and the fact being explained is a property of the **column** — identical on every row — so a per-cell trigger would repeat one sentence on every row, which is the same waste in a different place. **§2.2 is untouched:** no column, width, order, colour, density, sort or filter behaviour changes, no new component and no second tooltip mechanism. **R-13.3.4 checked and not engaged** — the Counts column divides nothing and the tooltip shows no figure. *(PR #210 review note N1; owner request, 2026-08-13 session.)* |

| **A8** | 2026-08-13 | **Three owner rulings from the fidelity audit's Content-column addendum, written into the spec. No column, width, order, colour, sort or filter behaviour changes, and no user-facing word is added, removed or altered.** (a) **R-D17 is APPROVED — Option B, two lines** — and the word *snippet*, which has carried this requirement unwritten since 2026-08-06, is **given its definition in the new §2.2.1**, beside the word. (b) **The audit's M10 is REJECTED: the thumbnail stays 40 × 40px square.** §3.1's wireframe and the mockup both drew a 44 × 56px portrait tile; the **mockup is the stale artefact** and has been redrawn to the shipped square. (c) **§3.1's truncation rule is scoped to qualifiers** (§3.1, new note), and **§3.1's `68px` row figure is re-derived** from the ruled inputs and found unreachable — a **replacement figure is PROPOSED there, not applied**. | (a) `AUDIT-3C-table-fidelity.md` **M9**: the caption shipped unclamped, and on 3 of 6 rows of the owner's capture the Content cell was strictly the tallest cell in its row. The owner accepted the recommendation — **column 1 is the identification column, and a one-line clamp reduces some real captions to text that identifies nothing**. (b) **Owner ruling, 2026-08-13, explicit: he likes the shipped square thumbnail and it stays.** M10's own arithmetic already cut this way — the 56px tile exceeded §3.1's row figure before a line of text was laid out. **This is settled and is not to be reopened**; anyone proposing a portrait tile is proposing to overturn a ruling, not to fix a drift. (c) The developer applied §3.1's *"line 2 is never truncated"* — a rule written for **denominator qualifiers** — to **unbounded user caption text**, and said so in a code comment. That reading was defensible, which makes the ambiguity the root cause. Scoping the rule at its source is the fix; R-D17 alone would have left the collision live. *(Audit M8, M9, M10; owner rulings, 2026-08-13 session.)* |

| **A8-note** | 2026-08-13 | **Two audit items were considered and DROPPED by the owner — recorded here so they do not resurface as findings.** (i) **L1**, the Counts column's absent-reason string: the shipped `Counts weren't available` stands, the mockup's `not published for image posts` on that cell is stale, and **neither is being changed**. (ii) **L4**, the failed-group divider sentence: **no sentence is written and none is owed**. Both were raised as owner rulings needed; the owner has ruled that **no fix is wanted in either direction, and neither gets a ticket**. | Both are cases where the **mockup**, not the implementation, had drifted, and in both the shipped behaviour is already the non-fabricating one — L1's `Counts weren't available` asserts no cause (R-13.5.3a-safe), and L4's failed-group label is unverifiable until a failed row can be captured. Closing them as "no action" is a decision, and an undocumented no-action decision is indistinguishable from an oversight to the next reader. **Nothing in this row licenses a change to either string.** |

| **A9** | 2026-08-14 | **The owner's ruling on the engagement column-header colour is written into §9, as the new §9.2.1, with two rules. No colour value, column, width, order, density, sort *ordering* or filter behaviour changes, and no user-facing string is added, removed or altered.** (a) **R-D18 — the header colour is unconditional**: it renders in idle, hover, active-sort, focus-visible and sticky-scrolled states, on exactly the two engagement columns; `hover:text-foreground` and the active-sort `text-foreground` swap must not be present on those two headers at all, and putting the colour on the `<th>` and relying on inheritance is explicitly **not** compliant, because the button's own `color` wins. (b) **R-D19 answers the affordance question R-D18 opens, in two halves, and the owner ruled on each separately.** **Approved half:** the **sort arrow alone carries the sorted state** — it is presence/absence of a glyph rather than a shade shift, and it also encodes direction, which the colour swap never did. **Rejected half:** the proposed colour-free hover `underline` on the label is **REJECTED by the owner** — ***"no need hover color change, its fine."*** **The two engagement headers get no hover affordance at all**, and the proposal is preserved in §9.2.1, marked declined, so it is not rebuilt or re-raised. What remains on them is the `focus-visible` ring, the arrow when active, the accessible name's `, currently ascending` / `, currently descending`, `aria-sort` and the pointer cursor — **no hover-state signal**. The banned substitutes (weight changes, opacity modifiers, background tints, any second colour, and now the underline itself) are kept, so no hover signal returns by another route. The §4.2 tooltip trigger is unaffected; it is a separate sibling button. | **Owner ruling, 2026-08-14, verbatim: *"The engagement column-header colour must be kept in ALL states — idle, hover, and active-sort."*** The gap being closed is **silence, not error**: §9.2 specifies the accent/teal on the **qualifier** only; the header colour existed solely in the mockup, whose headers are **static text with no sort button**, and in `AUDIT-3C-table-fidelity.md` **M3**, which read it off the mockup. So no document had ever stated what the colour does under hover or active sort, and a developer building the sort control exactly as written got a colour that vanished at the moment the reader was ordering rows by that denominator — the state in which the two denominators are most confusable. **This is R-D17's root cause a second time** (§2.2.1): one unstated requirement carried silently, applied in good faith, wrong. R-D19's hover half was proposed because R-D18 on its own leaves the two engagement headers as the only sortable headers with **no pointer feedback at all** — a discoverability loss the arrow cannot cover, since the arrow does not appear until after the click. **The owner has rejected that half and accepted the cost**, which is recorded in §9.2.1 as accepted cost rather than an open objection. **§9.5 still holds**: the colour was already ruled a *redundant* channel (§4, distinguisher 3), and the remaining affordances — arrow and focus ring — are shape. **Explicitly not reopened:** the 1-unit teal drift (`#40d0bb` vs `#3fd0bb`) is accepted and deliberate, the `headerColorClassName` column-field mechanism is approved, and the 40px thumbnail (M10) stays. *(Owner ruling, 2026-08-14 session; audit M3; ticket 3C-S1 [#221](https://github.com/jordanjordann/my-content/issues/221).)* |

**Neither amendment reopens a settled decision.** The column set, density, sort behaviour and the Direction A engagement split are unchanged. Both are copy/state corrections consequent on rules ruled on *after* the mockup review, and §5.3 largely brings this document into line with what the mockup already drew.

**That sentence was written of A1 and A2 and holds for all three.** **A3 reopens nothing and changes nothing** — it records two owner rulings that ratify proposals this document already made, so the column set, widths, order, density, sort behaviour, strings, colours and the Direction A engagement split are all untouched by it.

**Resolved, 2026-08-07.** The flag previously carried here — that the status header read *PROPOSED — NOT APPROVED* and §12 was empty while `docs/archive/handoffs/HANDOFF-2026-08-06.md` §"Design / table (3C)" recorded the design as approved — has been cleared. The owner approved this document explicitly in the 2026-08-07 session, and that approval, not the handoff line, is what §12 records.

---

## 1. What this document decides, and what it does not

**Decides:** which columns exist by default and which are cut, how the two non-comparable engagement percentages are separated, how a 1–5 performance score renders inside a small cell, sort and filter behaviour, row density, and the empty/loading/error states.

**Does not decide:** the scoring model (PRD §3, confirmed), the stored contract (PRD §5, confirmed), or any copy string — every user-facing string lives in the companion explainability spec so that there is exactly one place to change wording.

**Exception, from amendments A1 and A2:** §5.3 and §5.4 do state exact wording, because in both cases the *structure* of the sentence is the requirement — a figure that can be separated from its format noun, or a diagnosis that can be rendered without its figure, is non-compliant however it is worded. **The companion spec remains the single home for these strings.** It has now been brought into line: its amendment **B1** (2026-08-07) withdraws the bare `3 of 5` from all six places it appeared — §4.1, §4.3, §4.4, §5 row 5, §5.2, §9 — and from its mockup, and states the binding rules in its own new §5.3. **The two documents no longer diverge**, and the cold-start wording is now identical in both. Where they ever disagree again, the companion is the canonical home for the *string* and this document is the canonical home for the *cell it renders in* — change the string there first.

**Scope constraints inherited and not reopened:**

- **Desktop-only.** No responsive breakpoints, no card fallback, no horizontal-scroll-on-mobile design. This is a scope decision (PRD §8.1), and a prior session shipped and correctly reverted a mobile "fix" that was worse than the bug it addressed (`docs/HANDOFF-2026-08-05.md`). The target is a **1440px viewport, ~1360px of content width**. Below ~1180px the table scrolls horizontally with the first column pinned; that is a degradation path, not a design.
- **The table is the only view.** `AnalysisGrid` / `AnalysisCard` are dead code (RUNBOOK §8.5). Nothing here is designed around a card layout.
- **Dark-locked.** All colour values in §9 are dark-surface values. **The two existing mockups in this folder were authored on white and their `slate-*` values are illegible in this app** — RUNBOOK §8.4 calls this out explicitly. The mockups accompanying *this* spec are dark, matching the real app, and that is a deliberate correction of the earlier convention rather than a departure from it.
- **UI copy English.** Gemini's `verdict` and `drivers[]` are Indonesian and render as-is.

---

## 2. My verdict on the 12-column proposal: it is too many, and I recommend 9

Caveat C2 says the owner approved the *fields* without seeing the *table*, and that this mockup is the real checkpoint. So, plainly:

**Twelve columns does not fit, and the failure is not cosmetic.** Laid out at the narrowest width each column can carry its required content — and every one of them now carries more than a number, because §13.7 requires tier, confidence, sample size, provisional state and absent-reason text *in the cell* — the twelve come to roughly **1,620–1,730px**. That is 260–370px over budget at 1440. The table would either scroll horizontally by default (which destroys US-6, "scan the library and find what worked") or every cell would be squeezed to the point where the §13 explainability text is the first thing to get truncated. **The rule that erodes first under layout pressure is exactly the rule §13.5.4 predicted would erode first.** I would rather cut columns now than watch the explanations get ellipsised in code review.

The PRD's own guidance (R5) is *"cut from the bottom of the default list, not from #7/#8."* I have followed it. **#7 (performance score) and #8 (baseline multiplier) are untouched and are the visual centre of the table.**

### 2.1 The cuts and collapses

| PRD col | What I propose | Why |
|---|---|---|
| **#3 Content kind + `analysis_mode` badge** | **Collapsed into #1**, as a badge overlaid on the thumbnail (kind + slide count) and a chip under the title (`Caption only` / `Images only`) shown **only when the mode is not `full_video`** | The correctness problem #3 exists to solve — a `metadata_only` row looking like a watched video — is an *identification* problem, and identification already happens in column 1. Putting the badge where the eye already is makes it more visible, not less. AC-13 is still satisfiable: the labelled badge is in the rendered text. |
| **#5 Reach** + **#6 Likes/comments** | **Collapsed into one two-line "Counts" column** — reach on line 1, likes · comments on line 2 | These are always read together and never sorted independently in practice. Two lines in one 130px column beats two 110px columns, and the shipped four-state treatment (`Hidden` / `0` / `—` / `116.3K plays`) works identically in either. Saves ~90px. |
| **#11 `formatArchetype` + `hookType`** | **Demoted to an optional column** (a "Style" column, off by default, toggled from the column menu) | These are genuinely useful, but they are the answer to a *second* question ("what kind of content works for this creator?"), not to US-6 ("which posts worked?"). Making it a toggle keeps it one click away without taxing every scan. If the owner disagrees this is the easiest thing to restore. |
| **#12 Status** | **Cut as a column; replaced by a row-level treatment plus a status filter** | In a table where the overwhelming majority of rows say "Completed", a status column spends 90px repeating "Completed". Failures instead get a **distinct full-row treatment**: rose left-edge marker, the failure reason inline in the title cell, and every metric cell showing `—` rather than a fabricated blank. The status *filter* chip stays. This makes failures **more** conspicuous than a small badge would, which is what "failures must be visible, not silent" actually asks for. |
| **#9 Engagement %** | **Split into TWO columns** in the recommended direction (§4) | This is the one place I am *adding* width, deliberately, because §12.3 is the highest-severity risk in the PRD and a structural separation is the only mitigation that cannot be undone by a later layout tweak. |

Net: **12 → 9 default columns**, with one optional tenth.

> **RULED 2026-08-09, by the owner — the two proposals in this table that were still only proposals are now decisions.** Both rows above were written as recommendations pending §11 Q2 and Q3. They are no longer conditional:
>
> - **#12 Status — Q2 RULED: the Status column is CUT.** It does not ship as a column, and it is not "the easiest thing to restore". Status surfaces in exactly two places, both already specified here: the **row-level failed treatment** (§3.3 — 3px rose left edge, `Analysis failed — {reason}` on line 2 of the Content cell, `—` in every metric cell, and `Not analysed` in the Performance cell) and the **Status filter chip** (§6.2). Nothing else moves; **no other column absorbs Status's content**, because Status never had per-row content worth a column — it said "Completed".
> - **#11 `formatArchetype` + `hookType` — Q3 RULED: the Style column ships DEFAULT-OFF.** The sentence *"If the owner disagrees this is the easiest thing to restore"* is spent: the owner did not disagree. **The column is built and available**, and is hidden until the user opts in from the `Columns` menu (§6.3). Default-off is a **default**, not a cut — do not descope building it.
>
> Both rulings **confirm this section as written**. No width, order or total in §2.2 changes as a result; see the note there for the resulting column set stated in full.

### 2.2 The proposed default column set

Left to right, at a 1440px viewport:

| # | Column | Width | Sortable | Carries |
|---|---|---|---|---|
| 1 | **Content** | 300px | no | Thumbnail — **40 × 40px square** (§3.1) — with kind + slide-count overlay; title/caption **snippet — *snippet* is defined in §2.2.1: the caption is clamped to two lines (R-D17)**; mode chip when not `full_video`; failure reason when failed |
| 2 | **Creator** | 140px | yes (A–Z) | `@username`, platform glyph + word |
| 3 | **Posted** | 108px | yes (default: desc) | `12 Jul` / `25d ago`, plus the `Early` provisional badge |
| 4 | **Counts** | 132px | yes (by reach) | Reach + its kind word (`plays` / `views`) using the shipped four states; likes · comments on line 2 |
| 5 | **Content** score | 84px | yes | 1–5 numeral + pips. Header group "Scores" shared with #6. |
| 6 | **Performance** | 156px | yes | 1–5 numeral + pips, tier phrase, confidence word, **or** the plain-language absent reason. Carries the row's one explain affordance. |
| 7 | **vs their usual** | 128px | yes | Tier 2 multiplier `3.2×` + `based on 7 reels`, **or** the bucket-scoped cold-start state (§5.3) — **never a bare `3 of 5`**, which is the R-14.2.5 violation this column is most likely to reintroduce |
| 8 | **Eng. / reach** | 116px | yes | `4.1%` + `of 116.3K plays` |
| 9 | **Eng. / followers** | 124px | yes | `≈4.0%` + `of 284K followers` |
| — | *Style* (optional) | 150px | no | `formatArchetype` + `hookType` badges. Off by default. |

Total ≈ **1,288px** + 24px gutters ≈ **1,312px**. Fits 1360 with slack. With the optional Style column on it is ~1,462px and the table scrolls slightly — acceptable for an opt-in column.

> **CONFIRMED 2026-08-09 — this is the shipping column set, not a proposal.** The heading above still reads *"The proposed default column set"*; it is preserved, and superseded. With **Q2 ruled (Status cut)** and **Q3 ruled (Style default-off)**, the table above is **exactly what ships**. Stated plainly, because **#145 / #146 / #149 are scoped from this section**:
>
> **Default columns, left to right — nine, and only these nine:** **1 Content · 2 Creator · 3 Posted · 4 Counts · 5 Content score · 6 Performance · 7 vs their usual · 8 Eng. / reach · 9 Eng. / followers.** Columns 5 and 6 sit under the shared **`Scores`** group header.
>
> **Plus one optional tenth: *Style*** (`formatArchetype` + `hookType`, 150px, not sortable). **Built, shipped, and hidden by default**; the user turns it on from the `Columns` menu (§6.3). A build that omits the Style column entirely does not satisfy Q3.
>
> **There is no Status column, and nothing replaces it in the grid.** Row affordances and hierarchy are **unchanged** by the cut: no column widens, no column moves, the group header spans the same two columns, and the sort set of §6.1 is unchanged. Status surfaces only as the **row-level failed treatment** (§3.3) and the **Status filter chip** (§6.2), both already specified.
>
> **Width is unchanged too.** Both rulings ratify what this section already drew, so the total stands at **≈1,312px** default (fits 1360 with slack) and **≈1,462px** with Style toggled on. **Neither ruling makes the table narrower than the figures above** — the 1,312px total never included Status and never included Style. If a later reader has been told the table "ships materially narrower than §2.2 describes", that is a misreading of the rulings: they **confirmed** this layout rather than trimming it.

### 2.2.1 What *"snippet"* means — the caption clamp *(R-D17, APPROVED 2026-08-13)*

**Status: APPROVED by the owner, 2026-08-13.** `R-D17` was raised in `AUDIT-3C-table-fidelity.md` **M9** as `NEW — PROPOSED 2026-08-13, NOT APPROVED`, with two options for the line count. **The owner ruled Option B — two lines.** This section is the approved rule and the layout authority for it; the audit's copy of R-D17 is marked approved and cross-referenced here.

**Why this section exists.** §2.2's column 1 has asked for a *"title/caption snippet"* since **2026-08-06**, and this document then never defined *snippet* — no line count, no character limit, no ellipsis rule, anywhere. One word carried a layout requirement silently, and the caption shipped unclamped because **there was no rule to build against**. That was a spec gap. The definition belongs here, beside the word, because this is where the next reader will look.

**R-D17 — the Content column's caption snippet is line-clamped. Nothing else in this table is.**

- **Comfortable: the caption renders at most TWO lines**, and the second line is CSS-ellipsised at the point it clips (`line-clamp-2`). Two, not one: column 1 is the **identification** column (§2.2's column-order rationale), and at 300px minus the thumbnail one 11px line is roughly 30–35 characters — often less than one clause of a real caption, which makes the snippet decorative rather than identifying.
- **When the caption is shorter than the clamp, nothing happens.** It renders on one line at its natural height, with **no ellipsis, no padding out to a two-line box, and no reserved blank line**. The clamp is a **ceiling, never a floor**. A short caption yields a shorter cell, and that is correct — it is not a ragged bug to be "fixed" with a fixed-height caption slot.
- **When there is no caption, the line is not rendered at all.** Unchanged from what ships.
- **Compact: the caption is not rendered.** Unchanged — §3.2 already drops it, and the binding list of what no density mode may drop does not include the caption.
- **The title is untouched by this rule.** It stays a **single** truncated line with an ellipsis, which is what ships today. R-D17 must not be read as touching the title.
- **CSS clamp only.** The full caption **stays in the DOM**, so a screen reader reads it whole and §10's semantics are unchanged. A JS substring, which would delete text from the accessibility tree, is out of bounds.
- **No native `title` attribute, no tooltip, no popover, no hover-reveal of the clipped tail.** §8 forbids a native `title`; **R-8.4.7 / R-13.6.2** forbid hover-gating. The clipped tail is simply not shown in the table.
- **Scope, stated so it can never be widened.** R-D17 binds **the Content column's caption and nothing else** — see §3.1's scoping note. Every denominator qualifier, tier phrase, confidence word, `based on N …`, cold-start figure with its format noun, and every absent-score reason and any figure it cites remains **unclamped and untruncatable**.
- **No new copy.** A clamp and an ellipsis are **layout**, not words. This rule adds no user-facing string, and none may be added under it — an ellipsis is not licence for a `Show more` control, a `…read more` link, or any label.
- **Why no information rule breaks.** A caption is **identification material**, not an explanation: it is not a denominator, a tier, a sample size or an absent-score reason. Clamping at Comfortable is strictly **less** lossy than the total suppression §3.2 already approves at Compact.
- **R-13.5.3a and R-13.3.4 checked and not engaged.** A clamped caption states no facts, shares no sentence with a second fact, and shows no division. **#147's one-`ⓘ`-per-row ruling is untouched** — this rule adds no affordance anywhere.

**Column-order rationale.** Identification (1–3) → raw evidence (4) → judgement (5–6) → the quotable comparison (7) → the two ratios (8–9). The two axes the PRD insists must never merge (D7) sit **adjacent under a shared "Scores" group header**, which is the clearest way to say "these are two different things about the same post" without implying either is a component of the other. The engagement ratios sit at the **far right, after** the multiplier, deliberately: §12.4 warns against burying Tier 2 beneath a weaker follower-denominated percentage, and reading order does the burying.

---

## 3. Row anatomy

Two density modes. **Comfortable is the default** because §13.7's requirements live on the second line of several cells; Compact is a power-user affordance that the user opts into and that explicitly warns what it hides.

### 3.1 Comfortable — 68px rows (default)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CONTENT                     CREATOR      POSTED   COUNTS       │  SCORES          │ vs their   Eng./reach  Eng./follo… │
│                                                                │ Content  Perf.   │ usual                              │
├────────────────────────────────────────────────────────────────┼──────────────────┼────────────────────────────────────┤
│ ▓▓▓ Nasi Goreng Kampung     @dapurbunda  12 Jul   482.1K views │  4 ▪▪▪▪▫  4 ▪▪▪▪▫│  3.2×      4.1%        —           │
│ ▓▓▓ 5 Menit — resep…        Instagram    25d ago  31.4K · 1.2K │           vs their│  based on  of 482.1K   no follower │
│ ▓▓▓ [Reel]                                                     │           usual ⓘ│  7 reels   views       measure here│
├────────────────────────────────────────────────────────────────┼──────────────────┼────────────────────────────────────┤
│ ▓▓▓ 10 Ide Konten Ramadan   @dapurbunda   9 Jul   — no reach   │  3 ▪▪▪▫▫  3 ▪▪▪▫▫│  1.8×      —           ≈16.2%      │
│ ▓▓▓ untuk UMKM              Instagram    28d ago  32.3K · 13.8K│           vs their│  based on  not         of 284K     │
│ ▓▓▓ [Carousel ×10] Images   only                               │           usual ⓘ│  6 carous… published   followers   │
└────────────────────────────────────────────────────────────────┴──────────────────┴────────────────────────────────────┘
```

- **Line 1** is the number. **Line 2** is the qualifier that §13.7 requires. Line 2 is never optional and never truncated to nothing — if it does not fit, the *column* is too narrow and gets widened, not the text shortened.

> **SCOPED 2026-08-13 (amendment A8c) — the rule above governs QUALIFIERS, and only qualifiers. It has never governed the Content column's caption.** The sentence is preserved above **verbatim and unchanged in force**; what follows says what it applies to, because it was read wider than it was written and that reading shipped.
>
> **It binds:** every denominator qualifier (`of 482.1K views`, `of 284K followers`), every tier phrase, every confidence word, every `based on N …`, every cold-start figure **with its format noun** (§5.3), every absent-score reason and **any figure that reason cites** (§5.4), and the R-D1 footer (R-D11). For all of these the answer when the text does not fit is **widen the column** — never shorten, never clamp, never ellipsise.
>
> **It does not bind the Content column's caption**, which is **unbounded user-authored text** and is clamped to two lines by **R-D17 (§2.2.1)**. The two rules do not conflict and never did: this one is about **system-authored explanation text of known, bounded length**, whose whole purpose is to stop a number being misread; R-D17 is about **arbitrary-length text whose purpose is identification**. Widening a 300px column is a real answer for a six-word qualifier and no answer at all for a caption that may run to 2,200 characters.
>
> **Why this note exists rather than a bug report.** The implementation applied this rule to the caption and left a comment citing it (`AnalysisContentCell.tsx`, PR #198 review blocker 7). **That reading was defensible on the text as written, and the developer was right to write down which rule he was following.** The ambiguity is the defect, and it is fixed here at its source. **No qualifier's treatment changes.** *(Audit M9; owner ruling, 2026-08-13.)*

- Line 2 uses `--muted-foreground` at full opacity (**no `/70`, no `/80`** — see §9.2; that opacity class is the exact thing that shipped non-compliant twice).
- Row hover raises the row to the hover surface and reveals nothing new. **No information is hover-gated anywhere in this table** (R-8.4.7, R-13.6.2).

#### The thumbnail is 40 × 40px, square — RULED 2026-08-13, and not reopenable *(amendment A8b)*

**The shipped thumbnail is `h-10 w-10` — 40 × 40px, square, `object-cover` — and it stays exactly that.** The audit's **M10** proposed restoring the mockup's 44 × 56px portrait tile; **the owner rejected that, explicitly, because he likes the square thumbnail as shipped.** That is the ruling, and it is recorded here with its reasoning so it is not reopened:

1. **It is the owner's stated preference on his own product**, given after looking at the real table. That alone settles it.
2. **M10's own arithmetic already cut this way.** The mockup's `py-3` + a 56px tile is a **80px** floor on every row before one line of text is laid out — over this section's own row figure, on rows with nothing in them. The 40px square is the only reason short rows come anywhere near it.
3. **The identification cost M10 raised is real and is accepted knowingly.** A square `object-cover` crop of 9:16 or 4:5 source does discard more of the frame than a portrait tile would. The owner has weighed that against the row height it buys and chosen the square. **It is a trade that was made, not one that was missed.**

**Consequences, so no one has to re-derive them:**

- **The mockup was the stale artefact on this point and has been redrawn**, not the code: all seven `w-11 h-14` tiles in `3c-analyses-table-mockup.html` are now `w-10 h-10`. **Code was not changed to match a mockup, and the mockup no longer proposes a tile the owner has rejected.**
- **§3.1's ASCII wireframe above is schematic.** Its `▓▓▓` block is drawn on all three text lines of each row because ASCII has no half-height glyph — **it depicts a thumbnail, not a portrait tile, and it never specified one.** Do not read a tile aspect ratio out of it; §2.2 and this note are the authority.
- **The kind badge sits on a 40px tile and must work there.** The audit's **M11** — a badge tinted for four surface tokens it never sits on, over an arbitrary photograph, with `Carousel` already spanning the tile edge to edge — is **still open and now unavoidable**, because M11's third part was *"if the owner keeps the square tile, the badge needs its own answer."* He has. **This document does not rule on it here**; see the open list at the end of §3.1.

#### Row height — what governs it now the caption is clamped *(amendment A8c)*

**With R-D17 in force the Content cell stops being the thing that sets row height.** On the owner's six-row capture the caption ran to **2, 2, 4, 4, 3, 2** lines and the Content cell was **strictly the tallest cell on 3 of those 6 rows**. Clamped to two, no caption exceeds two, and the Content cell ties but never exceeds on any row in that capture.

**What governs row height instead, stated as a rule:** **the tallest cell in the row governs, and Comfortable has a floor rather than a fixed height.** No cell is clamped, squeezed or middle-aligned to hit a target row height; if a row is tall it is because a cell in it has three real lines, and the fix for that is never to shorten a qualifier (see the scoping note above). `height` set on a `<tr>` is a **minimum in CSS, not a height** — treating it as a height is the defect the audit's **M8** found.

**Re-deriving the 68px figure, with the thumbnail ruled at 40px square.** Content cell, Comfortable, at today's shipped tokens (`p-3` = 12px top + 12px bottom; title `text-sm` = 14px/20px; caption `text-xs` = 12px/16px):

| Row shape | Padding | Thumbnail column | Text column | Cell height |
|---|---|---|---|---|
| Title, no caption | 24 | 40 | 20 | 24 + 40 = **64px** |
| Title + 1-line caption | 24 | 40 | 20 + 16 = 36 | 24 + 40 = **64px** |
| **Title + 2-line caption (the clamp ceiling)** | 24 | 40 | 20 + 32 = 52 | 24 + 52 = **76px** |
| Title + mode chip + 2-line caption | 24 | 40 | 20 + ~17 + 32 = ~69 | 24 + ~69 = **~93px** |

**So: 68px is reachable only on rows that carry no caption, and is unreachable on any row that carries one.** The 40px square buys back the 16px the portrait tile would have cost — it lifts the thumbnail out of the governing position on every row shape above — but the **text column, not the thumbnail, is what exceeds 68px**, and a two-line caption clears it by 8px. Under the mockup's type scale that M8 proposes (12.5px title / 11px caption) the same sum gives **~71px**, still over. **The clamp did not rescue 68px, and no legal combination of the ruled inputs reaches it.**

> **PROPOSED, not applied — this figure needs the owner's sign-off before it changes.** I am not editing `68px` out of this section's heading on my own authority; the audit's M8 said the number should move *"with the owner's agreement"*, and that agreement has not been given.
>
> **My proposal: replace the single `68px` figure with a `64px` minimum and a content-driven height** — heading to read *"Comfortable — 64px minimum, height set by the tallest cell"*. 64px is the real floor (padding + the ruled thumbnail), it is a number the layout can actually honour, and it stops the spec asserting a height that CSS was only ever treating as a minimum. **Typical rows land at 76px today**, or ~71px if the §9 type pass (M8) lands at the mockup's scale.
>
> **The chipped-row figure (~93px) is arithmetic, not a proposal.** Whether the mode chip stacks above the caption or takes its line **instead** is the audit's **L7**, still unruled, and it is the one input that moves this number materially. I am not deciding it here.

**Still open in this section, for the owner — listed, not decided:**

1. **M11 — the kind badge's backing over a photograph.** See above. What I need in order to rule is stated in the audit's open list.
2. **L7 — mode chip stacking**, which sets whether chipped rows are ~93px or ~76px.
3. **The `68px` → `64px` replacement above.**

### 3.2 Compact — 40px rows (opt-in)

Row padding halves and the non-load-bearing second lines drop out. **What Compact loses:** the caption snippet, the platform word (the creator handle stays), and the likes/comments line. **What Compact keeps, unconditionally:** every denominator qualifier (`of 482.1K views`, `of 284K followers`), every tier phrase, every confidence word, every `based on N …`, every cold-start progress figure **with its format noun attached** (§5.3 — the noun is not an optional decoration on the figure, it is the half of it that makes it true), the `Early` badge, the post age, and every absent-score reason **including any figure that reason cites** (§5.4).

**Rule: no density mode may drop a denominator, a tier, a sample size, a provisional badge, an absent-score reason, a format noun, or a figure an absent-score reason refers to.** If it cannot fit them, it is not a legal density mode. The mockup shows Compact obeying this.

### 3.3 The failed / non-completed row

Not a status badge. The whole row changes:

- A 3px rose left edge marker.
- The title cell shows the caption snippet greyed, with a second line: `Analysis failed — {reason}` or `Queued · position 4`.
- Every metric cell renders `—` in muted, and the Performance cell renders `Not analysed` rather than an absent-score reason (a failed analysis has no performance verdict to explain — that is a different fact from a completed analysis with no score, and the two must not share a string).
- Failed rows are **excluded from every sort ordering** and grouped at the bottom under the same divider as unscored rows, labelled separately.

---

## 4. THE HARD ONE — making two engagement percentages non-comparable (PRD §12.3, R6)

This is the single requirement I would most like the owner to rule on explicitly, because it is the only failure mode in this feature that produces **no error, no failing test, and a wrong sentence in a client meeting**.

Two directions. I recommend **A**.

### Direction A — Two dedicated columns, never one *(RECOMMENDED)*

`Eng. / reach` and `Eng. / followers` are **separate columns with separate headers**. Every row fills exactly one of them; the other cell carries the plain-language reason it is empty, never a blank.

| | Reel row | All-image carousel row |
|---|---|---|
| **Eng. / reach** | `4.1%` <br> `of 482.1K views` | `—` <br> `not published for image posts` |
| **Eng. / followers** | `—` <br> `measured against reach instead` | `≈16.2%` <br> `of 284K followers` |

> **AMENDED 2026-08-13 (amendment A5) — the `Eng. / followers` reason string is now `measured against reach instead`.** It previously read `no follower measure here`, which is preserved here as the withdrawn string so it is not restored. **The behaviour is correct and unchanged**; only the sentence changed. The old string described the **denominator choice for this post** but its grammar described **the creator's data**, and read down a column of one creator's rows it parsed as *"we don't know this creator's follower count"* — visibly contradicted by the row above it showing a follower-denominated figure for the same creator. The word `here` was carrying the entire meaning and losing. The replacement names the column that **does** hold the figure, so a row-to-row difference reads as a routing fact rather than a data gap. It renders in the `Eng. / followers` cell on any row whose Tier 1 ratio resolved against **reach** — the same condition, unchanged. The mirror strings in `Eng. / reach` are **unchanged and stay split** on content kind (`no post-level reach` for video, `not published for image posts` for image-only — R-13.5.2, §5.4); this amendment is not licence to collapse them. Neither string implies an error state. *(Issue [#207](https://github.com/jordanjordann/my-content/issues/207) item 1; #199 reworks the sibling string's **selection logic**, not its wording — the two are independent.)*

Additional always-on distinguishers, so the separation survives even a user who ignores headers:

1. **Different qualifier text in every cell** — `of 482.1K views` vs `of 284K followers`. This is the accessible-text assertion AC-25 and AC-21 test against, and it is present with no hover, no legend, no tooltip.
2. **The `≈` prefix on every follower-denominated figure.** It is not decoration: the follower count comes from a cache with up to a 7-day TTL (PRD §4.2, R3), so the number genuinely *is* approximate, and the reach-denominated figure genuinely is not. **A truthful typographic difference is worth more than an invented one**, because it survives a redesign — anyone who removes it has to argue that the number is exact, which it is not.
3. **Different colour families** — amber (`--accent`) for reach-denominated, teal for follower-denominated — as a **redundant third channel only**. Colour carries no meaning that text does not already carry (WCAG 1.4.1); the design is fully readable in greyscale.

**Why I recommend A, in one sentence:** it makes R-12.3.2 (*sorting must never interleave denominators*) **structurally impossible to violate** — there is no single "engagement" column to sort, so no code path exists that could mix them, and no future refactor can quietly reintroduce one.

**The honest cost:** every row has one cell that is a reason instead of a number, and the table gets ~120px wider. I think that is a good trade for the highest-severity product risk in the PRD, and the "empty" cells are not wasted — they are exactly the R-8.4.3 / R-13.5.1 reason text the PRD requires anyway. It has to go somewhere.

### Direction B — One column, two different units

A single `Engagement` column, where the two denominators **do not share a unit**:

- Reach-denominated: `4.1%` `of 482.1K views`
- Follower-denominated: `162 per 1K followers` `284K followers` — **no percent sign anywhere**

Two numbers can never be confused when only one of them is a percentage. Saves ~120px.

**Why I do not recommend it, despite liking the idea:**

1. **It sacrifices the number the agency will actually want to quote.** "Engagement rate" against followers *is* conventionally a percentage — it is the number on every influencer rate card (PRD §3.1) — so we would be converting the industry-standard figure into a unit nobody uses. The percentage would then reappear in the detail view and in Gemini's Indonesian prose anyway, and **the moment it reappears un-prefixed the protection is gone**.
2. **Sorting needs machinery.** One column means a denominator-scoped sort: clicking the header opens a two-item menu ("Sort by engagement per reach" / "…per follower"), and the non-selected denominator's rows drop below the divider. That works, but it is a behavioural rule that a future ticket can regress silently. Direction A cannot regress.

Direction B is in the mockup under the toggle so the trade-off is visible and reviewable, not asserted.

### 4.1 Rules binding on whichever direction is chosen

- **R-D1** No aggregate, total, average or "typical engagement" row exists anywhere in this table, in either direction (R-12.3.3). Where a user might reasonably expect one, the table footer says so in words: `No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.` (R-13.6.3.)

  > **AMENDED 2026-08-13 (amendment A5) — copy only. The decision is untouched.** The withdrawn string is preserved so it is not restored: `No totals — these posts are measured against different things.` **There is still no aggregate row and there never will be** (R-12.3.3); what failed was the sentence, on its first real reader — *"i dont understand what it means"*. Three things were wrong with it and all three are fixed above: it named no unit, so the reader could not reconstruct what the difference *was*; `different things` is the same abstraction the successful version of this explanation avoids (`DESIGN-3B` §5 row 5 names *"different units — views and plays"* and works); and it gave a reason without ever stating plainly what the table was declining to do. The replacement **declines first** (`No totals`), **names the two denominators in the words the cells already use** (`views or plays` / `follower count`), and **says what cannot be done with them** (`added or averaged`). It contains no numeral and no new term. It renders in the table footer bar on every load, unconditionally, exactly as the old string did. **It stays always-visible** — R-13.6.2 forbids hover-gating, so it is not a tooltip, not a popover and not an on-demand disclosure; see R-D11. *(Issue [#207](https://github.com/jordanjordann/my-content/issues/207) item 2.)*
- **R-D2** Any future CSV/export inherits the qualifier as its own column. A percentage that leaves this product without its denominator is the failure this whole section exists to prevent (PRD §13.7). Export is not in 3C scope; this is a standing constraint.
- **R-D3** A video-bearing carousel is reach-denominated but its reach is **derived from the first slide** (D4). Its qualifier reads `of 88.2K views · first slide only`, and it is the one reach-denominated figure whose confidence is one level lower. It sits in the reach column — it belongs there — but it must not read as an unqualified per-post reach.
- **R-D4** *(amendment A2)* The **mirror case of R-D3** — first slide is an image, a later slide has the count (`REACH_NOT_ON_FIRST_SLIDE`, §5.4) — has **no** reach-denominated figure and its `Eng. / reach` cell renders the reason `no post-level reach`. The later slide's count appears **once**, in the Performance cell, attached to the sentence that says what it is. **It must never appear in the Counts column, in either engagement column, or in any export**, because a figure in any of those positions is a per-post reach claim, and this row has no per-post reach.

### 4.2 The engagement-column tooltips — placement, trigger and accessible name *(amendment A6)*

The **copy** for both tooltips is in the companion spec's new **§4.6** (`T1` for `Eng. / reach`, `T2` for `Eng. / followers`), which stays the single home for strings. This section decides the **affordance**, which is this document's job.

**The trigger lives in the column header, once per column, and never in a cell.**

```
┌──────────────────┬─────────────────────┐
│ Eng. / reach ⓘ ▾ │ Eng. / followers ⓘ ▾│   ← sticky header row; ▾ = the existing sort control
├──────────────────┼─────────────────────┤
│ 4.1%             │ —                   │
│ of 482.1K views  │ measured against    │   ← rows carry NO new glyph
│                  │ reach instead       │
└──────────────────┴─────────────────────┘
```

**Why the header, and how this respects §5.1's one-`ⓘ`-per-row ruling rather than dodging it.** §5.1 ruled exactly one explain affordance per row, in the Performance cell, because *"four `ⓘ` glyphs per row × 50 rows is visual noise that would train users to ignore all of them."* That ruling is about **per-row glyph density**, and this design does not touch it: **it adds zero glyphs per row.** It adds **two glyphs to the entire table**, in a header that renders once and is `sticky` (§8), so the count is two at ten rows and two at five hundred. The ruling's spirit is served on the merits too: the fact these tooltips carry is a property of the **column**, not of the row — every row in `Eng. / reach` has the same denominator kind — so a per-cell trigger would repeat one identical explanation on every row, which is the same waste in a different place. **A per-cell or per-row engagement `ⓘ` is out of bounds and stays out of bounds.**

**Rules binding on the affordance:**

- **R-D5** The two triggers are the **only** explain affordances outside the Performance cell. The row's single `ⓘ` (§5.1) is unchanged in position, count and behaviour. No other column header gains one in this amendment.
- **R-D6** Each trigger is a **real `<button>`, a sibling of the sort control inside the same `<th>`, never nested inside it** — a control inside a control is both an a11y defect and a click-target ambiguity, and the header's sort button already owns the whole label. `aria-sort` on the `<th>` is unaffected.
- **R-D7 — reuse, do not reinvent.** Both triggers use the **shipped ticket-#70 interaction contract**, exactly as the Performance cell's `ⓘ` already does: open on hover **and** on keyboard focus, `role="tooltip"` on the popup, `aria-describedby` wired from the trigger while open, dismissal on `Escape`, on blur and on outside press, and **never** a native `title` attribute. There is no second tooltip mechanism in this table.
- **R-D8 — accessible names.** `Eng. / reach` → **`How is engagement against reach worked out?`**; `Eng. / followers` → **`How is engagement against followers worked out?`**. The pattern matches the shipped `How was this score worked out?` (§5.1) — the name is the **question the tooltip answers**, never a generic `info`, `help` or `more information` (R-13.7.6). **Note, 2026-08-14:** applying that same requirement to the Performance-cell trigger found it stating a question about a score on a row that has none; the row-8 name is now `Why is there no 1–5 for this post?` (`S-P8`), and the complete state-by-state table of that trigger's name is the companion's **§5.5.1**. R-D8's two engagement-column names are unchanged.
- **R-D9 — L2 only, and provably so.** Nothing that prevents a misread may move into these tooltips. The denominator qualifier stays on **every cell, every row, every density** (`of 482.1K views`, `of 284K followers`), and the `≈` prefix stays on every follower-denominated figure. If a later change makes either tooltip the only place a denominator appears, that change is non-compliant with R-13.6.2 and R-8.4.7 — the tooltip is not the licence for it.
- **R-D10 — the tooltips never render a figure.** No row's numbers, no example numbers, no worked division (R-13.3.4). They explain the shape of the calculation only; the numbers are in the cells.
- **R-D11 — the R-D1 footer is not a tooltip.** It stays plain, always-visible text in the table's footer bar, left slot, `text-xs text-muted-foreground`, at full opacity. It may wrap to a second line and **must never be truncated or ellipsised**; if it does not fit, the footer bar's layout gives it the room (`min-width: 0` on the pagination side), because R-13.6.2 forbids moving it behind an affordance.

### 4.3 The Counts column tooltip, and the comment count that has no number *(amendment A7 — PROPOSED, awaiting owner sign-off)*

**This section sits under §4 because §4.2 is where the header-trigger affordance was decided, not because the Counts column is an engagement ratio — it is not, and nothing here treats it as one.** The **copy** is the companion's new **§4.7** (`T3` and its Compact variant, the trigger name, and the `S-C1` accessible name), which stays the single home for strings. This section decides the **affordance** and rules on the **per-row glyph question**, which is this document's job.

**The state this is for, and the state it deliberately is not for.** The companion's §4.7.1 verified in code that a comment count resolves to **`AVAILABLE` / `ZERO` / `UNKNOWN` only, never `HIDDEN`** — both comment resolvers are bare `resolveFromCount`, the state is re-derived at read time rather than stored, and nothing in `lib/` reads the payload's `comments_disabled` field. **So there is no comments `hidden` cell to design an affordance for**, the invented trigger `Why is the comment count hidden?` is withdrawn, and the shipped per-cell `ⓘ` that the `Hidden` state carries stays what it already is: an affordance for the two metrics `like_and_view_counts_disabled` governs — **reach and likes — and no others**.

**The trigger lives in the Counts column header, once, and never in a cell.**

```
┌──────────────────┐
│ Counts ⓘ ▾       │   ← sticky header row; ▾ = the existing by-reach sort control
├──────────────────┤
│ 482.1K views     │
│ 31.4K · 1.2K     │   ← rows carry NO new glyph
│                  │
│ 88.2K views      │
│ 5.1K · —         │   ← the `—` is the state this explains; still no glyph
└──────────────────┘
```

**How this respects the #147 one-`ⓘ`-per-row ruling rather than dodging it.** §5.1 ruled exactly one explain affordance per row, in the Performance cell, because *"four `ⓘ` glyphs per row × 50 rows is visual noise that would train users to ignore all of them."* That ruling is about **per-row glyph density**, and this adds **zero glyphs per row** — one glyph to the entire table, in a header that renders once and is `sticky` (§8), so the count is one at ten rows and one at five hundred. The merits agree: what the tooltip explains (what the two lines are, and what a `—` means) is identical on every row, so a per-cell trigger would repeat one sentence fifty times. **A per-cell or per-row Counts `ⓘ` is out of bounds and stays out of bounds.** Table-wide total after this amendment: **three header triggers** (§4.2's two, plus this one) and **one per-row `ⓘ`**, unchanged.

**Rules binding on the affordance:**

- **R-D12 — the count is three header triggers and no more.** `Eng. / reach`, `Eng. / followers` (§4.2) and `Counts`. **No other column header gains one**, and the row's single `ⓘ` (§5.1) is unchanged in position, count and behaviour. A fourth header trigger is a design ticket, not an implementation choice.
- **R-D13 — reuse, do not reinvent.** The trigger is a **real `<button>`, a sibling of the sort control inside the same `<th>`, never nested inside it** (a control inside a control is both an a11y defect and a click-target ambiguity), using the **shipped ticket-#70 interaction contract** exactly as §4.2's two do: open on hover **and** on keyboard focus, `role="tooltip"` on the popup, `aria-describedby` wired while open, dismissal on `Escape`, blur and outside press, and **never** a native `title`. `aria-sort` on the `<th>` is unaffected, and the Counts column stays sortable by reach. There is no second tooltip mechanism in this table.
- **R-D14 — no comments `hidden` state may be rendered.** The Counts cell's comments slot renders `AVAILABLE` / `ZERO` / `UNKNOWN` only, through the shipped four-state component. **`Hidden` must never appear in the comments slot**, and the views/likes hidden sentence must never be reachable from it. If a comments `HIDDEN` is ever produced, that is a new-evidence event requiring a design ticket (companion §4.7.1) — not a fallback string and not a reuse.
- **R-D15 — L2 only.** The `—` keeps its accessible name on every row at L1, the reach line keeps its in-cell OR-11 absent-reason at L1, and the `Hidden` state keeps its own per-cell affordance. Nothing that prevents a misread moves into this tooltip; if a later change makes it the only place any of those appears, that change is non-compliant with R-13.6.2.
- **R-D16 — the tooltip has two density variants and no other conditionality.** Comfortable renders `T3`; Compact renders `T3-compact`, which drops only the sentence describing line 2, because Compact does not render line 2. It is **never** conditioned on a row's state, on the row set, or on whether any row currently shows a `—` — it explains the column, and an empty table's header still carries it.

**No layout consequence.** **§2.2 is the layout authority and is untouched by this amendment:** the Counts column stays column 4 at **132px**, sortable by reach, in the same order, and the table's totals (≈1,312px default, ≈1,462px with Style on) are unchanged. The trigger sits inside the existing header cell beside the existing sort control; no column widens, moves or is added.

---

## 5. Rendering a 1–5 score inside a small cell without misleading

This is the second-hardest thing in the table, and it has three traps.

**Trap 1 — a progress bar reads as a percentage.** A 5-step score drawn as a filled bar is read as "80%". **No bars.** The score renders as **five discrete square pips** with the numeral beside them: `4 ▪▪▪▪▫`. Discrete pips are countable and cannot be read as a continuous proportion.

**Trap 2 — the numeral must be the information, the pips must be decoration.** The pips are `aria-hidden`; the accessible text is `4 out of 5`. This is not only an a11y nicety — it means the pip track colour is **decorative and exempt from WCAG 1.4.11**, so the design does not hang on a 3:1 non-text ratio that a later theme tweak could break. (The track colour specified in §9 clears 3:1 anyway. Belt and braces.)

**Trap 3 — the content score and the performance score look identical and will be confused.** D7 says they are separate axes, always two, never merged. Two identical-looking `n ▪▪▪▪▫` cells side by side invite exactly the merge D7 forbids. Mitigations:

- A **shared `Scores` group header** spanning both, with sub-labels `Content` and `Performance`. The group header is what says "related but different".
- **Different pip fill colours** — `--muted-foreground` for content, `--primary` for performance — redundant with the sub-labels, never load-bearing.
- **The Performance cell always has a second line and the Content cell never does.** The performance score is never presentable without its tier phrase; the content score has no tier. That asymmetry is itself a signal, and it is enforced: a Performance cell with no second line is a bug.

### 5.1 The Performance cell, fully specified

```
 4 ▪▪▪▪▫              ← numeral + pips, foreground
 vs their usual ⓘ     ← tier phrase (plain language, never the enum) + explain affordance
 high confidence      ← confidence word, muted (Comfortable only; inlined in Compact)
```

- **The tier phrase is never the enum.** `CREATOR_BASELINE` → `vs their usual`; `REACH_ONLY` → `of who saw it`; `AUDIENCE_FALLBACK` → `rough — vs audience size`. Exact strings live in the companion spec §3.
- **Tier 3 must read as the weakest of the three wherever it appears** (R-13.2.4). It is the only tier phrase rendered in muted italic with the word `rough` leading it. That is a deliberate, visible demotion, carrying §3.5's demotion through to the user where it matters.
- **When there is no score**, the numeral and pips are replaced by the plain-language reason — **not** by `0`, `—`, or an empty cell (R-13.5.4). The reason is short enough to fit two lines at 156px; the full sentence is in the popover. Strings in the companion spec §5.

  > **AMENDED 2026-08-13 (amendment A6) — two of the three states that shipped as a bare `—` now have sentences, and one of them changes this cell's affordance rule.** The bullet above is unchanged as a rule; what changed is that reachable states were falling through it. Both are specified in the companion's new **§5.5**, with their strings as **rows 8 and 9** of its §5 table: **`No 1–5 for this post`** (the judgement returned no score over a present computed block) and **`Performance wasn't measured`** (no performance block exists at all). Both render on line 1 of this cell, styled exactly as every other absent-score reason — muted, full opacity, **no rose, no glyph, not the failed-row treatment of §3.3**. **The affordance differs between them, deliberately:** row 8 **keeps the row's single `ⓘ`**, because a computed block exists and the popover has real content (with its heading and opening paragraph swapped for the no-score case, companion §5.5); row 9 **carries no `ⓘ`**, because there is nothing behind it and a popover that opens onto nothing is worse than no affordance. **`INSUFFICIENT_HISTORY` deliberately keeps the `—`** — it is never produced, and copy for an unreachable state would publish a meaning the system cannot demonstrate. **Neither row is a failed row and neither uses `Not analysed`**, which stays row 7's string. *(Owner request, 2026-08-13; the gap PR #198 review round 3 deferred.)*
- **The `ⓘ` explain affordance is one per row, in this cell only.** Not one per figure. Four `ⓘ` glyphs per row × 50 rows is visual noise that would train users to ignore all of them. One well-placed affordance satisfies R-13.7.6 ("it must be evident a fuller explanation exists and is reachable") without that cost. It reuses the ticket-#70 tooltip trigger interaction (hover **and** keyboard focus, `Escape` to dismiss) already shipped and already documented in `DESIGN-engagement-count-display-states.md` §6.

### 5.2 Provisional

`Early` badge in the **Posted** column, next to the age — because provisionality is a property of the post's age, not of the score, and putting it there stops it competing with the tier phrase for the Performance cell's second line. It also means it is visible on rows that have no score at all.

The badge reads `Early` with the age immediately beside it (`2d ago · Early`). Copy and the a11y string are in the companion spec §6, including the R-13.4.4 constraint that **no string anywhere may imply the maturity floor is a measured threshold**.

### 5.3 Cold start — the `vs their usual` cell while a format bucket is still filling *(amendment A1)*

**This supersedes the bare `3 of 5` this document previously showed.** PRD **§14.2** is binding: the Tier 2 minimum of 5 is counted **per format bucket**, never per creator, because reels are measured in plays and carousels in views and **R-4.3.2 forbids a ratio across two reach kinds**, so the pools never combine. The case that decides the copy: **a creator with 4 reels and 4 carousels has 8 analysed posts and gets no comparison on either.** A bare `3 of 5` in front of that user is not merely terse — it is a false statement about what they are waiting for, and it is the string that makes a correctly-working feature read as broken.

**The design requirement, then, is not "add a noun". It is that the figure and the noun are one atom and must never be separated** — a `2 of 5` that can be rendered without `carousels` is a bug waiting for a narrow column, exactly the way §13.5.4's explanations were going to get ellipsised.

#### The cell, at 128px

```
 2 of 5 carousels        ← the progress, format-scoped. The noun is not optional.
 builds as you           ← the reassurance. Wraps to two lines at 128px; that is fine.
 analyse more            
```

**Line 1 — `2 of 5 carousels`.** The format noun is the bucket noun of R-13.4.1 / OR-9, in the user's words (`carousels`, `reels`, `Shorts`), **pluralised and lowercase**, sitting inside the same phrase as the number so that no truncation, no density mode and no future width tweak can separate them. `2 of 5` and `carousels` are never in separate elements that could wrap apart or be independently hidden.

**Line 2 — `builds as you analyse more`.** This is R-14.2.5's third mandatory element, the reassurance that it resolves on its own, and **it is in the cell, not in the popover.** R-13.6.2 forbids hover-gating information, and "is this permanent or temporary?" is precisely the question the user is asking at the moment they read the cell. A user who never opens the popover must still learn that this state ends.

**Neither line is styled as a failure (R-14.2.4).** No rose, no warning glyph, no `—`, no `0`, no empty cell. Both lines are `text-muted-foreground` at full opacity — the same treatment as every other line-2 qualifier in the table (§9.2, **7.91 / 7.73 / 7.35 / 6.78** against background / card / hover / muted). **No new colour value is introduced by this state**, deliberately: a waiting state that needed its own colour would be a waiting state that had been designed as an alert.

#### The full sentence, in the popover

> `“vs their usual” compares this post against the same creator's own past carousels. Carousels and reels are measured in different units — views and plays — so they're counted separately and never pooled. @dapurbunda has 2 of 5 carousels analysed so far. The comparison appears on its own once the fifth is in.`

The second sentence is **R-14.2.6**: it is what stops a creator with plenty of posts overall concluding the tool is stuck. It names the mechanism in the user's terms — different units — rather than asserting a rule they have to take on trust.

#### Rules binding on this state

- **R-C1** No string in this table, in any state, at any density, in any popover, empty state, filter label, sink label or tooltip, may frame the threshold at creator level. **The literal string `5 posts` must not appear**, nor any paraphrase of it (`5 analysed posts`, `five posts`, `needs 5 more posts`). Every occurrence of the threshold carries its format noun. This is directly assertable by string search (PRD S9 / AC-33) and should be.
- **R-C2** The `5` remains a configuration constant on the R-13.3.4 allow-list (**R-14.2.7**). It is read from config for display; it is **not** stored per row, and the copy must not hard-code it.
- **R-C3** The count in the cell is **the count for that bucket**, never the creator's total analysed posts. Rendering a creator-level count in a bucket-scoped sentence is the same failure as the bare `3 of 5`, one layer down.
- **R-C4** This is a **partial** absence, not an absent score. A cold-start row may still carry a Tier 1 or Tier 3 performance score; only the `vs their usual` cell is waiting. It therefore **does not** move to the sink group under the default sort, and its Performance cell renders normally.

### 5.4 `REACH_NOT_ON_FIRST_SLIDE` — the count exists, on a slide we did not read *(amendment A2)*

New state, from **OR-26** (TDD §0, §3.1, §5.3) and the PR #161 review. The situation: a carousel whose cover slide is an image. D4's rule reads reach from slide 0, finds neither reach key, and derives nothing — but a **later slide carries a real play or view count**. `derivedFrom` stays `NONE`; `unavailableReason` is `REACH_NOT_ON_FIRST_SLIDE`, which splits this off from `CONTENT_KIND_UNSUPPORTED` ("this post type doesn't report counts" — true for an all-image carousel, **false here**).

**The constraint, and it is the whole of this section: the figure appears alongside the sentence, or the state is not shown at all.**

> `Reach isn't on slide 1` / `a later slide: 0 views` is honest.
> `The count is on a later slide` is a **non-answer** — and at `0` it is worse than a non-answer, because the user is left assuming a number was withheld when in fact it was measured and it is zero.

**Zero is a measurement here, not missing data**, and must read as one. That is the same discipline as the shipped `0` count state in `DESIGN-engagement-count-display-states.md`, and this state reuses it rather than inventing a second language for it.

#### The Performance cell, at 156px

```
 Reach isn't on slide 1
 a later slide: 0 views  ⓘ
```

- Line 1 names **where we looked** and says plainly that the number is not there. `slide 1` rather than `the first slide` for width; the table already uses one-based slide language in the Content column's `Carousel ×10` overlay.
- Line 2 carries **the figure and its kind word**, in the same phrase. `0 views`, `234.1K views`, `18.4K plays` — whichever the later slide actually reports.
- The `ⓘ` sits at the end of line 2, the row's single explain affordance as always (§5.1).
- Both lines `text-muted-foreground` at full opacity — **7.73:1 on card**, 7.91 / 7.35 / 6.78 on background / hover / muted (§9.2). **No new colour, no new component, no new width.** This state is a reason like any other reason and is styled identically to the two that already ship in the mockup.

#### The other cells on this row

| Cell | Renders | Why |
|---|---|---|
| **Counts (#4)** | `—` / `no reach on slide 1` | The post's reach is genuinely underived. **The later slide's count must not appear here**, because this column is sortable by reach and a number in it would be sorted, exported and read as *the post's* reach. It is not — it is one slide's. The figure appears exactly once, in the Performance cell, where it is attached to the sentence that says what it is. |
| **vs their usual (#7)** | `no reach to compare` | No reach, no multiplier. Sinks under R-S1. |
| **Eng. / reach (#8)** | `—` / `no post-level reach` | Distinct from the image-carousel row's `not published for image posts` — this post **does** publish counts, so that string would be false here (R-13.5.2 forbids collapsing these two). |
| **Eng. / followers (#9)** | the follower ratio, if audience size is known | Unaffected by where reach lives. |

#### The full sentence, in the popover

> `This carousel's first slide is an image, so there's no view count where the score reads it. A later slide does report one — 0 views — but the score uses the first slide only, so this post has no reach figure and no performance comparison. This isn't a missing number: it's a number in a place we don't read.`

#### Rules binding on this state

- **R-N1 (binding — the figure is not optional)** The figure and its kind word are **required** whenever this state renders. If the value is unavailable to the UI, **this state must not be rendered**; the row falls back to `CAUSE_NOT_DETERMINABLE` and its existing copy. A bare "the count is on a later slide", with no count, must never ship — it is a fabricated-adjacent diagnosis of exactly the class **R-13.5.3a** exists to forbid, and it is the sentence the PR #161 review objected to.
- **R-N2 (binding — R-4.3.1)** The kind word must match the key the later slide actually carries: `video_play_count` → **plays**, `video_view_count` → **views**. A play count is **never** labelled "Views". If the kind cannot be established, **R-N1 applies** — degrade to `CAUSE_NOT_DETERMINABLE` rather than print an unlabelled number. There is no `UNKNOWN`-kind rendering of this state, because "a later slide reports 234,050 of something" is not a sentence worth showing anyone.
- **R-N3** If **more than one** later slide carries a count, the cell shows the count of the **first slide that carries one**, and the popover says which: `slide 6 of 10`. It must **never** show a sum, a maximum or a mean across slides — that would be a per-post reach figure we have explicitly declined to compute (D4, R-D3), reintroduced through the back door of an error message.
- **R-N4** The slide index is a **nice-to-have, not a requirement**. If the resolver carries it, the cell reads `slide 6: 0 views` and the popover names it; if not, `a later slide: 0 views` is fully compliant. The design must not be built such that a missing index suppresses the figure.
- **R-N5** This state **never** uses the failed-row treatment (§3.3). Nothing failed. It is a completed analysis with a reach figure we deliberately do not consult.

> **Engineering consequence, flagged rather than assumed.** TDD §3.1's ruling gives `ReachResult` **one additive boolean** (`children.some(hasReachFields)`). **A boolean cannot satisfy R-N1.** For this state to render at all, the resolver must carry forward **the value and its reach kind** (and, optionally, the slide index) — not merely the fact that one exists. That is a change to ticket **#155**'s scope, and **#143** depends on it. If it is not carried, R-N1 binds and this state must not ship: the honest fallback is `CAUSE_NOT_DETERMINABLE`, which is worse product but not a false one.

---

## 6. Sorting, filtering, search

### 6.1 Sorting

Sortable: **Creator, Posted, Counts (by reach), Content score, Performance score, vs their usual, Eng./reach, Eng./followers.** Default sort: **Posted, descending.**

Three rules, all of which have precedent in this repo and none of which is new invention:

- **R-S1 — Non-numeric and absent values always sink to the bottom**, regardless of ascending or descending. This is already the owner-confirmed behaviour for count columns (`DESIGN-engagement-count-display-states.md` §5.1, ticket #96 Q5) and it extends unchanged to scores and ratios. AC-14 asserts unscored rows are never sorted as if they were `0`.
- **R-S2 — The sink group is visible, labelled and counted.** A 1px divider with a left-aligned label: `6 posts with no performance score — sorted separately`. Silence here is what makes a user think the table is broken. Within the group, rows keep the previous ordering (stable), and each still shows its own reason in its own cell.
- **R-S3 — No sort mixes denominators.** In Direction A this is free. In Direction B, sorting the engagement column requires choosing a denominator and pushes the other denominator's rows into the sink group with the label `12 posts measured against followers — not comparable in this ordering`.

**Sorting `vs their usual`** sinks every row without Tier 2, and the sink label distinguishes *no history yet* from *wrong bucket* — those are different facts and R-13.5.2 forbids collapsing them.

**Sink labels are bucket-honest too (R-C1).** A sink label is a cold-start string like any other and is the easiest place for a creator-level framing to survive a copy audit of the cells. The labels read:

- `9 posts waiting on more of the same format — reels and carousels build up separately`
- **not** `9 posts with fewer than 5 analysed posts`, and **not** any variant naming a count without its format.

The second clause is doing real work: it is where a user sorting this column learns *why* a creator with a full library still has rows down here (**R-14.2.6**).

### 6.2 Filtering

A single chip bar above the table, left-aligned, wrapping to a second line if needed: **Creator · Platform · Content kind · Tier · Status**, plus the existing keyword search on the right. Applied filters render as removable chips; a `Clear all` appears once any is set.

- The **Tier** filter's options are the plain-language phrases, not the enums: `Compared to their usual` / `Measured against reach` / `Rough — vs audience size` / `No score`.
- Below the chip bar, always: `Showing 24 of 118 analyses`. Always rendered, even unfiltered — it is the fastest way for a user to notice a filter they forgot about.
- **Filters never hide the reason a row has no score.** Filtering to "No score" is a supported and useful view, not an error state.
- **The `Status` chip is now load-bearing (Q2, ruled 2026-08-09).** With the Status *column* cut, this filter plus the failed-row treatment of §3.3 are the **only** two places status is expressed in the table. It is therefore **not optional and not a candidate for descoping**: removing it would leave a user with no way to ask "show me what failed" at all.

### 6.3 Column visibility

A `Columns` menu at the right of the chip bar. Only the optional Style column is off by default. **Four columns cannot be hidden: Content, Performance, and both engagement columns** (or the single engagement column in Direction B) — hiding a denominator-bearing column is how R-12.3.1 gets violated by a user rather than by a developer. The menu shows them as locked with the tooltip `Always shown — this column carries information the numbers can't be read without.`

**Style is default-off by ruling, not by proposal (Q3, ruled 2026-08-09).** The column is **built and shipped**, listed in this menu unchecked on first load, and toggled on by the user. Two consequences for whoever builds this: **the menu is not optional** — with exactly one toggleable column it is still the only way Style can ever be seen, so a build that ships the menu "later" ships Style unreachable; and **the user's choice persists** across navigations within the session, because a column that silently resets to off every time is functionally still cut. There is **no Status entry** in this menu — Status is not a column (§2.1, §2.2).

> **Superseded 2026-08-09 as to persistence — the owner ruled: NO persistence at all.** The second consequence above is preserved verbatim because it records why the question was escalated, and it is **wrong as a build instruction**. The Style opt-in **resets to hidden on every load**: **no `sessionStorage`, no `localStorage`, no URL parameter, no per-user storage** — the visibility is ordinary component state and it starts off. *"Persists within the session"* was the minimum I proposed to stop default-off being functionally a cut; the owner considered it and ruled the other way. **Do not build session persistence — it was never asked for.**
>
> **What this does not change:** Q3 still ships **default-off, built and available** (§11 Q3), and the first consequence above is not merely intact but **sharper**. Because the opt-in never survives a load, **the column picker is the only route to the Style columns on every single load, not just the first** — so a build that ships the menu "later", or omits the Style entry from it, ships the Style column as **dead code**. The menu is not optional, and the Style entry in it is not optional.
>
> Nothing else in §6.3 moves: the four locked columns, their tooltip string, and the absence of a Status entry are unchanged, and **no copy string changes**. The implementation consequence is recorded by the tech lead on **#149** (plain React state, resets on load, plus a verification case) and in `TDD` §0 (OR-5). **Correct before #149 is picked up.**

---

## 7. Empty, loading and error states

Four distinct states. **Collapsing any two of them is the same class of error as collapsing two absent-score reasons** (R-13.5.2) — the user acts differently in each.

| State | Trigger | Treatment |
|---|---|---|
| **Loading** | First fetch | Skeleton rows in the **exact column grid** — 8 rows, shimmer blocks matching each cell's real shape (thumbnail rect, two text bars, pip row). Header and chip bar render real, not skeletoned, so the page does not reflow when data lands. **Never a centred spinner** — a spinner throws away the layout the user is about to read. |
| **Empty — nothing analysed yet** | Zero rows, no filters | Centred block inside the table frame: heading `No analyses yet`, one line of body, and the primary `Analyse a post` action. The **column headers stay rendered** above it, so the user learns the shape of what they are about to get. |
| **Empty — no rows match filters** | Zero rows, ≥1 filter | Different copy and a different action: `No analyses match these filters` + `Clear all filters`. Never the same block as above — offering "Analyse a post" to someone who just over-filtered is a small insult. |
| **Error** | Fetch failed | Rose-marked block: `Couldn't load analyses` + the failure detail + `Try again`. Distinguished from the empty states by colour **and** by the presence of a retry action. |

**All four render inside the table frame with the header row intact.** The chrome does not disappear.

---

## 8. Interaction rules

- **Row click** opens the existing analysis detail modal. The whole row is the target except the explain affordance and the creator link.
- **Row hover** raises to the hover surface. Reveals nothing. (R-8.4.7.)
- **Keyboard:** rows are reachable in DOM order with a visible focus ring; `Enter` opens the detail modal; `Escape` closes it and returns focus to the row that opened it. Sort headers are `<button>`s inside `<th>` with `aria-sort` set to `ascending` / `descending` / `none`.
- **The explain popover** reuses the #70 tooltip pattern exactly: opens on hover **and** keyboard focus, `role="tooltip"` + `aria-describedby`, dismissible on blur / mouse-out / `Escape`, never a native `title` attribute. Do not build a new one.
- **Sticky header.** The `<thead>` and the group header row stick on vertical scroll. On a 100-row table the column headers are the only thing preventing a denominator misread; they must never scroll away.
- **No row-level actions in the table.** Re-analyse and delete stay in the detail modal, where they already are and where the confirmation already lives.

---

## 9. Colour, contrast and tokens

### 9.1 Method

**Every ratio below was computed with the gamma-encoded sRGB method** required by RUNBOOK §8.4 — the exact method this codebase got wrong twice, shipping non-compliant colour through tickets #101 and #102. Alpha compositing is done on gamma-encoded 0–255 values *before* linearisation, and each colour is measured against **all four** surfaces it actually renders on, not one.

The values below are **dark-surface stand-ins for the app's semantic tokens**, chosen to reproduce the ratios already measured and recorded in `docs/HANDOFF-2026-08-05.md` (`--card` resolving to `rgb(3,10,23)`; `text-accent` on card = 7.57:1; `bg-primary/10 text-primary` = 6.04:1; `text-muted-foreground` on background ≈ 7.9:1). **The implementer must re-measure against the real token values before merging** and record the three surface ratios in the PR body (AC-17). I am specifying the *pattern* and the *floor*, not asserting the app's hex values from memory.

Surfaces measured against: `--background` `#02060f`, `--card` `#030a17`, row-hover `#0a1120`, `--muted` `#111a2c`.

### 9.2 Text

| Role | Token pattern | background | card | hover | muted | Verdict |
|---|---|---|---|---|---|---|
| Primary cell text | `text-foreground` `#e6edf7` | 17.21 | 16.82 | 16.00 | 14.75 | pass |
| **Line-2 qualifier text** | `text-muted-foreground` `#94a3b8` | **7.91** | **7.73** | **7.35** | **6.78** | pass |
| Reach-denominated qualifier | `text-accent` `#d99126` | 7.75 | 7.58 | 7.21 | 6.65 | pass |
| Follower-denominated qualifier | teal `#3fd0bb` | 10.58 | 10.33 | 9.83 | 9.07 | pass |
| Performance numeral | `text-primary` `#8092e7` | 6.94 | 6.78 | 6.45 | 5.95 | pass |
| Failed-row text | rose `#fda4af` | 10.72 | 10.48 | 9.97 | 9.19 | pass |

**Amendments A1 and A2 add no colour values.** Both new states (§5.3, §5.4) render entirely in the **Line-2 qualifier** row of the table above — `text-muted-foreground` at full opacity, **7.91 / 7.73 / 7.35 / 6.78** against background / card / hover / muted, all ≥ 4.5:1. That is deliberate and load-bearing in two directions: the cold-start state must not be styled as an alert (**R-14.2.4**), and the reach state must not be styled as a failure (**R-N5**). If either state acquires a colour treatment later, it needs its own row here with all four ratios re-measured — and it should first have to argue why a normal waiting state needs a colour the other reasons do not.

**Hard rule: qualifier text is `text-muted-foreground` at FULL opacity.** Not `/70` (4.42:1 vs background — fails), not `/80` (5.53:1 — passes but has no margin and is the exact value that had to be patched in PR #113). Any opacity modifier on a text token in this table must be re-measured against all four surfaces before it ships.

### 9.2.1 The two engagement column headers — the colour, and every state it has to survive *(R-D18 ruled and R-D19's hover half rejected, both 2026-08-14)*

**Owner ruling, 2026-08-14, verbatim:**

> **The engagement column-header colour must be kept in ALL states — idle, hover, and active-sort.**

**Why this sub-section exists, and where the gap was.** §9.2's table above assigns `text-accent` and the teal token to the **line-2 qualifier**. It has never said anything about the **column header**. The header colour has only ever existed in two places: the mockup, which draws it as static text (`3c-analyses-table-mockup.html:181-182` — `class="… text-accent" — Eng. / reach`, `class="… text-teal" — Eng. / followers`), and `AUDIT-3C-table-fidelity.md` **M3**, which read it off the mockup and asked for it back. **The mockup's headers are not buttons.** They have no hover state, no active-sort state and no sort arrow, so nothing in this document, in the audit or in `TDD` §16 has ever stated what that colour does once the label sits inside a real sort control.

The shipped sort control's own classes are `hover:text-foreground` plus an active-sort `text-foreground` — an explicit `color` on the button, which beats anything the `<th>` would pass down. So a developer adding the colour to the `<th>` and building the sort button exactly as specified gets a header whose colour **disappears on hover and stays gone while that column is sorted** — the colour vanishes precisely when the reader is doing the one thing that makes the two denominators most confusable, comparing rows ordered by one of them.

**That silence is the bug, and it is the same root cause as R-D17 (§2.2.1).** There, one undefined word (*snippet*) carried a layout requirement silently and the caption shipped unclamped; §3.1's *"line 2 is never truncated"* was then applied outside the scope it was written for. Here, one unstated interaction state carried a colour requirement silently. In both cases the developer applied the rule as written and the rule was incomplete. The fix is the same: state it where the next reader will look, and scope it so it cannot be widened or narrowed by inference.

#### R-D18 — the engagement column-header colour is unconditional

- **The colour renders in every state of the header: idle, hover, active-sort, focus-visible, and sticky-scrolled.** There is no state in which either header renders in `text-muted-foreground`, `text-foreground`, or any other colour.
- **Scope: exactly two columns** — `Eng. / reach` (accent) and `Eng. / followers` (teal), columns 8 and 9 of §2.2. **Every other header is untouched** and keeps `hover:text-foreground` and the active-sort `text-foreground` swap exactly as it has them today. This rule is not a table-wide change and must not be generalised into one.
- **Inheritance is not sufficient, and "put the colour on the `<th>`" is not a compliant implementation.** The label lives inside a `<button>`; a `color` declared on that button wins over the colour it would inherit. **The colour must be carried by the element that renders the label**, and the foreground-swap classes must not be present on it at all. Suppressing them with a higher-specificity override, an `!important`, or an ordering trick is not compliant either — the requirement is that on these two headers there is **no competing `color` declaration to begin with**.
- **This is a regression guard, not a preference.** Any later refactor that reintroduces a foreground swap on these two headers — including a "tidy-up" that unifies all headers under one class string — is a regression against this rule and against the owner's ruling, not a simplification.
- **No new colour value is introduced.** The accent and teal are §9.2's existing tokens. **§9.1's hexes remain non-normative stand-ins**; AC-17's re-measure still applies because the header is a *new element* for the colour (composited against the sticky `bg-card` header, not against a row surface), but nothing here asserts a hex.
- **Settled, and out of scope for this rule:** the 1-unit teal drift (`#40d0bb` against §9.2's `#3fd0bb`) is **accepted and deliberate** — recomputed twice, contrast differs by 0.01 — and the per-column class field on `AnalysisTableColumnDef` (`headerColorClassName`) is the **approved** mechanism for carrying it. Neither is reopened here.
- **§9.5 is unchanged and still holds.** Greyscale loses nothing: §4's distinguisher 3 already rules the colour a **redundant** channel, and after R-D19 the header's remaining affordances — the sort arrow and the `focus-visible` ring — are shape, not hue.

#### R-D19 — the sorted state is carried by the arrow alone; the hover underline was proposed and is **REJECTED 2026-08-14. There is no hover affordance on these two headers.**

> **OWNER RULING, 2026-08-14 — the hover underline is REJECTED and this is not reopenable.** Verbatim: ***"no need hover color change, its fine."*** **The two engagement column headers get no hover affordance at all** — no underline, no foreground swap, no substitute of any kind. This is the **owner's** ruling on his own product, not a designer's or a developer's inference from it, and nothing below re-argues it. **R-D18 is unaffected and stands in full**: the colour is still kept in idle, hover and active-sort.
>
> **What R-D19 still rules, and it is the half that was approved:** the **sort arrow alone carries the sorted state**, for the three reasons set out below. That part of this rule is live and binding.
>
> **The designer's analysis is preserved rather than deleted, and is recorded as accepted cost, not as an open objection.** The hover foreground swap was the **only pointer feedback that these two headers are clickable at all**, and the sort arrow cannot substitute for it, because the arrow does not exist until *after* the click — it is a confirmation of the action, never an invitation to it. So the trade the ruling makes is real and specific: on these two headers, and only these two, a mouse user gets **no on-hover signal that the label is a control**, and will find the sort by clicking, by tabbing to the focus ring, or by inferring it from the other seven headers that do still swap. That is a **discoverability** cost, not a correctness or accessibility one — no information is lost, no state becomes unreadable, and §9.5's greyscale test still passes. It is written down so that a future reader who notices the asymmetry knows it was **seen, weighed and knowingly accepted**, and does not "fix" it as an oversight.
>
> **What remains as affordance on the two engagement headers — the complete list:** the **`focus-visible` ring** (unchanged, and now the only interaction-time visual affordance); the **directional arrow** when the column is active; the accessible name's **`, currently ascending` / `, currently descending`**; **`aria-sort`** on the `<th>`; and the **pointer cursor**. **No hover-state signal remains** — stated plainly, because "no hover state" is the kind of thing a later reader assumes is a bug.
>
> **The banned-substitutes list below survives this rejection and is now load-bearing in the opposite direction.** It no longer picks between candidate hover signals; it exists so that **no hover signal is reintroduced by another route**. A font-weight change, any opacity modifier, a background tint and any second colour are all still forbidden here, for the reasons given — and so, now, is the underline itself.
>
> **The R-D18 regression warning is unchanged by any of this.** R-D18 is exactly the kind of rule a later class-string tidy-up silently undoes: one refactor that unifies all nine headers under a single class string reintroduces `hover:text-foreground` on these two and breaks the ruling without anyone noticing. That warning was written of R-D18 and stands whether or not R-D19's hover half was approved.
>
> The proposal as written is preserved below, unedited, as the record of what was proposed and declined.

R-D18 removes the two headers' only colour-based state change, so the question is what, if anything, replaces it. **Checked against the shipped control** (`AnalysisTableColumnHeaders.tsx` at `cb4571c`), a sortable header already carries **six** signals: the hover foreground swap, the active-sort foreground swap, a `focus-visible` ring, a directional arrow rendered **only** when the column is active, an accessible name that appends `, currently ascending` / `, currently descending`, and `aria-sort` on the `<th>`. R-D18 removes the first two from these two headers and nothing else.

**Active sort needs no replacement. The arrow alone suffices, and this is a ruling, not an omission.** Three reasons:

1. **The arrow is the stronger channel of the two, and it always was.** It is a **presence/absence** change of a glyph, not a shade shift between two greys, and it additionally encodes **direction**, which the foreground swap never did. The colour swap was the redundant half of that pair; the half being kept is the half that carries the information.
2. **"Which column is sorted?" is never answered by comparing headers.** At most one column is active at a time, and the arrow is unique in the header row. A reader scans for the glyph; nobody reads nine header labels side by side judging shades. The two engagement headers therefore do not become ambiguous by looking the same sorted as unsorted — they become **identifiable by the arrow**, exactly like every other column.
3. **`aria-sort` and the direction-bearing accessible name are untouched**, so the non-visual channel is unaffected by any of this. §9.5's test — printed in greyscale, this table loses nothing — is satisfied by the arrow on its own.

**The `focus-visible` ring is unchanged on all headers**, and remains the keyboard affordance — and on these two headers, after the rejection above, it is the only interaction-time visual affordance they have. R-D19 adds nothing to the keyboard path and removes nothing from it.

**The two engagement headers also carry the §4.2 tooltip trigger (R-D5…R-D11).** That trigger is a **separate sibling `<button>`** with its own accessible name and its own focus ring; R-D18 and R-D19 bind the **sort control only** and change nothing about it. A hover over the sort label must not open the tooltip.

---

##### The rejected proposal, preserved unedited — **nothing in the four bullets below is to be built**

> **This block is the record of what was proposed and declined on 2026-08-14. It is not a requirement.** The reasoning in its first paragraph is the accepted cost recorded in the ruling above; the four bullets are the rejected mechanism. The **banned substitutes** in the third bullet remain **live and binding** — they are the reason no *other* hover signal may be introduced in the underline's place, and the underline now joins them.

**Hover does need a replacement, and this is the part R-D18 alone would have left broken.** The hover swap was not a redundant channel: it was the **only pointer feedback that these headers are clickable at all**. Removing it without replacement would make the two engagement headers the only sortable headers in the table that do not respond to the pointer, and the arrow cannot cover it — the arrow does not exist until *after* the user has clicked. That is a discoverability loss, not a redundancy loss, so it is spec'd:

- **On hover, the label underlines.** `underline` with `underline-offset-4` and `decoration-1` (or the nearest tokens the app has). On **hover only** — never on the active-sort state, where a permanent underline would read as a link.
- **Why an underline and not something else.** Text-decoration **inherits the text colour**, so it works identically in accent, in teal and in greyscale, and it introduces **no colour value and no contrast obligation** — AC-17 is not engaged by it. It also causes **no reflow**, which matters in a 116px / 124px fixed-width header.
- **Banned substitutes, recorded so they are not reinvented:** a **font-weight** change (reflows a fixed-width header and can wrap the label); **any opacity modifier** — §9.2's hard rule requires a re-measure on all four surfaces, and dimming is a direct attack on the colour R-D18 exists to protect; a **background tint** (that is §9.3's badge pattern and is reserved for badges); and **any second colour**, which would reintroduce exactly the override just removed.
- **Scope, so it cannot be widened.** R-D19's underline binds **only** the two colour-carrying headers. The other seven keep `hover:text-foreground` and get no underline — they lose nothing and need no compensation.

**End of the rejected proposal. The other seven headers keep `hover:text-foreground` exactly as they have it today; the two engagement headers get no hover affordance of any kind.**

### 9.3 Badges (tinted-background pattern)

Following the known-good `EnumValueBadge` pattern (`bg-{colour}/10` + `text-{colour}`), measured foreground-on-composited-tint on each surface:

| Badge | Pattern | on background | on card | on hover | on muted |
|---|---|---|---|---|---|
| Tier / performance | `bg-primary/12 text-primary` | 6.10 | 5.91 | 5.51 | 5.00 |
| Reach denominator | `bg-accent/12 text-accent` | 6.80 | 6.61 | 6.18 | 5.60 |
| Follower denominator | `bg-teal/12 text-teal` | 8.96 | 8.58 | 7.97 | 7.17 |
| Failed / destructive | `bg-rose/12 text-rose` | 9.08 | 8.79 | 8.10 | 7.29 |
| Neutral (kind, mode) | `bg-slate-300/10 text-slate-300` | 11.63 | 11.25 | 10.36 | 9.31 |

All ≥ 4.5:1 on all four surfaces. **The tightest is `bg-primary/12` on `--muted` at 5.00:1** — that is the one to re-check first against the real tokens, because it has the least headroom.

### 9.4 Non-text

- **Score pip track (unfilled)** `#5c6c86` — 3.72 / 3.54 / 3.27 against card / hover / muted, clearing the 3:1 non-text floor (WCAG 1.4.11). Formally the pips are decorative (`aria-hidden`, numeral carries the value), so this is headroom rather than a dependency.
- **Row borders and the sink divider are decorative.** No information is carried by a border. The sink divider carries its meaning in its **text label**, not its line.
- **Focus ring** `--ring` at 2px with 2px offset, ≥3:1 against every surface it lands on.

### 9.5 Colour is never the only channel (WCAG 1.4.1)

Checkable claim: **printed in greyscale, this table loses nothing.** Every distinction that colour reinforces is also carried by text or shape —

| Distinction | Non-colour channel |
|---|---|
| reach- vs follower-denominated | different column, different header, different qualifier text, `≈` prefix |
| content vs performance score | different sub-label, presence/absence of a second line |
| Tier 3 as the weakest tier | the word `rough`, and italic |
| provisional | the word `Early` |
| failed row | the words `Analysis failed` + the reason |
| absent score | a full plain-language sentence |
| cold start vs. a real absence | the words `2 of 5 carousels` and `builds as you analyse more` — a progress figure, not a treatment |
| count on a later slide vs. no count at all | the figure itself, with its kind word (`0 views` vs `no counts published`) |

---

## 10. Accessibility

- **Semantics:** a real `<table>` with `<caption class="sr-only">`, `<th scope="col">`, and the group header as a `<th colspan="2">` in a first header row. Not a div grid — the whole point of this surface is relationships between cells, and a screen reader needs the row/column association to convey them.
- **`aria-sort`** on the active header; the sort button's accessible name includes the current direction.
- **Score cells** announce as `Performance 4 out of 5, compared to their usual, high confidence`. Pips are `aria-hidden`.
- **Engagement cells** announce the number and its denominator **in one phrase** — `4.1 percent of 482,100 views`, not `4.1 percent` followed by a detached label. Same discipline already applied to State 4's `plays` label.
- **Absent cells** announce the full reason sentence. An absent score must never announce as empty.
- **The cold-start cell (§5.3)** announces as one phrase, format noun included: `2 of 5 carousels analysed — this comparison builds as you analyse more`. It must never announce as `2 of 5`, which is meaningless read aloud with no column context.
- **The `REACH_NOT_ON_FIRST_SLIDE` cell (§5.4)** announces the figure and its kind in the same phrase as the sentence: `Reach isn't on slide 1 — a later slide reports 0 views`. **`0` is announced as a number, never skipped**; a screen-reader user must not be able to come away thinking the count was absent.
- **The explain affordance** has an accessible name phrased as the question it answers — `How was this score worked out?` — so a screen-reader user knows what opening it gets them. **On row 8 (companion §5.5) that name would state a question about a score the row does not have, so it becomes `Why is there no 1–5 for this post?` (`S-P8`); the companion's §5.5.1 is the complete table, and every scored row keeps the name above unchanged.**
- **No information anywhere is hover-only.** This is a correctness constraint (R-8.4.7, R-13.6.2), and it is also what makes the table usable by keyboard at all.

---

## 11. Open questions for the owner

These are the ones I could not answer alone. **Questions 1, 5 and 6 were ruled on by the owner on 2026-08-07 as part of the §12 sign-off. Question 4 was ruled by the owner on 2026-08-07 too, but *separately from* that sign-off, which did not cover it. All four are marked RULED below. Questions 2 and 3 are still open** and are not covered by the §12 sign-off.

> **Superseded 2026-08-09 as to its last sentence.** *"Questions 2 and 3 are still open and are not covered by the §12 sign-off"* was true from the sign-off until 2026-08-09 and is kept on the record. **The owner ruled both on 2026-08-09, separately from and after the §12 sign-off: Q2 — the Status column is CUT; Q3 — the Style column ships DEFAULT-OFF (built and available, hidden until the user opts in via the column picker).** **Every question in this section is now ruled — 1, 5 and 6 at the sign-off; 4 on 2026-08-07; 2 and 3 on 2026-08-09.** Nothing in §11 is open. The rulings are recorded per question below and in §12.

1. **RULED — Direction A** for the engagement split (§4), 2026-08-07. Two dedicated columns; there is no single engagement column to sort, so R-12.3.2 is structurally unviolable. This was the C2 sign-off the PRD reserved.
2. **RULED — the Status column is CUT**, 2026-08-09, by the owner. Ruled **separately from and after the §12 sign-off**, which did not cover it; see the note in §12. The question is kept below rather than replaced, on the same discipline as Q4.

   > **The question as it stood:** *Do you accept cutting the Status column in favour of a distinct failed-row treatment (§2.1)?*

   **Outcome: cut.** Status does not ship as a column. It surfaces in exactly two places, both already specified: the **row-level failed treatment** of §3.3, and the **Status filter chip** of §6.2 — which is consequently load-bearing rather than a convenience. **No other column absorbs anything**, no width changes, no order changes: §2.2's nine columns and its ≈1,312px total were already computed without Status. See §2.2 for the shipping column set stated in full.
3. **RULED — the Style column ships DEFAULT-OFF**, 2026-08-09, by the owner. Ruled **separately from and after the §12 sign-off**, which did not cover it; see the note in §12. The question is kept below rather than replaced, on the same discipline as Q4.

   > **The question as it stood:** *Style (`formatArchetype` + `hookType`) default-on or default-off? I propose off.*

   **Outcome: default-off — and *default-off*, not cut.** The column is **built and available**; it is hidden on first load and the user opts in from the `Columns` menu (§6.3). The proposal is confirmed, so §2.1's *"if the owner disagrees this is the easiest thing to restore"* is spent, and the ~1,462px with-Style total in §2.2 stands as the opt-in width. **Descoping the build is not what this ruling says.**
4. **RULED — the 1–5 performance score stays in the analyses table**, 2026-08-07, by the owner. Ruled **separately from the §12 sign-off**, which did not cover it; see the note in §12. The question is kept below rather than replaced, because it was genuinely open and was refused settlement by proximity three times (PRs #163, #165, #166) before it was decided explicitly.

   > **The question as it stood:** *Do you want the 1–5 performance score in the table at all? Provocative, and I mean it: `3.2× their usual` is a measured number and by your own PRD (§3.1, §3.5) the most quotable thing this product makes, while the 1–5 is a model judgement. Keeping both costs 156px and creates the "score says 2 but the multiplier says 3.2×, which do I believe?" question. Keeping only the multiplier would be narrower and more defensible — but it loses the read on posts with no Tier 2 yet. I lean toward keeping both, with the score explicitly labelled as a judgement (see the companion spec §7). Worth your ruling.*

   **Outcome: both stay** — the score and the multiplier. The lean is confirmed, not merely tolerated, so the companion spec's **§7 is now the governing treatment** of the 1–5 rather than a contingent argument, and **§5's Performance-cell specification stands** as written. This ruling covers Q4 and nothing else: **Q2 and Q3 remain open.**

   > **Superseded 2026-08-09 as to its last clause only.** *"Q2 and Q3 remain open"* correctly describes the **scope of the Q4 ruling** and stays on the record for that reason — Q4 did not touch them. **They were ruled separately on 2026-08-09** (see Q2 and Q3 above). Everything else in this outcome is unchanged.
   >
   > **One operational consequence of Q4, carried here because it is scoped from this section.** With the 1–5 staying, the *"score says 2 but the multiplier says 3.2×"* problem has exactly one remaining mitigation: the companion spec **§7 point 4**, the deterministic *"these disagree because…"* line. The other fix was removing the column, and this ruling killed it. **Per OR-6 that line is REQUIRED, not optional, and cannot be dropped for time** — **#147** is built from it. The "cut the score" contingency has also **left ticket planning**; the PM recorded that in PRD **§15.1**. Do not re-open it.
5. **RULED — Comfortable** is the default density (68px, ~9 rows visible), 2026-08-07. Compact stays as the opt-in of §3.2, bound by the rule that no density mode may drop a qualifier.
6. **RULED — pagination**, 2026-08-07, with **newest analysis first as the default sort** and **performance explicitly not the default sort**. This confirms §6.1's `Posted, descending` default and settles the interaction with the sink group: a sink group at the bottom of an infinite scroll is a sink group nobody ever sees.

---

## 12. Sign-off record

**Approved by the owner on 2026-08-07.** Recorded here because the PRD (§13.8, caveat C2) requires the sign-off to be explicit — *"we assumed the designer had handled it"* is precisely how R6 ships.

**What is approved:**

- [x] **§12.3 / R-12.3.4 — the comparability treatment, direction named: Direction A** (§4). Two dedicated columns, `Eng. / reach` and `Eng. / followers`, never one.
- [x] **The default column set: 9 columns** (§2.2), cut from the PRD's 12 as proposed in §2.1.
- [x] **Row density: Comfortable** (§3.1) as the default.
- [x] **Pagination**, with **newest analysis first as the default sort**. **Performance is explicitly not the default sort.**
- [x] **Amendment A1 — §5.3, the bucket-scoped cold-start copy** (`2 of 5 carousels` / `builds as you analyse more`) and rules R-C1…R-C4, as merged in PR #162.
- [x] **Amendment A2 — §5.4, `REACH_NOT_ON_FIRST_SLIDE`**, and rules R-D4 / R-N1 / R-N2 / R-N3, as merged in PR #162.

**What this sign-off does not cover**, recorded so that nobody reads it as broader than it is:

- **§13 — the explainability surfaces are signed off separately** in the companion spec's own record. Every user-facing string this table renders lives there.

  > **Corrected 2026-08-07, after this sign-off was recorded.** As approved, this bullet continued: *"…in the companion spec's own record, **which is still empty**. That document remains PROPOSED."* **That was true when the owner approved this document** — 3C was signed off before 3B — and it is **now superseded**: [`DESIGN-3B-score-explainability.md`](./DESIGN-3B-score-explainability.md) was signed off by the owner on **2026-08-07** and merged in **PR #165** (`main` @ `642f2e5`); its **§10** carries the full record. Recorded as a superseded statement rather than a silent rewrite, so the reason it was written stays legible. **The exclusion itself is unchanged** — this sign-off still does not extend to §13; the companion document is signed off in its own record, on its own terms.

- The remaining items in **§11** on which no ruling is recorded here: the Status-column cut (Q2), the Style column's default state (Q3), and whether the 1–5 performance score belongs in the table at all (Q4). They are implemented as this document proposes, but they are not signed off.

  > **Superseded in full 2026-08-09 — all three are now ruled.** This exclusion is preserved verbatim because it was accurate at signature and its two earlier partial supersessions (Q4, below) only make sense against it. **The 2026-08-07 sign-off still does not cover any of the three** — that fact does not change. What changed is that each was ruled **separately from and after** it, by the owner: **Q4 on 2026-08-07** (the 1–5 score stays), and **Q2 and Q3 on 2026-08-09** — **Q2: the Status column is CUT; Q3: the Style column ships DEFAULT-OFF**, built and available, hidden until the user opts in via the column picker. **No item in §11 is open, and no item in §11 is now "implemented but unsigned".** Recorded as superseded rather than rewritten, per the pattern of PRs #166 and #168.

  > **Superseded in part 2026-08-07, after this sign-off was recorded — for Q4 only.** As approved, this bullet excluded three questions, and the clause *"and whether the 1–5 performance score belongs in the table at all (Q4). They are implemented as this document proposes, but they are not signed off"* was accurate for Q4 at the moment of signature. **Q4 was outside the 2026-08-07 sign-off and was ruled separately by the owner on the same date**: the **1–5 performance score stays in the analyses table** (§11, Q4). Two distinct acts on one day — the sign-off did not cover Q4; a later ruling decided it. The approved text above is left standing rather than rewritten, so that a reader can see both facts. **Q2 and Q3 are untouched by this note: they remain unruled, remain excluded from this sign-off, and remain implemented as this document proposes without being signed off.**

  > **Superseded 2026-08-09 as to its last sentence.** *"Q2 and Q3 are untouched by this note"* remains a true statement about the **Q4 note** and is kept for that reason; *"they remain unruled"* is no longer true of the world. **Q2 and Q3 were ruled by the owner on 2026-08-09 — Status column CUT, Style column DEFAULT-OFF** — again separately from, and after, this sign-off. Three distinct acts now sit on top of one signature: the sign-off (2026-08-07), the Q4 ruling (2026-08-07), and the Q2/Q3 rulings (2026-08-09). All three are recorded, none replaces the text of another. **The resulting shipping column set is stated in full in §2.2.**

- **A record disagreement, flagged for the tech lead — not resolved here.** `TDD` §0.2 carries **Q2 and Q3 as already decided (OR-4 / OR-5)**, while this section recorded them as **outside the 2026-08-07 sign-off and unruled** until 2026-08-09. Both statements were written in good faith and the **substance is now settled either way** — the owner's 2026-08-09 rulings match what OR-4 / OR-5 say. What is *not* settled is the **record**: two governing documents disagree about when, and under which instrument, these questions were decided, and that matters the next time someone asks what a sign-off covered. **Reconciling the TDD is the tech lead's call, not the designer's**, and nothing in this pass edits the TDD.

  > **CLOSED 2026-08-09 — reconciled by the tech lead in merged PR #178 (`TDD` §0.7).** The item above is preserved verbatim because it is the flag that produced the reconciliation, and it is **no longer open — do not restate it as such.** The reconciliation went **against the TDD** and found **this design record correct about the instrument**: `DESIGN-3C` §12 is a dated sign-off with an explicit scope statement, while `TDD` §0 is a derived decision list carrying one blanket date. **OR-4 / OR-5, as written on 2026-08-06, were the TDD adopting this document's own §2.1 / §2.2 proposals into the build plan so tickets could be cut — binding as *plan*, but not a separate owner act**, and they are not evidence that the owner ruled Q2/Q3 before 2026-08-09. **The governing instrument for Q2 and Q3 is the owner's ruling of 2026-08-09.** The 2026-08-07 sign-off did not cover them, and that does not change. A standing rule came out of it: **a `TDD` §0 row is never a citation for *when* or *by what instrument* something was decided** — cite the dated sign-off or ruling record. Nothing built changes.
- **R-N1's data dependency** (§5.4's engineering consequence). If the resolver does not carry the reach value and kind, `REACH_NOT_ON_FIRST_SLIDE` must not render at all. Approving the design does not approve shipping the state without its figure.
