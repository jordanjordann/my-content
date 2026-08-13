# TDD — Phase 3: 3B performance scoring, 3C analyses table, 3A job queue, deployment

**Status:** **FINAL for 3B and 3C — tickets cut from this document.**
3A and deployment are specified here as **sections, not tickets** (§10, §11) by owner instruction: they are
two steps out in the sequence and a stale backlog is worse than none.
**Author:** John (tech lead)
**Created:** 2026-08-06 · **Supersedes:** the skeleton on branch `tdd-phase-3-skeleton` (PR #135). **Close #135 unmerged; this is its successor at the same path.**
**Amended:** 2026-08-06 (correction pass) — the original pass was written from a commit that predated the
**V1**, **V3** and **V4** captures, the **V2 checkpoint**, and the owner's hosting reversal. Corrections land
as **OR-19 … OR-25** (§0.6) and are threaded through **§1.7, §5.4, §8.4, §11.2, §12, §13, §14**. Nothing from
the original pass is deleted; superseded claims are marked as superseded in place.

**Primary inputs**

- `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md` (as amended by §14 of this document)
- `docs/design/DESIGN-3C-analyses-table.md` — **APPROVED** (PR #136)
- `docs/design/DESIGN-3B-score-explainability.md` — **APPROVED** (PR #136)
- `docs/product-direction-plan.md` §3 Phase 3, `docs/HANDOFF-2026-08-05.md`
- `docs/RUNBOOK.md` §4 (migrations) / §7 (test projects) / §8 (known hazards)
- `.claude/context/verified-facts.md` — authoritative, append-only

---

## 0. Owner rulings — the decision record

**Recorded so nobody re-litigates them.** All confirmed in conversation 2026-08-06. Each is binding;
where a ruling contradicts the PRD, §14 amends the PRD rather than leaving two sources of truth.

> **Provenance correction, 2026-08-09 (tech lead) — read this before citing any row in §0 as evidence of a
> dated owner act.** The line above stamps **the whole of §0** with a single date. That stamp is reliable
> for *what was decided*; it is **not** reliable as **per-row provenance** — the date on which, and the
> instrument under which, each individual question was decided. The record proves this on its own terms:
> **OR-6** states Q4's outcome, and `DESIGN-3C` §11/§12 date the owner's Q4 ruling to **2026-08-07**, a day
> *after* this block was written. A blanket 2026-08-06 stamp therefore already covers at least one item
> decided later. **§0 is the TDD's binding statement of the outcomes it builds on. It is not a log of owner
> acts and must not be read as one.** Where §0 and a design document's dated sign-off record disagree about
> *when* something was decided, **the design document's sign-off record governs the provenance**; §0
> governs only the outcome. The worked case is **OR-4 / OR-5** — see the note under §0.2.

### 0.1 Design

| # | Ruling |
|---|---|
| **OR-1** | **Jessica's design is APPROVED in full**, including the reduction from 12 default columns to **9**. Her width analysis (~1,620–1,730px of content against a ~1,360px budget) is accepted as the reason. **PRD D9's 12-column set is superseded** (§14.5). |
| **OR-2** | **Columns #7 (performance score) and #8 (baseline multiplier) are the visual centre and are untouched.** PRD R5 ("cut from the bottom, not from #7/#8") was honoured and remains binding on any future cut. |

### 0.2 The table (3C)

| # | Ruling |
|---|---|
| **OR-3** | **Engagement split — Direction A: two dedicated columns, never one.** This is the explicit **R-12.3.4 sign-off** the PRD reserved under caveat C2. Recorded as such. The mechanism was the designer's to choose and it is now chosen; the outcome (two denominators must never look comparable) was never negotiable. |
| **OR-4** | **The Status column is cut.** Failures get the whole-row treatment: rose left-edge marker + the failure reason inline in the title cell (design §3.3). The status *filter* survives. **Ruled by the owner 2026-08-09** — see the provenance note below; the outcome stated here is unchanged. |
| **OR-5** | **Style columns (`formatArchetype`, `hookType`) are off by default**, available as an optional column from the `Columns` menu. **Ruled by the owner 2026-08-09** — see the provenance note below; the outcome stated here is unchanged. **The opt-in does NOT persist** (ruled 2026-08-09, separately): it resets to hidden on every load, with no per-user and no per-session storage. |
| **OR-6** | **The 1–5 performance score STAYS in the table.** Owner's reasoning: the tooltip carries the explanation and that is sufficient. Jessica's "score says 2 but multiplier says 3.2×" concern is therefore resolved **in the tooltip, not by removing the column** — her deterministic *"these disagree because…"* line (design-3B §7.4) is **required, not optional**. See §9.4. |
| **OR-7** | **Default density is Comfortable (68px).** |
| **OR-8** | **Pagination, not infinite scroll** (50 rows/page). **Default sort stays newest-analysis-first (`Posted`, descending).** Performance is *not* the default sort. This resolves Jessica's "sink group nobody ever sees" concern **by construction**: the sink group only exists under a user-selected sort, and pagination gives it a reachable page. If a residual hidden-rows concern remains for user-selected performance sorts, it is settled with Jessica directly and is **not** escalated. |

> **OR-4 / OR-5 — the record reconciled, 2026-08-09 (tech lead). Substance unchanged; do not re-litigate
> it.** This document carried Q2 (Status column) and Q3 (Style default state) as **already decided**, while
> `DESIGN-3C` §11/§12 recorded them as **outside the 2026-08-07 owner sign-off and unruled** until
> 2026-08-09. Both were written in good faith. Dan and Jessica each flagged the clash and each correctly
> declined to close it by preferring the more convenient record. The reconciliation is mine, and it goes
> **against this document**:
>
> - **The design record is right about the instrument.** `DESIGN-3C` §12 is a **dated sign-off with an
>   explicit scope statement** — a record of a specific owner act, listing what it does and does not cover.
>   §0 here is a **derived decision list with one blanket date**, and that date is demonstrably not
>   per-row accurate (see the provenance note at the head of §0, and OR-6 / Q4).
> - **What OR-4 and OR-5 actually were, when written on 2026-08-06:** the TDD's adoption of
>   `DESIGN-3C`'s own §2.1 / §2.2 **proposals** into the build plan, so tickets could be cut without
>   waiting. They were binding **as plan**, and this document was entitled to build on them. They were
>   **not** a separate owner act, and citing them as evidence that the owner had ruled Q2/Q3 before
>   2026-08-09 is **incorrect**. The 2026-08-07 sign-off did not cover them, and that fact does not change.
> - **The governing instrument for both is the owner's ruling of 2026-08-09** — Q2: the Status column is
>   **CUT**; Q3: the Style column ships **DEFAULT-OFF** (built and available, hidden until opted into via
>   the `Columns` menu). Recorded at `DESIGN-3C` §2.2, §6.2, §6.3, §11 and §12.
> - **Nothing built changes.** The owner ratified what this document and the design already described,
>   which is exactly why the clash was harmless in substance and dangerous only in the record — the next
>   person to ask "what did that sign-off cover?" would have got two answers.
> - **Standing rule this establishes:** a §0 row is **never** a citation for *when* or *by what instrument*
>   something was decided. Cite the dated sign-off or ruling record for that.
>
> Related and **not** reconciled here because it is a live correction, not a record question: `DESIGN-3C`
> §6.3 still states the Style opt-in *"persists … within the session"*. That is **superseded** by the
> 2026-08-09 no-persistence ruling now recorded on **OR-5**. Flagged for the designer; **it must be
> corrected before #149 starts.** This document must not be read as authorising session persistence.

### 0.3 Explainability (3B §13)

| # | Ruling |
|---|---|
| **OR-9** | **Bucket-aware noun APPROVED.** AC-28 is relaxed from the literal `videos` to the pattern **`based on {N} {noun}`**, so an image-carousel baseline reads `based on 6 carousels`. Rationale, recorded in the owner's own terms: saying "videos" for a carousel-derived figure is the **same bug class** as labelling a play count "Views". PRD amended (§14.3). |
| **OR-10** | **R-13.3.4 / AC-27 — allow-list, do NOT store.** Config constants (`BASELINE_MIN_SAMPLE`'s `5`, the cache TTL's "week") are **formally exempt** from "every numeral in an explanation exists in the computed block". The owner explicitly considered and **rejected** storing them per-row: the threshold numeral only ever appears in the sub-threshold cold-start sentence, so the retroactive-rewrite exposure is limited to rows that are untrusted anyway. PRD amended (§14.4). |
| **OR-11** | **R-13.5.3a — derive, do not add a column.** Conditional on the inputs surviving to render time. **They do — verified, §1.6.** Three cases, not two (§9.5). |
| **OR-12** | **`engagement_rate` — the tech lead's correction is ACCEPTED and treated as a bug fix, not cleanup.** PRD §8.2 and D10 are factually wrong on `main`. `computeEngagementRate` is **repurposed** as 3B's follower-denominated Tier 1 primitive, not deleted. PRD amended (§14.1). |
| **OR-13** | **PRD §5.2 field split — ACCEPTED.** `tierUsed`, `confidence`, `basedOnVideos`, `provisional` and `unavailableReason` move **out of the Gemini block and into code**. Gemini's `responseSchema` carries only `performanceScore`, `verdict`, `drivers[]`. PRD amended (§14.2). |

### 0.4 Hosting and spend

| # | Ruling |
|---|---|
| **OR-14** | **O-1 answered: staff-facing**, not a single-user local tool. → Option B (container PaaS). |
| **OR-15** | **O-2 answered: Vercel is NOT a requirement.** Explicitly released. Option C (Vercel + external worker) is therefore dominated and is dropped. **The tech lead must name a specific host** — see §11.2, recommendation **Fly.io**. |
| **OR-16** | **D-3 / V4 APPROVED.** The second billed Gemini call for temperature-0 determinism is authorised and is being dispatched separately. **S3 / AC-10 is treated as discharged live; no ticket in this document runs it.** ⚠️ **V4 has since run and AC-10 FAILED — see OR-22 and §14.7.** The "no ticket runs it" half stands; the assumption that it would pass does not. |

### 0.5 Sequencing

| # | Ruling |
|---|---|
| **OR-17** | **`3B → 3C → deploy + Turso cutover → 3A queue`.** Deployment is explicitly **not** first. 3B and 3C build fine against the local SQLite file; PRD §9.3 confirms 3B/3A independence. The owner accepts that **nothing is usable by staff until deployment lands** and has chosen to build the value first. |
| **OR-18** | **Tickets are filed for 3B and 3C only.** Deploy and 3A are covered as §10/§11 here and ticketed when 3C lands. |

### 0.6 Correction pass — rulings from the V1/V2/V3/V4 captures and the hosting reversal (2026-08-06)

Everything in §0.1–§0.5 was ruled **before** these captures existed. These seven rulings correct it.

| # | Ruling |
|---|---|
| **OR-19** | **V1 and V3 are CAPTURED and merged — "approved but uncaptured" is stale everywhere it appears.** V3 measured **~85.5% output-token headroom on a real 10-slide video-bearing carousel run through the *production* pipeline** (`runAnalysis()` end to end), against the single-reel baseline of ~83%. The carousel is **equal or better**, not worse. **The PRD §9.1 risk framing — "a 10-slide carousel plus a longer prompt is the case that would actually bind `MAX_TOKENS`" — is empirically FALSE and is corrected (§14.6).** Consequently **ticket #142 (3B-4) is UNGATED**: its `[gated on V3]` condition is satisfied. **Only V2 remains uncaptured.** |
| **OR-20** | **The `-1` sentinel is a binding implementation constraint, not a footnote.** V1 found that a genuinely counts-disabled Instagram post returns `edge_media_preview_like.count: **-1**` — not `0`, not `null`, not absent, and with `edges[]` still populated. The **existing** adapter is safe only because it gates on `like_and_view_counts_disabled === true` *before* reading the count. **Any new 3B code that reads the count before checking the flag computes a negative engagement ratio and presents it as real.** Rule: **a negative count is UNKNOWN, never data.** Specified in §1.7, enforced in §5.4, and added to ticket **#140**. |
| **OR-21** | **YouTube hidden likes — the CONSERVATIVE rule, ruled without V2.** On `likeCountInt`, **`0`, `null` and field-absent ALL mean `UNKNOWN`.** No score is fabricated and no fake zero is stored. **The accepted cost, stated plainly: a genuinely zero-like video will read "unknown".** The owner considered that and accepted it deliberately — an under-claim is recoverable, a fabricated zero in a client deck is not. **3B is therefore NOT blocked on V2**; V2 remains open only as a future narrowing of this rule. |
| **OR-22** | **V4: `temperature: 0` determinism is FALSE — and the drift is ACCEPTED, not engineered around.** Two `analyzeContent()` calls on byte-identical input diverged. **Stable:** `overallScore` and all 7 scorecard dimensions. **Drifted:** `formatArchetype` (`TEXT_SLIDESHOW` vs `CAROUSEL_STATIC`), `pacing` (`FAST` vs `SLOW`), `estimatedCutsPerMinute` (`20` vs `null`), `ctaType` ordering, `structureBeatMap` segmentation (10 beats vs 6) — **enums and numbers, not prose.** **AC-10 / S3 as written cannot pass and are corrected (§14.7)** — an acceptance criterion that is known-false is worse than none. **No reconciliation machinery, no versioned re-analysis records, no retry loops**: an analysis runs once and is stored, so the drift only surfaces if a user hits Re-analyze. **Documented in §13 (E8), not solved.** |
| **OR-23** | **HOST REVERSAL — RAILWAY, not Fly.io.** The owner reviewed §11.2's Fly recommendation and **overrode it, explicitly on billing predictability**: he dislikes Fly's pay-as-you-go per-second billing and prefers a predictable flat floor. **This is a preference about billing, not a technical rebuttal** — the original analysis is preserved verbatim in §11.2 and the reasoning is not retracted. §11.2a records what the reversal costs (the Turso co-location tiebreaker is forfeited) and §11.2b records the verification that Railway can carry 3A's actual requirements. |
| **OR-24** | **`performance_score` as a real column — CONFIRMED.** §5.2 stands as written. |
| **OR-25** | **The prose guard fails loudly with no repair retry — CONFIRMED.** §8.2 stands as written; the owner understands and accepts that a violation burns a billed Gemini call and fails the analysis. |
| **OR-26** | **`derivedFrom: "NONE"` is overloaded — SPLIT, but in `unavailableReason`, not in `derivedFrom`. Migration `013`; 3A's job table renumbers to `014`.** Raised by code review on PR #152. `NONE` currently means both *"no node in this post carries reach fields at all"* (all-image carousel, single image post — permanent and expected) and *"slide 0 carries none, but a later slide does"* (a mixed carousel whose cover is an image — the post **has** real play counts that D4's first-slide rule never consulted). Ticket **#143** turns this into a user-facing sentence, so the second case would ship as "this post type doesn't report counts" — **false, and a fabricated diagnosis of exactly the class R-13.5.3a exists to forbid.** ⚠️ **Deriving the split from `analysis_mode` was proposed and is FALSIFIED — see §3.1.** The fix adds **one value to `perf_unavailable_reason`** (`REACH_NOT_ON_FIRST_SLIDE`, §5.3), **not** a fourth `perf_reach_derived_from` value: `derivedFrom` answers *where the number came from*, and with no number `NONE` is the complete and correct answer to that question; the split is a *why*, and `unavailableReason` is the why-column. Cost stated plainly: one new migration and a **full `analyses` table rebuild** (SQLite cannot alter a `CHECK` in place, and 012 is merged) — but **zero data cost**, because 012 already `DELETE`d every row. |

### 0.7 Tech-lead architecture rulings (2026-08-09)

| # | Ruling |
|---|---|
| **TR-1** | **The carousel slide total has ONE canonical derivation — Option A on #176.** `carouselItemCount` and `LaterSlideReach.slideCount` must not answer "how many slides does this post have" independently. **The canonical source is the pre-filter `edge_sidecar_to_children.edges` array, reached through one exported helper**, `getCarouselEdges()`, promoted out of `lib/server/analysis/performance/reach.ts` into a neutral module (`lib/server/analysis/carousel/`) that depends only on the schema types. Every slide **count** is `getCarouselEdges(raw).length` and every slide **index** is an index into that array. Two fields may still *carry* the number — they are at different layers and collapsing them would couple the fetcher to the performance layer for no gain — but there is **exactly one expression in the codebase that computes it**, so they cannot drift. Rationale: the standing owner preference (`PRD` §14, *reliability over coverage*) forbids a confident-looking wrong number, and Option B's guard is a test, which is a description of the constraint rather than a structural bar on violating it. |
| **TR-2** | **Consolidation is ACCEPTED on #175; the duplicate `getCarouselChildren()` helpers are DELETED, not patched.** Both file-local, non-exported copies (`fetcher/adapter.ts`, `media/resolveMediaParts.ts`) are removed; the third was already removed from `reach.ts` by PR #167 and broke no callers. Patching three call sites in place is rejected: the duplication **is** the defect's transmission mechanism, and leaving a named "already-compacted array" in scope leaves the illegal operation (index/count a filtered array) available to the next author. **Making illegal states unrepresentable beats documenting the constraint.** Where a *filtered* list is genuinely wanted and no position is taken from it — `adapter.ts:118`'s `.find()`, which is **out of scope and correct as written** — it filters inline at the call site off `getCarouselEdges()`. |
| **TR-3** | **The #175 cross-assertion survives TR-1 and stays mandatory** — one test asserting `carouselItemCount === LaterSlideReach.slideCount` on a null-`node` fixture. Under TR-1 it is no longer the guard; it is the **regression detector for TR-1 itself** (i.e. for someone re-introducing a second derivation). Keep it, and keep the "nothing changed for the no-null-node case" test beside it. |

### 0.7a Tech-lead ruling on #182 — the slide-manifest header (2026-08-10)

| # | Ruling |
|---|---|
| **TR-4** | **The slide-manifest header states NO total, and `totalPartsBeforeCap` / `mediaPartsTotalBeforeCap` are DELETED — not renamed, not re-derived.** Implemented inside **#142**; see §8.1 item 7 for the full specification. |

**The diagnosis, which is not the one the ticket states.** #182 reads as a copy bug ("9 total" over a list ending
"10."). It is not. `buildUserPrompt()` **already emits a canonical slide total** one block higher —
`formatMediaType()` renders `carousel (${carouselItemCount} slides)`, and after #175/PR #180 `carouselItemCount`
**is** `getCarouselEdges(raw).length`, the one canonical derivation under TR-1. The manifest header is therefore a
**second expression rendering the same quantity into the same prompt**, computed off a different population
(`candidates.length`, post-filter, post-`toPart`-rejection). That is precisely the failure class TR-1 abolished for
slide counts and indices; it survived in the manifest header only because it was reached through a field whose
*name* claimed it was about the cap rather than about slides.

**Why #182's Option A is rejected.** Pointing the header at `getCarouselEdges(raw).length` makes the two numbers
agree *today*, but leaves two expressions rendering one quantity in one prompt — agreement maintained by care
rather than by construction, which TR-1 exists to forbid. It also requires new gap-explaining prompt copy, landing
in the exact block #142 rewrites, describing a payload shape we have **never observed**.

**Why "drop the total" is right, and it is not merely because redundancy is a second chance to be wrong.** Ask what
a manifest total could buy the model, and every answer is already paid for elsewhere:

- **Ordering** — carried by the numbered list itself.
- **How many slides the post has (coverage reasoning)** — carried by the `Type:` line, canonically, for every
  carousel that can produce a manifest.
- **That not everything is listed (truncation)** — carried by the manifest's note, which is boolean-gated and
  quotes no figure.

The header total contributes **zero information and one failure mode**. Delete it. The prompt keeps exactly one
slide total, from exactly one expression.

**How the model learns about capping — explicitly.** It is told twice, and neither telling is a second derivation:
the `Type:` line states the true slide count (e.g. `carousel (34 slides)`) while the manifest visibly lists fewer,
and the manifest's closing note says so in words. **The note's gate is widened by this ruling** from
`mediaPartsTruncated` to *"the listed slides are not all the slides"* —
`mediaPartsTruncated === true || (carouselItemCount != null && parts.length < carouselItemCount)`. One predicate now
covers the `MAX_MEDIA_PARTS` cap, the byte cap (`truncatedForBytes`), **and** the null-node gap, without naming a
number and without any prompt copy about an unobserved payload shape. `mediaPartsTruncated` is retained as the
defensive fallback for the (unreachable) `carouselItemCount == null` case.

**On the gaps themselves — deliberately not explained, and this is not a reliability-over-coverage violation.** With
real pre-filter indices, a null-node carousel renders a list with a number missing (`1,2,3,5…10`). Every number
rendered is a **true slide position**; nothing in the manifest is a confident-looking wrong figure. That is
*incompleteness*, and the note above already tells the model the list is incomplete. The owner preference bars
confident wrong numbers, not silence about an unobserved payload. If the shape is ever **observed** (it is
`⚠️ SYNTHETIC MUTANT` today), the remedy is one added sentence, not a redesign.

**Naming/derivation — the field is deleted, not renamed.** `ResolvedMediaParts.totalPartsBeforeCap` and
`MediaMetadata.mediaPartsTotalBeforeCap` are **removed**. Renaming (#182 Option B) leaves a live count in scope
whose only consumer this ruling deletes — an unused number that reads like a slide total is a loaded gun for the
next author, and per TR-2 **doc comments are not guards**. The boolean `truncated` / `mediaPartsTruncated` stays: a
boolean **cannot be rendered as a count**, so the illegal state becomes unrepresentable rather than merely
discouraged. `truncated = candidates.length > MAX_MEDIA_PARTS` is unchanged and remains correct — it asks a
question about the *parts* population, which is the right population for a cap. If a pre-cap parts count is ever
needed again, it is re-derived from `getCarouselEdges()` **at the point of use** (TR-1), never re-carried.

**Scope bar.** This ruling touches the manifest header, the note's gate, and the deletion of the two fields. It
reopens **nothing** in #175/#176: `getCarouselEdges()` stays the one derivation, `MediaPart.index` stays the real
pre-filter position, and TR-3's cross-assertion is untouched. The manifest strings are **model-facing prompt text,
not user-facing copy** — `DESIGN-3B` §7's canonical-string rule is not engaged and no designer sign-off is required.

---

## 1. Codebase findings that change the PRD's assumptions

Checked against the code, not inferred from migration files.

### 1.1 `engagement_rate` is NOT unused — the PRD is wrong, and removing it fixes a live defect

PRD §8.2 lists `engagement_rate` among columns "written and never read" and says its denominator "is
not documented anywhere". **Both statements are false.** Verified chain:

- `lib/server/profiles/helpers.ts:23` — `computeEngagementRate()`. Denominator is **followers**:
  `(likes + comments) / followerCount`. Returns `null` when `followerCount` is null or 0. Its docstring
  says so — the denominator **is** documented, in code rather than in product docs.
- `lib/server/analysis/pipeline/index.ts:124-135` — computes it, writes it (`:256`, `:286`), **and assigns
  it onto `metadata.engagementRate`** specifically so the prompt builder can read it. The inline comment
  at `:130-133` says exactly that.
- `lib/server/analysis/prompts/user.ts:111-112` — emits `- Engagement rate: <percent>` into the user
  prompt on **every** analysis.
- `lib/server/db.ts` — `getAnalysesList()` / `getAnalysisDetail()` do **not** select it. Unread by the
  *UI*; very much read by the *pipeline*.

**There is a live R-12.3.1 violation shipping today.** The prompt hands Gemini a **follower-denominated**
ratio under the bare, unqualified label `Engagement rate`, on *every* content type including reels —
precisely the failure §12.3 and R-12.5.1 exist to prevent, and the same bug class
`user.engagementLabel.test.ts` was written for on the reach axis.

**Per OR-12 this is a bug fix.** `computeEngagementRate` is **relocated** into
`lib/server/analysis/performance/ratios.ts` as the follower-denominated Tier 1 primitive, with a mandatory
`denominator: "FOLLOWERS"` on its return value (R-12.2.2). Same arithmetic, honest label. The column
`analyses.engagement_rate` is still dropped (D10 stands); it is the *function* that survives.

**Blast radius — five files, tracked in ticket 3B-1:** `lib/server/profiles/helpers.ts` (move),
`lib/server/analysis/types/metadata.ts:34` (`MediaMetadata.engagementRate` removed),
`lib/server/analysis/pipeline/index.ts` (assignment + write removed),
`lib/server/analysis/prompts/user.ts:111-112` (the mislabelled line removed — **this is half of §8**),
`tests/server/db/migrations.schema.test.ts` (`EXPECTED_ANALYSES_COLUMNS`, currently **39** entries), plus
two pipeline tests that stub the helper (`fingerprintRecompute.test.ts:75`, `viewCountBinding.test.ts:83`).

### 1.2 The `schema_version` bump cold-starts the fingerprint engine

`ANALYSIS_SCHEMA_VERSION` (`lib/server/analysis/schema`) is `2` and is used as a **filter** beyond
persistence: `app/api/profiles/[id]/fingerprint/route.ts:74,136` and `lib/server/fingerprint/*`, which
counts only `schema_version = ANALYSIS_SCHEMA_VERSION` completed rows and refuses to write a fingerprint
below 5 (pinned by `tests/server/fingerprint/service.test.ts`).

**Bumping to 3 deletes every analysis row (3 rows, cost ~0) *and* makes every profile's style fingerprint
uncomputable until 5 new analyses exist per profile.** `profile_style_fingerprints` has 0 rows, so nothing
is destroyed — but the fingerprint engine returns to cold start and stays there until the corpus is
rebuilt, which means **Phase 5's generator has nothing to generate from until re-analysis happens.**

Still the right call — there is no alternative that preserves a contract we are deliberately breaking, and
3A's bulk ingestion is what makes rebuilding cheap. **Recorded so it is not a surprise (D-1).**

### 1.3 Point-in-time scoring (D3/D8) — one schema addition required

`analyses.follower_count` already exists and is already written per-analysis at analysis time
(`pipeline/index.ts:285`), independently of `profiles.follower_count`, which `resolveProfile` upserts over.
The freeze is therefore already structurally correct.

**The wrinkle:** R-13.3.2 requires the follower count's **staleness** to be inspectable. That value lives on
`profiles.last_fetched_at`, which is **mutated by the next refresh** — a completed analysis cannot recover
how stale its own denominator was. It must be **copied onto the analysis row at write time**, not joined
from `profiles` at read time.

→ **`analyses.audience_source_fetched_at TEXT` is added in migration 012** (§5.2). Without it R-13.3.2 and
R-13.4.5 are unimplementable, Jessica's L2 string `from a profile record cached 3 days ago` cannot be
rendered, and AC-9's byte-identity guarantee holds only by accident.

### 1.4 `MATURITY_FLOOR_HOURS` / `BASELINE_MIN_SAMPLE` are env-overridable named constants

Caveat C1 is explicit that 72h is an unmeasured guess. Both live as named exports in
`lib/server/analysis/performance/constants.ts`, env-overridable in the manner already established for
`PROFILE_TTL_DAYS` / `MAX_VIDEO_BYTES` (RUNBOOK §3), and both go into `.env.example` per §3's audit rule:

| Constant | Default | Env override |
|---|---|---|
| `MATURITY_FLOOR_HOURS` | `72` | `PERFORMANCE_MATURITY_FLOOR_HOURS` |
| `BASELINE_MIN_SAMPLE` | `5` | `PERFORMANCE_BASELINE_MIN_SAMPLE` |

**No UI copy may state or imply the floor is validated (R-13.4.4).** Enforced in §12 by a string search over
the copy source, not by review. Per **OR-10** these two numerals are on the AC-27 allow-list and are **not**
stored per row.

### 1.5 The `@libsql/client` transaction leak — binding on 3A

Known hazard, source-traced in RUNBOOK §8 and the 2026-08-05 handoff. **Do not re-derive.**
`Sqlite3Client.transaction()` steals the underlying `Database` handle and `Sqlite3Transaction.close()` is a
no-op after a successful commit; there is no userland fix. Harmless in tests, unbounded under a long-lived
server. **A job queue is exactly the code that reaches for `transaction()`.** Binding constraint: the claim
must be a single atomic `UPDATE ... RETURNING *` (§10.3). Same fix pattern proven in `lib/server/fingerprint`
(PR #120).

### 1.6 **VERIFICATION FOR OR-11 — the counts-disabled signal DOES survive to render time**

The owner's ruling #9 was conditional on this check. **It passes. Derivation is viable; no new column.**

`analyses.like_and_view_counts_disabled` exists today (migration 009,
`tests/server/db/migrations.schema.test.ts` line 57) and the **tri-state is preserved end to end**:

- **Write:** `lib/server/analysis/pipeline/index.ts:289` → `toDbBool(metadata.likeAndViewCountsDisabled)`,
  and `toDbBool` (`:45-47`) is `value == null ? null : value ? 1 : 0`. So **`undefined` → `NULL`**, not `0`.
  The inline comment at `:236-243` states the intent explicitly: *"NULL means unknown, never coerced to
  false, so the UI can tell 'creator hid the counts' apart from 'never fetched'."*
- **Read:** `lib/server/db.ts:74,101` (`getAnalysesList`) and `:126,153` (`getAnalysisDetail`) both select it
  and map it through `toNullableBoolean` (`:16-21`), which returns `null` for `NULL` and `false` for `0`.
- **Source:** `lib/server/analysis/fetcher/adapter.ts:284` → `bool(raw.…) ?? undefined`, i.e. an absent key
  stays absent rather than becoming `false`. `:236` reads `=== true` strictly.

**Three distinct values reach the client today: `true` / `false` / `null`.** ⚠️ **What this section did NOT
know at the time it was written is that the *count* field itself lies — see §1.7.** The second discriminator the
three-case logic needs — "is this an all-image carousel" — is also available at render time from
`analyses.analysis_mode` (`'images_only'`, migration 009 line 107) and, after 012, from
`perf_reach_derived_from = 'NONE'`. **Nothing needs to be stored. §9.5 specifies the derivation.**

### 1.7 **NEW TRAP (V1, OR-20) — `edge_media_preview_like.count` is `-1` on a counts-disabled post**

Captured live 2026-08-06, fixture `.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json`.
On a genuinely counts-disabled Instagram post the like-count field is **present, populated and actively wrong**:

```json
"edge_media_preview_like": { "count": -1, "edges": [ { "node": { "username": "..." } }, … ] }
```

**`-1`. Not `0`, not `null`, not absent** — and `edges[]` is still populated with real usernames, so an
absence heuristic based on "is there any like data here" also fails. This is the one state the shipped
`CountState` union (`lib/api/analyses/helpers.ts`, `classifyLikeCount`/`classifyViewCount`) does not name.

**Why nothing is broken today, and why that is not reassurance.** `fetcher/adapter.ts` gates on
`raw.like_and_view_counts_disabled === true` **before** reading the count, so `adaptPostResponse()` already
returns `likeCount: null` on this exact fixture. The existing path is correct **by construction**. But 3B is
**new, independently-written code that touches the same fields**, and the failure mode is silent and
plausible-looking:

| Naive code | Result on this payload | Why it is worse than a crash |
|---|---|---|
| `likes ?? 0` | `-1` survives (`-1` is not nullish) | a **negative** engagement ratio, rendered as a real figure |
| `Math.max(likes, 0)` | `0` | a fabricated zero — Decision 6's forbidden fabrication, reached by "defensive" code |
| `(likes + comments) / followers` | negative percentage | `4,1%` becomes `-0,2%` in an Indonesian client deck |

**Binding rules, enforced by test, not by review (see §5.4 and ticket #140):**

1. **Never read `edge_media_preview_like.count` before checking `like_and_view_counts_disabled`.** Not even
   defensively. The flag is the discriminator; the count is not evidence about itself.
2. **An explicit negative guard, independent of rule 1.** Any count `< 0` from any source resolves to
   **`UNKNOWN`**, never to `0`, never to `HIDDEN`-by-inference, never clamped. Rule 1 is the primary defence;
   rule 2 exists because rule 1 is a convention a future contributor can forget and rule 2 is a line of code
   that cannot be.
3. **Never clamp.** `Math.max(x, 0)` and `Math.abs(x)` on a count are both bugs — they convert a *signal that
   we have no data* into *data*. `unavailableReason` is the correct output, not a number.

**Comments are unaffected** — the flag is `like_and_view_counts_disabled`, and V1 confirms
`edge_media_to_parent_comment.count: 1` is real and correctly not nulled. Do not widen the guard to comments.

**Still open, and deliberately not assumed:** V1's sample is an `XDTGraphImage`, so it says nothing about
whether a counts-disabled *video* still exposes `video_view_count`/`video_play_count`. `resolveReach()` must
not key off the counts-disabled flag to decide anything about reach — it branches on **field presence**
(R-12.7.1), which is already what §3 requires.

---

## 2. Architecture overview

Existing layering is unchanged:

```
classifier → fetcher → adapter → pipeline → gemini → parser → persist
```

Phase 3 adds:

- **3B** — a **new deterministic stage between adapter and prompt-build**, plus an extended output contract:

  ```
  adapter → [NEW: performance/computeBlock] → prompt-build → gemini → [NEW: prose guard] → parser → persist
  ```

  The computed block is written by code, never by Gemini (D2, hardened by **OR-13**). It is both an **input**
  to the prompt and a **stored artefact**.
- **3C** — read path plus UI only.
- **3A** — wraps `runAnalysis()` in a job queue. Changes *who calls* `runAnalysis()`, not what it does.

**Module placement (AGENTS.md):**

```
lib/server/analysis/performance/
├── index.ts            # barrel — re-exports only
├── types.ts            # ReachKind, AvailabilityState, Denominator, Tier, Confidence,
│                       # UnavailableReason, Tier1Ratio (discriminated union),
│                       # LaterSlideReach (discriminated union, §3.1), ComputedPerformanceBlock
├── constants.ts        # MATURITY_FLOOR_HOURS, BASELINE_MIN_SAMPLE, ROUNDING_TOLERANCE, bucket nouns
├── reach.ts            # resolveReach()      — the carousel/top-level branch (§5.1)
├── availability.ts     # resolveAvailability() — the four states (§5.4)
├── ratios.ts           # Tier 1 / Tier 3 arithmetic, denominator-tagged. Home of the relocated
│                       # computeEngagementRate() (§1.1)
├── baseline.ts         # Tier 2: bucket key, median, sample size, multiplier, bucket noun
├── judgement.ts        # NEW per OR-13: tierUsed, confidence, basedOnVideos, provisional,
│                       # unavailableReason — all computed in code
└── computeBlock.ts     # orchestrates the above into ComputedPerformanceBlock

lib/server/analysis/carousel/       # NEW per TR-1 (§0.7), shipped by #180
├── index.ts            # barrel — re-exports only
├── types.ts            # CarouselEdge
└── getCarouselEdges.ts # the ONE canonical slide derivation: every slide COUNT is
                        # getCarouselEdges(raw).length, every slide INDEX is an index
                        # into that PRE-FILTER array. Neutral (schema types only) so
                        # fetcher/adapter.ts and media/resolveMediaParts.ts can depend
                        # on it without inverting the layering onto performance/.

lib/server/analysis/prose/
├── index.ts
├── constants.ts        # DENOMINATOR_PHRASES_ID, PERCENT_PATTERN
└── guard.ts            # §8 — assertQualifiedPercentages(), extractNumerals()

lib/server/jobs/        # 3A — §10
```

**Nothing under `app/` computes anything.** Per AGENTS.md's data-transformation rule the API route returns
the stored block verbatim, **all** derivation happens in `lib/api/analyses/hooks.ts`'s `select`, and
components receive already-shaped props and do presentation formatting only.

---

## 3. 3B — reach resolution

PRD §11 correction 3 is right: there is no single resolve-reach rule. From `.claude/context/verified-facts.md`:

| Case | Rule | Source |
|---|---|---|
| Top-level reel/video | `video_play_count` is authoritative; `video_view_count === 0` alongside a non-zero `video_play_count` is a **false zero** | fixture `ig_reel_1_zero_view_count.json` (`view 0` / `play 116333`) |
| Carousel **video child** | **Reversed** — `video_play_count` is `null` on all children, `video_view_count` is populated | fixture `ig_carousel_mixed_video_and_image_10_slides.json` |
| Video-bearing carousel, post level | **First slide's** count (D4); kind from that slide; confidence −1 | D4 |
| All-image carousel / single image | **No reach field exists at all** — neither key present | fixture `ig_carousel_all_images_10_slides.json` |
| YouTube | `viewCountInt`, one unambiguous number, kind `VIEWS` | verified-facts, `/v1/youtube/video` |

**R-12.7.1 is binding: branch on field *presence*, never on `__typename` and never on "is this image
content".** verified-facts' 2026-08-05 correction proves both discriminators wrong — two `XDTGraphSidecar`
payloads differ from each other, and an `XDTGraphImage` single-image post carries fields the all-image
carousel does not.

```ts
resolveReach(): { value: number | null; kind: ReachKind; state: AvailabilityState;
                  derivedFrom: "TOP_LEVEL" | "CAROUSEL_FIRST_SLIDE" | "NONE" }
```

`derivedFrom` is what the confidence penalty and R-13.4.2's explanation read. A bare `0` with no
corroborating sibling is `UNKNOWN`, not `ZERO` (R-4.3.3).

### 3.1 `NONE` is two facts, and they must not share one value (OR-26)

Raised by code review on PR #152 (merged). Read the fourth row of the table above literally — it collapses
two facts that are **not the same fact**:

| | What is true | Is it permanent? | Is the honest sentence "this post type doesn't report counts"? |
|---|---|---|---|
| **Case 1** | No node anywhere in this post carries the `video_play_count`/`video_view_count` keys. All-image carousel; single image post. | Yes | **Yes.** |
| **Case 2** | Slide 0 carries neither key, but a **later slide does** and has a real count. D4 says read slide 0, so nothing was derived. | No — the data exists | **No. It is false.** The post has view data; we chose not to consult it. |

Case 2 is not hypothetical. `ig_carousel_mixed_video_and_image_10_slides.json` proves that image and video
children **interleave arbitrarily within one carousel** (slide 5 image, slide 6 video, `234050` views on
slide 0). A carousel whose *cover* is an image and whose video sits at slide 6 is a reordering of witnessed
data, not a new payload shape.

**This is a live R-13.5.3a violation** — the same rule that forced `CAUSE_NOT_DETERMINABLE` into existence
(§5.3). #143 is the ticket that would otherwise commit it.

#### The `analysis_mode` derivation was proposed and is FALSIFIED — do not revive it

The proposal: `NONE` + `analysis_mode = 'images_only'` → case 1; `NONE` + anything else → case 2. It fails on
**two mainline paths, not edge cases**, verified against `lib/server/analysis/media/resolveMediaParts.ts` and
`lib/server/analysis/pipeline/index.ts`:

1. **A single image post is `metadata_only`, not `images_only`.** `resolveMediaParts()` pushes a part for a
   non-carousel post **only if `kind === "video"`** — a lone image post produces an **empty** parts array, so
   `pipeline/index.ts` never enters the `mediaParts.length > 0` branch and `analysisMode` keeps its
   `metadata_only` initialiser. Confirmed against `ig_single_image_post.json`. The derivation therefore reads
   the single image post — a textbook **case 1** — as case 2, and tells the user their image post has view
   data that was not consulted. That is the exact fabrication the split exists to prevent.
2. **Every YouTube `NONE` is `full_video`.** `resolveYoutubeReach()` returns `NONE` when `viewCountInt` is
   **absent**; the YouTube path always synthesises a video part from `metadata.videoUrl`, so `hasVideoPart`
   is always true. The derivation reads every such row as "mixed carousel, image first slide" — a sentence
   about a carousel, on a platform that has none.

Two further reasons it could not be repaired even if those two were patched:

3. **It would launder the forbidden discriminator.** `analysis_mode` derives from `isVideoNode()`, which
   branches on `__typename === "XDTGraphVideo" || is_video === true`, and from a carousel gate of
   `__typename === "XDTGraphSidecar"`. **R-12.7.1 forbids exactly these** for this question, and PR #152's
   BLOCKING 1 was this same discriminator in `reach.ts` (since fixed to `"edge_sidecar_to_children" in raw`).
   Deriving a *reach* sentence from a `__typename`-based signal reintroduces the defect one file away.
4. **The column is nullable and is explicitly nulled.** `pipeline/index.ts` sets `analysis_mode = NULL` on the
   re-analysis reset path, and migration 012 declares it without `NOT NULL`. A derivation whose input can be
   absent cannot be the basis of an assertion about the world.

#### The ruling

Compute the distinction **where the payload is in hand**, not by cross-module inference. At
`resolveInstagramReach()`'s carousel `noneResult()` return the carousel's own edges are already in scope, so
the fact is established from the same payload, in the same function, with no cross-module inference.

`ReachResult` gains **one additive field, `laterSlideReach`**, carrying that fact forward; `derivedFrom` is
**unchanged** and keeps its three values. The judgement module (#143) maps it onto `unavailableReason` (§5.3).

> **SUPERSEDED, 2026-08-10 (#172) — the original carrier, quoted so the record is not silently rewritten.**
> As first written, this ruling read:
>
> > `hasReachFields` is already the R-12.7.1-compliant presence check:
> >
> > ```ts
> > // same payload, same function, same presence discriminator — no inference
> > const someSlideHasReach = children.some(hasReachFields);
> > ```
> >
> > `ReachResult` gains one additive boolean carrying that fact forward.
>
> **Why it was written that way:** OR-26's question was *"are these two facts, or one?"* — and for answering
> *that* question a boolean is sufficient. The carrier was chosen to be the smallest thing that answered it.
>
> **Why it could not survive.** Two separate defects, fixed in two stages:
>
> 1. **The predicate was presence-only** (`children.some(hasReachFields)`). PR #161's review established that
>    a later slide merely *carrying* the reach keys is not enough — `video_view_count: null` on a later video
>    slide satisfies a presence check while having **no count to print**. The predicate must require a
>    **usable count**, i.e. a slide that `resolveNodeReach()` actually resolves to `AVAILABLE` or `ZERO`
>    (a corroborated zero is a real fact, R-4.3.1; `UNKNOWN` is not usable).
> 2. **The carrier was a boolean.** `DESIGN-3C` §5.4's **R-N1** is binding: the figure and its kind word are
>    **required** whenever `REACH_NOT_ON_FIRST_SLIDE` renders. A boolean asserts a number exists while being
>    structurally incapable of producing it — the exact fabricated-adjacent diagnosis **R-13.5.3a** exists to
>    forbid. It was replaced by `LaterSlideReach` in PR #164, extended in PR #167.
>
> **OR-26's reasoning is unchanged and is NOT superseded** — see *"Why not a fourth `derivedFrom` value"*
> below, and §5.3's three-outcome table. Only the carrier changed.

#### The carrier as it actually ships — `LaterSlideReach` (#161, #164, #167)

Declared in `lib/server/analysis/performance/types.ts`; consumed by #143. Reproduced here because §3.1 is the
section #143 is scoped from, and scoping against prose is how the boolean survived this long:

```ts
export type LaterSlideReach =
  | { usable: false }
  | {
      usable: true;
      value: number;                        // never negative
      kind: Exclude<ReachKind, "UNKNOWN">;  // "PLAYS" | "VIEWS" — structurally excludes UNKNOWN
      slideIndex: number;                   // 0-based index into the PRE-FILTER `edges` array
      slideCount: number;                   // `edges.length`, pre-filter — the SAME array
    };
```

**This shape is the guard. It is not a description of a guard.** Five properties are enforced by `tsc`, not by
this paragraph — which is the whole reason this correction exists (a doc comment claimed a guarantee the type
system did not hold):

1. `{ usable: true, value: 5 }` **does not compile** — `kind` is required, so R-N2's *"value and kind travel
   together"* cannot be violated.
2. `kind` cannot be `"UNKNOWN"` — R-N2's second half. A later slide whose kind cannot be established degrades
   the **whole union** to `{ usable: false }`; it never travels as an unlabelled number.
3. `{ usable: false }` has **no read path** to `value`, `kind`, `slideIndex` or `slideCount`. There is nothing
   to reach for without first narrowing on `usable: true`.
4. All four payload fields are **required**, not optional. The single production construction site
   (`resolveLaterSlideReach()` in `reach.ts`) always knows its own position and the total it scanned, so
   optionality would only buy every consumer a `??` fallback for a case that cannot occur.
5. Illegal states are **unrepresentable, not merely documented.** Per TR-2 (§0.7), *doc comments are not
   guards.*

**Provenance of `slideIndex` / `slideCount` — the thing most likely to be silently re-broken (#167, TR-1).**
Both come from the **pre-filter `edges` array**, reached through the one canonical derivation
`getCarouselEdges()` (`lib/server/analysis/carousel/`, promoted there by **#180** under TR-1). They must
**never** be derived from a filtered/compacted children array: a single null `edge.node` before the usable
slide shifts every later index down by one and prints *"slide 6"* for what the user sees as the 7th slide.
Pairing an `edges`-derived `slideIndex` with a filtered-array `slideCount` produces a second, equally
confident wrong number (*"slide 6 of 9"* on a 10-slide carousel). The scan skips null nodes with `continue`;
it does not remove them from the array first.

**R-N3 is binding and stays visible:** if more than one later slide carries a usable count, use the **first**
one, and only **its own** value and kind — **never** a sum, maximum or mean across slides. A per-post reach
figure is something D4 / R-D3 have explicitly declined to compute.

**R-N4's status changed at the type level (#167), and its design intent did not.** R-N4 calls `slideIndex` a
*nice-to-have*. It is now **required** in TS, because the producer always has it. R-N4's actual intent — *a
missing index must never suppress the figure* — is unaffected and is now unreachable-by-construction rather
than a rule to remember. The next reader should not have to reconcile the word "optional" with a required
field, so it is written down here.

**The fallback is mandatory, and it is the reliability-over-coverage side of the trade (R-N1, R-13.5.3a).**
If either the value or the kind cannot be established, `laterSlideReach` is `{ usable: false }`,
`REACH_NOT_ON_FIRST_SLIDE` **must not render**, and the row falls back to **`CAUSE_NOT_DETERMINABLE`** (§5.3).
Worse product, but not a false one.

**Why not a fourth `derivedFrom` value:** `derivedFrom` answers *"where did this number come from"*. When
there is no number, `NONE` is the complete and correct answer to that question. The split is a *why*, and
every consumer of `derivedFrom` today (the §4 confidence penalty, R-13.4.2) reads it for the *where* — a
fourth value would force all of them to handle a case with no bearing on confidence. Both options cost the
same migration, so cost is not the tiebreak; the column's meaning is.

**Verification gap, stated rather than papered over:** **no committed fixture has an image at slide 0 with a
video later.** Test case 2 with a **synthetic mutant** of `ig_carousel_mixed_video_and_image_10_slides.json`
(move the slide-5 image node to index 0), clearly labelled synthetic in the test. **Do not capture a new
payload — this costs no API credits.**

**Rounding tolerance (S2/AC-7), stated as the PRD asks:** a numeral extracted from prose matches the
computed block if it agrees to **1 decimal place** for multipliers and percentages, and **exactly** for
integer counts, after stripping thousands separators. **Indonesian prose uses `,` as the decimal separator
(`4,2%`) and `.` as the thousands separator** — the extractor must handle both conventions or it will
silently pass everything. Flagged explicitly because that is exactly how an automated criterion becomes
vacuous (see E6, §13).

---

## 4. 3B — division of labour, as amended by OR-13

**Code produces** (deterministic, frozen, stored):

reach + kind + `derivedFrom`; likes/comments + availability states; audience size + its capture time; post
age; Tier 1 ratio + denominator; Tier 2 median/sample/bucket/multiplier/noun; Tier 3 reach-per-follower;
content kind + bucket — **and, per OR-13**, `tierUsed`, `confidence`, `basedOnVideos`, `provisional`,
`unavailableReason`.

**Gemini produces** (judgement only): `performanceScore` (1–5, nullable), `verdict`, `drivers[]`.

The five relocated fields are mechanically determined and were never judgement calls: which tier was used
follows from which inputs exist; `provisional` is `post_age_hours < MATURITY_FLOOR_HOURS`; `basedOnVideos`
is a `COUNT`; confidence is a fixed ladder with three enumerated demotion reasons (R-13.4.2);
`unavailableReason` is resolved from the availability states and the reach result (**two paths — see
below**). Letting the model restate them reintroduced exactly the non-determinism D2 exists to eliminate,
and S3's byte-diff would have been testing the model's obedience rather than our arithmetic.

They are passed to Gemini as **inputs it must not contradict**. `responseSchema` is narrowed to three fields
in ticket **3B-4**.

#### `unavailableReason` has TWO origins, not one — binding on #143

⚠️ An earlier revision of this section said `unavailableReason` *"is decided by the availability resolver"*.
That was true of the enum as it stood before **OR-26**, and it is **no longer true of all seven values**. An
implementer who reads it as written will look for the whole enum in one place, fail to find
`REACH_NOT_ON_FIRST_SLIDE`, and either re-derive it or conclude it is missing. The accurate statement:

| Path | Values | Where the deciding fact is computed | Where it becomes `unavailableReason` |
|---|---|---|---|
| **A — resolved inside `judgement.ts`** | `REACH_HIDDEN`, `CAUSE_NOT_DETERMINABLE`, `REACH_UNKNOWN`, `CONTENT_KIND_UNSUPPORTED`, `NO_AUDIENCE_DATA`, `INSUFFICIENT_HISTORY` | `judgement.ts`, from the §5.4 availability states, the `like_and_view_counts_disabled` tri-state (§1.6) and the tier inputs | `judgement.ts` |
| **B — decided upstream in `reach.ts`, only *mapped* in `judgement.ts`** | `REACH_NOT_ON_FIRST_SLIDE` | `reach.ts` — `resolveLaterSlideReach()` produces `ReachResult.laterSlideReach` (`LaterSlideReach`, §3.1). The fact *"slide 0 carries no usable count but a later slide does"* is established there and nowhere else | `judgement.ts` maps `laterSlideReach.usable === true` onto the enum value |

Two consequences, both binding on **#143**:

1. **#143 reads `laterSlideReach.usable`. It must never re-derive path B**, and must never write a presence
   check of its own over the carousel edges (§3.1, R-N1). When `usable === false` the row is
   `CAUSE_NOT_DETERMINABLE`, not `REACH_NOT_ON_FIRST_SLIDE`.
2. **The mapping is one-directional.** `reach.ts` does not know the enum and must not import it —
   `LaterSlideReach` stays a reach-shaped fact; `judgement.ts` owns every write of `unavailableReason`.

Path A's first two values (`REACH_HIDDEN` / `CAUSE_NOT_DETERMINABLE`) already ship, in
`resolveHiddenCountsUnavailableReason()` (#169). #143 **imports** that function for those two rows rather
than re-deriving them — it is the module §2 names for this logic, not a second home.

**V4 turns this from a well-argued preference into a measured necessity (OR-22).** OR-13 was argued on
principle — mechanically-determined fields do not belong to a language model. V4 then measured what happens
when the model *does* own such fields on this exact schema: on two byte-identical requests at
`temperature: 0`, `formatArchetype` flipped `TEXT_SLIDESHOW` → `CAROUSEL_STATIC`, `pacing` flipped
`FAST` → `SLOW`, `estimatedCutsPerMinute` went `20` → `null`, `ctaType` reordered, and `structureBeatMap`
resegmented from 10 beats to 6. **Those are enums and numbers — structurally identical in kind to
`tierUsed`, `confidence` and `unavailableReason`.** Had OR-13 gone the other way, a re-analysis could have
silently reported a different *tier* for unchanged inputs, and `perf_confidence` — the field three separate
pieces of UI copy are derived from — would have been a coin flip. The scorecard and `overallScore` were the
fields that held steady; the classification enums were not. **The five relocated fields stay in code. This is
now settled by measurement and is not reopenable on a "the model could just do it" argument.**

**Confidence ladder (code, `judgement.ts`):**

| Start | Demotion | Result |
|---|---|---|
| `HIGH` | — | Tier 2 with `sampleSize >= BASELINE_MIN_SAMPLE`, reach-denominated, `derivedFrom = TOP_LEVEL` |
| −1 | `derivedFrom = CAROUSEL_FIRST_SLIDE` (D4) | |
| cap `MEDIUM` | `denominator = FOLLOWERS` (R-12.2.5 — cached denominator) | |
| `LOW` | `sampleSize < BASELINE_MIN_SAMPLE` on a Tier 2 figure | |
| `NONE` | `tierUsed = UNAVAILABLE` | |

**Each demotion records its cause** in `perf_confidence_reason` so Jessica's three L2 strings
(design-3B §4.3) are renderable without re-deriving anything.

---

## 5. 3B — migration **012** and the stored contract

**Migration number is fixed at `012_performance_block.sql`.** Latest on `main` is `011_fingerprint_computed_at.sql`.
**`013` is `013_reach_unavailable_reason.sql`** (OR-26 / §5.3 — ticket **#155**), and **3A's job table takes
`014_jobs.sql`** (§10.2). ⚠️ An earlier revision of this line assigned `013` to 3A's job table; that is
**superseded by OR-26** and the ordering-safety argument in §5.3 (the `013` rebuild issues `DROP TABLE
analyses`, so a jobs table carrying `REFERENCES analyses(id)` must not precede it). This also resolves the
collision flagged in the skeleton: two agents in parallel worktrees would otherwise both create `012_`.

### 5.1 Form

Repo convention is **additive only, no down-migrations** (RUNBOOK §4). D10 requires a **drop**, so 012 is a
**full table rebuild** in the style of `009_analysis_mode_images_only.sql`. Modern SQLite does support
`ALTER TABLE ... DROP COLUMN`, but 009 set the house pattern and `tests/server/db/migrations.schema.test.ts`
asserts positional alignment of the `INSERT...SELECT` column lists — a rebuild keeps that assertion
meaningful. All rows are deleted anyway (schema bump), so the `INSERT...SELECT` copies nothing.

### 5.2 `analyses` — drop 1, add 17 (39 → 55 columns)

**Correction (PR #151 review):** this header previously read "drop 1, add 14 (39 → 52 columns)".
The per-column table below lists 17 distinct new column names, not 14 — every one of them is
referenced by name elsewhere in this document (§4's `perf_confidence_reason`, §6's
`perf_tier1_ratio`/`perf_reach_value`, §7's full computed-block shape, §9.1's `ⓘ` tooltip fields) —
so 38 (39 - 1) + 17 = 55 is the correct total, not 52. This is an arithmetic correction only; the
per-column table itself (and every ruling in §0) is unchanged.

`EXPECTED_ANALYSES_COLUMNS` must be updated in the same PR.

| Column | Type | Notes |
|---|---|---|
| ~~`engagement_rate`~~ | — | **DROPPED** (D10). See §1.1 for the five files that go with it. |
| `perf_reach_value` | `INTEGER` | nullable — absent for image-only content **by design**, not failure |
| `perf_reach_kind` | `TEXT` | `CHECK(perf_reach_kind IS NULL OR perf_reach_kind IN ('PLAYS','VIEWS','UNKNOWN'))` |
| `perf_reach_derived_from` | `TEXT` | `CHECK(perf_reach_derived_from IS NULL OR perf_reach_derived_from IN ('TOP_LEVEL','CAROUSEL_FIRST_SLIDE','NONE'))` |
| `perf_tier1_ratio` | `REAL` | nullable |
| `perf_tier1_denominator` | `TEXT` | **Required whenever the ratio exists** (R-12.2.2). `CHECK((perf_tier1_denominator IS NULL OR perf_tier1_denominator IN ('REACH','FOLLOWERS')) AND (perf_tier1_ratio IS NULL OR perf_tier1_denominator IS NOT NULL))`. Two conditions ANDed, not a single `ratio IS NULL OR ...` short-circuit: the naive form `CHECK(perf_tier1_ratio IS NULL OR perf_tier1_denominator IN ('REACH','FOLLOWERS'))` is unsafe because SQLite's `IN` yields `NULL` (not `FALSE`) when the left operand is `NULL`, and a `CHECK` treats a `NULL` result as passing — that form silently accepts both `(0.5, NULL)` and `(NULL, 'BOGUS')`. A ratio without a denominator is a **constraint violation**, not a lint. |
| `perf_bucket_key` | `TEXT` | `(platform, content kind)` bucket identity — D4 |
| `perf_baseline_median` | `REAL` | nullable |
| `perf_baseline_sample_size` | `INTEGER` | `basedOnVideos`; **never null when a Tier 2 figure exists** |
| `perf_multiplier` | `REAL` | nullable |
| `perf_post_age_hours` | `INTEGER` | at analysis time |
| `audience_source_fetched_at` | `TEXT` | **§1.3** — copy of `profiles.last_fetched_at` at write time, so staleness stays inspectable after the cache refreshes (R-13.3.2, R-13.4.5) |
| `perf_tier_used` | `TEXT` | **OR-13** — `CHECK(perf_tier_used IS NULL OR perf_tier_used IN ('CREATOR_BASELINE','REACH_ONLY','AUDIENCE_FALLBACK','UNAVAILABLE'))` |
| `perf_confidence` | `TEXT` | **OR-13** — `CHECK(perf_confidence IS NULL OR perf_confidence IN ('HIGH','MEDIUM','LOW','NONE'))` |
| `perf_confidence_reason` | `TEXT` | nullable — `CHECK(perf_confidence_reason IS NULL OR perf_confidence_reason IN ('CACHED_FOLLOWER_DENOMINATOR','CAROUSEL_FIRST_SLIDE','THIN_SAMPLE'))` (§4) |
| `perf_provisional` | `INTEGER` | nullable boolean, `toDbBool` convention |
| `perf_unavailable_reason` | `TEXT` | **OR-13** — `CHECK(perf_unavailable_reason IS NULL OR perf_unavailable_reason IN ('REACH_HIDDEN','REACH_UNKNOWN','CONTENT_KIND_UNSUPPORTED','NO_AUDIENCE_DATA','INSUFFICIENT_HISTORY','CAUSE_NOT_DETERMINABLE'))` as shipped in 012 — ⚠️ **`REACH_NOT_ON_FIRST_SLIDE` is added by migration `013` (OR-26, §5.3)**; 012 is merged and SQLite cannot alter a `CHECK` in place, so 013 is a full table rebuild. Enum below |
| `performance_score` | `INTEGER` | **promoted to a column** — resolves the skeleton's open sub-question. R-8.4.1 requires it sortable and 3C paginates server-side (OR-8), so it cannot be a client-side sort over `json_extract`. Nullable. |

`verdict` and `drivers[]` remain **model output inside `result_content` JSON**, exactly as `overallScore` and
`scorecard` do today. They are never sorted or filtered on.

**Indexes added in 012:**

```sql
CREATE INDEX idx_analyses_profile_bucket ON analyses(profile_id, perf_bucket_key, status);
CREATE INDEX idx_analyses_performance_score ON analyses(performance_score);
```

`EXPECTED_ANALYSES_INDEXES` grows from 6 to 8.

### 5.3 `unavailableReason` enum

```
REACH_HIDDEN | REACH_UNKNOWN | CONTENT_KIND_UNSUPPORTED
| REACH_NOT_ON_FIRST_SLIDE | NO_AUDIENCE_DATA
| INSUFFICIENT_HISTORY | CAUSE_NOT_DETERMINABLE
```

**`INSUFFICIENT_HISTORY` is declared here but intentionally NOT produced by `judgement.ts`** (PR #191 review, Leo).
Owner-ruled, not open for re-litigation: R-C4 makes a Tier 2 cold start a NON-`unavailable` partial-absence
state, so no code path in `resolveUnavailableReason()` ever returns it — and the value stays in the union and
in migration 012/013's `CHECK` regardless, because removing it would make a legitimate already-stored row
unrepresentable on read. `THIN_SAMPLE` (the `ConfidenceReason`, a separate enum) is kept for the same reason.
See `judgement.ts`'s `resolveUnavailableReason()` doc comment for the full "declared-but-unproduced" reasoning.

`CAUSE_NOT_DETERMINABLE` satisfies R-13.5.3a. **Two different facts must not share one enum value.** Jessica
proposed the name `PERFORMANCE_DATA_ABSENT`; naming is the tech lead's call and `CAUSE_NOT_DETERMINABLE` is
chosen because it names the epistemic state rather than the data state — which is precisely the distinction
the value exists to hold.

**`REACH_NOT_ON_FIRST_SLIDE` is added by OR-26 / §3.1, under the same rule.** It splits the two facts that
`derivedFrom: "NONE"` was carrying, and it **narrows `CONTENT_KIND_UNSUPPORTED` to its true meaning**. The
three `NONE` outcomes are now disjoint and each is separately assertable:

| Situation | `derivedFrom` | `unavailableReason` | The sentence #143 may honestly write |
|---|---|---|---|
| No node in the post carries either reach key — all-image carousel, single image post | `NONE` | `CONTENT_KIND_UNSUPPORTED` | "This post type doesn't report view counts." |
| Slide 0 carries neither key; a **later slide does** | `NONE` | **`REACH_NOT_ON_FIRST_SLIDE`** | "Views are reported on later slides of this carousel, but the score reads the first slide only." |
| YouTube, `viewCountInt` absent from the response | `NONE` | `REACH_UNKNOWN` | "No view count was returned for this video." |

**Binding on #143:** `CONTENT_KIND_UNSUPPORTED` must **never** be written for a YouTube row — a YouTube video
is a supported content kind, and a missing field is an `UNKNOWN`, not an unsupported kind. Neither carousel
value may ever be written on the YouTube path at all.

#### Migration **`013_reach_unavailable_reason.sql`** — and 3A renumbers to `014`

**Ticket: [#155](https://github.com/jordanjordann/my-content/issues/155)** (3B-7). It carries the migration,
the `ReachResult.laterSlideReach` field (`LaterSlideReach`, §3.1 — **not** the boolean this line originally
said; corrected 2026-08-10, #172) and the `reach.ts` change. It is **unblocked** (its inputs #151 and #152 are
merged) and **blocks #143**, which consumes `laterSlideReach` and writes the new enum value. #143 no longer
carries the migration.

**#143 reads `laterSlideReach.usable` — never a presence check of its own.** The `REACH_NOT_ON_FIRST_SLIDE`
row above is writable **only** when `laterSlideReach.usable === true`; when it is `false`, the row is
`CAUSE_NOT_DETERMINABLE`, per R-N1 (§3.1).

Migration **012 is merged**, so its `CHECK` on `perf_unavailable_reason` is live. **SQLite cannot alter a
`CHECK` in place**, so this is a **full `analyses` table rebuild** following 012's own pattern (which
followed 009's), not an `ALTER TABLE`. Concretely:

- **Data cost is zero.** 012 already `DELETE`d every analysis row and `profile_style_fingerprints` has 0
  rows. Re-verify the row count at write time; the copy-forward statement is kept for positional symmetry
  with the 009/012 test pattern and is expected to move nothing.
- **The only `CHECK` that changes is `perf_unavailable_reason`.** `perf_reach_derived_from` keeps its three
  values verbatim. All 55 columns are otherwise reproduced unchanged, including all 8 indexes.
- `tests/server/db/migrations.schema.test.ts`'s positional insert/copy column-list assertion must be updated.

**3A's job table moves from `013` to `014_jobs.sql`** (§10.2, §15). Two reasons, neither of them tidiness:

1. **Ordering safety.** This rebuild `DROP TABLE analyses`. If 3A's jobs table lands first and carries any
   `REFERENCES analyses(id)`, the rebuild orphans it. Taking `013` for the rebuild means the jobs table is
   created **after** `analyses` reaches its final shape, and the hazard cannot arise.
2. **3A is not ticketed** (OR-18 — "cut when 3C lands"), while this ships inside 3B now. Numbers are
   allocated in the order files land, and reserving a low number for deferred work would leave a gap if 3A is
   ever cut. The renumber costs two line edits in this document and **no ticket edits**.

### 5.4 Availability states

`resolveAvailability(field, raw)` → `AVAILABLE | HIDDEN | UNKNOWN | ZERO` (PRD §4.4). Four rules pinned by
tests rather than by review. **The four-state model itself survives V1 unchanged** — `HIDDEN` is driven by the
flag, not by the count — but the resolver's *input handling* is now pinned harder:

- `like_and_view_counts_disabled` is read `=== true` **strictly**; absent is **not** `false`.
  `fetcher/adapter.ts:236` already does this correctly — the new code must not regress it (AC-19).
- **`-1` — OR-20 / §1.7.** The flag is checked **first**. Independently, **any count `< 0` resolves to
  `UNKNOWN`**. No clamping, no `?? 0`, no `Math.max`. This has a **dedicated test against the real V1 fixture**
  `ig_post_counts_disabled.json`, and a second test asserting the guard fires on a synthetic `-1` **with the
  disabled flag stripped** — i.e. proving the negative guard is load-bearing on its own and not merely shadowed
  by the flag check.
- **YouTube `likeCountInt` — OR-21, the conservative rule, now settled and no longer provisional.**
  **`0`, `null` and field-absent ALL resolve to `UNKNOWN`.** Never `ZERO`, never a fabricated score.
  This is the *ruled* behaviour, not a placeholder waiting on V2 — **3B is not blocked on V2** and no code
  branches on "once V2 lands". The accepted cost is stated in OR-21: a genuinely zero-like video reads
  "unknown". If V2 is ever captured it can only *narrow* this rule; nothing has to be rewritten to accept it.
- **Provenance discipline on the YouTube rule.** The owner also surfaced a secondary claim, found via a
  general web search and **not verified against a live payload**, that YouTube "typically returns null, 0, or
  omits the field" for a hidden like count. It is recorded **here, in the TDD, explicitly labelled as an
  unverified secondary source**, and it is deliberately **NOT written into `.claude/context/verified-facts.md`**
  — that file is reserved for live-observed facts and putting a Google result in it would poison the one
  artefact the codebase treats as authoritative (AGENTS.md, "External API Verification"). The claim changes
  nothing operationally: OR-21 already covers all three shapes it names, plus any fourth shape it does not.
  Also note V1's precedent — the analogous Instagram guess would have been `0`/`null`/absent, and the real
  answer was `-1`. **Guessing the shape has already been wrong once on this exact question.**

---

## 6. 3B — Tier 2 (baseline) data flow

One extra DB read per analysis (PRD §9.1):

```sql
SELECT perf_tier1_ratio, perf_reach_value, like_count, comment_count
FROM analyses
WHERE profile_id = ? AND perf_bucket_key = ? AND status = 'completed'
  AND schema_version = ? AND id != ?
  AND perf_post_age_hours >= ?    -- age-bounded baseline, D5 part 3
```

Served by `idx_analyses_profile_bucket` (§5.2). The median is computed in JS over the returned set; these
sets are tiny and a SQL median in SQLite is not worth the complexity.

**R-4.3.2 / R-12.3.2 enforcement lives here.** The baseline set is single-denominator by construction,
because `perf_bucket_key` encodes content kind and content kind determines the denominator. **Assert it
anyway** — a mixed set must **throw**, not average.

**Bucket noun (OR-9).** `baseline.ts` exports `bucketNoun(bucketKey): string` returning `reels` /
`carousels` / `Shorts` / `videos` / `posts` (generic fallback). It is stored implicitly via `perf_bucket_key`
and derived at render time in `hooks.ts` — no extra column. Copy renders `based on {N} {noun}`.

**Explicitly out of scope per PRD §9.3:** whether the baseline is computed per-analysis or once at the end of
a bulk batch. That is a 3A-era question. **No 3B ticket touches it.**

---

## 7. 3B — API surface

No new endpoints. `GET /api/analyses` and `GET /api/analyses/[id]` grow fields.

`lib/server/db.ts`'s `getAnalysesList()` / `getAnalysisDetail()` currently select **20** and **19** columns
respectively. They gain the `perf_*` columns, `performance_score` and `audience_source_fetched_at`.
`app/api/analyses/route.ts` already parses `result_content` and lifts `overallScore` / `scorecard`; it lifts
`verdict` / `drivers[]` the same way.

Response shape (purely additive; **no** existing field changes):

```ts
performance: {
  computed: {
    reach:    { value, kind, derivedFrom, state },
    likes:    { value, state },
    comments: { value, state },
    audience: { value, capturedAt, sourceFetchedAt },
    postAgeHours,
    tier1: Tier1Ratio | null,               // discriminated union, below
    tier2: { median, sampleSize, bucketKey, multiplier } | null,
    tier3: { reachPerFollower } | null,
    tierUsed, confidence, confidenceReason, provisional, unavailableReason
  },
  judgement: { performanceScore, verdict, drivers }
} | null
```

`performance` is `null` only for rows written before schema 3 — post-012, none.

**R-12.3.5 is a type-level requirement and is implemented as one:**

```ts
type Tier1Ratio =
  | { denominator: "REACH"; ratio: number; reachKind: ReachKind }
  | { denominator: "FOLLOWERS"; ratio: number };
```

— not an object with an optional `denominator` string. Dropping the discriminator then fails `tsc`. That is
what the PRD means by *"dropping it is a type error rather than a silent presentation bug"*. Precedent:
PR #122 shipped a comparable type-level guard on the fingerprint client.

Per AGENTS.md the route returns this **verbatim**; every derived value (formatted percentages, denominator
labels, tier phrases, the plain-language absent reason, the `3 of 5` progress string, the bucket noun) is
computed in `lib/api/analyses/hooks.ts`'s `select`, **never** in a component.

---

## 8. **The Indonesian prose leak (R-13.6.4) — designed fresh**

Jessica flags this as the highest-risk surface and the one design cannot backstop: Gemini's Indonesian prose
is what gets pasted into a client deck, and **a bare unqualified percentage there escapes every UI safeguard**
— the `≈` prefix, the column header, the qualifier line, all of it.

**This and the `engagement_rate` finding (§1.1) are one problem with two halves:**

- **Half A — the prompt currently *teaches* the model a mislabelled ratio.** `prompts/user.ts:111-112` emits
  `- Engagement rate: <percent>` from a follower-denominated number, on every content type. The model is
  being trained, in-context, that "engagement rate" is a bare unqualified percentage.
- **Half B — nothing *constrains* the model's output** to qualify a percentage with its denominator. There is
  no schema field for it, no validator, no test.

Fixing only A leaves the model free to invent a bare percentage. Fixing only B leaves a guard fighting the
prompt that taught the violation. Both ship in **3B-4**.

### 8.1 Half A — the prompt

`buildUserPrompt()` loses the `Engagement rate` line and gains a performance block that:

1. **Labels every figure with its denominator in words** (R-12.5.1) and its reach kind in words (R-4.3.1) —
   in **Indonesian**, because the label is what the model will echo.
2. **Supplies each figure as a pre-formatted, already-qualified Indonesian string** and instructs the model to
   **quote it verbatim** rather than re-derive or re-format it. e.g.
   `ANGKA_ENGAGEMENT = "4,1% dari 482,1RB penayangan"`. The model copies; it never computes. This is what
   makes §8.2's guard nearly always pass rather than nearly always fire.
3. **States explicitly which inputs are unavailable** and instructs the model not to estimate them.
4. For image-only content, **states that no reach data exists**, and contains no reach/views/plays token
   anywhere near that post's engagement figure (AC-22).
5. **Forbids comparison** against the model's own priors or against any other post's differently-denominated
   ratio (R-12.5.3).
6. **Forbids computing or restating any number it was not given** (S2).
7. **Fixes the slide manifest in the same pass — TR-4 / #182.** `#142` rewrites this file's prompt blocks, so the
   manifest fix lands here rather than as a separate PR that `#142` would immediately rewrite. Exactly four
   changes, and **no other manifest behaviour moves**:
   - **`prompts/user.ts` — `buildSlideManifest()` header carries no count.** `## Slides (${countLabel}, in order)`
     becomes `## Slides (in order)`. The `countLabel` / `totalBeforeCap` block (and its PR #95 item-7 comment) is
     deleted outright. The list lines, the `part.index + 1` numbering and the "ONE post — single holistic verdict"
     sentence are **unchanged**.
   - **`prompts/user.ts` — the incomplete-list note is re-gated**, from `metadata.mediaPartsTruncated` to
     `metadata.mediaPartsTruncated === true || (metadata.carouselItemCount != null && parts.length < metadata.carouselItemCount)`.
     The note's wording stays qualitative and **must not quote a figure**; adjust it from "truncated" to cover both
     causes (e.g. *"NOTE: not every slide of this carousel is listed above — some were not sent to you. Base your
     analysis only on the slides shown."*). The `Type:` line remains the prompt's only slide total.
   - **`media/resolveMediaParts.ts` + `media/types.ts` — delete `totalPartsBeforeCap`** from the return value and
     from `ResolvedMediaParts`. Keep `truncated` and its `candidates.length > MAX_MEDIA_PARTS` derivation.
   - **`types/metadata.ts` + `fetcher/adapter.ts` — delete `mediaPartsTotalBeforeCap`** (the field, its doc comment,
     and both adapter sites). **Before deleting, confirm no persistence path reads it** — at time of ruling `grep`
     shows the only consumers are `adapter.ts:229/283`, `prompts/user.ts:77` and their tests; `pipeline/index.ts`
     writes explicit columns and does not blob the metadata. If a persistence consumer is found, **stop and raise
     it** rather than working around it.

   **Tests (extend, do not duplicate) — `tests/server/analysis/prompts/user.slideManifest.test.ts`,
   `tests/server/analysis/media/resolveMediaParts.test.ts`, `tests/server/analysis/fetcher/adapter.test.ts`
   (`review item 7` case is deleted with the field):**
   - Null-node carousel (`makeCarouselWithEdges()`): the prompt contains **no** `N total` and no `N of M` in the
     manifest header; the list's last line is `10. …`; the `Type:` line reads `carousel (10 slides)`; the
     incomplete-list note **is present** even though `mediaPartsTruncated` is `false`.
   - Over-cap carousel: the note is present, the header still carries no count, and the `Type:` line carries the
     true total.
   - Ordinary 2-slide carousel: note **absent**, header reads `## Slides (in order)`.
   - **One structural assertion:** the rendered prompt contains **exactly one** `\d+ slides?` slide-total token
     (the `Type:` line). This is the regression detector for TR-4 — a second total re-entering the prompt fails it.

### 8.2 Half B — the enforcement mechanism: a deterministic post-generation prose guard

**New module `lib/server/analysis/prose/`**, run in the parser stage **before** persistence.

```ts
assertQualifiedPercentages(text: string): void   // throws ProseQualifierError
assertNumeralsAreReal(text: string, block: ComputedPerformanceBlock): void  // S2/AC-7
```

`assertQualifiedPercentages` scans `verdict` and every entry of `drivers[]` for a percentage token
(`/\d{1,3}(?:[.,]\d+)?\s*%/g` — **both** decimal separators) and requires an approved denominator phrase
within **40 characters** of it. The allow-list is an explicit constant, in Indonesian:

```
DENOMINATOR_PHRASES_ID = [
  "dari … penayangan",  "dari … tayangan",     // reach / views
  "dari … yang menonton",                       // reach / plays
  "dari … pengikut",    "dari jumlah pengikut", // followers
]
```

**A violation fails the analysis loudly.** No stripping, no rewriting, no silent degradation — §5.4 already
binds us: *"no invented values on parse failure"*, and quietly deleting a percentage from a client-facing
sentence is a fabrication by omission. The violating substring is logged.

**No automatic repair retry.** A retry is a second billed call and, given §8.1's pre-formatted strings, a
violation is a signal that the prompt has drifted — which is information we want, not noise we want papered
over. Recorded as a deliberate choice, not an oversight.

#### STATED LIMITATION — the 40-character window qualifies by proximity, not per figure

**This is the guard's known ceiling, not a defect. Do not file it as a bug and do not "fix" it on sight.**

`assertQualifiedPercentages` asks one question per percentage token: *is an approved denominator keyword
anywhere within 40 characters?* It does **not** attribute a denominator to a *particular* figure. So a **bare**
percentage riding inside the window of an **unrelated qualified** one inherits its neighbour's qualifier and
passes:

```
"Engagement 4,1% dari 482,1RB penayangan dan CTR 12% rendah"
                     ^^^^^^^^^^^^^^^^^^^^          ^^^
                     qualifies 4,1% …              … and 12% inherits it — accepted
```

`12%` carries no denominator of its own, and the guard accepts it because `penayangan` falls inside its
window.

**Cause, named so it is recognised rather than re-discovered: window-based qualification, not per-figure
attribution.** Fixing it properly means binding each percentage to *its own* denominator phrase (parsing
sentence structure), which is a different mechanism from the one specified here — not a tuning of this one.
Widening or narrowing the 40 characters does not address it; it only moves which sentences are affected.

**The 40-character window is what this section prescribes, so this behaviour is spec-conformant.** The
residual risk is bounded by §8.1: the model is given `ANGKA_ENGAGEMENT` pre-formatted and told to quote it
verbatim, and `assertNumeralsAreReal` independently rejects any numeral it was never handed — so a *second*
percentage has to be a real supplied figure before this window case can arise at all. Accepted at that level.
Revisit only if a real generation is observed exploiting it.

#### Two verification notes from the #142 review, both PASS — recorded so §8.2's record is complete

- **The R-4.3.1 label mapping was verified against this section's own allow-list, not assumed:**
  `"dari … penayangan"` / `"dari … tayangan"` → reach/views, `"dari … yang menonton"` → reach/plays. §8.1's
  worked example reproduces it byte-for-byte.
- **`assertNumeralsAreReal` throwing on `"12 detik pertama"` is CORRECT and INTENDED.** The `12` is a numeral
  the model was never handed, so **AC-7** and §8.1's S2 instruction require it to throw. It is an intended
  false positive against *natural-sounding prose*, not a defect against the spec, and the fix — if the copy is
  ever wanted — is on the **prompt** side (supply the figure), never by loosening the guard. Widening the
  allow-list to admit such numerals **was tried and REJECTED**: it did not fix the class of problem, and it let
  invented round numbers through, because the guard matches **values, never labels**.

### 8.3 Why a guard and not just a test — and the precedent

**This repo already guards the same bug class on the reach axis.**
`tests/server/analysis/prompts/user.engagementLabel.test.ts` exists precisely because a play count was
labelled "Views", and the PRD names it three times as the enforcement mechanism (S5, R-12.5.2, AC-22).

The difference: that test guards **our** string, which is deterministic and therefore testable. Gemini's
prose is **not** deterministic, so a unit test over a fixture proves nothing about tomorrow's generation.
**A test can only guard the half of this we author; a runtime guard is required for the half we don't.**
Hence: extend `user.engagementLabel.test.ts` for Half A (**do not duplicate it** — the PRD names that file),
and add the runtime guard plus its own `prose/guard.test.ts` for Half B, including a **deliberately vacuous-proof
case**: a fabricated bare `4,1%` must throw, and `4.1%` (dot separator) must throw too.

### 8.4 Token budget — **V3 IS CAPTURED (OR-19); this section's original text is superseded**

> ~~**Unverified for this shape.** V3 (approved, not yet captured) must measure a real multi-slide carousel with
> the extended prompt against `maxOutputTokens: 32768`. The 83% headroom figure in verified-facts is from a
> **single-video reel** and is not a bound for this case. **No code ships against an assumed headroom.**~~
> — written before V3 ran. Retained so the reasoning is auditable; the gate it describes is discharged.

**Measured, 2026-08-06, through the real production pipeline** (`runAnalysis()` end to end on
`/p/DZCPPJTjKVy/` — a 10-slide, 7-video + 3-image carousel; real fetch, real File API uploads, real
`temperature: 0` / `maxOutputTokens: 32768` config, real parse, real row written):

| | 10-slide carousel (V3) | Single 61s reel (2026-08-05 baseline) |
|---|---|---|
| `promptTokenCount` | **15,663** | 24,052 |
| `candidatesTokenCount` | 2,192 | 1,574 |
| `thoughtsTokenCount` | 2,566 | 3,994 |
| **Output-budget spend** (candidates + thoughts) | **4,758 / 32,768** | 5,568 / 32,768 |
| **Headroom remaining** | **~85.5%** | ~83% |

**The carousel is cheaper on every token axis than the reel — equal or better headroom, not worse.** Sixty-one
seconds of continuous video plus an audio track costs more input tokens than seven short slides plus three
images. **The PRD's stated risk is not merely unproven, it is measured false, and §14.6 corrects the PRD
rather than leaving a falsified risk row on `main`.**

**Consequences, stated so nobody re-derives them:**

- **Ticket #142 (3B-4) is UNGATED.** Its `[gated on V3]` condition is satisfied; the issue body has been
  amended.
- **The honest residual.** V3 measured the **current, pre-3B** contract, because 3B's extended prompt does not
  exist yet. It does not measure §8.1's block. It falsifies *"carousels are the binding case"*; it does not
  prove *"3B's prompt fits"*. Those are different claims and this document does not conflate them. n=1, same
  single-sample caveat every carousel finding in `verified-facts.md` carries.
- **What that residual is worth: very little, and here is the arithmetic.** §9.1 budgets ~+300–600 output
  tokens for 3B. Against 28,010 free tokens on the worse of the two measured samples, that is under 2% of
  remaining headroom. **This is no longer a gate; it is a thing to glance at.** 3B-4's implementer reads
  `usageMetadata` off the first real extended-prompt run and appends it to `verified-facts.md` — a free
  observation on a call that is being made anyway, not a new spend and not a blocker.
- **Unchanged:** if headroom ever does bind, the mitigation is to **shorten `drivers[]`**, never to raise
  `maxOutputTokens` past the model's real limit.

---

## 9. 3C — the analyses table (design resolved)

The skeleton's §8 placeholder is now filled from `docs/design/DESIGN-3C-analyses-table.md` (APPROVED, OR-1)
and `DESIGN-3B-score-explainability.md` (APPROVED).

### 9.1 The 9 default columns, mapped to files

Desktop-only, 1440px viewport / ~1360px content. Total ≈ 1,288px + gutters ≈ 1,312px.

| # | Column | Width | Sortable | Component (all under `app/app/analyses/components/grids/AnalysisDataTable/components/cells/`) |
|---|---|---|---|---|
| 1 | Content | 300px | no | `AnalysisContentCell.tsx` — thumbnail + kind/slide-count overlay, title snippet, mode chip when not `full_video`, **failure reason inline (OR-4)** |
| 2 | Creator | 140px | A–Z | `AnalysisCreatorCell.tsx` |
| 3 | Posted | 108px | **default desc (OR-8)** | `AnalysisPostedCell.tsx` — date + age + the `Early` badge |
| 4 | Counts | 132px | by reach | `AnalysisCountsCell.tsx` — reuses the shipped four states verbatim |
| 5 | Content score | 84px | yes | `AnalysisScoreCell.tsx` (`variant="content"`) |
| 6 | Performance | 156px | yes | `AnalysisScoreCell.tsx` (`variant="performance"`) + the row's single `ⓘ` |
| 7 | vs their usual | 128px | yes | `AnalysisMultiplierCell.tsx` — `3.2×` + `based on {N} {noun}` (OR-9), or `3 of 5` cold start |
| 8 | Eng. / reach | 116px | yes | `AnalysisEngagementCell.tsx` (`denominator="REACH"`) |
| 9 | Eng. / followers | 124px | yes | `AnalysisEngagementCell.tsx` (`denominator="FOLLOWERS"`) |
| — | *Style* (optional, **off by default — OR-5**) | 150px | no | `AnalysisStyleCell.tsx` |

Columns 5 and 6 sit **adjacent under a shared `Scores` group header** (`<th colspan="2">`), which is how D7's
"two axes, never merged" is said in layout rather than in copy.

**There is no Status column (OR-4).** Failed rows get the whole-row treatment: 3px rose left-edge marker,
`Analysis failed — {reason}` as line 2 of the Content cell, `—` in every metric cell, and `Not analysed` in
the Performance cell — which is a **different string** from any absent-score reason, because a failed
analysis has no verdict to explain. Failed rows are excluded from every sort ordering and grouped at the
bottom under their own labelled divider.

### 9.2 Engagement — Direction A (OR-3, the R-12.3.4 sign-off)

Two dedicated columns with separate headers. Every row fills **exactly one**; the other carries a
plain-language reason, never a blank.

| | Reel row | All-image carousel row |
|---|---|---|
| **Eng. / reach** | `4.1%` / `of 482.1K views` | `—` / `not published for image posts` |
| **Eng. / followers** | `—` / `no follower measure here` | `≈16.2%` / `of 284K followers` |

Three always-on distinguishers, all rendered with **no hover, no legend** (R-8.4.7):

1. **Different qualifier text in every cell** — the AC-25/AC-21 assertion target.
2. **The `≈` prefix on every follower-denominated figure.** Not decoration: the follower count comes from a
   ≤7-day-TTL cache (R3), so it genuinely *is* approximate and the reach figure genuinely is not. A truthful
   typographic difference survives a redesign in a way an invented one does not.
3. **Different colour families** — amber `--accent` for reach, teal for followers — as a **redundant third
   channel only** (WCAG 1.4.1; greyscale-readable).

**Why this is structurally strong and why it is the ruling:** there is no single "engagement" column, so
**no code path exists that could interleave denominators**, and no future refactor can quietly reintroduce
one. R-12.3.2 becomes impossible to violate rather than merely tested-for.

**R-D3 — the video-bearing carousel** is reach-denominated but its reach is first-slide-derived (D4). Its
qualifier reads `of 88.2K views · first slide only` and its confidence is one level lower (§4).

### 9.3 Score rendering

Five discrete square pips + the numeral: `4 ▪▪▪▪▫`. **No bars** — a 5-step score drawn as a filled bar reads
as "80%". Pips are `aria-hidden`; the accessible text is `4 out of 5`, which also makes the pip track
**decorative** and exempt from WCAG 1.4.11. Content pips use `--muted-foreground`, performance pips
`--primary`.

**The Performance cell always has a second line; the Content cell never does.** That asymmetry is enforced:
a Performance cell with no second line is a bug. The tier phrase is **never the enum** — `CREATOR_BASELINE`
→ `vs their usual`, `REACH_ONLY` (reach) → `of who saw it`, `REACH_ONLY` (followers) → `vs follower count`,
`AUDIENCE_FALLBACK` → `rough — vs audience size` in **muted italic**, the only tier phrase leading with a
hedge (R-13.2.4).

### 9.4 **OR-6 — the score stays, and the tooltip carries the disagreement**

The owner kept the 1–5 column and ruled that the tooltip is sufficient explanation. That makes Jessica's
deterministic disagreement line **a requirement, not a proposal**. `AnalysisScoreExplainPopover` renders, in
this order:

1. `The 1–5 is a judgement of the numbers below, not a number we measured. The measured figures are the percentage and the multiplier.`
2. **The measured figures, above the judgement.** Reading order is an argument about which number to trust.
3. The operand list (§4.4 of the design) — **no worked division**, because an intermediate quotient would be
   a numeral not present in the computed block (R-13.3.4).
4. **The disagreement line, when the score and the multiplier point opposite ways** — a deterministic
   template selected by sign comparison against the bucket median, e.g.
   `This scored lower than the reach multiplier suggests — the reach was strong but engagement on it was not.`
   Four variants, per design-3B §3.1. **Computed in `hooks.ts`, not in the component.**
5. `drivers[]` under `Why it did what it did`, in Gemini's Indonesian, unedited.
6. **The unconditional footer:** `Measured {date}. These numbers are frozen at the time of analysis and don't update.`

One `ⓘ` per **row**, in the Performance cell only — not one per figure. It reuses the shipped #70 tooltip
trigger (hover **and** keyboard focus, `role="tooltip"` + `aria-describedby`, `Escape` to dismiss, never a
native `title`). **Do not build a new one.**

### 9.5 **OR-11 — the absent-count reason, derived in three cases**

Verified viable in §1.6: nothing is stored, nothing is added to the schema. Derived in
`lib/api/analyses/helpers.ts` (where the existing four-state count logic already lives at `:34-72`) and
applied in `hooks.ts`.

```ts
function absentCountReason(row): AbsentCountReason {
  if (row.likeAndViewCountsDisabled === true) return "CREATOR_DISABLED";  // "Creator turned off counts"
  if (isAllImageCarousel(row))                return "TYPE_NOT_REPORTED"; // "This post type doesn't report counts"
  return "NOT_AVAILABLE";                                                 // "Counts weren't available"
}
```

| Case | Condition | Copy |
|---|---|---|
| 1 | flag **explicitly** `true` | `Creator turned off counts` |
| 2 | all-image carousel — flag **absent** by verified behaviour (PRD §12.1) — i.e. `analysis_mode === 'images_only'` **or** `perf_reach_derived_from === 'NONE'` with a sidecar media type | `This post type doesn't report counts` |
| 3 | **anything else** | `Counts weren't available` |

**Case 3 is mandatory and is the point of the whole ruling.** Fetch failures, private accounts and unseen
payload shapes must **not** be diagnosed as deliberate creator action. It **states the observation and
asserts no cause** — a two-case version that fell through to "Creator turned off counts" would be Decision 6's
forbidden fabrication reached by inference. There is **no fallback to case 1**; if a new situation appears it
gets its own sentence (R-13.5.2).

Note `false` (flag present and explicitly not-disabled) correctly lands in case 2 or 3, never case 1 — which
is only possible because §1.6's tri-state survives.

### 9.6 Sorting, filtering, pagination (OR-8)

- **Default sort: `Posted` descending — newest analysis first.** Performance is user-selectable, never default.
- **Pagination at 50 rows**, server-side. This is why `performance_score` is a column and not a JSON field
  (§5.2) — a server-paginated sort cannot be done client-side over `json_extract`.
- **R-S1** Non-numeric and absent values **always sink to the bottom**, in both directions. Already the
  owner-confirmed behaviour for count columns (`DESIGN-engagement-count-display-states.md` §5.1, ticket #96
  Q5). AC-14: unscored rows are never sorted as if they were `0`.
- **R-S2** The sink group is **visible, labelled and counted**: `6 posts with no performance score — sorted
  separately`. Stable ordering within the group; each row still shows its own reason.
- **R-S3** No sort mixes denominators. Under Direction A this is free.
- **Filters:** Creator · Platform · Content kind · Tier · **Status** (the filter survives OR-4's column cut) +
  keyword search. Tier options are the plain-language phrases, never enums. `Showing 24 of 118 analyses` is
  always rendered, even unfiltered.
- **Column visibility:** only Style is hideable-by-default. **Content, Performance and both engagement
  columns are locked** — hiding a denominator-bearing column is how R-12.3.1 gets violated by a user rather
  than by a developer.

### 9.7 States, a11y, contrast

- **Four distinct states** — Loading (skeleton rows in the exact column grid, never a spinner),
  Empty-nothing-analysed, Empty-no-match, Error. All four render **inside the table frame with the header row
  intact**. Collapsing any two is the same error class as collapsing two absent-score reasons.
- **Semantics:** a real `<table>` with `<caption class="sr-only">`, `<th scope="col">`, group header as
  `<th colspan="2">`. Not a div grid. `aria-sort` on the active header.
- **Engagement cells announce number and denominator in one phrase** — `4.1 percent of 482,100 views`, not
  two detached fragments.
- **Absent cells announce the full reason sentence.** Never empty.
- **No information anywhere is hover-gated** (R-8.4.7, R-13.6.2).
- **Contrast (R-8.4.6 / AC-17):** every new badge measured in **gamma-encoded sRGB** against `--background`,
  `--card`, row-hover **and** `--muted`, ≥4.5:1 on all, with the numbers in the PR body. Jessica's §9 values
  are **dark-surface stand-ins** and the implementer **must re-measure against the real tokens**. The tightest
  is `bg-primary/12` on `--muted` at 5.00:1 — check that one first. **Qualifier text is
  `text-muted-foreground` at FULL opacity** — not `/70` (4.42:1, fails), not `/80` (5.53:1, the exact value
  patched in PR #113). This error class has shipped non-compliant twice (RUNBOOK §8.4); issue #132 tracks the
  missing automated guard and 3C is the natural place to add it.

### 9.8 Dead code

`AnalysisGrid` and `AnalysisCard` are dead, unreachable code the owner already decided to delete
(RUNBOOK §8.5; handoff item 3). 3C deletes them. **It must NOT delete `AnalysisGridSkeleton`**, which is a
different, live module.

---

## 10. 3A — job queue **[SECTION ONLY — NOT TICKETED (OR-18)]**

Specified now so the deploy work in §11 is done against a known shape. Tickets are cut when 3C lands.

### 10.1 Settled

- **`runAnalysis()` survives unchanged.** 3A changes its caller. It already accepts an `onProgress` callback
  that nothing currently passes.
- **`app/api/analyze/route.ts` stops running the pipeline.** It enqueues N jobs and returns job IDs
  immediately; `maxDuration = 300` becomes irrelevant. Today it runs a **serial `for` loop** over up to
  `MAX_URLS_PER_BATCH` URLs inside one request — a single 61s reel is not fast and ten in series has no
  realistic chance inside 300s.
- **`lib/server/analysis/pipeline/progress.ts` gets wired up** rather than deleted.
- **Idempotency is a requirement.** Today a user retry re-spends credits. Dedupe key
  `(normalised_url, prompt_hash)` over non-terminal jobs is the minimum.
- **A reaper for stale `queued`/`claimed` rows.** Today rows would stay `queued` forever.

### 10.2 Job table — **migration `014_jobs.sql`** (renumbered from `013` by OR-26 / §5.3; number fixed here, §5)

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK(kind IN ('analysis')),
  status       TEXT NOT NULL CHECK(status IN ('queued','claimed','running','succeeded','failed','dead')),
  payload      TEXT NOT NULL,
  dedupe_key   TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  claimed_at   TEXT, claimed_by TEXT, heartbeat_at TEXT,
  last_error   TEXT,
  analysis_id  TEXT REFERENCES analyses(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_jobs_dedupe ON jobs(dedupe_key)
  WHERE status IN ('queued','claimed','running');
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
```

SQLite supports partial indexes, so "one live job per URL+prompt" is expressed declaratively rather than in
application code.

### 10.3 Claiming a job — the §1.5 constraint

**No `db.transaction()`.** A claim is exactly one statement:

```sql
UPDATE jobs
SET status='claimed', claimed_at=datetime('now'), claimed_by=?,
    attempts=attempts+1, updated_at=datetime('now')
WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
RETURNING *;
```

Zero returned rows means "nothing to claim" — the same NOT_FOUND-vs-no-op discrimination PR #120
established. **Do not "improve" this back into a transaction.**

### 10.4 Now resolved by OR-14/OR-15

- **Process model:** two processes from one image — `next start` and `scripts/worker.ts` importing
  `runWorkerLoop()` from `lib/server/jobs/`. Keep the entrypoint thin so the loop stays unit-testable.
- **Concurrency:** start at **1 worker**; `claimed_by` is meaningful from day one so N>1 needs no migration.
- **Progress transport:** **SSE** — fine on a long-lived Node process, which OR-14 gives us.
- **Heartbeat/reaper:** heartbeat every 15s; reaper requeues a `claimed`/`running` job whose
  `heartbeat_at` is older than 5× the heartbeat interval. The platform *can* kill a worker mid-job, so this
  is load-bearing, not defensive decoration.
- **Still blocked, and not on the queue:** the spend cap (roadmap Decision 2) needs `credits_charged`
  tracking, which does not exist (handoff carried-forward item 5). **Bulk ingestion is blocked on that.**
  Not a 3A ticket, but 3A is where it stops being deferrable.

---

## 11. Deployment + Turso cutover **[SECTION ONLY — NOT TICKETED (OR-18)]**

### 11.1 Current reality, verified

**No `vercel.json`, no Dockerfile, no deploy workflow**, `next.config.ts` is empty, `.github/workflows/ci.yml`
runs test/typecheck/lint/build and nothing else, and `TURSO_DATABASE_URL` is unset by default so the app runs
against a local SQLite file (`file:./my-content.db`). **This app is not deployed anywhere today.** The hosting
choice is genuinely open, not a migration.

### 11.2 Host recommendation — **Fly.io** ⚠️ **OVERRIDDEN BY THE OWNER — the host is RAILWAY (OR-23)**

> **Read §11.2a and §11.2b for the decision that is actually in force.** The section below is the tech lead's
> original recommendation and it is **preserved deliberately and in full**. The owner reviewed it and chose
> Railway **on billing predictability** — he dislikes Fly's pay-as-you-go per-second model and wants a
> predictable flat floor. **That is a preference about how the bill behaves, not a technical rebuttal of any
> claim below**, and none of the reasoning below is retracted or was found wrong. It is kept so that if the
> billing preference ever changes, the engineering case does not have to be rebuilt from scratch.

OR-15 requires a named host, not a three-way shrug. **Recommendation: Fly.io.** Reasoning against the three
criteria asked for:

**Pricing model.** Fly bills **per second on provisioned resources**, pro-rated, with no per-service
subscription — a `shared-cpu-1x` 256MB machine is ~$2.02/mo run continuously, and stopped machines cost only
$0.15/GB/mo of root filesystem ([fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/)). Our shape is
**two long-lived processes**, one of which is idle most of the time. Under Fly that is two machines sized
independently — a small web machine and a larger worker machine (video download + `yt-dlp` + upload wants
~1GB) — and we pay for what each actually is. Railway's model is a **$5/mo Hobby subscription that includes
$5 of usage**, i.e. a floor before any resource is consumed
([docs.railway.com](https://docs.railway.com/reference/pricing/plans)). Render bills **per service instance**,
and its free tier is disqualifying for us in two ways at once.

**Cold-start behaviour — the criterion that actually decides it.** A job queue worker must not sleep. Render
**spins down a Free web service after 15 minutes without inbound traffic, with roughly a one-minute cold
start**, and **background workers are not available on the free tier at all**
([render.com/docs/free](https://render.com/docs/free)) — so on Render the worker is a paid instance from day
one and a free-tier trial teaches us nothing about production. Fly's machines start/stop under **our**
control rather than on an inbound-traffic heuristic: the web machine may auto-stop (a cold start on a staff
tool is acceptable), while the **worker machine is simply never configured to stop**. That is the exact split
this workload wants, and it is expressible in `fly.toml` rather than worked around.

**Turso cutover effort.** Turso is libSQL and the app already uses `@libsql/client` — the cutover is
`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` and a `db:migrate` step in the release command, on **any** of the
three hosts. The differentiator is that **Turso runs on Fly's infrastructure**, so co-locating the app region
with the database primary is a one-line `primary_region` setting rather than a cross-provider network hop on
every one of the queue's frequent small reads. That is not decisive on its own; it breaks a near-tie.

**The honest cost of choosing Fly:** its ergonomics are more infrastructure-shaped than Railway's — you write
a `fly.toml` and a Dockerfile and think about regions and volumes. Railway would be faster to first deploy.
I am recommending the one that is better for a long-lived worker with a binary dependency and a lot of small
DB reads, not the one that is fastest on day one.

**Rejected:** Vercel + external worker (Option C) — released by OR-15, and its split-brain cost (two
platforms, two deploy paths, two env-var sets, split logs) is pure loss once Vercel is not required.
Vercel-cron "worker-lite" (Option D) — a Gemini video analysis can exceed a cron function's ceiling, `yt-dlp`
is a binary in a bounded function, and there is no persistent `/tmp`; it buys serverless purity at the price
of re-architecting the pipeline into resumable steps.

### 11.2a **THE DECISION IN FORCE — Railway (OR-23), and what it costs**

**The owner's reason, in his terms:** Fly bills pay-as-you-go per second on provisioned resources. He does
not want that. He wants a **predictable flat floor** and is willing to pay for it. Railway's Hobby plan is
**$5/mo which *includes* $5 of resource usage**, with overage billed as the delta
([docs.railway.com/reference/pricing/plans](https://docs.railway.com/reference/pricing/plans)). **This is a
legitimate basis for a decision and the tech lead is not relitigating it.**

**One accuracy note, so the expectation is right rather than flattering:** Railway is *not* flat-rate
underneath — it meters RAM at **$10/GB/mo**, vCPU at **$20/vCPU/mo**, egress at **$0.05/GB** and volumes at
**$0.15/GB/mo**, quoted per-minute. What the $5 buys is a **floor with usage included**, i.e. the bill is
*stable and predictable at our scale* rather than genuinely fixed. That is exactly the property asked for, and
at our two-small-services shape we are plausibly inside the included $5 most months. But if the worker is
later scaled to 1GB+ and run 24/7, the bill moves. **Recorded so "flat" is not later read as "capped".**

**What is genuinely lost — the Turso co-location tiebreaker.** §11.2's third criterion broke a near-tie on the
fact that **Turso runs on Fly's infrastructure**, so `primary_region` co-location was a one-line setting. On
Railway that is gone: **every queue read becomes a cross-provider hop over the public internet.** Stated
plainly because the queue's access pattern is the worst possible one for it — **many small, frequent reads**
(a claim poll, a heartbeat write every 15s, a reaper scan), where per-query latency dominates and there is no
payload size to amortise it against.

**How much this actually costs, honestly scoped:**

- **It is a latency tax on the queue's *polling*, not on user-facing analysis.** An analysis is dominated by a
  video download, a Gemini File API upload and a multi-second `generateContent` call. Adding single-digit
  milliseconds per DB round trip to that is noise. The reads it genuinely affects are the worker's idle poll
  loop and the heartbeat — neither of which a human is waiting on.
- **Region choice mitigates most of it.** Railway and Turso both offer US-East / EU-West / Asia-Southeast
  metros. Same-metro cross-provider is a small single-digit-ms hop, not a cross-continent one. **Choose the
  Railway region and the Turso primary in the same metro at deploy time — this is a deploy-ticket checklist
  item, not an afterthought.**
- **There is a real mitigation available if it does bite, and it is already in our dependency tree.**
  `@libsql/client@0.17.4` (installed) supports **embedded replicas** — `syncUrl` / `syncInterval` /
  `readYourWrites` are accepted options on the node `sqlite3` path (verified in
  `node_modules/@libsql/client/lib-esm/sqlite3.js:33-51`). That turns reads into local-file reads with
  background sync and makes the co-location question mostly moot. It requires a **Railway volume** for the
  local file and it changes write/read-consistency semantics, so it is **not** adopted pre-emptively — it is
  named here so that if queue latency ever shows up as a real problem, the fix is known and does not require
  reversing the hosting decision.
- **Egress cost:** the queue's reads are tiny; at $0.05/GB this is not a line item. Video downloads are
  *ingress* and are not billed on that rate.

**And a point that now counts in Railway's favour, carried forward from §11.2's own closing paragraph:** the
tech lead's stated honest cost of choosing Fly was that *"Railway would be faster to first deploy"* — no
`fly.toml`, no regions/volumes reasoning, less infrastructure surface. **That was true when it was written and
it is a real benefit now that it is the chosen path**, particularly given OR-17 puts deployment after 3C, when
the priority is getting staff onto the tool quickly. **This is not a consolation prize invented after the
fact; it is the same sentence, unchanged, now on the other side of the ledger.**

### 11.2b **Can Railway actually do what 3A needs? — verified against Railway's own docs. YES, no blockers.**

Checked because a preference is only safe to accept once it is confirmed it does not silently break a
requirement. **Nothing 3A needs is unsupported.** Every row is from Railway's primary documentation.

| 3A requirement | Railway | Verdict |
|---|---|---|
| **A long-lived background worker that NEVER sleeps** — §10.4's whole process model | Railway's sleep feature ("app sleeping", now branded **Serverless**) is **OFF by default and toggled per-service** in *service settings → Deploy → Serverless* ([docs.railway.com/guides/optimize-usage](https://docs.railway.com/guides/optimize-usage)). We simply never enable it on the worker. | ✅ **Satisfied, and better than Render.** §11.2 disqualified Render because its free tier spins a service down after 15 minutes *on an inbound-traffic heuristic we do not control*. Railway's is an explicit opt-in switch — the same "under our control, not the platform's" property that made Fly's `auto_stop` acceptable. |
| **The `yt-dlp` binary + ffmpeg** | Railway builds and deploys from a **user-supplied `Dockerfile`** at the source root ([docs.railway.com/guides/dockerfiles](https://docs.railway.com/guides/dockerfiles)); no documented restriction on installing system packages in the build. | ✅ **Satisfied.** §11.3's Dockerfile is written once and is **host-agnostic** — it is the same artefact under Fly or Railway. This was never the risky part. |
| **Two processes from one image** (`next start` + `scripts/worker.ts`) | Multiple services from one repo, each with its own **custom start command** ([docs.railway.com/guides/services](https://docs.railway.com/guides/services), monorepo deployment). | ✅ **Satisfied.** The `fly.toml` `[processes]` block in §11.3 becomes two Railway services sharing one repo/Dockerfile. |
| **A worker with no HTTP port / no public domain** | A public domain is opt-in on Railway; services communicate over private networking. | ✅ **Satisfied.** |
| **SSE progress transport** (§10.4) | Needs a long-lived Node process, which the web service is. | ✅ **Satisfied** — this was a consequence of OR-14, not of the host. |
| **Independent sizing of web vs worker** (the worker wants ~1GB for download + upload) | Per-service resource allocation, metered per GB/vCPU. | ✅ **Satisfied**, and the per-service split §11.2 wanted from Fly is available here too. |
| **Turso cutover** | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` + a `db:migrate` release step — **host-agnostic**, as §11.2 already said of all three candidates. | ✅ **Satisfied.** Only the co-location tiebreaker is lost (§11.2a), and the cutover work itself is unchanged. |

**Conclusion: there is no technical blocker. OR-23 costs us one tiebreaker, not a capability.** Had Railway
been unable to run an always-on worker or a custom binary, that would have been a genuine blocker and would
have been escalated rather than absorbed — it is not.

### 11.3 What the deploy work contains

**Updated for OR-23.** `Dockerfile` (Node + `yt-dlp` + ffmpeg — unchanged and host-agnostic), **two Railway
services from the one repo/Dockerfile** with distinct start commands (`next start` and the worker entrypoint,
§10.4) **replacing the `fly.toml` `[processes]` block**, **Serverless left OFF on the worker service** (§11.2b
— this is the one setting that would silently break 3A if it were flipped, so it belongs in the deploy ticket
as an explicit checked item, not as tribal knowledge), a Turso database + auth token **with its primary in the
same metro as the Railway region** (§11.2a), a release command running `db:migrate`, secret management for
`GEMINI_API_KEY` / `SCRAPECREATORS_API_KEY`, a deploy step in `.github/workflows/ci.yml`, and a `.env.example`
audit (RUNBOOK §3). Since OR-17 puts this **after** 3C, migrations 012, 013 and 014 will all apply on the first
Turso run — which is fine and is why all SQL in this document is kept libSQL-portable.

---

## 12. Testing strategy

The suite is **29 files / 340 tests** across two vitest projects (RUNBOOK §7).

> **Load-bearing naming convention:** a jsdom test **must** be named `*.dom.test.ts(x)`. A plain `*.test.tsx`
> matches **neither** project and **silently does not run at all**. Every 3C component test is a
> `.dom.test.tsx`. This has already bitten this repo once.

| Layer | Project | What |
|---|---|---|
| `resolveReach` | node | AC-4 (false zero → 116,333 `PLAYS`), AC-5 (carousel reversal → `VIEWS`), AC-6/AC-18 (all-image → no reach, no kind). **All against committed fixtures — zero credits.** |
| `resolveAvailability` | node | AC-19 (absent flag never read as `false`); **OR-20** — the real V1 fixture `ig_post_counts_disabled.json` resolves `HIDDEN` and **never** yields `-1`/`0`, plus a synthetic `-1` **with the flag stripped** proving the negative guard stands alone (§1.7); **OR-21** — YouTube `likeCountInt` of `0`, `null` **and** absent all → `UNKNOWN` (settled, not pending V2) |
| `ratios` / `baseline` | node | AC-1, AC-2, AC-23, AC-24 (no cross-bucket substitution), R-4.3.2 mixed-kind **throws**, `bucketNoun()` per bucket (OR-9) |
| `judgement` | node | **OR-13** — the confidence ladder and all three demotion reasons; `provisional` boundary at `MATURITY_FLOOR_HOURS`; every `unavailableReason` branch |
| prompt | node | AC-8, AC-22 — **extend** `user.engagementLabel.test.ts`, do not duplicate it |
| **prose guard** | node | **§8** — a bare `4,1%` throws; a bare `4.1%` throws; a qualified `4,1% dari 482,1RB penayangan` passes; a fabricated numeral not in the block throws (proves the extractor non-vacuous) |
| parser / validation | node | Contract v3; a missing performance field fails loudly; an *absent input* is **not** a parse failure (§5.4 — must not be conflated) |
| migration | node | `migrations.schema.test.ts` — updated `EXPECTED_ANALYSES_COLUMNS` (39→55) and `EXPECTED_ANALYSES_INDEXES` (6→8), positional `INSERT...SELECT` alignment, AC-12 |
| S2 numeral extractor | node | AC-7 + AC-27 — handles both `,` and `.` decimal separators, and honours the **OR-10 allow-list** |
| 3C cells | **jsdom** | AC-13, AC-14, AC-15, AC-16, AC-20, AC-21, AC-25 → AC-30 — all assert **rendered text content**; none is a screenshot |
| absent-count derivation | node | **OR-11** — all three cases, plus a negative assertion that case 3 never says "Creator turned off counts" |
| copy lint | node | AC-29's negative assertion: string-search the UI copy source for any claim the maturity floor is measured or validated |

~~**Gated on approved spends:** the counts-disabled Instagram fixture (V1), the likes-hidden YouTube fixture
(V2), carousel token headroom (V3). **S3/AC-10 is discharged live by V4 (OR-16) and is not a ticket here.**~~

**Verification status — CORRECTED 2026-08-06. Nothing in §12 is gated any more.**

| | Status | Effect on this document |
|---|---|---|
| **V1** — counts-disabled Instagram post | ✅ **CAPTURED & COMMITTED** — `.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json` | **Ungates the availability tests**, and adds the `-1` trap (§1.7, OR-20). The fixture is real, so these are fixture tests at **zero credits**. |
| **V2** — likes-hidden YouTube video | ⚠️ **NOT CAPTURED** — no candidate video found; **0 credits spent**. The blocker is discovery, not budget. | **Does NOT gate anything.** OR-21 rules the conservative behaviour outright. The test asserts the *ruled* rule, not a placeholder. **This is the only outstanding verification in Phase 3.** |
| **V3** — carousel token headroom | ✅ **CAPTURED** — ~85.5% headroom, better than the reel (§8.4) | **Ungates ticket #142.** |
| **V4** — `temperature: 0` determinism | ✅ **RUN — and it FAILED** (§13 E8, OR-22) | AC-10/S3 corrected (§14.7). Still not a ticket; strengthens §4/OR-13. |

---

## 13. Risks

PRD §9.2's R1–R7 are inherited unchanged. Engineering risks:

- **E1 — Building against an unverified payload shape. ⚠️ REWRITTEN — V1 landed and it proved the risk was
  real.** The original text said *"V1/V2 are approved but not captured; approved is not verified."* V1 is now
  captured and it **falsified the shape everyone was defaulting to**: the counts-disabled like count is `-1`,
  not `0`/`null`/absent (§1.7). The residual risk is now narrower and named: **(a)** V2 is still uncaptured —
  handled by ruling conservatively (OR-21) rather than by guessing; **(b)** a counts-disabled *video* is still
  unobserved, so no branch may infer anything about reach from the counts-disabled flag. **The lesson generalises
  and is the reason OR-21 is worded the way it is: on this exact class of question, guessing the payload shape
  has already been wrong once, with a value nobody proposed as a possibility.**
- **E2 — Carousel token headroom. ⚠️ CLOSED as a risk (§8.4, OR-19).** Measured at ~85.5%, *better* than the
  reel's 83%. The PRD's contrary framing is corrected in §14.6. Residual: V3 measured the pre-3B contract, and
  3B's ~+300–600 output tokens are under 2% of the measured free budget. **No longer a gate on #142.**
- **E3 — The transaction leak** (§1.5). The highest-probability way 3A ships a production defect.
- **E4 — The fingerprint cold-starts** on the schema bump (§1.2). Not a bug; a consequence that will look like
  one if unannounced.
- **E5 — `getAnalysesList()` has no pagination today** and returns every row with `result_content` inline.
  OR-8 makes server-side pagination a 3C requirement rather than a deferred concern.
- **E6 — The S2/AC-7 numeral extractor is the kind of test that passes vacuously** if separator handling is
  wrong. Prove it non-vacuous by asserting it *fails* on a deliberately fabricated numeral, the way #123's
  demonstration test was proven.
- **E7 — The prose guard is a runtime failure on a paid call.** If §8.1's pre-formatted strings drift, we
  burn a Gemini call and fail the analysis. Accepted deliberately (§8.2) and **now explicitly confirmed by the
  owner with the cost understood (OR-25)**: a loud failure is better than a quietly unqualified percentage in
  a client deck.
- **E8 — NEW. Gemini output is non-deterministic at `temperature: 0`, and it moves the style fingerprint.**
  Measured by V4 (OR-22). **The drift is accepted; this entry exists so the consequence is not discovered by
  someone else later.**
  - **What is stable:** `overallScore` and all 7 scorecard dimensions were identical across identical calls.
    The commercially load-bearing scores are reproducible.
  - **What drifts:** `formatArchetype`, `pacing`, `estimatedCutsPerMinute`, `ctaType` ordering,
    `structureBeatMap` segmentation — **classification enums and numbers, not just prose.**
  - **Why it is tolerable:** an analysis runs **once and is stored**. The drift is only observable if a user
    triggers **Re-analyze** on the same content. There is no background re-run, no cache invalidation path
    that would silently reclassify a row.
  - **⚠️ The consequence somebody will hit — stated, not solved.** `formatArchetype` and `pacing` are
    **inputs to the style fingerprint** (`lib/server/fingerprint/*`). Therefore **a re-analysis can legitimately
    change a video's classification, and with it the creator's aggregate fingerprint**, with no change to the
    underlying content and no bug anywhere. **Whoever builds the fingerprint UI needs to know this** — do not
    present a fingerprint as a stable fact about a creator, and do not treat a changed classification after a
    re-analysis as a defect to investigate. **This TDD notes it and does nothing about it, per OR-22.**
  - **Explicitly NOT being built:** reconciliation machinery, versioned re-analysis records, retry-until-agree
    loops, or an n-of-3 vote. All were considered and ruled out — they buy consistency in a field nobody has
    complained about, at the price of multiplying the per-analysis Gemini spend.
  - **Do not treat `temperature: 0` as a determinism guarantee for any field on this schema.** If a future
    feature needs a literally-stable value, it must either compute it in code (the OR-13 pattern) or store and
    reuse the first result.

---

## 14. PRD amendments applied

The PRD is **wrong on `main`**. These edits are applied in the same PR as this TDD so it is left correct.

| # | Location | Change | Ruling |
|---|---|---|---|
| 14.1 | §8.2 bullet 1, §10.1 D10, §11 correction 5 | `engagement_rate` is **not** unread and its denominator **is** documented (in `profiles/helpers.ts`). Dropping the column is a **bug fix** — it removes a live mislabelling in the prompt. `computeEngagementRate` is **repurposed**, not deleted. | OR-12 |
| 14.2 | §5.1 / §5.2 | `tierUsed`, `confidence`, `basedOnVideos`, `provisional`, `unavailableReason` move from the Gemini block to the computed block. Gemini's schema carries only `performanceScore`, `verdict`, `drivers[]`. | OR-13 |
| 14.3 | §13.4 R-13.4.1, §13.7 R-13.7.3, AC-28 | `based on N videos` → the pattern **`based on {N} {noun}`**, bucket-aware. | OR-9 |
| 14.4 | §13.3 R-13.3.4, AC-27 | Adds a stated **allow-list**: config constants (`BASELINE_MIN_SAMPLE`, the profile cache TTL) are exempt and are **not** stored per row. | OR-10 |
| 14.5 | §8.3 D9 | The 12-column default set is **superseded by the approved 9-column set** (§9.1); Status is cut; Style is optional and off by default. | OR-1, OR-4, OR-5 |
| **14.6** | **§9.1 "Unmeasured risk" row; §9.2 R1, R2** | **The carousel headroom risk is measured and FALSE.** "A 10-slide carousel plus a longer prompt is the case that would actually bind" is replaced by the measured result: **~85.5% headroom on a real 10-slide carousel vs ~83% on the reel — better, not worse** (§8.4). R1 is updated from "approved but not yet captured" to **captured**, with the `-1` sentinel recorded. R2 is updated to record V2 as **uncaptured but no longer blocking**, under OR-21's conservative rule. | **OR-19, OR-20, OR-21** |
| **14.7** | **§7 S3; §8 AC-10** | **AC-10 and S3 as written are FALSE and are corrected rather than left standing.** V4 measured non-identical output on byte-identical input at `temperature: 0`. The criterion is **narrowed to what code actually guarantees**: the **computed block** (which is deterministic because code produces it, OR-13) is byte-identical; **Gemini's judgement fields are NOT guaranteed identical**, and the drift is accepted (OR-22). An acceptance criterion known to be unpassable is worse than no criterion. | **OR-22** |
| **14.8** | **§1.3 D8; §7; §14.7; §1.4 `MATURITY_FLOOR_HOURS`** | **D8's byte-identity is narrowed a second time: it covers MEASUREMENTS and JUDGEMENTS, and explicitly does NOT cover LIBRARY-PROGRESS INDICATORS.** The Tier 2 cold-start progress count (`tier2.sampleSize` when `tier2.multiplier IS NULL`) is a **live, read-time figure over the current library** and is **deliberately not byte-stable across two reads**. Separately, the `computeBaseline()` candidate-eligibility filter's use of the **frozen** `perf_post_age_hours` against `MATURITY_FLOOR_HOURS` is recorded as **DEFECTIVE, not intended** — see the two blocks below. | **OWNER RULING 2026-08-13 (#206)** |

---

### 14.8a — D8's boundary: measurements and judgements are frozen; library progress is live

**Owner ruling, 2026-08-13, on #206, verbatim:** *"i think it is better for the counter to update as we analyze more no? that way the data is the most accurate as it can be."* The owner additionally approved narrowing the "nothing changes after it's saved" rule so that it covers measurements and judgements but **not** library-progress indicators.

**Empirical evidence that forced the ruling** (owner's live data, creator `@giorrando`, 6 analyses — 5 reels + 1 carousel, observed simultaneously on one screen):

| Post | Age at time of observation | Counter rendered |
|---|---|---|
| Aug 11 (analysed at ~1d old) | 1d, `Early` | **2 of 5 reels** |
| Mar 30 | 135d | **0 of 5 reels** |
| Mar 10 (carousel) | 155d | **0 of 5 carousels** |
| Dec 26 | 594d | **1 of 5 reels** |
| Aug 12 (analysed at ~20h old) | today, `Early` | **0 of 5 reels** |
| Aug 10 (analysed at ~2d old) | 2d, `Early` | **2 of 5 reels** |

Four different answers to "how many reels does this creator have?" on one screen, two of them identical-but-coincidental. Every one of those numbers was correct at its own write time. That is precisely the point: **a frozen progress indicator is not conservative, it is false about the present.**

**The boundary, stated so it cannot be mistaken for a bug.** A future developer WILL find a response field that differs between two reads of an unchanged row and reach for "fix the non-determinism". That failure mode has already occurred in this codebase's history. The rule that decides it:

> **A number that has a stored sentence conditioned on it is FROZEN. A number that is only a progress indicator toward a computation that has not happened yet is LIVE.**

Applied:

| Field | Frozen or live | Why |
|---|---|---|
| `reach`, `likes`, `comments`, `audience`, `tier1`, `tier3`, `postAgeHours` | **FROZEN** | Measurements of this post at its measurement instant. D8 unchanged. |
| `tier2.median`, `tier2.sampleSize`, `tier2.multiplier` **when `multiplier != null`** | **FROZEN** | Operands of a stored multiplier. `based on {N} {noun}` is a provenance claim about a computed figure, and **R-13.3.4** requires every numeral in an explanation to exist in the computed block. Recomputing any one of the three makes the trio disagree with each other and with the stored verdict. |
| `performanceScore`, `verdict`, `drivers[]`, `confidence`, `provisional` | **FROZEN** | Judgements. OR-22: an analysis runs once and is stored. |
| `tier2.sampleSize` **when `multiplier == null` (`COLD_START`)** | **LIVE** | Not a measurement of the post at all. There is no multiplier and no verdict conditioned on it. It answers "how far is your library from unlocking this comparison", and **R-14.2.5** mandates the `builds as you analyse more` reassurance while **R-C4** defines the state as *temporary*. A frozen value here contradicts the state's own approved definition. |

**The copy-side fix was unavailable and must not be re-proposed.** Changing the cell to admit the number is frozen would contradict R-14.2.5's mandated "resolves on its own" reassurance and R-C4's "temporary state" definition. Those two are settled; the code is what changes.

**Consequential test note.** Existing D8 assertions — `tests/server/analysis/performance/readModel.test.ts:141`, `tests/api/analyses/route.test.ts:251` — legitimately need updating to carve out the cold-start progress count. Such an update is **not** a masked regression; it is this amendment landing. Any narrowing of a D8 test beyond that one field is.

**Ruled and NOT reopened: `MEASURED` multipliers do not recompute.** The question was raised whether a `3.2×` computed from 5 comparators should recompute once 20 exist. It must not. The decisive reason is not cost and not screenshot-portability (both are real but secondary) — it is that the multiplier is an **input to Gemini's stored judgement**: `performance_score`, `verdict`, and `drivers[]` were produced conditioned on that multiplier. The prose cannot be recomputed without a second billed call (OR-22 — analyses run once; OR-25's no-retry stance is under separate consideration), so a recomputed multiplier would sit next to a verdict that no longer follows from it, breaking R-13.3.4 at the point it matters most. Where a better baseline now exists, the correct response is to **surface that fact**, not to silently rewrite the figure — a copy/affordance question routed to design, deliberately deferred behind OR-25.

### 14.8b — `MATURITY_FLOOR_HOURS` evaluated against a frozen age is DEFECTIVE, not intended

`computeBaseline()`'s candidate filter (`lib/server/analysis/performance/baseline.ts:291`) reads `AND perf_post_age_hours >= ?`. `perf_post_age_hours` is computed **once**, at analysis time (`computeBlock.ts:148-153` / `:212`), and is never recomputed. So the filter compares a **frozen** age against a floor that is meant to express "is this post old enough *now* to be a trustworthy comparator".

**Consequence, confirmed empirically in the owner's only real dataset:** three of the five `@giorrando` reels were analysed while under the 72h floor (frozen at 20h / 24h / 48h). All three are **permanently ineligible as comparators, forever** — two of them are now genuinely mature in real-world time and still do not count. The counter is capped at 2 and can never reach 5 unless three further reels are analysed that are *already* over 72h old at analysis time.

This makes the single most natural user behaviour — analyse a post right after publishing, to see how it did — **permanently poison that post as future baseline material**. That is not an acceptable trade; it is recorded here as a **defect**, so the ambiguity stops.

**The correction, and the distinction it must preserve.** Candidate eligibility uses **live** age, derived at query time from the stored `post_date` (an ISO-8601 UTC string on both platforms — `fetcher/adapter.ts:50-57`, `fetcher/youtube.ts:75-82`). The post's **own** `perf_post_age_hours`, `perf_provisional`, and the `Early` badge stay **frozen** — those are properties of the ANALYSIS, and freezing them is exactly what makes `Early` an honest statement about when the measurement was taken. **The two must not be unified.** A row may therefore legitimately render `Early` while simultaneously serving as a mature comparator for its siblings; that is correct, not a contradiction.

Eligibility must also be **monotone**: a candidate already eligible under the frozen age must never become ineligible (e.g. through an unparseable or absent `post_date`). The filter takes the **greater** of the live and frozen ages, so time can only ever add comparators, never remove them.

**Blast radius.** The corrected filter runs on the write path too, so all future analyses get the right comparator set. It does **not** retroactively rewrite already-stored medians, sample sizes, or multipliers on `MEASURED` rows — those stay frozen per §14.8a. The resulting asymmetry (an old `MEASURED` row's operands were computed under the stricter frozen-age filter) is **accepted, deliberately**, and is the price of not recomputing stored judgements.

---

## 15. Sequencing and ticket map

```
3B-1 [BE] migration 012 + engagement_rate removal + schema-test update   (blocks all of 3B)
  └► 3B-2 [BE] performance module: reach + availability + ratios     (fixture-driven, no spend)
       └► 3B-3 [BE] Tier 2 baseline + bucket noun + composite index
            └► 3B-4 [BE] contract v3: prompt block, prose guard, responseSchema, parser   [UNGATED — V3 captured, OR-19]
                 └► 3B-5 [BE] judgement module + pipeline wiring + persistence   [also needs 3B-7]
                      └► 3B-6 [BE] read path + API response shape + server-side pagination

3B-7 [BE] migration 013 + ReachResult.laterSlideReach (OR-26, #155)   [needs only 3B-1 + 3B-2, both MERGED]
  └► blocks 3B-5 (#143); should also precede 3B-6 (#144) so the read path types 7 values, not 6.
     Runs in PARALLEL with 3B-3 (#141) and 3B-4 (#142) — no shared files.

3C-1 [FE] table shell: 9 columns, group header, density, pagination, sort/sink, states   [needs 3B-6]
  ├► 3C-2 [FE] engagement Direction A cells + absent-count derivation
  ├► 3C-3 [FE] score cells + explain popover (incl. the OR-6 disagreement line)
  └► 3C-4 [FE] filters, column menu, dead-code deletion, contrast record
```

**#182 (slide-manifest header) is folded into 3B-4 (#142), not sequenced beside it.** TR-4 / §0.7a is the ruling;
§8.1 item 7 is the specification. It is **not** an independently dispatchable ticket — #142 rewrites the same
prompt blocks, so landing it first is churn plus a near-certain conflict, and picking up #142 without it bakes the
inconsistency into the new block. It lands **after #180 merges** (it edits `media/resolveMediaParts.ts`, which
#180 owns), which the existing #175 → #142 order already guarantees. No conflict with #179 (`performance/judgement.ts`).

**Migration numbers, fixed here and repeated in the tickets:** **3B = `012_performance_block.sql`** (merged,
PR #151), **3B = `013_reach_unavailable_reason.sql`** (OR-26 / §5.3 — adds `REACH_NOT_ON_FIRST_SLIDE`; full
table rebuild because 012 is merged), **3A = `014_jobs.sql`** (renumbered from `013` by OR-26). No agent picks
a number at implementation time.

**FE/BE dependency:** 3C is **blocked on 3B-6**. The two phases are **not** parallelisable — 3C consumes a
response shape 3B-6 creates. Within each phase the chain above is sequential except 3C-2/3C-3/3C-4, which are
parallel once 3C-1 lands.

**Not ticketed yet (OR-18):** deploy + Turso cutover (§11), 3A queue (§10). Cut when 3C lands.
