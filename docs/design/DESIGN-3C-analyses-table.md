# Design Decision Record — Phase 3C, the Analyses Table

**Status:** **PROPOSED — NOT APPROVED.** Nothing in this document is signed off. It is the mockup-review checkpoint that caveat **C2** of the PRD reserved, and the owner has not yet ruled. **No developer should start building from this file.** Two design directions are presented for the highest-risk decision (§4); the owner picks one.
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

**Neither amendment reopens a settled decision.** The column set, density, sort behaviour and the Direction A engagement split are unchanged. Both are copy/state corrections consequent on rules ruled on *after* the mockup review, and §5.3 largely brings this document into line with what the mockup already drew.

⚠️ **Note for the owner, not acted on here:** the status header above still reads *PROPOSED — NOT APPROVED* and §12's sign-off record is still empty, but `docs/HANDOFF-2026-08-06.md` §"Design / table (3C)" records the design as **approved, 12 columns cut to 9, engagement split Direction A**. That is a stale header, not a live question — but **recording an approval is the owner's act, not the designer's**, so I have left both untouched and am flagging them instead.

---

## 1. What this document decides, and what it does not

**Decides:** which columns exist by default and which are cut, how the two non-comparable engagement percentages are separated, how a 1–5 performance score renders inside a small cell, sort and filter behaviour, row density, and the empty/loading/error states.

**Does not decide:** the scoring model (PRD §3, confirmed), the stored contract (PRD §5, confirmed), or any copy string — every user-facing string lives in the companion explainability spec so that there is exactly one place to change wording.

**Exception, from amendments A1 and A2:** §5.3 and §5.4 do state exact wording, because in both cases the *structure* of the sentence is the requirement — a figure that can be separated from its format noun, or a diagnosis that can be rendered without its figure, is non-compliant however it is worded. **The companion spec remains the single home for these strings and must be updated to match in the same pass** (its §3, §5 row 5, and the §9 constants note still carry the withdrawn bare `3 of 5`). Where the two documents disagree, this one is the newer and the companion is the one to fix.

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

### 2.2 The proposed default column set

Left to right, at a 1440px viewport:

| # | Column | Width | Sortable | Carries |
|---|---|---|---|---|
| 1 | **Content** | 300px | no | Thumbnail (with kind + slide-count overlay), title/caption snippet, mode chip when not `full_video`, failure reason when failed |
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
- Line 2 uses `--muted-foreground` at full opacity (**no `/70`, no `/80`** — see §9.2; that opacity class is the exact thing that shipped non-compliant twice).
- Row hover raises the row to the hover surface and reveals nothing new. **No information is hover-gated anywhere in this table** (R-8.4.7, R-13.6.2).

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
| **Eng. / followers** | `—` <br> `no follower measure here` | `≈16.2%` <br> `of 284K followers` |

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

- **R-D1** No aggregate, total, average or "typical engagement" row exists anywhere in this table, in either direction (R-12.3.3). Where a user might reasonably expect one, the table footer says so in words: `No totals — these posts are measured against different things.` (R-13.6.3.)
- **R-D2** Any future CSV/export inherits the qualifier as its own column. A percentage that leaves this product without its denominator is the failure this whole section exists to prevent (PRD §13.7). Export is not in 3C scope; this is a standing constraint.
- **R-D3** A video-bearing carousel is reach-denominated but its reach is **derived from the first slide** (D4). Its qualifier reads `of 88.2K views · first slide only`, and it is the one reach-denominated figure whose confidence is one level lower. It sits in the reach column — it belongs there — but it must not read as an unqualified per-post reach.
- **R-D4** *(amendment A2)* The **mirror case of R-D3** — first slide is an image, a later slide has the count (`REACH_NOT_ON_FIRST_SLIDE`, §5.4) — has **no** reach-denominated figure and its `Eng. / reach` cell renders the reason `no post-level reach`. The later slide's count appears **once**, in the Performance cell, attached to the sentence that says what it is. **It must never appear in the Counts column, in either engagement column, or in any export**, because a figure in any of those positions is a per-post reach claim, and this row has no per-post reach.

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

### 6.3 Column visibility

A `Columns` menu at the right of the chip bar. Only the optional Style column is off by default. **Four columns cannot be hidden: Content, Performance, and both engagement columns** (or the single engagement column in Direction B) — hiding a denominator-bearing column is how R-12.3.1 gets violated by a user rather than by a developer. The menu shows them as locked with the tooltip `Always shown — this column carries information the numbers can't be read without.`

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
- **The explain affordance** has an accessible name phrased as the question it answers — `How was this score worked out?` — so a screen-reader user knows what opening it gets them.
- **No information anywhere is hover-only.** This is a correctness constraint (R-8.4.7, R-13.6.2), and it is also what makes the table usable by keyboard at all.

---

## 11. Open questions for the owner

Nothing below is decided. These are the ones I cannot answer alone.

1. **Direction A or Direction B for the engagement split (§4)?** I recommend A. This is the C2 sign-off the PRD reserved and it should be recorded explicitly.
2. **Do you accept cutting the Status column** in favour of a distinct failed-row treatment (§2.1)?
3. **Style (`formatArchetype` + `hookType`) default-on or default-off?** I propose off.
4. **Do you want the 1–5 performance score in the table at all?** Provocative, and I mean it: `3.2× their usual` is a *measured* number and by your own PRD (§3.1, §3.5) the most quotable thing this product makes, while the 1–5 is a *model judgement*. Keeping both costs 156px and creates the "score says 2 but the multiplier says 3.2×, which do I believe?" question. Keeping only the multiplier would be narrower and more defensible — but it loses the read on posts with no Tier 2 yet. I lean toward keeping both, with the score explicitly labelled as a judgement (see the companion spec §7). Worth your ruling.
5. **Default density** — Comfortable (68px, ~9 rows visible) or Compact (40px, ~15 rows)? I propose Comfortable.
6. **Should the table paginate or infinitely scroll?** Not specified in the PRD and it interacts with sorting. I propose pagination at 50 rows, because a sink group at the bottom of an infinite scroll is a sink group nobody ever sees.

---

## 12. Sign-off record

**Empty. This document is not approved.**

When the owner rules, the following must be recorded here by name, because the PRD (§13.8, caveat C2) requires the sign-off be explicit and *"we assumed the designer had handled it"* is precisely how R6 ships:

- [ ] **§12.3 / R-12.3.4 — the comparability treatment is signed off**, direction named.
- [ ] **§13 — the explainability surfaces are signed off** (see the companion spec's own record).
- [ ] The final default column set is recorded, with any owner-directed additions or cuts.
