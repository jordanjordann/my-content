# Design-Fidelity Audit — Phase 3C, the Analyses Table

**Status:** Audit only. **No code was changed and no design document was changed by the audit itself.** The owner reviews this and decides what gets ticketed.

> **Updated 2026-08-13 — the owner has ruled on the Content-column addendum, and those rulings ARE now written into the spec** (`DESIGN-3C-analyses-table.md`, amendment **A8**) and into the mockup. Still no code changed. What was ruled: **R-D17 APPROVED at two lines** (M9 — the rule now lives in `DESIGN-3C` §2.2.1, which is its authority); **M10 REJECTED, the 40px square thumbnail stays** and the mockup was corrected to it; **L1 and L4's copy questions DROPPED**, no fix either way. Each is marked at its finding below. **M11, L6 and L9 remain open for the owner.**
**Author:** Jessica (UI/UX)
**Date:** 2026-08-13
**Requested by:** the owner — *"the shipped analyses table is far from the mockup."*

**Inputs compared**

| | |
|---|---|
| Shipped UI | `~/Desktop/table.png` — desktop width, 6 analyses, one creator (the primary test creator), left edge of the Content column cropped out of frame. **Superseded for the Content column by `~/Desktop/wider table.png`** (same 6 analyses, wider frame, Content column and the `Showing N of M` line included) — see the addendum. |
| Mockup | [`3c-analyses-table-mockup.html`](./3c-analyses-table-mockup.html) at `f0ac16f` |
| Spec | [`DESIGN-3C-analyses-table.md`](./DESIGN-3C-analyses-table.md) — **§2.2 is the layout authority, not §5** — and [`DESIGN-3B-score-explainability.md`](./DESIGN-3B-score-explainability.md) (B5–B8, §4.6, §5.5) |
| Implementation | `app/app/analyses/components/grids/AnalysisDataTable/**`, plus `lib/api/analyses/helpers.ts` where the copy is selected |

**Method note.** Colour, size and string claims below are read from the source, not eyedropped from the PNG — the screenshot is a scaled capture and pixel measurement from it would not be evidence. Where the screenshot is the evidence (a string being on screen, a glyph count, a line count, row proportions) I say so.

