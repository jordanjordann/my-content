# Design Decision Record — Phase 3B, Score Explainability

**Status:** **APPROVED — 2026-08-07, by the owner.** This is the sign-off PRD §13.8 reserved for this mockup review, and the owner has ruled: the three-level disclosure model, the seven absent-score strings of §5 (including case 3's `We can't tell`), the provisional copy constraint of §6, the seven items in §9, and amendment **B1** (§5.3, R-C1…R-C6). The full record, including what is and is not covered, is in **§10**. This file is the canonical home for every copy string it contains, and tickets **#145–#149** may build against it within that scope; anything §10 lists as not covered is not covered.
**Author:** Jessica (UI/UX)
**Created:** 2026-08-06
**Mockup:** [`docs/design/3b-score-explainability-mockup.html`](./3b-score-explainability-mockup.html) — open in a browser.
**Primary input:** `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md` §13 (the five questions, R-13.1.1 to R-13.7.11), §12.3 (comparability), §3.3/§3.5 (the tiers), §4.4/§4.5 (absent inputs, maturity).
**Companion:** [`DESIGN-3C-analyses-table.md`](./DESIGN-3C-analyses-table.md) — where most of these strings render. **One design, two documents.**
**Precedent it must not contradict:** [`DESIGN-engagement-count-display-states.md`](./DESIGN-engagement-count-display-states.md). That spec already solved "a count is missing — explain it honestly", and its four owner-confirmed states are reused verbatim rather than re-solved. This document extends the same vocabulary to *scores*; it does not start a second one.

### Amendment record

| # | Date | What changed | Why |
|---|---|---|---|
| **B1** | 2026-08-07 | **The Tier 2 cold-start copy is bucket-scoped, never creator-scoped.** The bare `3 of 5` is withdrawn everywhere it appeared: §4.1's string table, §4.4's constants note, §5 row 5 (both L1 and L2), §5.2, §9 item 2, and the mockup. §4.3's thin-sample confidence string loses its format-less `5 earlier posts` for the same reason. The strings are now **`2 of 5 carousels`** / **`builds as you analyse more`**, and the rules that bind them are stated in the new **§5.3**. | **R-14.2.4 / R-14.2.5 / R-14.2.6** (PRD §14.2) and **R-C1…R-C4** (companion §5.3, merged in PR #162). The threshold of 5 is counted **per format bucket**, because reels are measured in plays and carousels in views and R-4.3.2 forbids a ratio across two reach kinds. A bare `3 of 5` told a creator with 4 reels and 4 carousels — 8 analysed posts, no comparison on either — something false about what they were waiting for. This document is the canonical home for these strings, so it is the file tickets #145–#149 build against, and it had to stop disagreeing with its companion. |

| **B2** | 2026-08-09 | **Record-keeping pass, no design change.** (a) **§7 is now the *governing* treatment of the 1–5**, per the owner's Q4 ruling, and its point 4 — the deterministic *"these disagree because…"* line — is **REQUIRED, not optional** (OR-6); the "drop the 1–5 from the table" alternative is marked **spent**. (b) The **§9/§10 carry-overs for `based on {N} {noun}` (OR-9) and the `week` TTL (OR-10) are marked stale** — both were already resolved. (c) **Q2 (Status column cut) and Q3 (Style column default-off) are recorded as RULED, 2026-08-09**, in every place this document restated them as open. | Q4 removed the only alternative fix for the score/multiplier disagreement, so the line that explains it can no longer be dropped for time — **#147** is built from §7. The two carry-overs predicted a design/AC conflict and a CI failure that do not exist, and stale notes in that direction get "fixed" by loosening guards (**issues #170, #171**). No copy string, colour value, component, layout, density or interaction changes anywhere in this document. |

| **B3** | 2026-08-09 | **Correction, no design change. The stored reason for "cause not determinable" exists and is named `CAUSE_NOT_DETERMINABLE`** — recorded in every place this document said it did not exist or proposed a different name: **§5 row 3**, **§5.1**, **§9.6**, and **§10** (both the "one of the seven" note and the §9.6 carry-over). The proposed name **`PERFORMANCE_DATA_ABSENT` is recorded as ruled against and superseded**, with the reasoning, so it is not re-proposed. The mockup's row-3 annotation is corrected to match. | The value **shipped in migration `012`, merged**, and is live in the `perf_unavailable_reason` `CHECK` constraint (`TDD` §5.2), carried into `013`; the name was the tech lead's call and `CAUSE_NOT_DETERMINABLE` names the **epistemic** state rather than the data state (`TDD` §5.3). The doc never caught up, and a code review is holding **PR #179** on it (**issue #169**, step 4). The deferral blocker previously cited — contention with issues **#170 / #171** — is gone; both are closed. **No copy string, colour value, component, layout, density or interaction changes**, and string 3's `We can't tell` clause is untouched. |

| **B4** | 2026-08-11 | **§5 gains row 3b, and row 3's trigger condition is restated. Copy and trigger wording only.** `CAUSE_NOT_DETERMINABLE` is reached by two different routes, and row 3's copy is **false** on the second one. New **row 3b** carries its own L1 **`Engagement data incomplete`** and its own L2 (*"Instagram published part of this post's engagement, but not all of it…"*). **Row 3's trigger is restated** as *the hidden-counts flag absent **and** neither the like nor the comment count usable* — **zero** usable engagement inputs — so it can no longer be read as covering a partially-published post. New **§5.4** gives the deciding matrix over *(follower count known?, `likeState`, `commentState`)*, and the `All seven`/`All eight` count under the table is corrected. **Row numbers 1–7 are unchanged**, so every existing *"string 3"* / *"case 3"* reference here, in `DESIGN-3C`, in the PRD and in the ACs still points at the same row. | **R-13.5.3a** — *two different facts must not render one sentence.* The state exists in code today: PR #191's own fixture is a post with **32,313 likes**, an unknown comment count and a **10,000 follower count**, which resolves to `CAUSE_NOT_DETERMINABLE` because `hasComputableEngagementNumerator` refuses to sum a partial numerator. Row 3's L1 *"No performance data published"* and L2 *"Instagram published no view, like or comment data for this post"* are both untrue of it. `renderHiddenCountsReasonShortForm` has **no production call site yet**, so nothing user-facing is wrong today — this lands **before #145** renders these strings, so #145 has a truthful string instead of inventing one. **The stored value is untouched and stays `CAUSE_NOT_DETERMINABLE`** (owner-ruled, `TDD` §5.3); `PERFORMANCE_DATA_ABSENT` stays dead per **B3**. Row 3's `We can't tell` clause is **not edited** (R-13.5.3b, §10 sign-off). **No stored enum value, colour value, component, layout, density or interaction changes.** *(Issue [#192](https://github.com/jordanjordann/my-content/issues/192); PR #191 review round 3, item N2 — [comment](https://github.com/jordanjordann/my-content/pull/191#issuecomment-5248477069).)* |

| **B5** | 2026-08-12 | **§3.1 gains §3.1.1 — the disagreement line's comparison, thresholds, deadband and copy are specified. §9 item 5 is marked ruled.** The line **compares the 1–5 judgement against the Tier 2 multiplier**, not Tier 1 against Tier 2 as §3.1's four-variant table framed it; that table and its *"Open"* note are marked superseded and preserved verbatim. **Score split: `4–5` high, `3` neutral, `1–2` low** — `3` is a value a rater chooses and means *middling*, so it is the score side's deadband, and `>= 3` is wrong. **Multiplier split: `m >= 1.15` high, `m < 0.85` low, with a deadband of `0.85 <= m < 1.15`** — the band is set by the precision the user is shown (the multiplier renders to one decimal, so anything displaying as `0.9×`/`1.0×`/`1.1×` reads as *about usual* and must not be called high or low). **Both disagreement strings are restated** — `it travelled` / `it didn't travel far` withdrawn as untrue on image buckets, and `Worth re-cutting the hook and re-posting.` withdrawn as unsupportable from a judgement. **The two agreement variants are retired**, recorded, and are not rendered. **No stored value, colour value, component, layout, density or interaction changes**, and §7 is untouched — its point 4 already defers the comparison to §3.1. | §9 item 5 asked that this threshold *"be a stated product decision, not an implementation accident"*, and it became one: **PR #201** shipped a bare `score >= 3` against `multiplier >= 1` with **no deadband**, so a score `3` with a multiplier of `0.98` — a 2% margin — rendered `Worth re-cutting the hook and re-posting.` A near-tie producing a prescriptive command is the *"confident-looking wrong judgement"* the reliability-over-coverage preference exists to forbid. The mechanism needed deciding too, not just the number: §3.1's variants compared two **measured** readings, PR #201 substituted the **judgement** for the Tier 1 side, and nobody had reconciled the two. Reverting to Tier 1 vs Tier 2 does **not** work — `perf_baseline_median` is the median of the Tier 2 metric, not of the Tier 1 ratio, and `computeBaseline()` never reads `perf_tier1_ratio`, so "high Tier 1" has no stored reference and would need a schema change; and it would leave the `2` beside `3.2× their usual` row unexplained, which **§7/OR-6 calls non-compliant**. So the judgement stays in the comparison and the *judgement-vs-measured* objection is answered in the copy, which now names which figure to quote. *(Ticket [#147](https://github.com/jordanjordann/my-content/issues/147) step 5.4; PR [#201](https://github.com/jordanjordann/my-content/pull/201); review [comment](https://github.com/jordanjordann/my-content/pull/201#issuecomment-5261667478), "Score-threshold recommendation".)* |

| **B6** | 2026-08-13 | **§4.5's popover footer becomes two variants, and §4.5.1 specifies them.** The shipped sentence is **unchanged as `F1`** and stays the default on every row. A second variant **`F2`** renders **only** in the cold-start state (Tier 2 present, multiplier `null`) and is `F1` plus one clause: *"— except the count of carousels analysed so far, which is read from your library as it stands now."* The §4.5 bullet is marked superseded and preserved verbatim. **The frozen promise is not hedged**: it stays unqualified for every measurement and every judgement, and the exception names exactly one figure. §5 row 5's L2, the cold-start **cell** copy (`builds as you analyse more`), and the `≈`/staleness copy are **unchanged**. | **Owner ruling 2026-08-13 (#206), recorded in `TDD` §14.8 / §14.8a:** the Tier 2 cold-start progress count is a **live** figure, because *"a frozen progress indicator is not conservative, it is false about the present"*. That makes the unconditional footer **false on exactly the rows that show the counter**, while it remains true and load-bearing everywhere else. The copy-side fix of admitting a frozen count was ruled unavailable (it contradicts R-14.2.5 and R-C4), and weakening the sentence globally would trade a one-figure inaccuracy for the trust that makes the measurements quotable. `F2` carries no numeral (R-13.3.4, R-13.1.2), no hour count and no settling window (**R-13.4.4**), and its format noun keeps the threshold bucket-scoped (**R-C1 / R-C3**). **No stored value, colour value, component, layout, density or interaction changes.** *(Issue [#209](https://github.com/jordanjordann/my-content/issues/209); `TDD` §14.8a, PR #208.)* |

| **B7** | 2026-08-13 | **New §4.6 — copy for two column-level tooltips, one on `Eng. / reach` and one on `Eng. / followers`**, each giving the operand stack (`Likes + comments` over an em-rule over the denominator), what the percentage answers in words, and a matched closing sentence naming the *other* column's denominator. **T2 additionally explains the `≈`** — the cached follower count, in the same `up to a week old` terms §4.3 already uses. The affordance, its placement and its accessible name are specified in the companion's new **§4.2**; this section is the home for the strings only. | **Direct owner request, 2026-08-13:** *"please make a tooltip to explain the formula of eng/reach and eng/followers."* The two columns are structurally separated (companion §4, Direction A) but nothing ever explained what each is divided by, so the reader could see that they differ without being able to say how. **No numeral appears in either string** — they are attached to a column, not a row, so no computed block licenses a figure, and **R-13.3.4**'s ban on a worked division is honoured by following #147's operand-list-plus-em-rule precedent rather than performing the calculation. Both are **L2 only**: the denominator is already on every cell at L1 in the qualifier, so **R-13.6.2** is not engaged — nothing required to prevent a misread moves behind a hover. **No copy string outside §4.6 changes**, and no colour, component, width or density changes. *(Owner request, 2026-08-13 session.)* |

| **B9** | 2026-08-13 | **PROPOSED — awaiting owner sign-off; nothing in it may be built until the owner approves it.** **New §4.7 — the comment count that has no number, and the Counts column tooltip.** (a) **`HIDDEN` is ruled unreachable for a comment count**, verified in code rather than assumed (§4.7.1): both comment resolvers are bare `resolveFromCount`, which emits only `AVAILABLE`/`ZERO`/`UNKNOWN`; the state is re-derived at read time so it cannot be inherited from an old row; and nothing in `lib/` reads `comments_disabled`. **So no comments `hidden` copy is written** — the §5.5 / `INSUFFICIENT_HISTORY` discipline applied to a new state. (b) The invented string **`Why is the comment count hidden?`** is **withdrawn and preserved verbatim**, and **`ENGAGEMENT_HIDDEN_TOOLTIP_COPY` is ruled scoped to `like_and_view_counts_disabled`** — approved, unchanged, and never to be rendered for comments. (c) The reachable state is `unknown`, and it renders **no new string**: the shipped `—` plus its generated accessible name **`comments unknown`** (`S-C1`), the only new word being the metric noun `comments`. (d) The explanation the state was missing becomes **one column-header tooltip, `T3`**, in two density variants, with the trigger name `What do the counts in this column mean?`. Affordance is the companion's new **§4.3**. | **PR [#210](https://github.com/jordanjordann/my-content/pull/210) review, note N1.** A developer needed a label for a comment count with no number, found none, and wrote one — inventing user-facing copy, which is a hard stop here. The invented string was also wired to the views/likes sentence, so the app would have answered *"why is there no comment number?"* with *"the creator turned off view and like counts"*. That pairing is the **R-13.5.3a** failure in its purest form, and the fix is **not** a comments-shaped rewrite of it: the state it describes cannot occur, and copy for an undemonstrable state publishes a meaning we cannot stand behind. What the reader actually lacks is an explanation of the `—`, which is a property of the **column** — so it goes in the header, adding **zero** glyphs per row and honouring the **#147 one-`ⓘ`-per-row ruling** on the merits (companion §4.3). **R-13.3.4 checked: no division is performed or shown** — the Counts column divides nothing. **No stored value, no enum, no colour value, no component, no column, no width, no density, no sort or filter behaviour changes**, and no approved string is edited. *(PR #210 review note N1; owner request, 2026-08-13 session.)* |
| **B8** | 2026-08-13 | **§5 gains rows 8 and 9, and new §5.5 rules the three states that render a bare `—`.** **Row 8** — the judgement returned no 1–5 over an intact computed block: L1 **`No 1–5 for this post`**, L2 naming the measurements as unaffected and refusing to guess at a cause. **Row 9** — no performance block exists at all: L1 **`Performance wasn't measured`**, L2 naming both possible histories and saying we cannot tell which. **`INSUFFICIENT_HISTORY` deliberately gets no copy** and keeps the `—`. §5.5 also fixes the affordance: row 8 keeps the row's single `ⓘ` with a heading/intro swap inside the popover, row 9 carries none. The `All eight` count is corrected to **`All ten`**. **Rows 1–7 and 3b are untouched and row numbering is unchanged.** | **Direct owner request, 2026-08-13:** *"Also a little explanation about why the performance score is '-' rather than just '-'."* This is the copy PR #198's round-3 review **deliberately deferred** — it ruled the muted `—` correct *"because no approved copy exists for those states and inventing one is worse"*, and forbade a developer from writing it. **R-13.5.3a decides the shape**: the three states are three different facts (the model declined to score; nothing was ever measured; a state no user can reach), so they cannot share a sentence. Row 8's `null` score is documented in the response contract as *"an expected state … not a parse failure"*, and the owner's Aug 12 reel carries a confident quantified verdict beside it — so *"the model didn't reach a judgement"* is true there and *"there's no data"* is false. Row 8's refusal to name a cause is the **`CAUSE_NOT_DETERMINABLE`** discipline applied to a new state, and its `We can't tell` clause carries the same protection as string 3's (R-13.5.3b). `INSUFFICIENT_HISTORY` gets no sentence because it is **never produced**: copy for it would publish a meaning the system cannot demonstrate, and its most natural wording is either the cold-start state's job or the un-nouned creator-level framing **R-C1** forbids. **No stored enum value, colour value, component, layout, density or interaction changes**, and `AC-30`'s four cases and negative assertion are untouched. *(Owner request, 2026-08-13 session; PR #198 review round 3.)* |

| **B10** | 2026-08-14 | **New §5.5.1 — the row-8 `ⓘ` trigger's accessible name, and a complete table of the name for every state the trigger can render in.** One new string, **`S-P8`** — **`Why is there no 1–5 for this post?`** — rendering on **row 8 only**. **Every row that renders a 1–5 keeps `How was this score worked out?` byte for byte**, and the two are selected by the **same single condition** that already selects the heading and the intro, so they cannot drift apart. **There is no third name because there is no third trigger**: every other Performance-cell state carries no `ⓘ` (rows 1–7 and 3b render their sentence with no affordance, `INSUFFICIENT_HISTORY` renders the bare `—`, and row 9 carries none by §5.5's own ruling). **No stored value, no enum, no colour value, no component, no column, no width, no density, no sort or filter behaviour changes, no second affordance, and no existing approved string is edited.** | **PR [#228](https://github.com/jordanjordann/my-content/pull/228) review, note N1 (ticket [#219](https://github.com/jordanjordann/my-content/issues/219)).** §5.5 swapped row 8's popover **heading** and **intro**, giving as its reason that the judgement intro *"asserts a score that is not there"* — and then said nothing about the **trigger**, which still announces **`How was this score worked out?`** on a row with no score. Verified in code, not assumed: `SCORE_EXPLAIN_TRIGGER_LABEL` is one constant applied unconditionally as the button's `aria-label`, with no row-8 variant. **It is the same fault, one element earlier and strictly worse placed** — a screen-reader user meets the *name* before the heading, so the first thing the surface says about the row is false, and the heading then contradicts it. **`DESIGN-3C` R-D8** requires the name to be *"the question the tooltip answers"*, and on row 8 it is a question about a different row. **The wording is the interrogative of the two strings already approved for this exact state** — cell `No 1–5 for this post`, trigger `Why is there no 1–5 for this post?`, heading `Why there's no 1–5 here` — reusing the cell's noun phrase verbatim so the name a screen-reader user hears is the line a sighted user is looking at. It asserts no score: no `this score`, no definite reference to a number that is not there, only the **scale**, which exists regardless. Characters checked against the file: **en dash U+2013** in `1–5`, matching the corpus; no apostrophe, so none to mismatch. **R-13.3.4 and R-13.5.3a checked and not engaged.** *(PR #228 review note N1.)* |

**B1 reopens no settled decision.** It is a copy correction consequent on rules ruled on *after* this document was written, and it brings this document into line with wording already merged in the companion spec's §5.3. No colour value, component, layout, density or interaction changes.

---

## 1. The design problem, restated

§13 says every score must answer five questions on the surface it appears on. The temptation is to answer them with five UI elements. R-13.1.1 explicitly says not to: it is a **completeness requirement on the information available**, not a prescription for widgets.

So the design is built on **three disclosure levels**, and each of the five questions is assigned to the shallowest level that can honestly carry it:

| Level | Where | What it carries | Interaction |
|---|---|---|---|
| **L1 — Always on** | Second line of the relevant table cell, and the equivalent line in the detail view | Metric identity, denominator, tier, confidence, sample size, provisional state, absent reason | **None. No hover, no click.** This is the level R-13.6.2 and R-8.4.7 constrain. |
| **L2 — One affordance per row** | The `ⓘ` in the Performance cell, opening a popover | The operands, the tier explanation, the confidence reason, the as-of date | Hover **or** keyboard focus. Reuses the shipped #70 tooltip pattern. |
| **L3 — Detail view** | A `How this was measured` panel in the analysis detail modal | Everything in L2 plus the bucket identity, the follower-count staleness, and Gemini's `drivers[]` as the reasoning behind the verdict | Already open |

**Nothing that prevents a misread lives above L1.** Everything at L2 and L3 deepens understanding; nothing there is load-bearing for correctness. That split is what makes R-13.6.2 auditable: if a string is required to stop a misread, it is at L1, full stop.

**Question 5 — "can I compare this to that?" — is answered structurally, not textually.** The strongest answer to "can I compare these two numbers?" is a layout in which the two numbers were never adjacent under a shared header in the first place (companion spec §4). Copy is the backup, not the mechanism.

---

## 2. Copy principles

Binding on every string in this document (R-13.1.3):

1. **No field names, no enum identifiers, no error codes, no `snake_case`.** A user never reads `UNAVAILABLE`, `REACH_HIDDEN`, `CONTENT_KIND_UNSUPPORTED`, `basedOnVideos` or `tierUsed`. Those stay English and machine-stable underneath (PRD §5.4); what renders is a sentence.
2. **No explanation restates the number** (R-13.1.2). `Performance score: 4 (good)` is banned. Every explanation names an operand or a comparison.
3. **State the observation, not a diagnosis, when we cannot evidence the cause** (R-13.5.3). This produces slightly longer, slightly more awkward copy in one case. That is the correct trade and it must not be "tidied up" later.
4. **Never imply precision we do not have.** The follower count is up to a week stale; the maturity floor is a guess; the score is a model judgement. Each of those has a specific copy consequence below.
5. **Second person, present tense, no jargon.** The reader is an agency strategist in a client meeting, not an engineer.

---

## 3. Question 1 — which metric is this, and why this one? (§13.2)

### 3.1 L1 — the tier phrase (always visible, in the Performance cell)

| Stored `tierUsed` | L1 phrase | Notes |
|---|---|---|
| `CREATOR_BASELINE` (Tier 2) | **`vs their usual`** | The headline when it exists. |
| `REACH_ONLY` (Tier 1, reach-denominated) | **`of who saw it`** | |
| `REACH_ONLY` (Tier 1, follower-denominated — image posts, §12.2) | **`vs follower count`** | A *different* phrase from the above even though the stored enum is the same. The enum is not the thing the user needs to know; the denominator is. |
| `AUDIENCE_FALLBACK` (Tier 3) | **`rough — vs audience size`** | Rendered in **muted italic**, and it is the only tier phrase that leads with a hedging word. This carries §3.5's demotion through to the user (R-13.2.4). |
| `UNAVAILABLE` | — | Replaced entirely by the absent-score reason, §5. |

**Tier 1 and Tier 2 coexisting (§3.5, the pair that matters most).** When both exist, they are **two cells, not one**: the Performance cell's tier phrase reads `vs their usual` (Tier 2 is the headline, per §3.5 and §12.4), the multiplier lives in the `vs their usual` column, and the Tier 1 ratio lives in its own engagement column. Three visually separate places, none of which claims to be the other.

The reason they must not be one cell is the product argument the PRD says it does not want lost: **high Tier 1 with low Tier 2 is a completely different recommendation from low Tier 1 with high Tier 2.** A single merged figure would destroy exactly that signal. The L2 popover names the pair explicitly:

> **Both readings, side by side.**
> `4.1% of the people who saw it engaged.`
> `It reached 3.2× this creator's usual for reels.`
> `Strong on both — the content held attention and the algorithm pushed it.`

The third line is a **template selected by the sign of each reading**, not model prose, so it is deterministic. Four variants:

| Tier 1 | Tier 2 | Sentence |
|---|---|---|
| high | high | `Strong on both — the content held attention and the algorithm pushed it.` |
| high | low | `The people who saw it engaged, but it didn't travel far. Worth re-cutting the hook and re-posting.` |
| low | high | `It travelled, but the people who saw it didn't engage much.` |
| low | low | `Weak on both readings.` |

**Open:** "high" and "low" need a threshold, and the PRD deliberately rejected universal benchmarks (§3.4). The only defensible split is **against this creator's own bucket median** — which means these sentences are only available when Tier 2 exists. Flagged in §9.

> **SUPERSEDED 2026-08-12 by amendment B5 — the block from *"The third line is a template…"* to the end of the *"Open"* note above is preserved verbatim, because it is what #147 and PR #201 were built from and deleting it would make both unreadable. It no longer describes what ships.** The four-variant table above compares **two measured readings** (Tier 1 against Tier 2); the shipped line does not, and the "Open" note is not a licence to pick a numeric split for the 1–5. **§3.1.1 below is the specification.**

#### 3.1.1 The disagreement line — mechanism, thresholds, deadband, copy *(amendment B5, 2026-08-12)*

This is the line §7 point 4 makes **REQUIRED** under OR-6. Everything a developer needs to implement it without a judgement call is in this sub-section; nothing here is deferred.

**Mechanism — it compares the 1–5 judgement against the Tier 2 multiplier.** Not Tier 1 against Tier 2. Three reasons, in order of weight:

1. **Only that comparison answers the question the line exists to answer.** OR-6 made this line mandatory as the *sole* remaining mitigation for one specific thing a user sees: a row showing `2` beside `3.2× their usual` (§7). A line that reconciles the engagement percentage with the multiplier leaves that row exactly as confusing as it was, and §7 calls such a row non-compliant. The 1–5 has to be on one side of the comparison or the line does not do its job.
2. **The Tier 1 side has no reference point, and inventing one is the failure this amendment exists to prevent.** The multiplier is already normalised against this creator's own bucket median, so `1.0` is a real, stored, creator-relative reference. The Tier 1 ratio has no equivalent anywhere in the data: `perf_baseline_median` is the median of the **Tier 2 metric** (reach on `full_video` buckets, `likes + comments` elsewhere — `denominatorForBucket()`), *not* the median of the Tier 1 ratio, and `computeBaseline()` does not read `perf_tier1_ratio` at all. So "high Tier 1" would require either a new stored per-bucket median of the engagement ratio — a schema change, out of 3B scope — or exactly the invented numeric split §9 item 5 forbids. **Option (b) does not escape the threshold problem; it relocates it to a column we do not have.**
3. **It is the more useful reading for the person the table is for.** The strategist's risk is quoting the `4` in a client meeting when the measured comparison says the post came in under this creator's usual. The line's job is to stop that, and it can only stop it by naming the 1–5.

**The judgement/measured objection is real and is answered in the copy, not in the mechanism.** The popover's own opening sentence says the 1–5 is *"not a number we measured"*, so this line must never read as *two measurements disagreeing*. The variants below therefore say which reading to quote, and the previous copy's prescriptive clause is withdrawn (see D1/D2 notes).

**The Tier 1 vs Tier 2 line is not designed and must not be built.** It is recorded here as considered and set aside — it needs a stored bucket median of the Tier 1 ratio first. Do not re-derive it from what happens to be on screen.

**Where the line renders.** It is **its own element after the operand list**, not the third line of the *"Both readings, side by side"* block quoted above. Reading order is fixed by §7 point 2: the measured figures first, then what went into them, then the reconciliation. The quoted block keeps only its two measured lines.

##### Trigger — the complete truth table

Preconditions, all required before any threshold is evaluated. If any fails, **no line renders** (never a placeholder, never an em-dash):

- the 1–5 score is present (a non-null integer 1–5), **and**
- Tier 2 exists with a **measured, non-null multiplier** — the cold-start and not-comparable states have no multiplier and therefore no line.

Then, with `s` = the 1–5 score and `m` = the multiplier:

| Condition | Renders |
|---|---|
| `s >= 4` **and** `m < 0.85` | **D1** |
| `s <= 2` **and** `m >= 1.15` | **D2** |
| anything else — including every case where `s === 3`, and every case where `0.85 <= m < 1.15` | **nothing** |

That is the whole rule. There is no third branch and no default sentence.

##### The score threshold: `1–2` is low, `3` is neither, `4–5` is high

**The scale's own midpoint is not the split, and `>= 3` is wrong.** `3` on a five-point ordinal scale is a value the rater can actually choose, and it means *middling* — it is a position, not a boundary. Reading a deliberate "middling" as "high" is precisely the misread that turns a shrug into a disagreement. Because the score is an integer, an odd-length ordinal scale gives a symmetric split with a neutral centre for free: **`4–5` high, `3` neutral, `1–2` low.** `3` is the score side's deadband, it is exact, and it needs no tolerance arithmetic.

##### The multiplier threshold and its deadband: the line never contradicts the figure on screen

The multiplier's reference point is `1.0` — the creator's own bucket median, per the "Open" note above, which was right about the denominator. What it lacked is a tolerance. The tolerance is set by **the precision the user is shown**: the multiplier renders to one decimal place (`3.2×`), so a post whose multiplier displays as `0.9×`, `1.0×` or `1.1×` is a post the row itself is telling the user is *about usual*. The explanation must not call that post's travel high or low.

- **high:** `m >= 1.15` — displays as `1.2×` or more.
- **low:** `m < 0.85` — displays as `0.8×` or less.
- **deadband:** `0.85 <= m < 1.15` — displays as `0.9×`, `1.0×` or `1.1×`. **No line.**

The asymmetric bracket is deliberate and follows round-half-up: `0.85` displays as `0.9×` and so sits inside the band; `1.15` displays as `1.2×` and so sits outside it. A ±0.15 band is also the right order of magnitude for the data underneath — a bucket median can be built from as few as `BASELINE_MIN_SAMPLE` posts (§5.3), and a median that thin moves by more than 15% on one atypical post.

**Worked check, the case that prompted this amendment:** score `3`, multiplier `0.98`. Both sides land in the deadband, so **no line renders** — instead of the prescriptive instruction the previous `>= 3` / `>= 1` split produced off a 2% margin. Mirror case, score `2` / multiplier `1.02`: multiplier in the deadband, **no line**. The canonical OR-6 row, score `2` / multiplier `3.2×`, still fires **D2**.

**Provisional rows are not suppressed.** An `Early` row still gets the line if it clears the thresholds. The `Early` badge already carries the provisionality (§6), the copy below is no longer prescriptive, and suppressing the line on exactly the young rows where the two readings diverge most visibly would reintroduce the OR-6 gap on the rows that need it most.

##### The two copy variants — corrected, and why

Both strings below are **canonical and verbatim**. §7 point 4's sentence (*"This scored lower than the reach multiplier suggests…"*) and the ticket's restatement of it are **illustrative prose, not copy**; where they differ from this table, this table wins.

| # | Condition | String |
|---|---|---|
| **D1** | score high, multiplier low | `The 1–5 reads this more favourably than the measured comparison does — it came in under this creator's usual for this kind of post. The measured figures above are the ones to quote.` |
| **D2** | score low, multiplier high | `The 1–5 reads this less favourably than the measured comparison does — it came in over this creator's usual for this kind of post. The measured figures above are the ones to quote.` |

Two corrections to the strings the four-variant table carried, both forced by the change of mechanism:

- **`it didn't travel far` / `it travelled` are withdrawn as factually wrong on half the buckets.** The multiplier is *reach* vs usual only on `full_video` buckets; on image buckets it is `likes + comments` vs usual (`denominatorForBucket()`, AC-23). "It didn't travel far" is simply untrue of a carousel whose multiplier is an engagement-count ratio. `came in under/over this creator's usual for this kind of post` is true on both denominators and matches the `vs their usual` column header the user is already reading.
- **`Worth re-cutting the hook and re-posting.` is withdrawn.** Under the old mechanism it was a defensible inference — *measured* strong engagement plus *measured* weak reach is a distribution problem, and re-posting is the response. Under this mechanism the "strong" side is a model judgement, and a prescriptive instruction to re-shoot is not supportable from a judgement plus one ratio. The line reconciles two readings; it does not issue instructions. The second sentence does the useful work instead by telling the user which figure to quote.

##### The two agreement variants are retired — recorded, not dropped

`Strong on both — the content held attention and the algorithm pushed it.` and `Weak on both readings.` are **withdrawn from this design and are not rendered anywhere.** PR #201 not implementing them was correct. Stated explicitly so nobody restores them as a "missing" case:

- They are **agreement** lines. The line exists under OR-6 to explain a *divergence*; when the two readings agree there is nothing to reconcile and a sentence saying so is the restatement R-13.1.2 bans.
- Under this mechanism *"both"* would mean the judgement and the multiplier, and `Strong on both` would assert the 1–5 as a reading of the post — flatly contradicting the popover's opening sentence.
- With the deadband, "agreement" is no longer even a clean complement of "disagreement": most rows fall in neither, and a sentence would have to be invented for the neutral zone. **The neutral zone renders nothing, on purpose.**

### 3.2 L2/L3 — why this metric (R-13.2.2, R-13.2.3)

Content-type-specific, never boilerplate. Three strings:

- **Reel / Short:** `Instagram publishes how many people played this reel, so engagement is measured against that — the most accurate read for a single post.`
- **All-image carousel / single image:** `Instagram doesn't publish reach or view data for image-only posts, so this is measured against the creator's follower count instead. That's a limit of what Instagram exposes, not a shortcut — it's also the standard way image engagement is quoted.`
- **Video-bearing carousel:** `Instagram publishes views per slide, not per post. This uses the first slide's view count as the post's reach, which is why the confidence is one level lower.`

The second string is doing the most work in this whole document, and the sentence *"That's a limit of what Instagram exposes, not a shortcut"* is deliberate — R-13.2.2 asks that the user come away understanding the constraint rather than suspecting sloppiness.

---

## 4. Question 2 & 3 — what went into it, and how much evidence (§13.3, §13.4)

### 4.1 L1 — the qualifier lines

Always visible, never hover-gated:

| Figure | L1 qualifier |
|---|---|
| Reach-denominated engagement | `of 482.1K views` / `of 116.3K plays` — **the reach kind word is mandatory and matches the stored kind** (R-4.3.1, R-13.2.5). A plays figure never reads "views". |
| Video-carousel reach | `of 88.2K views · first slide only` |
| Follower-denominated engagement | `of 284K followers`, and the value carries an `≈` prefix |
| Tier 2 multiplier | `based on 7 reels` / `based on 6 carousels` |
| Tier 2 cold start | `2 of 5 carousels` on line 1, `builds as you analyse more` on line 2 — **the format noun is part of the figure, not a decoration on it** (§5.3). Never a bare `2 of 5`, and never a creator-level count. |
| Confidence | `high confidence` / `medium confidence` / `low confidence` |

### 4.2 Sample size — and a wording conflict I need ruled on

> **RULED 2026-08-06 — OR-9. The heading's *"a wording conflict I need ruled on"* is superseded; the conflict is closed.** The heading and the reasoning below are preserved verbatim because the reasoning is still the design rationale and is unchanged by the ruling — only its *status* changed. **The bucket-aware noun is approved and the PRD amendment has landed:** `AC-28` and `R-13.4.1` both now read the pattern **`based on {N} {noun}`**, each carrying an inline `[AMENDED 2026-08-06 — owner ruling OR-9]` note, and `TDD` §14.3 lists the amendment as applied. **The literal string `videos` is not binding and does not win in CI.** The noun set (`reels` / `carousels` / `Shorts` / `videos` / `posts`) and its derivation at render time are settled in `TDD` §6 — `bucketNoun(bucketKey)`, no extra column. Recorded as superseded rather than rewritten, per the `DESIGN-3C` §12 precedent. *(Issue #170.)*

R-13.4.1 and AC-28 require the sample size *"in the form `based on N videos`"*, reusing the style-fingerprint precedent.

**On an all-image-carousel bucket that string is factually false.** There are no videos in it. Rendering `based on 5 videos` under a figure computed entirely from image carousels reintroduces exactly the class of error that `PLAYS`-labelled-as-`Views` is treated as a bug for.

**I propose a bucket-aware noun** — `based on 7 reels`, `based on 6 carousels`, `based on 5 Shorts` — with `based on N posts` as the generic fallback. This keeps the *pattern* the precedent established (`based on N …`, same position, same register) while telling the truth. **It does require AC-28's assertion to be relaxed from the literal string `videos` to the pattern `based on {N} {noun}`.** That is a PM/owner call, not mine to make — flagged in §9.

### 4.3 Confidence, with its reason (R-13.4.2)

The word alone is at L1. **The reason it was lowered is at L2**, and all three known reasons are expressible:

| Cause | L2 string |
|---|---|
| Cached follower denominator (R-12.2.5, capped MEDIUM) | `Medium confidence — measured against a follower count that may be up to a week old.` |
| Carousel first-slide reach (D4, −1 level) | `Medium confidence — the post's reach is taken from the first slide, not the whole post.` |
| Thin sample | `Low confidence — based on only 5 earlier carousels. Treat the comparison as directional.` — the noun is the **bucket** noun of §4.2 (`reels` / `carousels` / `Shorts`), for the same reason as §5.3: a count of posts in a bucket-scoped sentence must never read as a count of the creator's posts (**R-C3**). |

**Design note, flagged as a concern rather than solved:** `confidence` and `tierUsed` encode overlapping information — Tier 3 is never high-confidence, a follower denominator is capped at medium. A user seeing both a tier phrase *and* a confidence word may read them as two independent judgements when they are largely one. I have kept both because the PRD requires both, but I would support collapsing confidence into the tier phrase at L1 and keeping the word only at L2. See §9.

### 4.4 Operands (R-13.3.1) — L2 and L3

Not a formula the user has to evaluate. The operands themselves, laid out:

```
What went into this
  Likes                31,412
  Comments              1,204
  Measured against    482,100  views
  ─────────────────────────────────────
  Engagement             6.8%  of views

  This creator's usual   151K  views  (median of 7 reels)
  This post                    3.2×  their usual
```

- **R-13.3.4 — every numeral in an explanation must exist in the stored computed block.** The layout above contains only stored operands and stored results. **It does not contain a worked division**, deliberately: showing `31,412 + 1,204 ÷ 482,100 = 6.8%` would put an intermediate numeral on screen that is not in the computed block. The em-rule is the only thing implying the operation.
- **Two constants break R-13.3.4 as literally written** — the `5` in `2 of 5 carousels` (a config threshold) and the `week` in "up to a week old" (a TTL). Neither is in the computed block. Flagged in §9; the practical fix is that the computed block stores them, which is cheap. **The `5` is on the R-13.3.4 allow-list per R-14.2.7 and is read from config, never hard-coded into copy and never stored per row (R-C2).**

  > **Superseded 2026-08-09 — both constants are resolved, and by two different routes. Keep them distinct.** The bullet above is preserved verbatim because it was accurate when written; the sentence *"the practical fix is that the computed block stores them"* is now **wrong** — per-row storage was **explicitly considered and rejected** (OR-10). There is no longer any constant that "breaks R-13.3.4 as literally written":
  >
  > - **The `5` in `2 of 5 carousels`** is `BASELINE_MIN_SAMPLE`, the Tier 2 per-bucket threshold. Resolved via **R-14.2.7 / R-C2** — on the allow-list, read from config for display, never stored per row, never hard-coded into copy.
  > - **The `week` in "up to a week old"** is the **profile cache TTL**, a *separate* constant with a *separate* resolution path. Resolved via **R-13.3.4 / AC-27 / OR-10**, which names it on the allow-list in terms: *"the profile cache TTL (the `week` in the staleness copy)"*. There is no R-14.2.7 equivalent for it and it does not need one.
  >
  > **These are two different numbers and must not be conflated** — a previous session lost real time to exactly that ("inherits the minimum of 5" when it was the other `5`).
  >
  > **The exemption is an explicit allow-list, not a loosened match.** AC-27's amendment is express: *"The extractor must implement the allow-list explicitly, not by loosening the match."* Neither constant is stored per row. **AC-27 will not fail on the `week`**, so nothing here is a reason to relax a numeral guard that was never broken. The staleness copy itself (`up to a week old`, the `≈` prefix, the §4.5 L2 footer) is unchanged. *(Issue #171; `TDD` §0.3 OR-10, §14.4.)*

### 4.5 Staleness and as-of framing (R-13.3.2, R-13.4.5)

The most common wrong conclusion this product can produce is **"this number is current."** It is not — everything is frozen at analysis time (D8).

- **L1:** the `≈` prefix on every follower-denominated figure. It is the only always-on staleness signal, and it is truthful rather than decorative.
- **L2:** `Follower count: 284,100, from a profile record cached 3 days ago. It may have changed since.`
- **L2 footer, on every popover, every time:** `Measured 12 Jul 2026. These numbers are frozen at the time of analysis and don't update.`

That footer is unconditional. It is repetitive and I want it that way — it is the single sentence that prevents the most likely wrong client statement.

> **SUPERSEDED 2026-08-13 by amendment B6 — the footer is still on every popover every time, but it is now *two* variants and the bullet above states only one of them.** The bullet is preserved verbatim because its reasoning is unchanged and because the default variant is still exactly the string it quotes. What changed underneath is not a design preference: **the cold-start progress count became a live figure** (owner ruling 2026-08-13, `TDD` §14.8 / §14.8a), so on a cold-start row the sentence above asserts freezing of a number that genuinely updates. **§4.5.1 below is the specification.**

#### 4.5.1 The two footer variants — the frozen promise, and the one figure it does not cover *(amendment B6, 2026-08-13)*

**What forced this.** `TDD` §14.8a narrows D8: a number that has a stored sentence conditioned on it is **frozen**; a number that is only a progress indicator toward a computation that has not happened yet is **live**. The Tier 2 cold-start progress count (`tier2.sampleSize` while `tier2.multiplier` is `null`) is **live**, deliberately. Every other number this popover can show — reach, likes, comments, the Tier 1 percentage, the median, the sample size behind a *measured* multiplier, the multiplier, the 1–5, the verdict, the confidence, the follower count — is **frozen** and stays so.

**The promise is not weakened; it is given a named exception.** The frozen sentence stays unhedged. There is no *"mostly frozen"*, no *"may change"*, no *"these numbers can update"*. A carve-out that names exactly one figure is a stronger statement than the original, not a softer one: it tells the reader precisely where the boundary is, and it leaves everything they would quote in a client meeting inside the guarantee.

| # | Renders when | String |
|---|---|---|
| **F1** | **Default — every popover on every row that is not in the cold-start state.** | `Measured 12 Jul 2026. These numbers are frozen at the time of analysis and don't update.` |
| **F2** | The row's `vs their usual` state is **cold start** — Tier 2 exists and its multiplier is `null` (companion §5.3; the same condition, from the same source, that renders `2 of 5 carousels` in the cell) | `Measured 12 Jul 2026. These numbers are frozen at the time of analysis and don't update — except the count of carousels analysed so far, which is read from your library as it stands now.` |

**Binding rules on F2:**

- **F1 and F2 are mutually exclusive and one of them always renders.** Never both, never neither. The footer's position, styling and separator rule are unchanged.
- **F2 is F1 plus one clause.** The first sentence and the whole of the second up to the em-dash are byte-identical to F1. If F1 is ever re-worded, F2 inherits the wording — they are one sentence with one optional tail, not two independently edited strings.
- **The format noun in F2 is the same bucket noun the cell renders** (`carousels` / `reels` / `Shorts` / `videos` / `posts`, R-13.4.1 / OR-9), read from the same `tier2` bucket key. A footer that says `carousels` above a cell that says `reels` is a bug. **R-C1** applies to F2 as to every other cold-start string: the count never appears creator-scoped, and the literal `5 posts` and its paraphrases must not appear.
- **F2 contains no numeral.** It names the count without stating it — the figure itself is in the cell and, per §5 row 5's L2, in the popover's cold-start sentence. R-13.3.4 is satisfied trivially, and R-13.1.2 (*no explanation restates the number*) is satisfied deliberately.
- **F2 states no duration.** No hours, no days, no cadence for how often the count is re-read (**R-13.4.4**). *"read from your library as it stands now"* is the whole of the claim, and it is exactly what the read path does.
- **§5 row 5's L2 sentence is unchanged** (`@dapurbunda has 2 of 5 carousels analysed so far. The comparison appears on its own once the fifth is in.`). F2 is the only place the *liveness* of that count is stated; the cold-start **cell** copy (`builds as you analyse more`) is untouched and stays out of scope, per #209.
- **A `MEASURED` row's `based on 7 reels` is frozen and F1 covers it.** The sample size behind a computed multiplier is an operand of a stored judgement (`TDD` §14.8a) and must never be routed to F2. The trigger is the multiplier being `null`, not the presence of a sample size.
- **Deferred, deliberately, and not designed here:** whether to surface that a better baseline now exists for a `MEASURED` row (#209's second half). It waits on OR-25 and nothing in this sub-section anticipates it.

### 4.6 The two engagement-column tooltips — what each percentage is divided by *(amendment B7, 2026-08-13)*

**Direct owner request, 2026-08-13:** *"please make a tooltip to explain the formula of eng/reach and eng/followers."* The reader can see two percentages in two columns and has no surface anywhere that says what each one is divided by, or why the two are not comparable. The companion spec's structural separation (§4, Direction A) stops them being *merged*; it does not explain them.

**These are L2, and they are allowed to be.** Nothing here is load-bearing for correctness: the denominator is already on every cell at L1, in the qualifier (`of 482.1K views`, `of 284K followers`), with no hover, and that is what R-13.6.2 protects. The tooltip deepens; it does not carry. If either of these tooltips were the only place the denominator appeared, the design would be non-compliant — see the companion's §4.2, which is where the *affordance* lives.

**No numeral appears in either tooltip.** They are attached to the column, not to a row, so there is no row whose computed block could license a figure. This is the strictest possible reading of **R-13.3.4** and it costs nothing: the shape of the calculation is the whole of what the user is missing. **No worked division, no quotient, no example numbers** — the operand stack below follows #147's precedent exactly (an operand list, an em-rule implying the operation, no computed result).

#### T1 — the `Eng. / reach` column

> **Engagement against reach**
>
> ```
> Likes + comments
> ─────────────────────────────
> Views or plays on this post
> ```
>
> `How many of the people who saw this post engaged with it. Both figures are counts Instagram published, not estimates — which is why no figure in this column carries an ≈. Where a carousel's reach is taken from its first slide, the cell says so.`
>
> `Not comparable with Eng. / followers: that column divides by the creator's follower count, not by this post's reach.`

#### T2 — the `Eng. / followers` column

> **Engagement against followers**
>
> ```
> Likes + comments
> ─────────────────────────────
> The creator's follower count
> ```
>
> `How much this post got relative to the size of the creator's audience. The follower count comes from a cached profile record that can be up to a week old, which is why every figure in this column carries an ≈.`
>
> `Not comparable with Eng. / reach: that column divides by the views or plays on the post itself, not by follower count.`

**Why the `≈` explanation lives in T2 and only in T2.** The `≈` prefix is the design's one always-on staleness signal (§4.5) and it is the one typographic difference between the two columns that is *truthful rather than invented* (companion §4, distinguisher 2). Until now nothing told the user what it meant — the explanation existed only in the row popover's follower-count line, which a user reading the column never opens. T2 is the natural home: it is attached to the column that carries the prefix, on every row, once. T1 states the mirror fact in the same breath, so a reader who opens either one learns why the two look different. **The `week` is the profile cache TTL and is on the R-13.3.4 allow-list by OR-10** — it is the same word the §4.3 confidence string already uses, deliberately, so the two agree.

**T1's third sentence exists because `not estimates` would otherwise overclaim.** A video-bearing carousel's reach is derived from its first slide (D4, companion R-D3), and the cell already says `· first slide only`. The tooltip names that rather than leaving a blanket claim the reader can find a counter-example to on screen. The clause points at the cell; it does not restate the caveat, and it introduces no figure.

**Copy rules binding on both:**

- **The two closing sentences are a matched pair and must stay matched.** Each names the *other* column and states that column's denominator. Editing one without the other produces a table where the two explanations disagree about what the other one measures.
- **`views or plays`, never `views` alone.** The reach kind word is mandatory and matches the stored kind (R-4.3.1, R-13.2.5). A column-level string cannot know which kind a given row carries, so it names both — it must never resolve the ambiguity by picking one.
- **Neither string states a threshold, an hour count or a settling window** (R-13.4.4), and neither mentions the 1–5, the multiplier or the tier — those are the row popover's subject, not the column's.
- **Neither string may be reworded into a percentage claim about a typical post.** No benchmark, no "good is around…" — §3.4 rejected universal benchmarks and this is the surface most likely to smuggle one back in.

---

### 4.7 The Counts column tooltip, and the comment count that has no number *(amendment B9, 2026-08-13 — PROPOSED, awaiting owner sign-off)*

**Why this section exists.** On PR [#210](https://github.com/jordanjordann/my-content/pull/210) a developer wiring the real comment count into the Counts cell needed a label for the case where that count has no number, found no approved copy, and wrote one: **`Why is the comment count hidden?`**. Review caught it and it is being deleted. **That string is withdrawn here, preserved verbatim below, and must not be restored** — not because the wording is poor, but because **the state it names cannot occur**, and the neighbouring approved string it was paired with is about a different setting entirely.

#### 4.7.1 Which comment-count states are reachable — verified in code, not assumed

I checked this rather than taking the brief's word for it. At the commit this amendment is written against (`f0ac16f`):

| Claim | Evidence |
|---|---|
| A comment count is resolved by `resolveInstagramCommentAvailability` / `resolveYoutubeCommentAvailability`, and **both are bare calls to `resolveFromCount`** | `lib/server/analysis/performance/availability.ts:78-80`, `:109-111` |
| `resolveFromCount` can return **only** `UNKNOWN` (non-finite, absent, or negative), `ZERO` (`0`) or `AVAILABLE` (`> 0`) | same file, `:40-56` — the module contains exactly one `state: "HIDDEN"` return, at `:71`, inside `resolveInstagramLikeAvailability`'s `like_and_view_counts_disabled === true` branch, which no comment path reaches |
| The state is **not stored** and cannot be inherited from an older row | `lib/server/analysis/performance/readModel.ts:124-137` re-derives `likes`/`comments` through the *same* resolvers at read time; the DB row carries `commentCount: number \| null` only |
| Nothing reads a comments-off signal from the payload | `grep -rn "comments_disabled" lib/` returns **nothing**. The field exists in the raw Instagram payload (`comments_disabled`, `commenting_disabled_for_viewer` — present in 6 of the 8 committed fixtures) and **no resolver, adapter or pipeline step looks at it** |
| The likes/views flag does **not** govern comments | `.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json` has `like_and_view_counts_disabled: true` **and** `edge_media_to_parent_comment.count: 1` **and** `comments_disabled: false` — on the one payload where a creator demonstrably turned counts off, the comment count came through anyway (this is V1, already recorded in `availability.ts`'s module doc and in `.claude/context/verified-facts.md`) |

**Ruling: `HIDDEN` is unreachable for a comment count, so no comments `hidden` copy is written.** Writing it would publish a meaning the system cannot demonstrate — the same reasoning **§5.5** applies to `INSUFFICIENT_HISTORY`, and the same reasoning PR #198's review applied when it forbade a developer from inventing the absent-score strings. **The only absent comment-count state that renders is `unknown`**, and it is genuinely reachable: the field is absent or non-finite (a YouTube video with comments turned off returns no `commentCountInt`), the universal negative guard fires, or the stored `comment_count` is `NULL` on an older row.

**If a comments `HIDDEN` ever appears, that is a new-evidence event, not a display problem.** The correct response is a design ticket adding a row to this section — never a fallback string (§5.2 — this document has none) and never a reuse of the likes/views sentence.

#### 4.7.2 The withdrawn string, and the approved string it must never borrow

> **WITHDRAWN — never rendered, never to be restored:** `Why is the comment count hidden?`

Two independent reasons, either of which is sufficient: it names an unreachable state (§4.7.1), and it was wired to open **`ENGAGEMENT_HIDDEN_TOOLTIP_COPY`**, which reads:

> `The creator turned off view and like counts on this post. This is a creator setting — not zero, and not missing data.`

**That string is correct, approved and unchanged — and it is scoped to one Instagram setting, not to the idea of a missing count.** It is the sentence for `like_and_view_counts_disabled === true`, which is why it names views and likes together: one flag, one fact, one sentence. **R-13.5.3a is not violated by it, and would be violated by stretching it** — asked "why is there no comment number?", it answers about views and likes, which is how the PR #210 bug surfaced. Binding: **no metric outside the two that flag governs may render it, and it must never be generalised** (its constant name invites exactly that reuse; renaming it to something flag-scoped is a developer call, not a copy change).

#### 4.7.3 The strings — with the exact condition each one renders on

**S-C1 — the comment count itself, when there is no number.** **No new string. The shipped four-state vocabulary already answers this**, and `DESIGN-3C`'s own precedent note binds me to reuse it rather than invent a second language for "the count is missing". The `—` renders with the accessible name the shipped component already generates from its metric word:

> `comments unknown`

- **Renders when:** the Counts cell's line-2 right slot has `commentCountState.kind === "unknown"` — i.e. `computed.comments.state === "UNKNOWN"` — in **Comfortable** density (line 2 does not exist in Compact).
- **The visible glyph stays the `—`**, at the shipped `unknown` treatment (the most muted of the four). Not `Hidden`, not `0`, not empty.
- **The only genuinely new word this state needs is the metric noun `comments`**, joining `views`/`likes` in the metric-word map. That is a mechanical extension, and it is the whole of the new vocabulary here.
- **`comments unknown` is not to be "improved" into a cause.** `comment count not published` and `Instagram didn't return comments` both assert something we cannot evidence — `UNKNOWN` also covers a negative sentinel and a pre-existing `NULL` row.

**S-C2 — the explanation body.** A dash with an accessible name tells a screen-reader user what it is and tells a sighted user nothing. The explanation is a property of the **column**, not of any row, so it lives in one column-header tooltip. The affordance, its placement and the one-`ⓘ`-per-row analysis are the companion's new **§4.3**; this section is the home for the string.

> **Trigger accessible name:** `What do the counts in this column mean?`

> **T3 — the `Counts` column tooltip (Comfortable density)**
>
> **What the counts show**
>
> `The top figure is the post's reach — views on a carousel or an image post, plays on a reel.`
>
> `Below it, likes on the left and comments on the right.`
>
> `A dash means we don't have that count for this post. It never means zero — a zero shows as 0.`
>
> `Where we know why a reach figure is missing, the cell says so under it.`

> **T3-compact — the same tooltip in Compact density**
>
> **What the counts show**
>
> `The figure is the post's reach — views on a carousel or an image post, plays on a reel.`
>
> `A dash means we don't have that count for this post. It never means zero — a zero shows as 0.`
>
> `Where we know why a reach figure is missing, the cell says so under it.`

- **T3 renders when:** the table is in **Comfortable** density (the cell has two lines). **T3-compact renders when:** the table is in **Compact** density, where line 2 is not rendered at all (`AnalysisCountsCell` gates it on `comfortable`) — the sentence describing a line that is not on screen is dropped, and nothing else changes. **Both render on every row-set including an empty table**, because a column tooltip is a property of the column; neither is conditional on any row's state.
- **Sentence 2 is the only difference between the two variants.** Same heading, same order, same closing sentence — a reader switching density meets the same explanation minus the part that no longer applies.

**Copy rules binding on T3:**

- **One fact per sentence (R-13.5.3a).** What the top figure is; what line 2 is; what a dash means; where a reason appears when we have one. The dash sentence's second clause (`It never means zero — a zero shows as 0`) is a *negation of a misreading*, not a second fact, and it follows the register string 1 already uses (`it isn't zero, and it isn't missing data`). It must not be merged into sentence 1.
- **No cause is asserted for the dash.** `we don't have that count` is the whole of what is true across all three routes into `UNKNOWN`. **`Instagram didn't publish it` is specifically forbidden here** — this string is column-level and cannot know the platform, and it would also assert a cause we cannot distinguish (the `CAUSE_NOT_DETERMINABLE` discipline, §5.1/§5.5).
- **`views ... plays`, never one of them alone** — the same rule §4.6 binds T1/T2 with, for the same reason: a column-level string cannot know a row's reach kind and must not resolve the ambiguity by picking one (R-4.3.1, R-13.2.5).
- **No figure, and no worked division.** **R-13.3.4 checked and honoured:** the tooltip performs no calculation and shows no quotient, because the Counts column *is* the raw evidence and divides nothing. The only numeral is the literal `0`, which is a display state being named — not a measurement, not a threshold, and not a figure about any post.
- **L2 only, and provably so (R-13.6.2).** Nothing needed to prevent a misread moves behind the hover: the `—` keeps its accessible name at L1 on every row, the reach line keeps its in-cell OR-11 reason at L1, and the `Hidden` state keeps its own shipped per-cell affordance. If a later change makes this tooltip the only place any of those appears, that change is non-compliant — the tooltip is not the licence for it.
- **It never mentions the 1–5, the tier, the multiplier or either engagement percentage.** Those are the row popover's and §4.6's subjects. A Counts tooltip that starts explaining scores is a Counts tooltip that will be reworded into a second, competing explanation of the table.
- **The closing sentence points at the cell; it does not restate the cell.** Same construction as T1's third sentence, and for the same reason — it tells the reader where to look without duplicating a string that can change independently.

---

## 5. Question 4 — why is there no score here? (§13.5)

**A blank cell is the worst outcome this feature can produce.** Every absent score renders a sentence. Never `0`, never an em-dash, never empty (R-13.5.4).

Two lines per state: an L1 **short form** that fits a 156px cell, and an L2 **full form** in the popover. The short form is never an abbreviation of the long one to the point of changing its meaning.

| # | Situation | Stored reason | **L1 (in cell)** | **L2 (popover)** |
|---|---|---|---|---|
| 1 | Creator disabled counts — flag confirmed `true` | `REACH_HIDDEN` | **`Creator hid the counts`** | `This creator turned off view and like counts on this post. That's their setting — it isn't zero, and it isn't missing data. There's nothing we can do about it.` |
| 2 | No view/play count returned; false-zero rejected | `REACH_UNKNOWN` | **`No view count published`** | `Instagram didn't return a view or play count for this post, so there's nothing to measure engagement against.` |
| 3 | **Cause not determinable (a) — nothing usable was published.** The hidden-counts flag is **absent** from the payload, **and neither** the like count **nor** the comment count is usable, and reach is not usable either — **zero** usable engagement inputs | **`CAUSE_NOT_DETERMINABLE`** — exists and is live; see the note under this table | **`No performance data published`** | `Instagram published no view, like or comment data for this post. We can't tell whether the creator turned the counts off or whether Instagram simply didn't return them — so we're not going to guess.` |
| 3b | **Cause not determinable (b) — engagement was published, but only in part.** The follower count **is** known, and **exactly one** of the like and comment counts is usable — the other is unknown or hidden — so the numerator cannot be summed (§5.4) | **`CAUSE_NOT_DETERMINABLE`** — the same stored value as row 3, deliberately different copy; see §5.4 | **`Engagement data incomplete`** | `Instagram published part of this post's engagement, but not all of it — one of the like and comment counts didn't come through. An engagement figure built from only the half we have would read as the whole, so we're not showing one. The counts that did come through are shown on the post as they were returned.` |
| 4 | No cached follower count | `NO_AUDIENCE_DATA` | **`No follower count available`** | `We don't have a recent follower count for this creator, and image posts have no reach data, so there's nothing to measure this post against yet.` |
| 5 | Tier 2 cold start (a *partial* absence — Tier 1 may still exist) | *not an unavailable reason* | **`2 of 5 carousels`** / **`builds as you analyse more`** (two lines, both always visible — §5.3) | `“vs their usual” compares this post against the same creator's own past carousels. Carousels and reels are measured in different units — views and plays — so they're counted separately and never pooled. @dapurbunda has 2 of 5 carousels analysed so far. The comparison appears on its own once the fifth is in.` |
| 6 | Caption-only analysis | `analysis_mode` | **`Caption only — video not analysed`** | `Only the caption and metadata were analysed for this post. The video itself wasn't watched, so there's no content read to go with the numbers.` |
| 7 | Analysis failed / not completed | — | **`Not analysed`** | `This analysis didn't complete, so there's nothing to score. Try re-analysing it.` |
| 8 | **The judgement returned no 1–5.** The analysis completed, the computed block is present, there is **no** unavailable reason — and the stored `performanceScore` is `null`, which the response contract documents as an expected state rather than a parse failure (§5.5) | *not an unavailable reason* — a `null` judgement over a present computed block | **`No 1–5 for this post`** | `The 1–5 is a judgement, and none was returned for this post. The measurements are unaffected and are shown as normal. We can't tell why no judgement was reached, so we're not going to guess.` |
| 9 | **No performance block exists for this analysis at all.** The analysis completed, but no performance measurement was ever recorded against it (§5.5) | *no stored block* — there is no reason field either | **`Performance wasn't measured`** | `This analysis has no performance measurements stored at all — either it was completed before performance scoring existed, or its performance step never ran. We can't tell which from here. Re-analysing the post is what produces them.` |

> **Superseded 2026-08-09 — row 3's stored reason EXISTS. It is `CAUSE_NOT_DETERMINABLE`.** Row 3's *Stored reason* cell previously read, verbatim: *"needs a new value — see §5.1"*. That text is preserved here and is superseded; the cell now names the shipped value. **The value shipped in migration `012`, which is merged**, and is live in the `perf_unavailable_reason` `CHECK` constraint (`TDD` §5.2); migration `013` carries it forward when it adds `REACH_NOT_ON_FIRST_SLIDE`. The design requirement of §5.1 — that a value distinct from `REACH_HIDDEN` exists so string 3 can be rendered — **is met in the schema**, and has been for longer than this document said. **The name `PERFORMANCE_DATA_ABSENT` proposed in §5.1 was ruled against and is superseded** (`TDD` §5.3): naming was the tech lead's call and `CAUSE_NOT_DETERMINABLE` was chosen because it names the **epistemic** state — *we cannot tell why* — rather than the data state, which is precisely the distinction the value exists to hold. **Do not re-propose `PERFORMANCE_DATA_ABSENT`.** No copy string in this table changes: L1 stays `No performance data published` and L2 keeps its `We can't tell` clause, which R-13.5.3b protects. *(Issue #169 step 4; PR #179.)*

**All ten are distinct strings.** AC-30 tests four of them (1, 3, 5-as-history, 4) for distinctness plus a negative assertion on case 3.

> **Corrected 2026-08-13 by amendment B8 — the count reads *ten*, not *eight*.** Rows **8** and **9** were appended, not interleaved, on the same discipline as row 3b: **rows 1–7 and 3b are unchanged and every existing *"string 3"* / *"case 3"* / *"row 4"* / *"the seven items"* reference still points at the row it always did.** The count under this table has now been corrected twice (seven → eight at B4, eight → ten here); it is a count of *this table*, not of the `UnavailableReason` enum, which is unchanged by both amendments. **AC-30's four cases and its negative assertion are untouched.**

**Row numbering is unchanged.** Row 3b was inserted with a suffixed number rather than by renumbering, so every existing reference to *"string 3"*, *"case 3"*, *"row 4"* and *"the seven items"* elsewhere in this document, in `DESIGN-3C`, in the PRD and in the acceptance criteria still points at the same row it always did. Rows 3 and 3b are two rows because they are two facts; they are numbered as a pair because they are one stored value.

### 5.1 Case 3 is the one §13.5.3 was written for, and it needs a new stored value

R-13.5.3a requires a **stored reason distinct from `REACH_HIDDEN`** for "cause not determinable". Two different facts cannot share one enum value or the UI is structurally unable to tell the truth.

- **Proposed name: `PERFORMANCE_DATA_ABSENT`.** Naming is the tech lead's call; **that a distinct value exists is a design requirement**, because without it string 3 cannot be rendered and the app will say string 1 — asserting a cause it cannot evidence.

  > **Superseded 2026-08-09 — the name was ruled against, and the value now exists.** The bullet above is preserved verbatim because its *requirement* still stands and is what produced the value; only the proposed name and the "does not exist yet" premise of this section's heading are superseded. **The stored reason is `CAUSE_NOT_DETERMINABLE`**, not `PERFORMANCE_DATA_ABSENT`. The tech lead ruled on the name (`TDD` §5.3) — it names the **epistemic** state rather than the data state, which is the distinction the value exists to hold — and it **shipped in migration `012`, merged**, live in the `perf_unavailable_reason` `CHECK` constraint (`TDD` §5.2) and carried into `013`. So the heading's *"it needs a new stored value"* is **answered, not outstanding**: the distinct value this design required is in the schema. **`PERFORMANCE_DATA_ABSENT` is a dead name — do not re-propose it, and do not write it into code, tests or copy.** Nothing else in this section changes; in particular the `We can't tell` clause of string 3 stands, and R-13.5.3c's retirement condition is untouched. *(Issue #169 step 4; PR #179.)*
- **The copy deliberately says `We can't tell`.** It is longer and less tidy than `Creator hid the counts`. R-13.5.3b is explicit that a tidier UI string is not a reason to assert a fact we do not have, and I expect this to come under editing pressure later. It should not be edited.
- If V1 later shows the flag *is* reliably present on this payload shape, this string can be retired. Until then it stands (R-13.5.3c).

### 5.2 The three-way distinction R-13.5.2 requires

The user acts differently in each, and the copy makes that explicit in its **last clause**:

- **Nothing we can do** → string 1: `There's nothing we can do about it.`
- **It will resolve itself** → string 5: `builds as you analyse more`, with visible **bucket-scoped** progress, `2 of 5 carousels`, and `The comparison appears on its own once the fifth is in.` in the popover.
- **A permanent property of the platform** → string 2 / the image-post explanation in §3.2.

Collapsing these into one "Unavailable" is a failure of R-13.5.2, and it is the thing most likely to happen if a developer needs a fallback branch. **There is no fallback string.** If a new reason appears, it gets its own sentence.

### 5.3 Cold start is counted per format bucket — the rules that bind string 5

**This supersedes the bare `3 of 5` this document previously carried in §4.1, §4.4, §5 row 5, §5.2 and §9.** The wording above is the same wording merged in the companion spec's §5.3; the two documents now say one thing, and **this document is where it is changed.**

The rule underneath the copy: **the Tier 2 minimum of 5 is counted per format bucket, never per creator.** Reels are measured in plays and carousels in views, and **R-4.3.2 forbids a ratio across two reach kinds**, so the pools never combine. The case that decides the copy: **a creator with 4 reels and 4 carousels has 8 analysed posts and still gets no comparison on either** — neither pool has reached 5. A bare `3 of 5` in front of that user is not merely terse; it is a false statement about what they are waiting for, and it is the string that makes a correctly-working feature read as broken.

**So the requirement is not "add a noun". It is that the figure and its format noun are one atom and must never be separated** — a `2 of 5` that can be rendered without `carousels` is a bug waiting for a narrow column.

- **R-C1** No cold-start string, at L1, L2 or L3, at any density, in any popover, empty state, filter label, sink label or tooltip, may frame the threshold at creator level. **The literal string `5 posts` must not appear**, nor any paraphrase (`5 analysed posts`, `five posts`, `needs 5 more posts`). Every occurrence of the threshold carries its format noun. This is directly assertable by string search (**PRD S9 / AC-33**) and should be.
- **R-C2** The `5` is a configuration constant on the R-13.3.4 allow-list (**R-14.2.7**), read from config for display, never stored per row and never hard-coded into copy.
- **R-C3** The count is **that bucket's** count, never the creator's total analysed posts. A creator-level count inside a bucket-scoped sentence is the same failure as the bare `3 of 5`, one layer down.
- **R-C4** This is a **partial** absence. A cold-start row may still carry a Tier 1 or Tier 3 score; only the `vs their usual` figure is waiting. It is not an unavailable reason and does not suppress the Performance cell.
- **R-C5 — it is a waiting state, not an error (R-14.2.4).** No rose, no warning glyph, no `—`, no `0`, no empty cell. Both lines render as ordinary L1 qualifier text (`text-muted-foreground` at full opacity), identical to every other line-2 qualifier. **This amendment introduces no new colour value** — a waiting state that needed its own colour would be a waiting state that had been designed as an alert.
- **R-C6 — the per-format nature of the wait must be evident (R-14.2.6).** L1 carries it in the noun; L2 carries it in the mechanism sentence (*different units — views and plays*). Line 2, `builds as you analyse more`, is **at L1, not hover-gated** (R-13.6.2): "is this permanent or temporary?" is exactly the question being asked at the moment the cell is read.

### 5.4 Rows 3 and 3b — one stored value, two facts, two sentences

`CAUSE_NOT_DETERMINABLE` is reached by **two** genuinely different routes, and the copy that reads correctly on one is false on the other. The case that forced this section: a post with **32,313 likes**, an **unknown comment count** and a **10,000 follower count**. Row 3's L1 (`No performance data published`) and L2 (`Instagram published no view, like or comment data for this post`) are both flatly untrue of it — Instagram published 32,313 likes. Rendering row 3's copy there is the failure **R-13.5.3a** exists to forbid: **two different facts must not render one sentence.**

**The stored value is not in question and does not change.** `CAUSE_NOT_DETERMINABLE` is owner-ruled and final for both rows (`TDD` §5.3). What changes is that the *renderer* must not key the sentence off the enum alone.

**Deciding which row applies.** "Usable" means the availability state is `AVAILABLE` or `ZERO` (`TDD` §5.4); `UNKNOWN` and `HIDDEN` are not usable. Given a post that has resolved to `CAUSE_NOT_DETERMINABLE`, the triple *(follower count known?, `likeState`, `commentState`)* decides the row with no judgement call:

| Follower count | Like usable? | Comment usable? | Row | Why |
|---|---|---|---|---|
| known or not | **yes** | **yes** | *neither* | The numerator sums; the row does not resolve to `CAUSE_NOT_DETERMINABLE` on this path at all. |
| **known** | exactly one of the two is usable | | **3b** | Engagement was published in part. We hold a real follower count and a real count on one side, and refuse to present a half-summed numerator as if it were the whole. |
| **not known** | exactly one of the two is usable | | **4** | `NO_AUDIENCE_DATA` — the missing thing is the denominator, and row 4's copy is true. |
| known or not | **no** | **no** | **3** | Nothing usable was published. Row 3 additionally requires the hidden-counts flag to be **absent**; a confirmed `true` flag is row 1, and a confirmed `false` flag with no usable inputs is `CONTENT_KIND_UNSUPPORTED`, not this table's row 3. |

Read the middle two rows together: **the presence or absence of the follower count is the whole of the difference between row 3b and row 4.** Neither row 3b string may claim there is no follower count, and neither may claim nothing was published — both are false in this state, and each is the other row's sentence.

**Row 3b's last clause, per §5.2's three-way test.** This is not a waiting state and it is not something the user can act on: it is a gap in what the platform returned for this post. The closing sentence — *"The counts that did come through are shown on the post as they were returned"* — says what the user *can* still rely on, rather than implying either a fix or a fault. It must not be edited into a promise that the figure will appear later; it will not.

### 5.5 Rows 8 and 9 — the three states that currently render a bare `—`, and which of them get a sentence *(amendment B8, 2026-08-13)*

**Direct owner request, 2026-08-13:** *"Also a little explanation about why the performance score is '-' rather than just '-'."* This closes a gap that was **deliberately deferred, not overlooked**: PR #198's round-3 review ruled that where the reason renderer returns `null` the Performance cell falls back to the table's existing muted `—`, *because no approved copy existed for those states and inventing one is worse*. A developer was correctly forbidden from writing these strings. They are written here.

**Three distinct states reach that fallback, and they are exactly the branches the cell already has.** `derivePerformanceCell` returns `kind: "reason"` whenever the score is `null`, and its `text` is `null` when the reason renderer has no approved copy; the cell also has to cope with no derived block at all. **They are three different facts, so R-13.5.3a decides the answer before any wording does: they cannot share one sentence.** Two get their own string; the third gets none, on purpose.

| State | What is true of it | Treatment |
|---|---|---|
| **The judgement returned no 1–5** — a performance block exists, no unavailable reason is stored, and `performanceScore` is `null` | The system measured the post successfully and the model declined to score it. The response contract documents this `null` as an expected state rather than a parse failure. On the owner's Aug 12 reel the stored verdict quotes a real, quantified figure — so the model plainly had a basis and still gave no number. | **Row 8.** `No 1–5 for this post` |
| **No performance block at all** — the analysis completed, no performance measurement was ever recorded (a pre-schema-3 row, or a completed analysis whose performance step never ran) | Nothing was measured. This is the opposite fact from row 8, where everything was measured and only the judgement is missing. | **Row 9.** `Performance wasn't measured` |
| **`INSUFFICIENT_HISTORY`** — declared in the reason enum, **never produced** | It has no user-facing meaning because no user can reach it. | **No copy. The muted `—` stays.** See below. |

**Row 8 is not "there's no data", and that distinction is the whole point of it.** *"No data"* is row 9's fact, and rows 1–4's. Row 8's fact is that a judgement was not reached over data that is present and correct — which is why its L2 says the measurements are unaffected, and why the row's other cells keep rendering their figures normally. The copy then **stops: it does not name a cause.** We cannot distinguish *"the model saw a thinly-evidenced post and declined"* from *"the model simply returned nothing"*, and guessing between them is the `CAUSE_NOT_DETERMINABLE` lesson. The `We can't tell … so we're not going to guess` clause is lifted from string 3 deliberately — same fact-shape, same register, and R-13.5.3b's protection is intended to extend to it.

**Row 9 admits its own ambiguity rather than inventing a reason.** A missing block has two possible histories — a row written before performance scoring existed, or a completed analysis whose performance step never ran — and nothing readable from the row tells them apart, so the copy names both and says we cannot tell which. Its last clause satisfies §5.2's three-way test: this state **is** addressable, so it names the mechanism. It says *"Re-analysing the post is what produces them"*, not *"re-analysing will produce them"* — re-analysis writes a performance block, but whether that block carries figures depends on what Instagram publishes, and the sentence must not promise numbers we cannot guarantee.

**`INSUFFICIENT_HISTORY` gets no sentence, and that is a ruling, not an omission.**

- It is declared in the enum and is **never produced**; the owner has ruled it stays declared. Writing copy for it would publish a meaning for a state the system cannot demonstrate, and the most natural wording — *not enough earlier posts* — is either the cold-start state's job (row 5) or an un-nouned creator-level framing that **R-C1 forbids outright**.
- **R-13.5.4's "never an em-dash" governs states a user can reach.** This branch is unreachable in production; the `—` is the honest placeholder for an impossible state, exactly as PR #198's review reasoned, and it stays.
- **If it is ever produced, that is a defect, not a display problem.** The correct response is a design ticket for a new row in §5 — never a fallback string, of which this document has none (§5.2).

**Where these render, and with what affordance:**

- **Row 8** replaces the numeral and pips in the Performance cell, on line 1, styled as every other absent-score reason (`text-muted-foreground`, full opacity, no rose, no glyph). **The row keeps its single `ⓘ`** — a computed block exists, so the popover has real content: the measured figures, the operand list, `drivers[]` and the footer. Inside that popover, and **only** in this state, the heading reads **`Why there's no 1–5 here`** in place of `How this score was reached`, and the opening paragraph is **row 8's L2 string** in place of the judgement intro (*"The 1–5 is a judgement of the numbers below…"*, which asserts a score that is not there). Every other block in the popover is unchanged and renders on its existing conditions. The disagreement line (§3.1.1) cannot fire here — its first precondition is a present score — and no placeholder replaces it.
- **Row 9** renders its L1 in the Performance cell and **carries no `ⓘ`**: there is no computed block, so the popover has nothing to show and must not open. Row 9's L2 belongs to L3, in the detail view's `How this was measured` panel. This is the one row in §5 whose L2 has no L2 surface, and it is stated here so nobody adds an affordance that opens onto an empty popover.
- **Neither row is the failed-row treatment** (companion §3.3). Nothing failed; both are completed analyses. No rose edge, no `Not analysed` — that string is row 7's and stays row 7's.
- **Both sink under R-S1**, like every other row with no performance score, and both keep their own reason in their own cell inside the sink group (R-S2).

#### 5.5.1 The `ⓘ` trigger's accessible name, for every state it can render in *(amendment B10, 2026-08-14)*

**What §5.5 above missed.** Its row-8 bullet swaps the popover's **heading** and **opening paragraph**, and gives the reason in terms: the judgement intro *"asserts a score that is not there"*. It says nothing about the **trigger**. So on a row 8 the `ⓘ` still announces itself as **`How was this score worked out?`** — verified in code, not assumed: `SCORE_EXPLAIN_TRIGGER_LABEL` is a single constant applied unconditionally as the button's `aria-label`, with no row-8 variant (`AnalysisScoreExplainPopover.tsx`, at `cb4571c`, after PR [#228](https://github.com/jordanjordann/my-content/pull/228) shipped the heading/intro swap).

**That is the same fault §5.5 gave as its own reason for the swap, one element earlier.** A screen-reader user meets the trigger *before* the heading — the name is what tells them whether opening it is worth their time — so the first thing that surface says about a row 8 is that a score exists and can be explained. The heading then contradicts it. **`DESIGN-3C` R-D8** binds every trigger in this design: the accessible name is *"the **question the tooltip answers**, never a generic `info`, `help` or `more information`"*. On row 8 the current name is not that question; it is a different question, about a different row.

**No approved string existed for this.** One is written here rather than left to a developer, which is the §4.7 / B9 discipline.

| # | Renders on | Accessible name |
|---|---|---|
| — | **Every row that renders a 1–5.** Unchanged, and this is the overwhelming majority of rows. | `How was this score worked out?` |
| **S-P8** | **Row 8 only** — the judgement returned no 1–5 over an intact computed block (the state §5.5's first table row defines; `performanceCell.kind === "no-judgement"`). | **`Why is there no 1–5 for this post?`** |

**Why this wording, clause by clause:**

- **It is a question, and it is the question this popover actually answers.** R-D8's pattern, and the same shape as the corpus's other names — `How was this score worked out?`, `How is engagement against reach worked out?`, `What do the counts in this column mean?`.
- **It asserts no score.** There is no `this score`, no `the score`, no definite reference to a number that is not there. It names the **scale** (`1–5`), which exists whether or not this post has a value on it, and asks after its **absence**.
- **It is the interrogative form of the two strings already approved for this exact state**, so the three read as one voice rather than three attempts: the cell says **`No 1–5 for this post`**, the trigger asks **`Why is there no 1–5 for this post?`**, the heading answers **`Why there's no 1–5 here`**. The trigger reuses the cell's own noun phrase verbatim — *no 1–5 for this post* — which is deliberate: the name a screen-reader user hears is the line a sighted user is looking at.
- **Characters, checked against the file rather than eyeballed.** `1–5` uses an **en dash, U+2013** (`e2 80 93`), matching every `1–5` in the corpus including `SCORE_EXPLAIN_NO_JUDGEMENT_HEADING`. The heading's apostrophe in `there's` is a **straight apostrophe, U+0027** — `S-P8` contains no apostrophe, so nothing to match there, but any future edit to it must not introduce a typographic one. No ellipsis character, no non-breaking space.

**Binding rules — the scope, stated so the scored case cannot be caught by accident:**

- **`S-P8` renders on row 8 and nowhere else.** Every row that has a 1–5 keeps `How was this score worked out?`, unchanged, byte for byte. **The two names are selected by the same single condition that already selects the heading and the intro** — one flag, three strings, never two independent checks that can drift apart. If a future change makes the heading swap on a state, the name swaps with it.
- **There is no third name, because there is no third trigger.** Every other Performance-cell state renders **no `ⓘ` at all**: an absent-score reason with approved copy (§5 rows 1–7 and 3b) renders its sentence with no affordance, `INSUFFICIENT_HISTORY` renders the bare `—` with none, and **row 9 carries none by ruling** (§5.5, third bullet). So this table is complete — every state that can produce a trigger has a name, and no state without a trigger needs one.
- **Nothing else about the trigger changes.** Same element, same one-per-row placement (`DESIGN-3C` §5.1), same ticket-#70 interaction contract — hover **and** keyboard focus, `role="tooltip"` + `aria-describedby`, `Escape` / blur / outside-press dismiss, never a native `title`. **No second affordance is added and no `ⓘ` is added to any row that does not have one today.**
- **The `Sort by …` header names, the engagement-column tooltip names (R-D8), the Counts column name (`T3`) and `S-C1` are untouched.** This amendment adds exactly one string.
- **R-13.3.4 and R-13.5.3a checked and not engaged.** `S-P8` contains no numeral (`1–5` is the scale's name, as it is in `No 1–5 for this post` and in the approved heading, not a measurement read from a computed block), and it states one fact only.

---

## 6. Provisional (§4.5, R-13.4.3, R-13.4.4)

- **L1:** an `Early` badge beside the age in the Posted column — `2d ago · Early`. In the Performance cell, the tier phrase is unchanged; provisionality is a property of the post, not of the tier.
- **L2:** `This post is 2 days old and still picking up reach. The score is an early read and may change. We mark posts as early for their first few days.`

**R-13.4.4 is a copy constraint with teeth.** AC-29 asserts by string search that no UI copy claims the maturity floor is measured or validated. So:

- **No user-facing string states the number of hours.** Not `72 hours`, not `3 days`, not `after 72h`. The copy says `for their first few days` — vague on purpose, because the threshold *is* a guess (caveat C1) and a specific number would read as researched.
- **Banned phrasings, recorded so they are not reinvented:** `posts settle after 72 hours`, `the standard settling window`, `research shows`, `typically stabilises within`. None may appear in copy or in a code comment that could be lifted into copy.
- **A provisional score is never presentable as final.** The `Early` badge is not dismissible, does not fade, and is not hidden in Compact density.

---

## 7. The elephant: the 1–5 score is a judgement, not a measurement

> **STATUS — GOVERNING, as of the owner's Q4 ruling of 2026-08-07 (recorded in §10 and in `DESIGN-3C` §11 Q4; PRD **§15.1**).** The four points below are no longer *"a proposed treatment, which I want ruled on"* feeding an open question — **they are the specification for how the 1–5 renders.** The score **stays in the analyses table**, and it reads as a judgement, per these four points. The heading's framing and the words *"Proposed treatment, which I want ruled on"* are preserved verbatim below because they record why the treatment exists, but they no longer describe its status.
>
> **Point 4 is REQUIRED, not optional (OR-6).** It is the *entire* answer to the "score says 2 but the multiplier says 3.2×, which do I believe?" concern raised two paragraphs down. The only other fix ever on the table was removing the 1–5 column, and **Q4 killed that alternative.** With the column staying, there is no second mitigation left: **the deterministic *"these disagree because…"* line cannot be dropped for time, deferred to a follow-up ticket, or hover-gated away.** A row that shows `2` beside `3.2× their usual` with no line explaining the disagreement is non-compliant. **#147 builds from this paragraph.**
>
> **The "cut the score" contingency has also left ticket planning** — the PM has recorded that in **PRD §15.1**. It is not a fallback anyone should still be scoping against. Do not re-open it.

Raising this because §13 requires every score to explain itself and I do not think the 1–5 currently can.

The computed layer produces `4.1% of views` and `3.2× their usual` — both traceable to stored operands, both fully explainable by §4.4's layout. **The 1–5 `performanceScore` is produced by Gemini** (§4.1, §5.2). Its relationship to those two ratios is a model judgement with no stored derivation. So when a user asks *"why 4?"*, the only honest answers are the ratios plus Gemini's prose — and R-13.1.2 arguably forbids the shallow version of that as "a restatement of the number."

There is also a live confusion risk the table makes vivid: **a row can show performance `2` next to `3.2× their usual`**, and nothing in the current design explains why.

**Proposed treatment, which I want ruled on:**

1. **Label the 1–5 as a read, not a measurement.** The L2 popover's heading for it is `How this score was reached`, and its first line is: `The 1–5 is a judgement of the numbers below, not a number we measured. The measured figures are the percentage and the multiplier.`
2. **The measured figures appear above the judgement in the popover**, not below it. Reading order is an argument about which number to trust.
3. **`drivers[]` are presented as the reasoning for the verdict** (R-13.7.11) under the heading `Why it did what it did`, in Gemini's Indonesian, unedited.
4. **When the score and the multiplier point opposite ways**, the popover says so rather than leaving the user to notice: `This scored lower than the reach multiplier suggests — the reach was strong but engagement on it was not.` Deterministic template, selected by the same sign comparison as §3.1. **This line is REQUIRED (OR-6), not a nice-to-have** — see the status note at the head of this section. It is deterministic template selection, not model prose, so there is no accuracy argument for deferring it, and no alternative mitigation survives Q4.

An alternative worth the owner's consideration is dropping the 1–5 from the table entirely and letting the multiplier be the headline (companion spec §11, question 4).

> **SPENT — superseded 2026-08-07 by the owner's Q4 ruling.** The sentence above is preserved verbatim because it was a real alternative and naming it is what made the ruling meaningful, but **it is no longer an option and must not be re-offered.** Q4 was ruled explicitly: **the 1–5 performance score stays in the analyses table** (recorded in `DESIGN-3C` §11 Q4 and §12, in §10 below, in PR #168, and closed out of ticket planning by the PM in PRD **§15.1**). The multiplier does not become the headline; **both stay.** The direct consequence is the one stated at the head of this section: with the "drop the column" fix gone, **point 4 is the only remaining answer to the score/multiplier disagreement, and is therefore mandatory.**

---

## 8. Where each of the five questions is answered — the completeness check

R-13.1.1 asks for completeness of *information*, not of widgets. This is the audit table:

| Question | Table (L1) | Popover (L2) | Detail view (L3) |
|---|---|---|---|
| **1. Which metric, and why?** | tier phrase + denominator qualifier | + the plain-language "why this metric" | + full content-type explanation (R-13.7.7) |
| **2. What went into it?** | the reach/follower operand in the qualifier | full operand list (§4.4) | full operand list + baseline + bucket identity (R-13.7.9) |
| **3. How much evidence, is it final?** | `based on N …`, confidence word, `Early` badge, `≈` | confidence reason, staleness, as-of footer | + point-in-time framing (R-13.7.10) |
| **4. Why no score?** | the short reason, in the cell (R-13.7.5) | the full reason | the full reason + what would change it |
| **5. Can I compare it?** | **structural — separate columns, separate headers, separate qualifiers** | `Comparable only to this creator's own posts of the same kind.` | + why no totals are offered (R-13.6.3) |

**R-13.7.6 — "it must be evident a fuller explanation exists and is reachable"** — is satisfied by exactly one `ⓘ` affordance per row, in the Performance cell. Not one per figure: four glyphs per row would train users to ignore all four.

**R-13.6.4 — Gemini's Indonesian prose is part of this surface.** The prompt requirement (R-12.5.4) that the denominator be evident *inside the sentence* is not a UI decision, but it is the highest-risk surface because it is what gets pasted into a client deck. **The design cannot repair a bad string there.** I am flagging it as the one part of §13 the UI genuinely cannot backstop.

---

## 9. Open questions and things in §13 I think need PM/owner attention

Flagged rather than designed around.

1. **`based on N videos` is wrong on image buckets.** R-13.4.1 and AC-28 mandate the literal word. I propose a bucket-aware noun (§4.2). Needs a PRD amendment or an explicit ruling that the literal string wins.

   > **RULED 2026-08-06 — OR-9; the amendment has landed.** The item above is preserved verbatim because it was accurate when written, and is **superseded**: the bucket-aware noun is **approved**, and the PRD amendment it asked for **already exists**. **AC-28** now reads the pattern **`based on {N} {noun}`** with an inline `[AMENDED 2026-08-06 — owner ruling OR-9]` note; **R-13.4.1** carries the same amendment; `TDD` §14.3 lists it as applied; `TDD` §6 specifies `bucketNoun(bucketKey)` → `reels` / `carousels` / `Shorts` / `videos` / `posts`, derived at render time. **The literal `videos` is not binding and does not win in CI.** The owner's rationale, in the owner's terms: saying "videos" for a carousel-derived figure is the same bug class as labelling a play count "Views." *(Issue #170.)*
2. **R-13.3.4 ("every numeral in an explanation exists in the computed block") is unachievable as written.** ~~The `5` in `3 of 5`~~ **Resolved for the threshold:** the `5` in `2 of 5 carousels` is a config constant and is now explicitly on the allow-list (**R-14.2.7**, §5.3 R-C2). **Still open:** the `week` in the staleness copy is a TTL and is not on the allow-list or in the computed block. Either the computed block stores it, or the allow-list is extended. Cheap either way, but it will fail AC-27 if nobody decides.

   > **RULED 2026-08-06 — OR-10; nothing here is still open.** The *"Still open"* clause above is preserved verbatim and is **superseded**. The `week` **is on the allow-list**: **R-13.3.4** names *"the profile cache TTL (the `week` in the staleness copy)"* explicitly `[AMENDED 2026-08-06 — OR-10; see AC-27]`, **AC-27**'s amendment note names it as **formally exempt**, and `TDD` §14.4 lists the amendment as applied. **AC-27 will not fail on it.** The allow-list is **explicit, not a loosened numeral match** (AC-27: *"The extractor must implement the allow-list explicitly, not by loosening the match."*), and **per-row storage of either constant was considered and rejected** — so the "either the computed block stores it" branch above is dead. **Do not conflate the two `5`s:** the `5` in `2 of 5 carousels` is `BASELINE_MIN_SAMPLE`, resolved via **R-14.2.7 / R-C2**; the `week` is the profile cache TTL, resolved via **R-13.3.4 / AC-27 / OR-10**. Separate constants, separate paths. *(Issue #171; see §4.4.)*
3. **The 1–5 score's explainability is the weakest link in §13** (§7 above). §13 requires every score to explain itself; the 1–5 is a model judgement over two ratios and cannot be derived. I propose labelling it as a judgement. Needs a ruling.

   > **RULED — twice over; no ruling is outstanding on this item.** The words *"I propose labelling it as a judgement. Needs a ruling."* are preserved verbatim and are **superseded**. (a) The §9 positions, this one included, were **approved by the owner at the 2026-08-07 sign-off** (§10), so labelling the 1–5 as a judgement stopped being a proposal then. (b) **Q4 was ruled the same day** — the score **stays in the table** — which removed the last conditional hanging over it: §7 is no longer an argument feeding an open question but the **governing treatment**, and its point 4 (the deterministic *"these disagree because…"* line) is **REQUIRED per OR-6**. The observation that the 1–5 cannot be derived from stored operands still stands as a description of the score; what is settled is what the design does about it. See the status note at the head of §7 and PRD **§15.1**.
4. **`confidence` and `tierUsed` overlap** (§4.3). Showing both at L1 may read as two independent judgements when it is largely one. I would keep the tier phrase at L1 and demote the confidence word to L2. Needs a ruling.
5. **The "both readings" sentence (§3.1) needs a high/low threshold** that §3.4 forbids sourcing from an industry benchmark. The only defensible source is the creator's own bucket median — which means the sentence is unavailable pre-Tier-2. Acceptable, but it should be a stated product decision, not an implementation accident.

   > **RULED 2026-08-12 — amendment B5; the decision is stated, and it lives in §3.1.1.** The item above is preserved verbatim because it was accurate when written and it correctly predicted what went wrong. **It is superseded, and its last sentence is now satisfied rather than outstanding.** What §3.1.1 states: the line compares **the 1–5 judgement against the Tier 2 multiplier** (not Tier 1 against Tier 2 — the Tier 1 ratio has no stored creator-relative reference, so that route needs a schema change and is set aside); the score split is **`4–5` high, `3` neutral, `1–2` low**; the multiplier split is **`m >= 1.15` high, `m < 0.85` low**, with a **deadband of `0.85 <= m < 1.15`** in which no line renders; the two disagreement strings are restated; the two agreement strings are retired. **This item is no longer a blocker on any ticket and the threshold is not the implementer's call.** The failure mode it warned about did occur in the meantime — PR #201 shipped a bare `score >= 3` with no deadband, which fired a prescriptive instruction on a score `3` / multiplier `0.98` near-tie. That is fixed by §3.1.1's deadband, not by loosening the rule. *(Ticket [#147](https://github.com/jordanjordann/my-content/issues/147) step 5.4; PR [#201](https://github.com/jordanjordann/my-content/pull/201) review, "Score-threshold recommendation".)*
6. **R-13.5.3a's new stored reason does not exist yet.** Without it the app will render string 1 where string 3 is required, and AC-30's negative assertion will fail. This is a schema requirement produced by a design need, and it should be routed to the tech lead before 3B tickets are cut.

   > **RESOLVED 2026-08-09 — the value exists; nothing here is open.** The item above is preserved verbatim because it was accurate when written, and it is **superseded**: it was routed to the tech lead, it was ruled, and it shipped. **The stored reason is `CAUSE_NOT_DETERMINABLE`**, live in the `perf_unavailable_reason` `CHECK` constraint from **migration `012` (merged)** and carried into `013` (`TDD` §5.2 / §5.3). **The name `PERFORMANCE_DATA_ABSENT` proposed in §5.1 was ruled against and must not be re-proposed** — `CAUSE_NOT_DETERMINABLE` names the *epistemic* state rather than the data state (`TDD` §5.3). String 3 is renderable, string 1 is not rendered in its place, and **AC-30's negative assertion has a distinct value to assert against**. This item is no longer a reason to hold any 3B ticket. *(Issue #169 step 4; PR #179.)*
7. **Nothing in §13 says what happens on re-analysis.** Scores are frozen (D8), but a re-analysed post presumably gets a new row or overwrites the old. If a user can see two scores for the same post with different values, the as-of framing in §4.5 is doing a lot of work and may not be enough. Not in scope for me to solve; flagged.

---

## 10. Sign-off record

**Approved by the owner on 2026-08-07.** Recorded here because PRD §13.8 and caveat C2 require the sign-off to be explicit — *"we assumed the designer had handled it"* is precisely how R6 ships. The approval covers this document **as it stands on `main` at `2c1c5db`**; it is the owner's ruling in the 2026-08-07 session, not any handoff line, that this record reflects.

**What is approved:**

- [x] **§13 explainability surfaces signed off**, including the three-level disclosure model (§1) and the completeness audit of §8.
- [x] **The absent-score copy set (§5) approved**, string by string — all seven — **especially case 3 (`We can't tell`)**, which R-13.5.3b protects and which **must survive later editing pressure** (§5.1). Its tidier-sounding neighbour, string 1, asserts a cause; approving string 3 is approving the untidiness on purpose.
- [x] **The cold-start copy set (§5.3) approved** — `2 of 5 carousels` / `builds as you analyse more`, and rules **R-C1…R-C6** (amendment **B1**). The same wording is approved in the companion spec's §5.3; the two documents now say one thing, and **this one is where the string changes.**
- [x] **The provisional copy constraint (§6) approved** — the `Early` badge, and **no hour count in any user-facing string** (R-13.4.4, AC-29), including the banned phrasings recorded there.
- [x] **The seven items in §9**, as the positions this document states them — including the bucket-aware `based on N {noun}` of §4.2, labelling the 1–5 as a judgement (§7), and keeping both the tier phrase and the confidence word at L1. **Three of the seven still require action by somebody other than the owner before they are true in code**, and are carried over below rather than closed by this signature.

  > **Superseded 2026-08-09 — it is now one of the seven, not three.** The sentence above was accurate at signature and is kept. Two of the three carried-over items were **already resolved by rulings made before this sign-off and simply not reflected here**: §9.1 / §4.2 by **OR-9** (issue #170) and §9.2 by **OR-10** (issue #171). Only **§9.6** — the new stored reason for "cause not determinable" — still requires action by somebody other than the owner. See the corrected carry-over list below.

  > **Superseded 2026-08-09 — it is now none of the seven.** The correction above is preserved verbatim and is itself superseded in its last two sentences: **§9.6 requires no further action either.** The stored reason **`CAUSE_NOT_DETERMINABLE`** shipped in **migration `012` (merged)** and is live in the `perf_unavailable_reason` `CHECK` constraint (`TDD` §5.2 / §5.3), so all three formerly carried-over items are closed — §9.1 / §4.2 by **OR-9**, §9.2 by **OR-10**, §9.6 / §5.1 by the shipped value. **`PERFORMANCE_DATA_ABSENT` was ruled against and is not the name** (`TDD` §5.3). Nothing in the seven §9 items now waits on anybody. *(Issue #169 step 4; PR #179.)*

**Resolved, 2026-08-07.** The gap previously recorded here — that the companion spec's §5.3 was approved while this document's copy set as a whole was not, so tickets **#145–#149** would have been building against an unapproved canonical string home — **is closed by this sign-off.** It was a real gap and was deliberately left open in PR #163 rather than allowed to read as approval by proximity to amendment B1; it is recorded as resolved, not deleted, so the reason it existed stays legible.

**Carried over — approved as positions, not yet actionable in code:**

- **§9.1 / §4.2 — `based on N videos`.** AC-28 asserts the literal word `videos`. The bucket-aware noun is approved as the design, but **AC-28 still needs relaxing to the pattern `based on {N} {noun}`** by a PRD amendment. Until that lands, design and acceptance criteria disagree, and the AC wins in CI.

  > **STALE — superseded 2026-08-09. Not a carry-over; it was already resolved.** The entry is preserved verbatim because it was accurate on the day it was written, and it is **wrong now, in a direction that actively misleads**: it tells anyone building **#145–#149** that this canonical string home and the acceptance criteria are in conflict and that the literal `videos` wins in CI. **It does not.** The amendment it asks for **has landed**: **AC-28** and **R-13.4.1** both read the pattern **`based on {N} {noun}`**, each with an inline `[AMENDED 2026-08-06 — owner ruling OR-9]` note; `TDD` §14.3 lists the amendment as applied; `TDD` §6 specifies the derivation (`bucketNoun(bucketKey)` → `reels` / `carousels` / `Shorts` / `videos` / `posts`, at render time, no extra column). **Design and acceptance criteria agree. `based on {N} {noun}` is binding.** §4.2's rationale is unchanged; only its status changed. *(OR-9; issue #170.)*
- **§9.2 — the `week` in the staleness copy** is a TTL, not on the R-13.3.4 allow-list and not in the computed block. The `5` is resolved (R-14.2.7 / R-C2); the `week` is not, and it will fail AC-27 if nobody decides.

  > **STALE — superseded 2026-08-09. Somebody decided; the `week` is on the allow-list.** The entry is preserved verbatim and is **wrong now, in the most expensive direction** — it predicts a **CI failure that will not happen**, and that is exactly the kind of note that gets "fixed" by loosening a guard that was never broken. **R-13.3.4** names *"the profile cache TTL (the `week` in the staleness copy)"* on the allow-list `[AMENDED 2026-08-06 — OR-10; see AC-27]`; **AC-27**'s amendment note declares it **formally exempt**; `TDD` §0.3 OR-10 and §14.4 record the ruling and its application. **AC-27 will not fail on the `week`.** Two things the correction must carry with it: the exemption is an **explicit allow-list, not a loosened numeral match** (AC-27 says so in terms), and **per-row storage of these constants was considered and rejected** by the owner. **Do not conflate the two `5`s** — the `5` in `2 of 5 carousels` is `BASELINE_MIN_SAMPLE`, resolved via **R-14.2.7 / R-C2**; the `week` is the profile cache TTL, resolved via **R-13.3.4 / AC-27 / OR-10**. Separate constants, separate resolution paths; conflating them has already cost a session real time. The staleness copy itself is untouched. *(OR-10; issue #171.)*
- **§9.6 / §5.1 — the new stored reason for "cause not determinable"** (proposed `PERFORMANCE_DATA_ABSENT`) does not exist yet. **That a distinct value exists is a design requirement**; the name is the tech lead's call. Without it the app renders string 1 where string 3 is required, and AC-30's negative assertion fails.

  > **As of 2026-08-09 this is the only live entry in this list.** The two above it are recorded as stale, not deleted. This one is genuinely outstanding and is tracked as **#169** (a code ticket; the doc reconciliation is its step 4).

  > **STALE — superseded 2026-08-09 (later the same day). The list has no live entries; the value exists.** Both notes above are preserved verbatim and are **wrong now, in the direction that blocks work**: they tell a reader that the "cause not determinable" reason is still missing from the schema, which is why a code review is holding **PR #179**. **It is not missing.** The stored reason is **`CAUSE_NOT_DETERMINABLE`** — it shipped in **migration `012`, merged**, is live in the `perf_unavailable_reason` `CHECK` constraint, and is carried into `013` (`TDD` §5.2, §5.3). It has existed the whole time; this document simply never caught up. **The name `PERFORMANCE_DATA_ABSENT` was ruled against and is superseded** — naming was the tech lead's call and `CAUSE_NOT_DETERMINABLE` was chosen because it names the **epistemic** state (*we cannot tell why*) rather than the data state (`TDD` §5.3). **Nobody should re-propose `PERFORMANCE_DATA_ABSENT`, and no ticket is blocked on this value being created.** With this, **all three carried-over entries in this list are closed** — §9.1 / §4.2 by OR-9, §9.2 by OR-10, and §9.6 / §5.1 by the shipped `012` value. The design requirement §5.1 states is **met**, not waived: the value is distinct from `REACH_HIDDEN`, which is the whole of what the design asked for. *(Issue #169 step 4; PR #179; the deferral blocker previously cited here — contention with issues #170 / #171 — no longer exists, both are closed.)*

**What this sign-off does not cover**, recorded so that nobody reads it as broader than it is:

- **The companion spec's §11 questions 2 and 3 remain UNRULED**, exactly as its own §12 records them, and **nothing here or anywhere else rules them**: the Status-column cut (Q2) and the Style column's default state (Q3).

  > **SUPERSEDED 2026-08-09 — the owner ruled both.** The exclusion above is preserved verbatim because it was true from the sign-off until 2026-08-09, and it is now closed:
  >
  > - **Q2 — RULED 2026-08-09, by the owner: the Status column is CUT.** Status does not ship as a column. It surfaces as the row-level failed treatment (`DESIGN-3C` §3.3) plus the Status **filter** chip (`DESIGN-3C` §6.2).
  > - **Q3 — RULED 2026-08-09, by the owner: the Style column ships DEFAULT-OFF.** It is **built and available**, hidden until the user opts in via the column picker (`DESIGN-3C` §6.3).
  >
  > Both rulings **ratify what `DESIGN-3C` already proposed** in its §2.1 / §2.2 / §6.3, so **no column width, order or total changes** and no string in *this* document changes. The full record, including the resulting column set, is in `DESIGN-3C` §2.2 and §12. **With Q4 (2026-08-07) and Q2/Q3 (2026-08-09), no question in `DESIGN-3C` §11 is open.**

  **Q4 — RESOLVED 2026-08-07, by the owner: the 1–5 performance score stays in the analyses table.** As recorded here at sign-off, Q4 sat in this same exclusion, and that record is kept rather than deleted because it was true and the reasoning is what made the ruling meaningful: *"Q4 is a live product question, not a formality — it is implemented as proposed but has never been decided, and **§7 of this document is an argument that feeds it, not an answer to it.** Approving §7's treatment of the 1–5 as a judgement approves how it reads if it ships; it does not approve that it ships in the table. If Q4 is later ruled the other way, §7 and §5's row-level assumptions are the parts of this document that change."* **That contingency is now closed in favour of the score staying.** Two consequences follow, and only these two: **§7 is now the governing treatment of the 1–5** — it ships in the table and it reads as a judgement, per §7's four points — rather than a contingent argument awaiting a ruling; and **§5's row-level assumptions stand.** The ruling was made **separately from, and after, the sign-off recorded above**, which did not cover it. Recorded as resolved, not erased, on the same discipline as the §10 gap note closed in PR #165. **It rules Q4 and nothing adjacent to it: Q2 and Q3 stay open.**

  **Superseded 2026-08-09 as to its last clause only.** *"Q2 and Q3 stay open"* was true of the Q4 ruling and stays on the record as a description of that ruling's scope — the Q4 ruling did not touch them. **They were ruled separately on 2026-08-09: Q2 — Status column CUT; Q3 — Style column DEFAULT-OFF (built, hidden until opted into).** See the note on the bullet above. Everything else in this paragraph stands unchanged.
- **R-N1's data dependency is not waived** (companion spec §5.4). A backend change is in flight to carry the reach **value and its kind** through `ReachResult`. If it does not land, **`REACH_NOT_ON_FIRST_SLIDE` must not render** and the row falls back to `CAUSE_NOT_DETERMINABLE` with its existing copy. Approving the copy does not approve shipping the state without its figure — a bare "the count is on a later slide" is the R-13.5.3a failure this whole section exists to forbid.
- **AC-33's ban-string search must be scoped to UI copy and code — not to design documents.** R-C1 bans the literal `5 posts`, and **both this document and its companion contain that literal inside the rule that states the ban.** An unscoped repository search will trip on the rule stating itself. That is a false positive, not a violation; scope the search to user-facing strings and the modules that render them.
- **Nothing outside this file.** The PRD, the TDD and the acceptance criteria are unchanged by this record. Where this document and an AC disagree (see the carry-overs above), this signature does not settle the disagreement.
