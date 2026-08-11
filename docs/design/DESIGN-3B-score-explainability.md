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

> **Superseded 2026-08-09 — row 3's stored reason EXISTS. It is `CAUSE_NOT_DETERMINABLE`.** Row 3's *Stored reason* cell previously read, verbatim: *"needs a new value — see §5.1"*. That text is preserved here and is superseded; the cell now names the shipped value. **The value shipped in migration `012`, which is merged**, and is live in the `perf_unavailable_reason` `CHECK` constraint (`TDD` §5.2); migration `013` carries it forward when it adds `REACH_NOT_ON_FIRST_SLIDE`. The design requirement of §5.1 — that a value distinct from `REACH_HIDDEN` exists so string 3 can be rendered — **is met in the schema**, and has been for longer than this document said. **The name `PERFORMANCE_DATA_ABSENT` proposed in §5.1 was ruled against and is superseded** (`TDD` §5.3): naming was the tech lead's call and `CAUSE_NOT_DETERMINABLE` was chosen because it names the **epistemic** state — *we cannot tell why* — rather than the data state, which is precisely the distinction the value exists to hold. **Do not re-propose `PERFORMANCE_DATA_ABSENT`.** No copy string in this table changes: L1 stays `No performance data published` and L2 keeps its `We can't tell` clause, which R-13.5.3b protects. *(Issue #169 step 4; PR #179.)*

**All eight are distinct strings.** AC-30 tests four of them (1, 3, 5-as-history, 4) for distinctness plus a negative assertion on case 3.

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