> **The Content column is no longer an open gap.** The original capture cropped it out, and this note used to say its thumbnail, kind overlay, mode chip and caption line were unaudited. The owner supplied a wider capture on 2026-08-13 and **the Content column is audited in the [addendum](#addendum--the-content-column-2026-08-13)** — findings **M9–M11** and **L6–L9**, plus one correction to **L4**. The remaining uncovered surfaces are listed, updated, in [What this audit does not cover](#what-this-audit-does-not-cover).

**Headline.** Nine columns, their order and their widths are **exactly** §2.2 — the table's skeleton is right. What has drifted is everything hung on it: two withdrawn strings are still live, one column renders a hard-coded placeholder on every row, and the type/colour system was rebuilt from the app's defaults rather than from §9. Fourteen findings, four of which change what a reader understands. **The addendum adds seven more** — and the largest of them is a **spec gap**, not a code defect.

---

## Findings ranked by severity

### HIGH — these change what the user understands

---

#### H1 — The withdrawn `no follower measure here` string is still shipping, on five of six visible rows

**Spec.** `DESIGN-3C` §4, amendment **A5** (2026-08-13): the `Eng. / followers` reason *"becomes **`measured against reach instead`**; `no follower measure here` is withdrawn and preserved as the withdrawn string."* §4's own table now reads:

> | **Eng. / followers** | `—` <br> `measured against reach instead` | `≈16.2%` <br> `of 284K followers` |

The mockup was updated with it (`3c-analyses-table-mockup.html:182`, `:262`, `:295`).

**Screenshot.** `no follower measure here` on rows 1, 2, 4, 5 and 6 — five of the six rows, in one column, under one creator, immediately below row 3 which shows `≈18.1% / of 255.8K followers` for that same creator. **This is the exact reading failure A5 was written from**, still on screen: *"some of the reels they are saying 'no follower measure here' while one of them have the data."*

**Implementation.** `lib/api/analyses/helpers.ts:350` — the string literal in `deriveEngagementCell`'s wrong-denominator branch. The comment above it at `:300` still cites §4 as its source, which is now the source of the *replacement*.

**Severity: HIGH.** A routing fact reads as a data gap, and the row above it contradicts the row below it.

**Resolution.** Replace the literal at `helpers.ts:350` with `measured against reach instead`. The **condition is unchanged** — A5 is copy-only. `tests/…/AnalysisDataTable.dom.test.tsx:612-616` asserts the old string and must move with it. The `Eng. / reach` mirror strings at `:348` / `:349` **stay split on content kind** (R-13.5.2) and must not be touched. `docs/TDD-3A-3B-3C-phase-3.md:1142` also carries the old string and is already flagged in A5 for the tech lead.

---

#### H2 — The withdrawn `No totals` footer sentence is still shipping, verbatim

**Spec.** `DESIGN-3C` §4.1 **R-D1**, as amended by **A5**: the footer reads

> `No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.`

and the withdrawn string is *"preserved so it is not restored: `No totals — these posts are measured against different things.`"* The mockup carries the replacement at `:419`.

**Screenshot.** Footer, left slot: **`No totals — these posts are measured against different things.`** — the withdrawn sentence, character for character.

**Implementation.** `AnalysisDataTable.tsx:316`.

**Severity: HIGH.** The owner is the reader who reported *"i dont understand what it means"*. The decision behind it (R-D1, no aggregate row) is settled and correct — only the sentence failed.

**Resolution.** Swap the literal at `:316`. Keep it **always-visible plain text** in the footer's left slot per **R-D11** — not a tooltip. R-D11 also asks the footer give it room to wrap rather than ellipsise (`min-width: 0` on the pagination side); the replacement is ~2.4× longer than what is there now, so this is not theoretical. `tests/…/AnalysisDataTable.dom.test.tsx:475` asserts the old string.

---

#### H3 — The comments half of the Counts cell is a hard-coded em-dash on every row

**Spec.** §2.2, column 4: *"Reach + its kind word (`plays` / `views`) using the shipped four states; **likes · comments on line 2**."* Mockup line 2 of that cell: `31.4K · 1.2K` (`3c-analyses-table-mockup.html:157`).

**Screenshot.** Line 2 reads `155 · —`, `12.9K · —`, `32.4K · —`, `36.0K · —`, `2.2K · —`, `112 · —`. **Every row, without exception.** A reader scanning that column concludes no post in the library has comment data.

**Implementation.** `AnalysisCountsCell.tsx:32`:

```tsx
<EngagementCount state={likeCountState} metric="likes" /> · <span aria-hidden="true">—</span>
```

The `—` is a literal, not a state. The root cause is upstream: `AnalysisListItem` carries `likeCountState` (`lib/api/analyses/types.ts:285`) and **no comment-count equivalent**, so the list payload has nothing to render. The per-post shape does have comments (`types.ts:101`).

**Severity: HIGH.** It is not a wrong number — it is a placeholder that renders in the position §2.2 reserved for a real one, and it is indistinguishable from a genuine `—` absent state. Six rows of it read as a fact about the library.

**Secondary defect in the same line.** The `—` is `aria-hidden="true"` while the `·` separator is not, so the accessible line announces as `155 ·` — a trailing separator with nothing after it. §10's discipline (*"absent cells announce the full reason"*) is not met by hiding half of a pair.

**Resolution.** This is a data-contract ticket before it is a UI ticket: carry a comment `CountState` on `AnalysisListItem` and render it through the same `EngagementCount` four-state component the likes side already uses. **Do not** simply restyle the dash. If the count genuinely cannot be carried, the honest interim is to drop the `· —` suffix entirely rather than render a placeholder in a data position — but that is a design ruling I would want the owner to make, not a developer.

---

#### H4 — Two visible rows render a bare `—` in the Performance cell where §5.5 now requires a sentence

**Spec.** `DESIGN-3B` **B8** / **§5.5**, and `DESIGN-3C` §5.1's A6 note. §5 row 8: *"The judgement returned no 1–5 … **`No 1–5 for this post`**"*, keeping the row's single `ⓘ`. Row 9: *"No performance block exists for this analysis at all … **`Performance wasn't measured`**"*, carrying **no** `ⓘ`. The governing principle is older than the amendment — §5's opening line: *"A blank cell is the worst outcome this feature can produce. Every absent score renders a sentence. Never `0`, never an em-dash, never empty (R-13.5.4)."*

**Screenshot.** The two rows below the sink divider show a bare muted `—` in the Performance column — while their other cells render normally (Content score `4 ▪▪▪▪▫`, cold-start `0 of 5 reels`, `2.6%` / `7.2%` engagement). That combination — everything measured, no judgement — is precisely §5.5's row 8.

**Implementation.** `AnalysisTableRow.tsx:185-188`. The fallback is well-reasoned and was *correct when written*: PR #198's round-3 review forbade a developer from inventing copy for these states. **The copy now exists**, merged today in #212.

**Severity: HIGH,** and the least blameworthy item on this list. It is a gap between an amendment merged hours ago and code that predates it, not a regression.

**Resolution.** One ticket against §5.5, and it must implement the **three-way** split, not two: row 8's string **with** the popover's heading/intro swap (`Why there's no 1–5 here`, opening paragraph = row 8's L2), row 9's string **with no `ⓘ` at all**, and `INSUFFICIENT_HISTORY` **keeping the `—`** — that last one is a ruling, not an oversight. `PerformanceCell`'s current single `cell?.text == null` branch cannot express the distinction; the derived cell needs to say which of the three states it is.

---

### MEDIUM — the design system was rebuilt from app defaults

The next five findings share one cause and would be one ticket: the table's typography and colour were taken from the codebase's ambient `text-sm` / `text-xs` / `text-muted-foreground` conventions rather than from §9 and the mockup. I list them separately because they were named separately and because their severities differ.

---

#### M1 — Column headers are sentence-case `text-xs`; the mockup is 10px uppercase with letter-spacing

**Mockup.** `3c-analyses-table-mockup.html:120` — `<thead class="text-[10px] uppercase tracking-wider text-mutedfg">`.

**Screenshot.** `Creator`, `Posted`, `Counts`, `Content`, `Performance`, `vs their usual`, `Eng. / reach`, `Eng. / followers` — all sentence case, no tracking, and visibly the **same size as the body's second lines**.

**Implementation.** `AnalysisTableColumnHeaders.tsx:64` and `:84` — `text-xs font-medium text-muted-foreground` (12px) on both header rows.

**Severity: MEDIUM.** Not a misread on its own, but this is the single largest contributor to *"the font size looks off"*. Uppercase-with-tracking at 10px is what separates chrome from content; at 12px sentence case, the header row stops reading as a header and the table loses its top-level structure. §8's sticky-header rule exists because *"the column headers are the only thing preventing a denominator misread"* — a header that does not read as a header is a weaker version of that protection.

**Resolution.** `text-[10px] uppercase tracking-wider font-semibold text-muted-foreground` on both header rows. Note `vs their usual` is deliberately lowercase prose in §2.2 and reads fine uppercased as a header label; confirm with the owner if it grates.

---

#### M2 — The `Scores` group header lost its colour, its casing and both vertical rules

**Mockup.** `:124` — `<th colspan="2" class="px-3 pt-2.5 pb-1 text-center text-primary border-x border-border/60">Scores</th>`, inheriting the `thead`'s 10px uppercase tracking. Every body cell in the group carries the matching `border-l` / `border-r` (`:158`, `:159`, `:202`, `:203`, …), so a continuous pair of vertical rules brackets the two score columns down the whole table.

**Screenshot.** `Scores` is sentence case, muted grey, at body-text size, with a horizontal rule under it and **no vertical rules anywhere in the body**.

**Implementation.** `AnalysisTableColumnHeaders.tsx:49` — `border-b px-3 py-1 text-center text-xs font-semibold text-muted-foreground`. No `text-primary`, no `border-x`, and `AnalysisTableRow.tsx:86` gives every `<td>` the same `p-3 align-middle` with no group borders.

**Severity: MEDIUM.** §5's Trap 3 is *"the content score and the performance score look identical and will be confused"*, and §5 names the shared group header as the **first** of three mitigations: *"The group header is what says 'related but different'."* Two adjacent `n ▪▪▪▪▫` cells with a faint grey word above them is a materially weaker version of that than a coloured, bracketed group. The other two mitigations (different pip fills, the Performance-cell second line) **are** shipped and working — see the "correct as shipped" list.

**Resolution.** Restore `text-primary` and the header casing; restore the `border-x` on the group header and `border-l` / `border-r` on the two score columns' `<td>`s. The vertical rules are a mockup detail the spec prose does not mandate, so if the owner dislikes them, the colour and casing are the load-bearing half — take those.

---

#### M3 — The two engagement column headers are not colour-coded

**Mockup.** `:135` `class="… text-accent" — Eng. / reach`; `:136` `class="… text-teal" — Eng. / followers`.

**Screenshot.** Both headers render in the same muted grey as every other header.

**Implementation.** `AnalysisTableColumnHeaders.tsx:64` applies one class string to all columns; `AnalysisTableColumnDef` (`types.ts`) has no colour field, so there is nowhere to put one today.

**Severity: MEDIUM.** §4's distinguisher 3 is explicit that colour is *"a **redundant third channel only** … Colour carries no meaning that text does not already carry"*, so nothing is unreadable. But R6 is the PRD's highest-severity risk and the design bought four channels deliberately; shipping three is a quiet reduction of a margin that was chosen on purpose.

**Resolution.** Add an optional per-column class to `AnalysisTableColumnDef` and set `text-accent` / the teal token on columns 8 and 9. Fix alongside M4 — they are the same colour decision at two ends of the same column.

> **AMENDED 2026-08-14 — this finding was under-specified, and `DESIGN-3C` **§9.2.1** (**R-D18** / **R-D19**) is now the authority.** The resolution above says *where* the colour goes and is unchanged; what it never said — because the mockup it was read off draws the headers as **static text with no sort button** — is what the colour does once the label sits inside a real sort control. The shipped control's `hover:text-foreground` and active-sort `text-foreground` are the button's own `color` and **override an inherited header colour**, so building M3 as written makes the colour disappear on hover and while that column is sorted. **The owner has ruled the colour is kept in ALL states** (**R-D18**), and §9.2.1 rules that the **sort arrow alone** carries the sorted state (**R-D19**, approved half). **A replacement hover affordance — a colour-free underline — was proposed and the owner REJECTED it** (*"no need hover color change, its fine."*): **these two headers get no hover affordance at all**, and the proposal is preserved in §9.2.1 marked declined so it is not rebuilt or re-raised as a new finding. **The `headerColorClassName` mechanism this finding proposed is approved** and is not reopened.

---

#### M4 — The engagement colour is on the wrong line: the figure is coloured, the qualifier is muted

This is the owner's *"colours of the view/reach figures differ"*, and it is inverted rather than merely off.

**Spec.** §9.2's text table names the roles precisely:

> | **Line-2 qualifier text** | `text-muted-foreground` `#94a3b8` | … |
> | Reach-denominated **qualifier** | `text-accent` `#d99126` | … |
> | Follower-denominated **qualifier** | teal `#3fd0bb` | … |

The mockup renders exactly that: `<div class="num font-semibold">4.1%</div><div class="text-[11px] text-accent">of 482.1K views</div>` (`:181`) — figure in foreground, **qualifier** in amber. Follower row at `:224`: `≈16.2%` in foreground, `of 284K followers` in teal.

**Screenshot.** `4.4%`, `4.5%`, `4.9%`, `2.6%`, `7.2%` are **amber**; `of 6.0K plays`, `of 292.8K plays` … are **muted grey**. `≈18.1%` is **teal**; `of 255.8K followers` is muted.

**Implementation.** `AnalysisEngagementCell.tsx:56` applies `ENGAGEMENT_CELL_VALUE_CLASSNAME[denominator]` to the **value** line, and `:60` gives the qualifier `text-xs text-muted-foreground`. `constants.ts:7-8` — `REACH: "text-accent"`, `FOLLOWERS: "text-teal-500"`.

**Severity: MEDIUM.** No number is wrong and no denominator is missing, so nothing is unreadable. But the design put the colour on the qualifier for a reason worth restating: **the qualifier is the thing that must not be skipped.** A coloured `4.4%` next to a grey `of 6.0K plays` emphasises the figure over its denominator, which is the reading order the whole of §4 is arranged against — and it makes the two engagement columns look like the table's most important numbers, when §2.2's column-order rationale deliberately placed them last so as *"not [to] bury Tier 2 beneath a weaker follower-denominated percentage."*

**Resolution.** Move the accent/teal class from the value line to the qualifier line; the value line takes the default foreground. §9.2's ratios were measured for exactly this assignment.

---

#### M5 — The Performance numeral is not `text-primary`

**Spec.** §9.2 — `| Performance numeral | text-primary #8092e7 | 6.94 | 6.78 | 6.45 | 5.95 | pass |`. Mockup `:160` — `<div class="num font-semibold text-primary">4 …`.

**Screenshot.** The Performance numerals (`2`, `4`, `5`, `5`) render in the same foreground white as the Content numerals beside them; only the **pips** are blue.

**Implementation.** `AnalysisScoreCell.tsx:55` — `<span aria-hidden="true" className="tabular-nums font-medium">{props.score}</span>`, with no variant colour. The pips do vary correctly (`constants.ts:5-8`).

**Severity: MEDIUM,** and it compounds M2. §5's Trap 3 mitigation list assumed the group header, the pip fill *and* the numeral colour all differentiating; with the group header greyed (M2) and the numeral uncoloured, the pips are carrying the axis distinction close to alone. §9.5 is still satisfied — the greyscale channel is the sub-label plus the presence/absence of a second line, and both ship — so this is not a WCAG 1.4.1 failure. It is a designed margin spent without a decision.

**Resolution.** Apply the variant colour to the numeral as well as the pips.

---

#### M6 — The `Early` badge: present in the code, **visible in the screenshot**, but rendered as bold plain text instead of a badge

The owner asked whether this is (a) missing, (b) unreachable, or (c) correctly absent. **It is none of the three — it is (d) present, reachable, and on screen three times, styled so plainly it does not read as a badge.**

**Evidence, from the screenshot itself.** Row 1: `2d ago · **Early**`. Row 5: `1d ago · **Early**`. Row 6: `3d ago · **Early**`. It is in the Posted column, immediately after the age, exactly where §5.2 puts it. It is not missing and its condition is not unreachable.

**Spec.** §5.2 — *"`Early` badge in the **Posted** column, next to the age … The badge reads `Early` with the age immediately beside it (`2d ago · Early`)."* §9.3's badge table gives the treatment: `bg-accent/12 text-accent`, 6.61:1 on card. The mockup at `:277`:

```html
<span class="text-mutedfg">2d ago &middot; </span><span class="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold text-[10px]">Early</span>
```

**Implementation.** `AnalysisTableRow.tsx:123-128`:

```tsx
{row.performance?.computed.provisional && (
  <> {" · "}<span className="font-medium">Early</span></>
)}
```

Correct column, correct position, correct condition — **no tint, no rounding, no padding, no accent colour, no size step**. It is bolded body text inside a muted second line, which is why it reads as part of the sentence rather than as a marker.

**Severity: MEDIUM.** §9.5 lists provisional's non-colour channel as *"the word `Early`"*, and the word is there, so the greyscale-safety claim holds and no user is misinformed. But §6 of `DESIGN-3B` says *"a provisional score is never presentable as final"*, and a marker the owner could not find on his own table is not doing that job. The gap between "technically rendered" and "actually noticed" is the whole finding.

**Resolution.** Apply §9.3's badge pattern: `rounded px-1.5 py-0.5 text-[10px] font-semibold bg-accent/12 text-accent`. **Do not change the condition, the position or the word** — all three are already right, and this is the one finding on the list where the code is more nearly correct than it looks.

---

#### M7 — The two engagement-column header tooltips (A6 / B7) are not built

**Spec.** `DESIGN-3C` **§4.2** (amendment A6) — a trigger in **each engagement column header**, *"once per column, and never in a cell"*, real `<button>` sibling of the sort control (**R-D6**), the shipped ticket-#70 interaction contract (**R-D7**), accessible names `How is engagement against reach worked out?` and `How is engagement against followers worked out?` (**R-D8**), no figures inside (**R-D10**). Copy is `DESIGN-3B` §4.6, `T1` and `T2`.

**Screenshot.** No `ⓘ` in either engagement header.

**Implementation.** `AnalysisTableColumnHeaders.tsx` — `ColumnHeaderLabel` renders the sort button and nothing else. Nothing to point at; it was never built.

**Severity: MEDIUM.** Merged today in #212, so this is an unbuilt amendment rather than a regression. It sits below H4 because H4's `—` is a blank where the design demands a sentence, whereas this is an explanation that has never existed.

**Resolution.** One ticket, and two rules to hold it to. **§5.1's one-`ⓘ`-per-row ruling is not excepted here** — the triggers add **zero** glyphs per row and two to the entire table, in a header rendered once. Any implementation that puts an `ⓘ` in an engagement **cell** is out of bounds (R-D5). And **R-D9**: the denominator qualifier and the `≈` stay on every cell at L1 — the tooltip must not become the only place a denominator appears.

---

#### M8 — Body type is a size step up, cells are middle-aligned, and rows are not the 68px §3.1 specifies

**Spec / mockup.** `tbody class="text-[12.5px] align-top"` (`:140`), second lines at `text-[11px]`. §3.1 — *"Comfortable — 68px rows (default)"*.

**Screenshot.** Rows are visibly unequal in height — the tallest (row 3, three wrapped lines in Counts and Performance) is roughly half again the shortest — and cell contents are **vertically centred**, so short cells float in the middle of tall rows instead of aligning along a shared top edge. This is the second half of *"the font size looks off"*: it is as much about looseness as about size.

**Implementation.**
- `AnalysisDataTable.tsx:296` — `<table className="w-full caption-bottom text-sm">`: 14px base against the mockup's 12.5px.
- Second lines are `text-xs` (12px) against the mockup's 11px, throughout.
- `AnalysisTableRow.tsx:86` — `p-3 **align-middle**`, against the mockup's `align-top`.
- `AnalysisTableRow.tsx:79` — `style={{ height: ROW_HEIGHT_PX[density] }}` with `comfortable: 68` (`constants.ts:86`). On a table row `height` is a **minimum**, not a height; at 14px/12px type with three-line cells, no row can honour it.

**Severity: MEDIUM.** Nothing is unreadable and nothing is untrue. But §3.1's two-line grammar — *"**Line 1** is the number. **Line 2** is the qualifier"* — depends on lines 1 aligning across the row. Middle alignment breaks that grid, and it is why the shot reads as a list of paragraphs rather than a scannable table (US-6, *"scan the library and find what worked"*).

**Resolution.** `align-top` on the row's cells and the mockup's type scale (12.5px body / 11px qualifier, or the nearest tokens the app has). Then re-check §3.1: if 68px is genuinely unachievable at Comfortable with real three-line cells, **68px is the number that should change, in §3.1, with the owner's agreement** — not the text. §3.1 is explicit that when line 2 does not fit, *"the **column** is too narrow and gets widened, not the text shortened."*

---

### LOW — cosmetic drift and one thing the mockup gets wrong

---

#### L1 — `Counts weren't available` on the image-carousel row, where the mockup says `not published for image posts` *(and here the mockup is probably the one that is wrong)*

**Screenshot.** Row 3's Counts cell: `—` / `Counts weren't available` / `32.4K · —`. That row is an all-image carousel — its `Eng. / reach` correctly reads `not published for image posts`.

**Mockup.** `:201` gives the same row's Counts cell `not published for image posts`.

**Implementation.** `AnalysisCountsCell.tsx:28` renders `ABSENT_COUNT_REASON_COPY[absentCountReason]`; `NOT_AVAILABLE` → `Counts weren't available`.

**Honest reading.** `DESIGN-3C` §2.2 says column 4 uses *"the shipped four states"* from `DESIGN-engagement-count-display-states.md` and never specifies a reason string for this cell; the reason copy was decided in `TDD` §1204/§1212 as OR-11's deliberately-non-fabricating three-case ladder, where `NOT_AVAILABLE` is *"the mandatory non-fallback default"*. `Counts weren't available` asserts no cause, which is the R-13.5.3a-safe answer. **The mockup, drawn before that ladder existed, is the stale artefact here.**

**Severity: LOW.** Both strings are true of that row.

**Resolution.** Owner's ruling, not a code fix. Either accept the shipped string and update the mockup, or decide the Counts cell should mirror the engagement column's kind-split — which would be a **new** design decision requiring its own R-13.5.2 reasoning, not a restoration.

> **CLOSED 2026-08-13 — DROPPED by the owner. No fix in either direction, and no ticket.** The finding was considered and deliberately set aside: **the shipped `Counts weren't available` stays**, the mockup's `not published for image posts` on that cell **is not being changed either**, and the kind-split alternative is not being pursued. This is recorded so it does not resurface as a finding — **a "no action" decision and an oversight look identical to the next reader unless one of them is written down.** Note what was already true and made it easy to drop: both strings are true of that row, and the shipped one asserts no cause, which is the R-13.5.3a-safe answer. **Nothing here licenses changing either string.** *(`DESIGN-3C` amendment A8-note (i).)*

---

#### L2 — The follower colour is a raw Tailwind palette value, not a token, and was never re-measured

`constants.ts:8` — `FOLLOWERS: "text-teal-500"`. §9.2 specifies teal `#3fd0bb`; Tailwind's `teal-500` is `#14b8a6`. `app/globals.css` defines `--accent` but **no teal token**, so there was nothing correct to reach for. §9.1 required the implementer to *"re-measure against the real token values before merging and record the three surface ratios in the PR body (AC-17)"*.

**Severity: LOW** — `teal-500` on this app's dark card comfortably clears 4.5:1, so this is a provenance and consistency defect, not an accessibility one.

**Resolution.** Add a semantic token for the follower-denominated colour and record its four measured ratios. Do this **with** M4, since M4 moves the colour to a different element and the ratio must be re-measured for the new one anyway.

---

#### L3 — Pip and numeral details drift from §9.4 and the mockup

- **Unfilled pip track:** `AnalysisScoreCell/constants.ts:10` — `bg-muted-foreground/30`. §9.4 specifies `#5c6c86` at 3.72:1 on card. An `/30` opacity is far below that. **Not a WCAG failure** — §5's Trap 2 and §9.4 both establish the pips as formally decorative (`aria-hidden`, the numeral carries the value), *"headroom rather than a dependency"*. But §9.2's hard rule — *"Any opacity modifier on a text token in this table must be re-measured against all four surfaces before it ships"* — is the exact discipline this codebase has now missed three times, and the track is visibly fainter in the shot than the mockup's.
- **Pip size:** `size-1.5` (6px) / `rounded-[1px]` vs the mockup's 7px / 2px.
- **Numeral weight:** `font-medium` vs the mockup's `font-semibold`.

**Severity: LOW.** **Resolution.** Match §9.4's track value explicitly rather than deriving it from an opacity; the size and weight are a judgement call I would take from the mockup.

---

#### L4 — The sink divider is styled as body text, and the failed-group divider has no approved sentence

`AnalysisSinkDivider.tsx:16` — `text-xs font-medium text-muted-foreground`; mockup `:301` — `text-[10.5px] uppercase tracking-wider` on `bg-mutedbg/40`. The *label* is correct and R-S2-compliant (visible, labelled, counted) — the screenshot's `…separately` is the tail of `6 posts with no performance score — sorted separately`, verbatim from §6.1.

Separately: `AnalysisDataTable.tsx:259` renders the failed group as `Analysis failed — 2`. That is **not prose and does not pretend to be** — the code comment at `:251-257` flags it explicitly as awaiting a design ruling, because §3.3 requires failed rows be *"labelled separately"* without ever stating the sentence. **The developer was right to stop.** No failed row is present in this screenshot, so it is unverified in the shipped shot.

**Severity: LOW.** **Resolution.** Casing fix on the divider. The failed-group label is a copy gap I owe `DESIGN-3B` §5 — it should be written where copy is written, following row 7's register, and it is not urgent until a failed row can appear on screen.

> **The failed-group divider sentence is CLOSED 2026-08-13 — DROPPED by the owner. No sentence is written, and none is owed.** I said above that I owed `DESIGN-3B` §5 a string; **the owner has ruled that he does not want one**, so the debt is discharged rather than outstanding, and there is no ticket. Recorded so it does not resurface as a finding. **No copy is invented under this note** — `AnalysisDataTable.tsx`'s `Analysis failed — 2` stays as it is, still flagged in its own code comment, and it remains unverifiable in the shipped UI until a failed row can be captured. **The divider casing half of L4 is untouched by this and still stands** (it belongs to the §9 typography pass, ticket group 4). *(`DESIGN-3C` amendment A8-note (ii).)*

---

#### L5 — The `ⓘ` glyph is a lucide `InfoIcon`, not the mockup's circled italic `i`

`AnalysisScoreExplainPopover.tsx:4`. The mockup drew a 14px `1px`-bordered circle with an italic serif `i` (`.ex`, mockup `:45-48`). **The interaction contract is correct and I want to say so plainly** — real `<button>`, hover *and* keyboard focus, `role="tooltip"` + `aria-describedby`, `Escape` / blur / outside-press dismissal, no native `title`, per §8 and R-D7.

**Severity: LOW** — purely the glyph. **Resolution.** Leave it. A shipped icon component beats a bespoke one, and the mockup's `.ex` was a mockup convenience.

---

## Correct as shipped — including things the owner suspected

Stated plainly, because a short honest audit is worth more than a long one.

| | Verdict |
|---|---|
| **The `Early` badge** | **In the screenshot, three times** (`2d ago · Early`, `1d ago · Early`, `3d ago · Early`), in the right column, in the right position, on the right condition. Not missing, not unreachable. Only its *styling* is wrong — **M6**. |
| **Nine columns, their order and their widths** | `constants.ts:15-57` matches §2.2 **field for field**: 300 / 140 / 108 / 132 / 84 / 156 / 128 / 116 / 124, in §2.2's order, with columns 5–6 grouped under `Scores`. No Status column. Style is separate and default-off. |
| **One `ⓘ` per row, Performance cell only** | Every scored row in the shot carries exactly one, in the Performance cell. #147's ruling is honoured — no per-cell triggers anywhere. |
| **`vs follower count` on row 3** | Correct, and worth flagging because it looks like a Tier 3 leak and is not. `DESIGN-3B` §5 line 73 gives it as `REACH_ONLY` **follower-denominated** — *"A different phrase from the above even though the stored enum is the same."* Tier 3's `rough — vs audience size` is a different string and does not appear here. |
| **The live cold-start counter** | `0 of 5 reels` / `2 of 5 carousels` + `builds as you analyse more`, muted, no rose, no `—`. The figure and its format noun are in **one element** (`AnalysisTableRow.tsx:224`), so no width can separate them — R-C1 and R-C3 hold, and per `TDD` §14.8a the live count is **correct behaviour**, not a bug. |
| **`≈` on follower-denominated figures** | Present — `≈18.1%`. `helpers.ts:39`, mandatory, not conditional. |
| **The kind-split `Eng. / reach` reasons** | `not published for image posts` on the image carousel; `no post-level reach` reserved for video (`helpers.ts:346-349`). R-13.5.2's forbidden collapse did **not** happen — and A5 must not be read as licence to collapse them later. |
| **Reach kind words** | `of 6.0K plays` on reels, and the `UNKNOWN` reach kind is filtered to an honest `—` rather than guessed as "views" (`AnalysisEngagementCell.tsx:40`, `helpers.ts:19-32`). R-4.3.1 holds. |
| **No worked division anywhere** | No quotient, no `÷`, no `x / y` in any visible cell. R-13.3.4 holds. |
| **No aggregate row** | The footer declines totals in words. The *sentence* is withdrawn (**H2**); the **decision** is intact and is not reopened here. |
| **Sink group behaviour** | Scoreless rows below a visible, counted, correctly-worded divider, each keeping its own reason in its own cell. R-S1 / R-S2 hold. |
| **Pip fill colours per axis** | `bg-muted-foreground` for content, `bg-primary` for performance (`AnalysisScoreCell/constants.ts:5-8`) — §5 Trap 3's second mitigation, shipped and working. |
| **The Performance cell's second line** | Renders unconditionally, structurally (`AnalysisScoreCell.tsx:58`), so §5's *"a Performance cell with no second line is a bug"* is enforced by the JSX rather than by review. |

---

## Addendum — the Content column *(2026-08-13)*

**Status:** Still audit only. **No code was changed and no design document was changed by this addendum.** One rule is **proposed** and marked **NEW**; it is not written into `DESIGN-3C` and must not be until the owner rules on it.

**Why there is an addendum.** The original capture cropped the Content column out of frame, so the audit recorded it as unaudited. The owner supplied a wider capture — `~/Desktop/wider table.png`, same six analyses, same creator, same density — with a specific report:

> *"the caption is truncated in the mockup but not in the real table"*

**That report is confirmed, in full, with the mechanism.** What follows audits the whole column, not just the caption, and corrects one thing the earlier audit got wrong.

**Inputs.** Wider capture as above; mockup at **`3b1ef89`** (the audit header cites `f0ac16f`; the file has since moved for #213, and the Content-column markup is unchanged between them — line numbers below are at `3b1ef89`); `DESIGN-3C` **§2.2 as the layout authority**, with §2.1, §3.1, §3.2, §3.3, §5.4, §9.3; implementation at `app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell/**`.

**Addendum headline.** The caption is the finding, and **the caption is a spec gap**. §2.2 asks for a *"caption snippet"* and then never defines *snippet* — no clamp, no line count, no character limit, no ellipsis, anywhere in the document. The mockup truncates to one line; nothing approved says it must. The developer applied a rule that *does* exist (§3.1's "line 2 is never truncated"), which was written for denominator qualifiers and not for unbounded user text, and left a comment saying exactly that. **No one did anything wrong here and there is nothing to blame a developer for. The rule is missing, and writing it is my job.**

---

### MEDIUM

---

#### M9 — The caption is unclamped, and on half the visible rows it is what sets the row height *(the owner's report — CONFIRMED)*

**Mockup.** Line 161: `<div class="text-[11px] text-mutedfg truncate" data-l2>resep andalan anak kos, cuma 5 bahan…</div>`. Same at `:246`, `:282`, `:322`, `:387`. **One line, `truncate`, CSS ellipsis.**

**Implementation.** `AnalysisContentCell.tsx:58-62`:

```tsx
{/* PR #198 review blocker 7 — line 2 is never truncated; the column widens instead if
    the text doesn't fit. No `truncate` class here, deliberately. */}
{!failed && comfortable && caption && (
  <p className="text-xs text-muted-foreground">{caption}</p>
)}
```

No `truncate`, no `line-clamp`, no character cap, no ellipsis — and a comment saying the omission is deliberate and citing its authority.

**Screenshot — the evidence, counted in lines rather than pixels.** Caption line counts, top to bottom: **2, 2, 4, 4, 3, 2**. Row 4's caption runs *"Share ke temen kalian yang butuh denger ini ya. Btw ini figurative ya. Gw ga punya macbook. In fact dr 2015 gw ud ga pake laptop sampe hari ini 🤭"* across four wrapped lines.

**And here is the mechanism the owner suspected.** Counting rendered lines per cell, the tallest cell in each row is:

| Row | Content cell | Tallest other cell | Row height set by |
|---|---|---|---|
| 1 Livestream Daging | 3 (title + 2 caption) | 3 (Performance) | tie |
| 2 Nasihat Pak Sandi | 3 (title + 2 caption) | 3 (Performance) | tie |
| 3 Mencari Telur Ajaib | **6** (title + chip + 4 caption) | 4 (Counts) | **Content** |
| 4 "MacBook Mau Kapan?" | **5** (title + 4 caption) | 3 (Performance) | **Content** |
| 5 "Tanya Theresa" | **4** (title + 3 caption) | 3 (cold-start) | **Content** |
| 6 Sukses dengan Menguasai | 3 (title + 2 caption) | 3 (cold-start) | tie |

**On three of six rows the Content cell is strictly the tallest cell in its row**, and on those three the caption alone accounts for every line above the tie. Clamp the caption to one line and the Content cell stops setting row height anywhere in this capture — the tallest cell in the table becomes row 3's four-line Counts cell, and that one is **H3**'s problem, not this one. **The owner is right: uncontrolled caption length is a direct cause of the shipped table looking heavier than the mockup, and it is the largest single cause.**

**It also compounds two findings already recorded.** With `align-middle` (**M8**), a six-line Content cell pushes every short cell in that row to float in the middle of a tall row, which is what breaks §3.1's *"Line 1 is the number, Line 2 is the qualifier"* cross-row grid. And unequal row heights are the other half of *"the font size looks off"* (**M8** again). M9 is the input; M8 is the amplifier. **Neither is a re-litigation of the other** — M8 is alignment and type scale, M9 is content length.

**What the spec actually says about caption length — the honest answer: nothing.**

| Where | What it says | Does it bound the caption? |
|---|---|---|
| §2.2, column 1 | *"Thumbnail (with kind + slide-count overlay), **title/caption snippet**, mode chip when not `full_video`, failure reason when failed"* | **No.** *"Snippet"* is the only signal in the document and it is never defined. |
| §2.1, the collapsed-column table | badge on the thumbnail, *"a chip under the title"* | No — concerns the badge and chip only. |
| §3.1, the wireframe | draws `5 Menit — resep…` on one line, with a typed ellipsis | It **depicts** a clamp. It states no rule. |
| §3.1, the prose rule | *"**Line 2** is the qualifier that §13.7 requires. Line 2 is never optional and never truncated to nothing — if it does not fit, the column is too narrow and gets widened, not the text shortened."* | **This is the rule the code followed**, and it is about **qualifiers** — denominators, tier phrases, `based on N`. Note it forbids truncating line 2 *"to nothing"*, which an ellipsised caption is not. The rule is genuinely ambiguous read against a caption, and the developer's reading is defensible. |
| §3.2, Compact | *"What Compact loses: **the caption snippet**, the platform word…"* — and the binding list of what no density may drop (denominator, tier, sample size, provisional badge, absent-score reason, format noun, cited figure) **does not include the caption** | **The caption is explicitly droppable.** This is the load-bearing fact for the proposal below. |
| §3.3, failed rows | *"The title cell shows the caption snippet greyed"* | No. |
| §10, accessibility | nothing on caption length | No. |

**No clamp. No maximum line count. No character limit. No ellipsis rule. Anywhere.** This is a **spec gap**, and the fix is a new rule, not a bug report.

**The mockup is not the authority either, and I want to be exact about why.** Line 161's caption is `resep andalan anak kos, cuma 5 bahan…` — the `…` is a **literal character typed into the string**, on a div that *also* carries `truncate`. The mockup fakes the ellipsis in its content and applies a truncation class on top of it. That is not the artefact of someone who reasoned about a clamp; it is someone typing a plausible-looking short caption. **"The mockup does it" is not a ruling**, and I am not asking the owner to treat it as one.

**Severity: MEDIUM.** By this audit's own scheme — high = *changes what the user understands* — this does not qualify. No number is wrong, no denominator is missing, no sentence is false, and a longer caption is if anything *more* information. I am not inflating it. **But by user-visible effect it is the top item in this addendum**, and the owner named it unprompted from a screenshot, which is the strongest signal a design finding gets.

**Resolution — a NEW rule, proposed, for the owner's ruling.**

> ### R-D17 — **APPROVED 2026-08-13 by the owner. `N` = 2, Option B.**
>
> **Status flipped from `NEW / PROPOSED / NOT APPROVED`.** The rule below is superseded as an audit proposal by its approved form, which now lives where design rules live: **`DESIGN-3C-analyses-table.md` §2.2.1** (amendment **A8a**), beside the word *snippet* it defines. **§2.2.1 is the authority; this block is kept as the record of how the rule was reasoned, not as a second copy to build from.** The build block on item 8 of the ticket grouping is lifted.
>
> **The Content column's caption snippet is line-clamped. Nothing else in the table is.**
>
> - **Comfortable:** the caption renders at most **two lines** — **ruled: Option B** — and CSS-ellipsises the last clipped line. **When the caption is shorter than the clamp it renders at its natural height with no ellipsis and no padding to a fixed box** (§2.2.1 — the clamp is a ceiling, never a floor).
> - **Compact:** the caption is not rendered at all. **Unchanged** — §3.2 already says this.
> - **The title is unaffected.** It stays a single truncated line with an ellipsis, which is what ships today and what the mockup draws. The title is already correct and this rule must not be read as touching it.
> - **CSS clamp only** (`line-clamp-{N}`). The full caption **stays in the DOM**, so a screen reader still reads it whole and §10's semantics are untouched. A JS substring, which would delete text from the accessibility tree, is out of bounds.
> - **No `title` attribute, no tooltip, no popover, no hover-reveal of the remainder.** §8 forbids a native `title`; **R-8.4.7 / R-13.6.2** forbid hover-gating. The clipped tail is simply not shown in the table. The post's own surface is where a full caption belongs.
> - **Scope, stated so it cannot be widened:** R-D17 binds **the Content column's caption and nothing else**. §3.1's *"line 2 is never truncated"* stands **untouched** for every denominator qualifier, tier phrase, confidence word, `based on N …`, cold-start figure with its format noun, and every absent-score reason and any figure it cites. If a *qualifier* does not fit, §3.1's answer is still the correct one: **widen the column**.
> - **Why this breaks no information rule.** §3.2's binding list of what no density mode may drop does not include the caption, and §3.2 already drops it **entirely** at Compact. A caption is identification material, not an explanation — it is not a denominator, a tier, a sample size or an absent-score reason. Clamping at Comfortable is strictly less lossy than what §3.2 already approves at Compact.
> - **R-13.5.3a and R-13.3.4 checked and not engaged.** A clamped caption states no facts, shares no sentence with a second fact, and shows no division.

**Two options for N — the owner picks one.**

| | **Option A — one line** | **Option B — two lines** *(my recommendation)* |
|---|---|---|
| Rule | `line-clamp-1` (equivalently `truncate`) | `line-clamp-2` |
| Matches | the mockup exactly | not drawn anywhere yet |
| Content cell height | **always 2 lines** (3 with a mode chip) | 2–3 lines (3–4 with a chip) |
| Effect on this capture | Content never sets row height on any row | rows 3, 4 and 5 drop from 6, 5 and 4 lines to 4, 3 and 3; Content ties but never exceeds |
| Nearest to §3.1's 68px | **yes** | close, not exact |
| What the user loses | a lot. Row 4's caption gets ~9 words of 30. At 300px minus a thumbnail, one 11px line is roughly 30–35 characters — often less than one clause of an Indonesian caption | the first sentence usually survives |
| Risk | the snippet becomes decorative — too short to identify a post by, which is the job §2.2 gave column 1 | rows stay slightly unequal |

> **RULED 2026-08-13 — Option B, two lines.** The recommendation below was accepted, on its stated reason: **column 1 must still be able to identify the post, and a one-line clamp reduces some real captions to text that identifies nothing.** Option A is spent — it is not a fallback, not a Compact variant, and not something to reach for if rows come out taller than expected. The full rule, including the shorter-than-clamp case the options table never covered, is **`DESIGN-3C` §2.2.1**.

**I recommend Option B.** The mockup's one-line treatment was drawn against short invented captions; the real ones in this capture are long, conversational and front-load nothing, and one line of *"Share ke temen kalian yang butuh denger ini ya. Btw…"* identifies almost nothing. Two lines bounds the row and still lets the caption do its identification job. **But A is the tighter table and the owner may simply prefer it — this is a taste call on his product and I will build to whichever he picks.**

**And a second ruling I need with it:** whichever N wins, **§2.2's word *"snippet"* should be given its definition in §2.2, beside the word**, because that word has been silently carrying this requirement since 2026-08-06 and is where the next reader will look. That is a spec edit, and this audit does not make spec edits.

> **DONE 2026-08-13.** The definition is written into **`DESIGN-3C` §2.2.1**, beside the word, and §2.2's column-1 row now points at it. The root cause was fixed with it: **§3.1's *"line 2 is never truncated"* is now explicitly scoped to qualifiers**, so it can never again be read as governing unbounded caption text. *(Amendment A8a / A8c.)*

---

#### M10 — The thumbnail is a 40px square; §3.1's wireframe and the mockup both draw a portrait tile — **REJECTED 2026-08-13. The thumbnail does not change.**

> **OWNER RULING, 2026-08-13 — M10 is REJECTED and this is not reopenable.** **The shipped 40 × 40px square thumbnail stays.** The owner looked at the real table and stated plainly that he likes it as it is. There is no portrait tile, no 44 × 56px, no aspect-ratio change and no ticket.
>
> **The mockup was the stale artefact here, and the mockup is what changed** — its seven `w-11 h-14` tiles are now `w-10 h-10`. **Code was not moved to match a mockup; a mockup that proposed a rejected tile was corrected.**
>
> **The reasoning, recorded so this is not re-argued:** (1) it is the owner's stated preference on his own product, given from the real UI, which settles it on its own; (2) **this finding's own arithmetic already cut this way** — `py-3` + a 56px tile is an 80px floor before a line of text is laid out, over §3.1's own figure, and the square tile is the only reason short rows come near it; (3) the identification cost of a square `object-cover` crop is **real, weighed and knowingly accepted** — a trade that was made, not one that was missed.
>
> **The one live consequence: M11 is now unavoidable.** Part 3 below says *"if the owner keeps the square tile, the badge needs its own answer."* He has. See M11.
>
> The finding as written is preserved below, unedited, as the record of what was proposed and declined.

**Mockup.** `:156`, `:200`, `:242`, `:280`, `:320`, `:351`, `:385` — `class="thumb w-11 h-14 rounded shrink-0 relative"`. **44 × 56px, portrait, ~4:5.**

**§3.1's wireframe.** The `▓▓▓` block is drawn on **all three** text lines of each row, i.e. a tile as tall as the cell — a portrait tile, not a square one.

**Implementation.** `AnalysisContentCell.tsx:37` — `className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted"`. **40 × 40px, square**, with `object-cover` on the image at `:41`.

**Screenshot.** Every thumbnail is visibly square. Row 1's is a centre crop of a 9:16 reel frame; row 3's carousel cover is cropped hard enough that its text panel is cut top and bottom.

**Severity: MEDIUM.** Nothing false — but every post in this library is 9:16 or 4:5 source, and a square `object-cover` crop discards more of each frame than a portrait tile does. Column 1 is the **identification** column (§2.2's column-order rationale: *"Identification (1–3) → raw evidence (4) → …"*), and identification is exactly what the crop is spending.

**One honest complication, and it cuts against the mockup.** `py-3` + a 56px tile = **80px minimum row height in the mockup**, which **exceeds §3.1's own 68px** before a single line of text is laid out. The shipped `p-3` + a 40px tile = **64px**, which fits under 68. **So the square thumbnail is currently the only reason the shortest shipped rows come near §3.1's number.** Restoring the portrait tile makes §3.1's 68px arithmetically unreachable — which strengthens rather than weakens **M8**'s resolution note that **68px is the figure that should change, in §3.1, with the owner's agreement.** Do not restore the tile and leave 68px in the document; that would leave the spec self-contradicting.

**Resolution.** Owner's ruling, and it should be taken **together with M8 and M9** — thumbnail height, caption clamp and row height are one arithmetic problem with three inputs, and solving them separately means solving them three times.

---

#### M11 — The kind badge is tinted for a surface it never sits on: it sits on a photograph

**Spec.** §9.3's badge table: `| Neutral (kind, mode) | bg-slate-300/10 text-slate-300 | 11.63 | 11.25 | 10.36 | 9.31 |` — measured *"on background / on card / on hover / on muted"*. §9.1's whole method is foreground-on-composited-tint **against a known surface token**.

**Implementation.** `AnalysisContentCell.tsx:44` — `absolute right-0 bottom-0 rounded-tl bg-slate-300/10 px-1 py-0.5 text-[9px] leading-none font-medium text-slate-300`. The header comment at `:11-14` records a re-measurement — **11.87 / 11.20 / 10.53 / 9.85** on background / card / row-hover / muted — which is diligent, correct method, and **measures four surfaces the badge is never on.** The badge is positioned over the thumbnail `<img>`.

**Mockup.** `:157` — `bg-slate-300/**20**` for the kind badge on the thumbnail, and `bg-slate-300/**10**` for the mode chip below the title (`:205`, `:353`). **The mockup used double the tint for the over-image badge specifically.** The shipped code uses `/10` for both, so the one badge that needed the heavier backing got the lighter one.

**Screenshot.** Row 1: `Reel` renders in slate over a bright white t-shirt, with a `/10` tint doing effectively nothing — it is legible only because the reader knows what word to expect. Row 3: `Carousel` spans **the full 40px width of the tile, edge to edge**, over a photographic strip, with its `px-1` padding pushed off both sides.

**Severity: MEDIUM.** §9.5 is satisfied — the kind is a **word**, not a colour or an icon, so WCAG 1.4.1 holds and AC-13's *"the labelled badge is in the rendered text"* holds. And PR #203's blocker 2 fix is **correct and worth restating**: the badge is a sibling **outside** the `aria-hidden` thumbnail scope (`:38` vs `:44`), so it reaches the accessibility tree. **A screen-reader user is fully served here. A sighted user reading a badge over a white shirt is not**, and WCAG 1.4.3 has no defined ratio against arbitrary photography, which is precisely why a badge over an image needs a treatment that does not depend on what the image is.

**Resolution.** Three parts, all cosmetic, none of them changing a word:
1. Give the over-image badge a backing that does not depend on the photo — the mockup's `/20`, or a small opaque scrim. **Record the measurement against the scrim, not against the four surface tokens** (§9.1 / AC-17); the four-token measurement in the comment is correct method pointed at the wrong surface and should not simply be re-run.
2. Move the badge to **bottom-left** (mockup `:157` — `bottom-0.5 left-0.5`) rather than the shipped `right-0 bottom-0`. Left-aligned it starts at the reading edge; right-aligned, a longer word grows leftward across the subject's face.
3. The word `Carousel` filling a 40px tile is a **width** problem that **M10** solves — a 44px tile plus the mockup's inset gives it room. If the owner keeps the square tile, the badge needs its own answer.

> **STILL OPEN after the 2026-08-13 rulings, and now unavoidable — part 3's condition has fired.** **M10 was rejected: the tile stays 40 × 40px square**, so the width half of this finding has no solution left in M10 and needs its own. **I am not ruling on this one, and I want to be exact about why: the thing I would have to measure is not measurable by this audit's method.** §9.1 measures a foreground against a **known surface token**; this badge sits on **an arbitrary user photograph**, and WCAG 1.4.3 defines no ratio against arbitrary photography. Re-running the four-token measurement more carefully produces a more precise number about four surfaces the badge is never on.
>
> **What I need in order to rule, stated concretely — three things, none of which I can get on my own:**
>
> 1. **An owner preference between three approaches, which I will mock up on request.** (a) **Opaque scrim** — a solid or near-solid backing behind the badge, which makes the photo stop participating and turns the measurement back into a fixed, measurable text-on-known-surface pair. (b) **Heavier tint only** — the mockup's `/20` instead of the shipped `/10`, which is cheaper but still leaves the ratio dependent on the image underneath, so it can only ever be *"better"*, never *verified*. (c) **Move the badge off the image** — under or beside the thumbnail, on a real surface token, which makes §9.1's existing method apply unchanged and is the only option that is provably compliant, at the cost of a line of vertical space in the cell that the row-height work has just been spent buying back. **This is a taste-versus-provability call on the owner's product, and it is his to make, not mine.**
> 2. **A 1:1, unscaled capture of the shipped table with at least one light/high-key thumbnail in frame** — the row-1 white t-shirt case is the worst case I have seen and I have only seen it in a scaled screenshot. **This audit's own method note forbids me eyedropping a scaled PNG**, so I cannot honestly measure the current state without it.
> 3. **Confirmation that the kind vocabulary is closed.** `AnalysisContentCell/constants.ts` enumerates exactly four labels — `Reel`, `Post`, `Carousel`, `Short` — so **`Carousel` is the longest word the badge can ever hold** and the width problem is bounded and solvable rather than open-ended. If a fifth, longer kind is coming, the sizing answer changes and I need to know before I give one.
>
> Until 1 is answered, any change here would be me picking the owner's aesthetic for him on a surface he has just told me he likes.

---

### LOW

---

#### L6 — The slide-count half of the `kind + slide-count` overlay does not ship — and §5.4 quietly leans on it

**Spec.** §2.2, column 1: *"Thumbnail (with **kind + slide-count** overlay)"*. Mockup: `Carousel &times;10` (`:201`, `:243`, `:352`), `Carousel &times;8` (`:385`).

**Screenshot.** `Reel`, `Carousel`. **No count, on any row.**

**Implementation.** `AnalysisContentCell/constants.ts:3-9`, verbatim:

> *The slide-COUNT half of that overlay is NOT rendered — `AnalysisListItem` (the #144 API response, `lib/api/analyses/types.ts`) carries no slide/media-part-count field, and inventing one would be a fabricated number (AGENTS.md external-verification rule / R-13.5.3a). Flagged in the PR body rather than guessed; the kind word alone is still real, verified data.*

**The developer was right, said so, and said why.** This is a data gap correctly declined, not a fidelity defect, and it is the second place in this audit where a developer stopped rather than invent (cf. **H4**, **L4**).

**What is new, and why this is worth a finding at all.** `DESIGN-3C` **§5.4** justifies its own wording by pointing at this overlay: *"`slide 1` rather than `the first slide` for width; **the table already uses one-based slide language in the Content column's `Carousel ×10` overlay**."* That justification rests on a thing that **does not render**. §5.4's copy is not wrong and does not need changing — `slide 1` is good copy on its own merits — but its stated reason is currently false, and a future reader will take it as evidence that the overlay ships.

**Severity: LOW.** No user is misinformed; the kind word alone is true.

**Resolution.** Owner's ruling, two independent parts:
1. **The mockup is the stale artefact.** It draws `Carousel ×10` — data the #144 response does not carry. Either add a media-part count to the list payload (a **#144 scope change**, not a UI ticket) or redraw the mockup's overlay as the bare kind word. **Flagged for the owner rather than changed here**, per this audit's standing rule that I do not edit the mockup to match code or code to match the mockup.
2. If the count is never carried, **§5.4's parenthetical reason should be amended** to stop citing an overlay that does not exist. That is a spec edit and this audit does not make spec edits.

---

#### L7 — The mode chip takes a line of its own **above** the caption; the mockup gives it line 2 **instead of** the caption

**Mockup.** Rows with a chip render `title` then the chip, and **no caption at all** (`:204-205`, `:352-353`). Rows without a chip render `title` then the caption. The chip **occupies** line 2; it never stacks on top of one.

**Implementation.** `AnalysisContentCell.tsx:53-62` — the chip and the caption are independent conditionals. Both render when both are present, chip first.

**Screenshot.** Row 3 is the only chipped row: `Mencari Telur Ajaib di New York` / `Images only` / four lines of caption = **six lines**, the tallest cell in the table.

**Also drifting, in the same element.** Chip is `text-[10px] px-1.5 py-0.5` (`:54`) against the mockup's `text-[9px] px-1.5 py-0.5` (`:205`). At 10px semibold on a tinted pill, sitting directly under a 14px title (**M8**), it reads with nearly the weight of the title.

**What the spec says.** §2.1's collapsed-column table: *"a chip under the title (`Caption only` / `Images only`) shown **only when the mode is not `full_video`**"*. **"Under the title" is satisfied by both layouts.** The spec does not say whether the chip replaces or precedes the caption — so, as with M9, the mockup depicts a decision the document never recorded.

**Severity: LOW.** The chip's **words**, its **condition** and its **position under the title** are all exactly right, and AC-13 is satisfied — `Images only` is real rendered text, not a colour or an icon. This is stacking and size only.

**Resolution.** Fold into whatever the owner rules on **M9**. If the caption is clamped, the stacking question mostly dissolves: chip + a clamped caption is 3–4 lines, not 6. If the owner prefers the mockup's exact behaviour, note that **suppressing the caption on chipped rows costs real information** on precisely the rows — `Caption only` — where the caption is the *only* thing that was analysed. **I would keep both and clamp**, rather than replicate the mockup here.

---

#### L8 — `Untitled` is invented copy, and when `title` is null the caption renders twice

**Implementation.** `AnalysisContentCell.tsx:49-50`:

```tsx
<p className={cn("truncate text-sm font-medium", failed && "text-muted-foreground")}>
  {title || caption || "Untitled"}
</p>
```

`title` and `caption` are both `string | null` (`types.ts:4-5`). Two consequences:

1. **`Untitled` appears in no design document.** Grepping `docs/` for it returns nothing. It is a developer-chosen user-facing string — a small one, and a reasonable one, but unapproved, and this project's standing rule is that copy is written where copy is written.
2. **When `title` is null and `caption` is not**, the caption renders **as the title** (bold, truncated to one line) and **again** on line 2 (muted, unclamped, in full) — the same sentence twice in one cell, the second time longer than the first. The fallback ladder was written for the title slot in isolation and the line-2 conditional at `:60` does not know the ladder consumed the caption.

**Screenshot.** **Neither is visible.** All six rows carry a distinct title and a distinct caption. This finding is read from source and I am labelling it as such — it is a latent defect, not something the owner is looking at.

**Severity: LOW.** Nothing on screen is wrong. Duplication would be noticeable but not misleading, and the mockup's failed row (`:415`) suggests a better fallback already exists in the design's own thinking: it shows the **post URL** greyed (`instagram.com/reel/DXk9…`) rather than a generic word.

**Resolution.** Two small rulings, no urgency. (a) Approve or replace `Untitled` — the mockup's URL-as-fallback is worth considering, since a URL identifies a post and `Untitled` identifies nothing. (b) Suppress line 2 when the ladder has already consumed the caption. Both belong in the same ticket as **M9**, since both are the caption line.

---

#### L9 — The failed row: the rose edge **is** built; the reason text is not, and its colour is unspecified

**Closing an item the earlier audit left open**, from source rather than from a screenshot — no failed row appears in either capture.

**Built and correct.** `AnalysisTableRow.tsx:82` — `failed && "border-l-[3px] border-l-rose-500"`, matching §3.3's *"A 3px rose left edge marker."* `:174` renders `Not analysed` in the Performance cell, matching §3.3's requirement that a failed analysis never borrows an absent-score reason. The Content cell greys the title (`AnalysisContentCell.tsx:49`) and suppresses the caption on failed rows (`:60`), so §3.3's *"caption snippet greyed"* is **half** satisfied — greyed, but the snippet itself is not shown.

**Not built.** `AnalysisTableRow.tsx:50` — ``const failedLabel = failed ? (row.status === "failed" ? "Analysis failed" : "Queued") : null;``. §3.3 asks for `Analysis failed — {reason}` and `Queued · position 4`; **both the reason and the queue position are dropped**, and the comment at `:41-45` flags both as absent fields rather than guessing them. **Right call again** — a fabricated failure reason is the R-13.5.3a class exactly.

**Unspecified.** The label renders `text-xs text-muted-foreground` (`AnalysisContentCell.tsx:52`); the mockup draws it `text-rose` (`:416`). §3.3 puts rose on the **left edge** and says nothing about the reason text's colour, and §9.3's `bg-rose/12 text-rose` is a **badge** pattern, not a text-colour rule. **So there is no rule to have broken here** — it is another undefined corner, smaller than M9's.

**Severity: LOW,** and unverifiable in the shipped UI until a failed row can be captured.

**Resolution.** Owner's ruling on the reason-text colour, alongside **L4**'s failed-group divider sentence — which is the copy I still owe `DESIGN-3B` §5. Both are blocked on the same thing: nobody has yet seen a failed row on screen.

---

### Correction to the merged audit — L4's reconstructed count was wrong

**What L4 says:** *"the screenshot's `…separately` is the tail of `6 posts with no performance score — sorted separately`, verbatim from §6.1."*

**What the wider capture shows:** **`2 posts with no performance score — sorted separately`**, with exactly two rows beneath it.

**What I got wrong.** The original capture cropped the divider's leading text, so I reconstructed it from **§6.1 R-S2's example string**, which reads `6 posts with no performance score — sorted separately`. **The `6` in the spec is an illustrative count, not a literal.** `AnalysisDataTable.tsx:247` builds the label from the group size, with correct singular/plural handling:

```tsx
label={`${groups.scoreless.length} post${groups.scoreless.length === 1 ? "" : "s"} with no performance score — sorted separately`}
```

**What survives.** The §6.1 / R-S2 citation is correct, the string's shape is correct, R-S2's *"visible, labelled and counted"* is satisfied — and it is satisfied **better** than L4 claimed, because the count is live rather than fixed. L4's actual finding, that the divider is styled as body text (`text-xs font-medium`) against the mockup's `text-[10.5px] uppercase tracking-wider`, is **unaffected and stands**.

**Stating it plainly:** I asserted a string was "verbatim" when I had only seen its last word. That was a reconstruction presented as evidence, and the method note at the top of this audit exists precisely to stop me doing that. The correction is the finding.

---

### Correct as shipped in the Content column

| | Verdict |
|---|---|
| **Title truncation** | `truncate` at `AnalysisContentCell.tsx:49` — single line, CSS ellipsis, exactly the mockup's `:160`. **The title was never the problem**; only the caption below it is (**M9**). |
| **Mode chip words and condition** | `Caption only` / `Images only` (`constants.ts:18-21`), rendered **only** when the mode is not `full_video` (`:33`), under the title — §2.1 word for word. AC-13 satisfied: real text, never colour or icon alone. Only its stacking and size drift (**L7**). |
| **The kind badge reaches assistive technology** | `AnalysisContentCell.tsx:38` `aria-hidden`s **only** the image wrapper; the badge at `:44` is a **sibling outside** that scope. PR #203's blocker 2 fix is correct and holds — an `aria-hidden` ancestor would have removed the badge from the tree regardless of its own attributes. |
| **The thumbnail image is decorative** | `alt=""` on a `aria-hidden` wrapper (`:38-42`). Correct — the kind word and the title carry the meaning, so the image adds nothing a screen reader needs. §10 holds. |
| **No `ⓘ` anywhere in the Content column** | Confirmed in the wider capture. **#147's one-`ⓘ`-per-row ruling holds across the full row width**, which the cropped shot could not establish. The single `ⓘ` per scored row is still the Performance cell's. |
| **No fabricated slide count** | See **L6** — declined in code with its reason written down. |
| **Column 1 width** | The wider capture puts the Content column at ~23% of the table's rendered width against §2.2's 300 / 1288 = 23.3%. Consistent with the audit's source-read finding that `constants.ts:15-57` matches §2.2 field for field. **Not a new finding** — a visual confirmation of one already recorded. |
| **`Showing 6 of 6 analyses.`** | On screen, above the table card, matching `AnalysisFilterSection/helpers.ts:12`. Previously listed as unverified. |
| **The `Columns` trigger and the Density toggle** | Both present in the toolbar, `Comfortable` selected. The affordances exist; the menu's **contents** remain unverified (see "does not cover"). |

---

## Suggested ticket grouping

Not a plan — the owner decides what gets ticketed. Grouped by what would sensibly land together.

1. **Copy restoration (H1, H2).** Two string literals plus their tests, plus R-D11's footer wrap. Smallest diff on this page, largest effect on what the owner reads.
2. **The Counts comment count (H3).** Data contract first, then the cell. Includes the `aria-hidden` defect.
3. **§5.5's three states (H4).** Needs the derived cell to distinguish rows 8, 9 and `INSUFFICIENT_HISTORY`. Do not let it collapse to two.
4. **The §9 typography and colour pass (M1, M2, M4, M5, M8, L2, L3).** One ticket. Every item is a class change plus one measurement, and doing them piecemeal means measuring the same surfaces four times. AC-17's ratios go in that PR body.
5. **The `Early` badge (M6).** Styling only — condition, column and word are already correct.
6. **A6/B7's header tooltips (M7).** New build, bounded by R-D5…R-D11.
7. **Owner rulings needed, no code:** ~~L1 (the Counts reason string — mockup or implementation?)~~ and ~~L4 (the failed-group divider sentence, which I owe `DESIGN-3B` §5)~~ — **both DROPPED by the owner on 2026-08-13; no fix in either direction and no ticket, see the notes on L1 and L4.** Still live: **§3.1's 68px row height**, which the 2026-08-13 arithmetic shows M8's fix cannot reach — a replacement figure is now **proposed** in `DESIGN-3C` §3.1 and awaits the owner.

*Added by the addendum:*

8. **The Content cell's vertical arithmetic (M9, L7, and M8 from the list above).** ~~**Blocked on one owner ruling first** — R-D17's line count, Option A or Option B.~~ **UNBLOCKED 2026-08-13: R-D17 is approved at two lines and is written into `DESIGN-3C` §2.2.1, so there is now a rule to build against.** **M10 is out of this group — it was rejected; the 40px square thumbnail is a fixed input, not a variable.** Two inputs remain open and both are in `DESIGN-3C` §3.1's open list: **L7's chip stacking**, and the **68px → 64px** replacement. Caption clamp and row height are still one arithmetic problem — do not solve them in separate PRs.
9. **The kind badge over the thumbnail (M11).** Backing, position, and a contrast measurement taken against the **scrim** rather than the four surface tokens. Changes no word. ~~Sequence after the M10 ruling, since the tile width decides whether `Carousel` fits.~~ **The M10 ruling has landed and it keeps the 40px square, so the width problem now has no solution outside this item.** Still an owner ruling, not an implementation choice — the three things I need before I can rule are listed under M11.
10. **The Content cell's fallback ladder (L8).** Approve or replace `Untitled`, and stop the caption rendering twice when it has been promoted into the title slot. Same file as item 8 — land together.
11. **More owner rulings, no code — the list as it stands after 2026-08-13.** **Still open:** the mockup's `Carousel ×10` overlay, which draws a field the #144 payload does not carry (**L6**), and §5.4's parenthetical that cites that overlay as precedent; the failed row's **reason-text colour** (**L9**); and **M11**, the kind badge over a photograph (item 9). **Closed:** ~~a definition of the word "snippet" written into §2.2~~ — **done, `DESIGN-3C` §2.2.1, with §3.1's truncation rule scoped to qualifiers alongside it.**

## What this audit does not cover

*Updated 2026-08-13 by the addendum. Struck items were closed by the wider capture.*

- ~~**The Content column**~~ — **closed.** Audited in the addendum from `~/Desktop/wider table.png`: thumbnail, kind overlay, mode chip, caption line and title truncation are findings **M9–M11 / L6–L8**. The failed row's rose left edge is **built** and confirmed from source (`AnalysisTableRow.tsx:82`, `border-l-[3px] border-l-rose-500`) — see **L9**; it is still not *visually* confirmed, because no failed row exists in either capture.
- ~~**`Showing N of M analyses`**~~ — **closed.** `Showing 6 of 6 analyses.` is on screen in the wider capture, above the table card, matching `AnalysisFilterSection/helpers.ts:12`. **The filter chip row itself is still cropped** (only the bottom edge of the chips and the search field is in frame), so the chips' labels, states and the `No results match your filters` variant remain unverified.
- **Compact density, the loading / empty / error states, the popover contents, and the Style column** — none appear in either shot. §3.2's rule that no density may drop a denominator, a format noun or an absent-score reason is **untested by this audit**. Note that §3.2 also drops the caption snippet at Compact, which **M9** relies on.
- **The Columns menu's contents.** The `Columns` trigger and the `Density · Comfortable | Compact` toggle are both visible in the wider capture, so the affordances exist. The menu is closed in the shot, so **whether it carries a Style entry — the only route to the Style column on every load (A4a) — is still unverified**, and a missing entry ships Style as dead code.
- **Measured contrast ratios.** Everything in §9 is stated as a required value here; none of it was re-measured against the app's real tokens. §9.1 asks for that at implementation time, and M4/L2 are the point at which it is owed. **M11 adds a surface §9.1's method never had: a photographic thumbnail**, which no token measurement can cover.
