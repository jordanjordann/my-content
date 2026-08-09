# PRD — Phase 3B (Performance / Engagement Scoring) + Phase 3C (Analyses Table Redesign)

**Status:** **Owner-reviewed 2026-08-05.** All ten §10 decisions are now **[CONFIRMED]** — the owner accepted the recommended option on every one. All three verification spends (V1, V2, V3) are **approved**. Two caveats attach to the acceptances and are recorded in §10.0; §12 adds the resolution for all-image carousels that the first draft only flagged.

> **⚠️ AMENDED 2026-08-06 — verification pass complete; three claims in this document were measured FALSE.**
> **V1 CAPTURED** (counts-disabled Instagram → the like count is **`-1`**, §9.2 R1). **V3 CAPTURED** (carousel
> headroom is **~85.5%, better than the reel** — §9.1's risk row is **falsified**, not merely unmeasured).
> **V4 RUN and FAILED** (`temperature: 0` is **not** deterministic — **S3 and AC-10 are corrected**).
> **V2 remains uncaptured but no longer blocks anything** (owner ruling: `0`/`null`/absent all mean `UNKNOWN`).
> The corrected passages are marked in place. The binding decision record is
> `docs/TDD-3A-3B-3C-phase-3.md` §0, rulings **OR-19 … OR-25**.

> **⚠️ AMENDED 2026-08-07 — §14 added: two settled behaviours that will otherwise be filed as bugs.**
> Both were already decided by the owner and neither is open. **§14.1** — a re-analysis can change a
> creator's **style classification**, and that is **expected product behaviour**, not a fault. **§14.2** —
> Tier 2's minimum is **5 comparable posts per format bucket, not 5 posts per creator**; a creator with
> **4 reels and 4 carousels has 8 posts and still gets no comparison at all.** Every earlier passage in
> this document that stated a bare "minimum of 5" has been corrected in place and now points at §14.2.
> **§14.2 is binding on the 3C frontend tickets (#145–#149) — the cold-start copy may not say "5 posts".**
> *(§14 here is a section of this PRD. It is unrelated to `TDD-3A-3B-3C-phase-3.md` §14, which is that
> document's own amendment log.)*

> **⚠️ AMENDED 2026-08-09 — §15 added: the product rulings on the design documents' open questions.**
> **Q4 — "should the 1–5 performance score be in the table at all?" — is CLOSED: the score STAYS**
> (OR-6, re-confirmed 2026-08-07). `DESIGN-3B` §7 is therefore the **governing treatment** of the 1–5,
> not an argument feeding an open question, and the "cut the score" contingency leaves ticket planning
> entirely — **#147 is clear to build the score pips.** **Q2 (cut the Status column) and Q3 (Style
> columns default-off) are now CLOSED too — both owner-ruled later the same day, 2026-08-09: Q2 is
> CUT, Q3 ships DEFAULT-OFF (built, hidden behind the column picker). See §15.2, which supersedes its
> own earlier "STILL OPEN" text.** All four design-document open questions are now settled. The table
> is **materially narrower** than `DESIGN-3C` §5 describes — **R-15.2.1 binds #145 and #149.**

**Owner:** Oden (product owner)
**Author:** Dan (PM)
**Created:** 2026-08-05
**Revised:** 2026-08-05 (owner acceptances recorded; §12 added; **§13 score explainability added** — new owner requirement, and the primary input to the UI/UX designer's next pass) · 2026-08-07 (**§14 added** — expected behaviours that will be mistaken for defects: classification drift on re-analysis, and Tier 2's per-bucket minimum)
**Extends:** `docs/PRD-analysis-schema-redesign.md` (the live analysis contract). This PRD **adds a third tier** to that contract and **bumps `schemaVersion`**. Everything in that PRD not contradicted here still stands.
**Primary input:** `docs/product-direction-plan.md` §3, Phase 3 (3B and 3C).
**Out of scope:** 3A (the job queue). Referenced only where a real dependency exists (§9.3).

Reading conventions are inherited from the roadmap and used strictly:

- **[CONFIRMED]** — explicit owner decision. Build to it.
- **[RECOMMENDATION]** — my proposal. Owner has not ruled. **Do not treat as approved.**
- **[OPEN]** — genuinely undecided. Nobody invents an answer.
- **[VERIFY]** — an external-API fact this PRD needs that is **not** in `.claude/context/verified-facts.md`. Must be captured live before any code depends on it. ~~**V1–V3 are now approved to be captured (§10.2); they are not yet captured.**~~ **UPDATED 2026-08-06: V1 and V3 are CAPTURED; V4 has run; only V2 remains uncaptured** (§10.2). "Approved" is not "verified" — nothing may be built against an unverified shape, and **V1 is the proof of why: the counts-disabled like count turned out to be `-1`, a value no one had proposed as a possibility.**

As of the 2026-08-05 revision, **every decision in §10 is [CONFIRMED]**. Remaining `[RECOMMENDATION]` language elsewhere in the document has been reconciled; if you find any, treat §10 as authoritative.

---

## 1. Executive summary

### Problem statement

The analysis scorecard judges **content only**. Nothing in the product says whether a video actually **performed**. A reel with 2,000 plays on a 500-follower account and one with 2,000 plays on a 500,000-follower account read identically today. Separately, the analyses table shows a small subset of what the pipeline already stores — roughly 17 columns added by migrations 006 and 009 are written and never read (§8.2) — so the agency cannot scan a creator's library and see what worked.

### Proposed solution

**3B:** add a **performance layer** to the analysis contract. Ratios are computed **deterministically in code** from metrics captured at analysis time; those ratios plus the content are handed to **Gemini, which produces the judgement** — a 1–5 performance score, an Indonesian verdict, and drivers linking content traits to the numbers. The layer **degrades gracefully** across three tiers so a brand-new creator still gets a real answer on video one, and **refuses to produce a score at all** when the inputs it needs are hidden or absent.

**3C:** rebuild the analyses table around what the contract actually produces, with the 3B performance verdict as a first-class column.

### Success criteria (measurable)

| # | Criterion | How it is checked |
|---|---|---|
| S1 | For any analysis where a usable denominator is available — reach for video, follower count for image-only content (§12) — the table shows a performance score and a tier badge | Query: 0 rows with a usable denominator and a null performance score |
| S2 | **Zero fabricated numbers.** Every numeral appearing in Gemini's performance prose exists in the computed input block handed to it | Automated: extract numerals from the prose fields, assert each is present in the stored computed-metrics block (rounding tolerance to be stated by the tech lead) |
| S3 | ⚠️ **CORRECTED 2026-08-06 — the original wording was measured FALSE.** ~~Re-running the same analysis inputs twice at `temperature: 0` yields an identical performance score and identical computed ratios.~~ **Now:** re-running the same analysis inputs twice yields a **byte-identical *computed* block** (reach, ratios, denominators, tier, confidence, provisional, `unavailableReason`). **Gemini's judgement fields are explicitly NOT guaranteed identical.** | Two runs, byte-diff **the computed block only**. **V4 (`verified-facts.md`, 2026-08-06) ran this and found `temperature: 0` is NOT deterministic on this schema** — `formatArchetype`, `pacing`, `estimatedCutsPerMinute`, `ctaType` ordering and `structureBeatMap` all drifted between byte-identical requests, while `overallScore` and the full scorecard held. The determinism this criterion can honestly claim is the determinism **code** provides, not the model. The drift is **accepted** (TDD OR-22); see TDD §13 E8 for its consequence on the style fingerprint. |
| S4 | An analysis whose like/view counts are disabled produces **no** performance score, an explicit unavailable state, and prose that says so | ✅ **The fixture now exists** — `ig_post_counts_disabled.json` (V1, captured 2026-08-06). This is a **zero-credit fixture test**, no longer a deferred one. It must also assert the `-1` sentinel never reaches a ratio (§9.2 R1). |
| S5 | Reach is never mislabelled: a play count is never rendered or described as "Views" | Extend the existing `user.engagementLabel` test to the new performance prompt block |
| S6 | Gemini output token usage stays under 50% of the `maxOutputTokens` budget on a production-sized request | Read `usageMetadata` from one live call. **Two baselines now exist in `verified-facts.md`: ~83% headroom on a single reel and ~85.5% on a 10-slide carousel (V3, 2026-08-06).** Both are far inside the 50% criterion — actual spend was 5,568 and 4,758 tokens against 32,768. Compare against the **carousel** figure, since it is the more media-heavy request. |
| S7 | **No user can mistake a follower-denominated engagement % for a reach-denominated one.** Every rendered engagement value carries its denominator in accessible text, and no sort or aggregate mixes the two | Component tests AC-20, AC-21; plus explicit designer sign-off at mockup review |
| S8 | **Every displayed score can be explained on the surface it appears on** (§13). No score, and no absent score, renders without its metric, its inputs, its evidence base and — where applicable — its reason | Component tests AC-25 to AC-30, each asserting rendered text content |
| S9 | **No user can read a working feature as broken.** The two expected behaviours of §14 — a style classification that changes on re-analysis, and a "vs their usual" comparison that is still filling up — are both stated to the user in the product, in the user's terms, at the point they occur | Component tests AC-31 to AC-33; plus a string search proving **no user-facing string frames the Tier 2 threshold at creator level** (R-14.2.5) |

---

## 2. Users and context

- **User:** an Indonesian social-media / marketing agency. Not the creator. They manage several creators and analyse competitors as reference material.
- **Surface:** desktop dashboard. **Desktop-only is an explicit scope decision** (roadmap §1; handoff 2026-08-05). **No mobile layouts are to be designed for 3C.**
- **Output language:** analysis prose Indonesian; app UI English. Unchanged from the live PRD §4.2.
- **What the agency wants from this feature, in plain terms:** not "engagement rate = 4.1%" but *"this one did 3.2× your usual reach, and here's what in the content probably did it."*

### User stories

- **US-1.** As an agency strategist, I want to see whether a video **overperformed or underperformed for that creator**, so I can tell a client which content to make more of.
- **US-2.** As an agency strategist, I want the system to **explain** the performance in terms of the content, not just print a ratio, so I have something to say in a client meeting.
- **US-3.** As an agency strategist onboarding a **brand-new creator**, I want a performance read on their very first analysed video, so the tool is useful on day one.
- **US-4.** As an agency strategist, I want to know **how much evidence** sits behind a performance claim, so I do not over-claim to a client.
- **US-5.** As an agency strategist, I want the tool to **say "we don't know"** when the creator has hidden their counts, rather than print a plausible number I would repeat to a client.
- **US-6.** As an agency strategist, I want to **scan a creator's analysed library in one table** and sort by performance, so I can find their best work without opening every row.
- **US-7.** As an agency strategist, I want **every score to explain itself inside the app** — what it measured, what went into it, how much evidence sits behind it, and why it says what it says — so I can defend the number in a client meeting instead of just repeating it. **(§13. Owner requirement, 2026-08-05.)**
- **US-8.** As an agency strategist, I want the app to **stop me from comparing two numbers that are not comparable**, so I do not confidently tell a client something untrue. **(§13.6, §12.3.)**
- **US-9.** As an agency strategist, when I re-analyse a post and its **style classification comes back different**, I want the app to have told me up front that this can happen, so I do not conclude the tool is broken or that the creator changed. **(§14.1.)**
- **US-10.** As an agency strategist waiting for the "vs their usual" comparison to switch on, I want the app to tell me **how many more posts of that particular format** it needs, so I can see the feature working rather than assume it is stuck. **(§14.2.)**

---

## 3. The central question: how do we measure performance?

The owner has said explicitly that he does not know what formula he wants and has asked for options. He also asked what to do **"if it's tricky to use follower/subscriber count"** — a well-placed suspicion. This section answers it.

### 3.1 What the industry actually does (research)

Three families of metric are in real use, and they disagree with each other by an order of magnitude:

1. **Engagement rate by followers** — `engagements ÷ followers`. The oldest convention, still the default on influencer rate cards ([Brandwatch](https://www.brandwatch.com/blog/social-media-engagement-rate/), [Hootsuite](https://blog.hootsuite.com/calculate-engagement-rate/)).
2. **Engagement rate by reach / by views** — `engagements ÷ reach`. Widely described as the more accurate per-post measure precisely **because reach fluctuates and most followers never see a given post** ([Hootsuite](https://blog.hootsuite.com/calculate-engagement-rate/), [Brandwatch](https://www.brandwatch.com/blog/social-media-engagement-rate/)). For Reels-heavy accounts, engagement-by-views is the recommended form ([Socialinsider](https://www.socialinsider.io/social-media-benchmarks/instagram)).
3. **Outlier / baseline multiplier** — `this video's views ÷ the creator's own median views`. This is what the serious YouTube research tools (ViewStats, 1of10, OutlierKit) actually sell, and they report it as a plain multiplier: *"7.1× — this video got 7.1 times the channel's typical views"* ([OutlierKit](https://outlierkit.com/resources/outlier-scores/), [Overseeros](https://www.overseeros.com/blog/youtube-outlier-analysis)).

**The most important research finding for us is how badly the published benchmarks disagree.** Within a single search, Reels engagement is quoted at **0.48%** (Socialinsider, Q2 2026) and at **4.2–7.1%** (a Sprout figure quoted by a third party) — a ~10× spread, driven entirely by whether the denominator is views or followers and by which accounts are in the sample. **Any product that scores a video against a published universal benchmark inherits that spread as silent error.** This is decisive against Option C below.

### 3.2 Option A — Engagement-per-reach only (single tier)

**What it is.** Compute `likes ÷ reach`, `comments ÷ reach`, and `(likes + comments) ÷ reach` from the same captured post. Hand those ratios to Gemini with the content. No follower count anywhere.

**Strongest property, and it is genuinely strong:** every input comes from **the same post, the same capture, the same source, at the same instant**. No stale cache, no cross-platform denominator mismatch, no drifting audience number. It answers *"of the people who saw it, how many cared"* — arguably a truer read on **content quality** than reach is, because reach is largely an algorithm decision rather than a content decision.

- **Cold start:** none. Works on video one.
- **Cost:** effectively zero. No extra API calls, no extra DB reads, a few hundred extra prompt tokens.
- **Weakness, and it is fatal on its own:** it cannot see **reach itself**. A video shown to 200 people that got 20 likes scores 10% and looks superb. A video shown to 400,000 people that got 8,000 likes scores 2% and looks mediocre. The agency's actual question — *"did this post do well?"* — is mostly a question about **distribution**, and Option A is blind to distribution by construction.

### 3.3 Option B — Tiered, graceful degradation [CONFIRMED — D1]

Three tiers, evaluated together, presented in priority order. This is the boss's steer, and I agree with it with two amendments (§3.5).

| Tier | Metric | Needs | Available when |
|---|---|---|---|
| **1 — Engagement-per-reach** | `likes ÷ reach`, `comments ÷ reach` | reach + likes/comments from this post | Always, if the post exposes reach |
| **2 — Creator's own baseline** | `this post's reach ÷ median reach of this creator's other analysed posts in the same bucket` → reported as **"3.2× typical reach"**; same treatment for engagement | ≥ N prior analyses of the same creator in the same comparability bucket | Once history exists |
| **3 — Audience fallback** | `reach ÷ follower or subscriber count` | cached audience count | When there is no history; presented as **approximate**, never precise. **Not applicable to image-only content**, which has no reach — see §12.5 |

**Design intent: degrade gracefully.** A brand-new creator gets Tier 1 immediately. Tier 2 switches on once history exists and becomes the headline. Tier 3 covers the gap between them, explicitly labelled as the weakest read.

- **Tier 2 is the one the agency will actually quote.** It is self-normalising: it does not care whether the follower count is stale, whether the creator has 500 or 500k followers, or whether two platforms count reach differently — the denominator is *the same creator, measured the same way*.
- **Median, not mean.** One viral post would drag a mean baseline upward and make every subsequent post look like a failure. Median is also what the industry tools use (§3.1).
- **Cost:** one extra database read at analysis time (the creator's prior analyses). **Zero extra ScrapeCreators credits** — the follower count already comes from the existing 7-day-TTL profile cache, which the pipeline already resolves today. Gemini: ~+600–1,000 prompt tokens and ~+300–600 output tokens. Against the measured **83% output headroom on a real production-sized request** (`verified-facts.md`, 2026-08-05), this is comfortable.
- **Weakness:** Tier 2 has a **cold-start problem** — meaningless until several of that creator's posts are analysed.
  **⚠️ CORRECTED 2026-08-07. This bullet previously read *"it inherits the style fingerprint's minimum of 5 (roadmap §1)"*, and that framing is wrong in exactly the way that matters.** The style fingerprint's 5 is **5 posts per creator**. Tier 2's 5 is **5 comparable posts per format bucket**. They are not the same threshold, and a creator can clear the fingerprint's bar while still having **no Tier 2 comparison anywhere**. **The rule, the worked example and the reason are in §14.2, which is binding on the 3C cold-start copy.** See also decision **D4**.

### 3.4 Option C — Score against a universal industry benchmark

**What it is.** Hard-code or configure "good" thresholds (e.g. "Reels ER above 2% is strong") and score every video against them.

**I recommend rejecting this outright**, and §3.1 is the reason: credible published benchmarks for exactly this metric differ by ~10× depending on denominator and sample. We would be encoding one vendor's sampling decisions as truth, with no way for the agency to see the assumption, and it would silently rot as platform algorithms change. It also gives Gemini nothing it can honestly reason about — and Gemini's training cutoff means it **cannot** know current benchmarks, which is exactly why `trendAlignment` was removed from the scorecard in the live PRD (§4.5). Reintroducing the same failure mode under a new name would be a regression.

### 3.5 Recommendation, and where I disagree with the steer

**Recommend Option B**, with two amendments to the boss's framing:

1. **Tier 3 should be demoted further than "fallback" — it should be labelled a *rough* read and must never be the headline number when Tier 1 is available.** Views-per-follower on Instagram is weak for a reason beyond staleness: Reels are distributed heavily to **non-followers**, so the follower count is not really the denominator of reach at all. It is an account-size proxy, not an audience-reached proxy. Keep it, label it honestly, don't lead with it.
2. **Tier 1 and Tier 2 are not competing — they answer different questions and should both be shown when both exist.** Tier 1 = "was the content compelling to those who saw it." Tier 2 = "did the algorithm push it." An agency needs both: high Tier 1 with low Tier 2 is *good content that didn't get distribution* — a completely different recommendation ("re-cut the hook, re-post") from low Tier 1 with high Tier 2 ("it travelled on a trend; the content underdelivered").

That second point is the strongest product argument in this PRD and I would not want it lost in implementation: **the pair of numbers is more useful than either number alone.**

---

## 4. Inputs — what is fed to Gemini, and what is emphatically not

### 4.1 The division of labour [CONFIRMED — D2]

- **Arithmetic happens in code.** All ratios, medians and multipliers are computed deterministically, stored, and frozen on the analysis row.
- **Interpretation happens in Gemini.** It receives the computed numbers plus the video and produces the judgement.
- **Gemini must not compute, restate approximately, or invent any number.** The prompt must say so explicitly, and criterion **S2** enforces it mechanically.

Rationale: an LLM doing arithmetic gives occasionally-wrong, non-reproducible figures — which breaks the `temperature: 0` + `responseSchema` reproducibility discipline the live contract was built around (live PRD §5). Computed ratios plus model judgement give **reproducible figures and** the reasoning the owner asked for.

### 4.2 The input set

Every item below must reach the prompt with an explicit **availability state** (§4.4), never as a bare number.

| Input | Source | Notes |
|---|---|---|
| **Reach** | resolved reach field | **See §4.3. The single highest-risk input in this feature.** Must carry which kind of count it is. |
| **Likes** | `edge_media_preview_like.count` (IG) / `likeCountInt` (YT) | Both confirmed in `verified-facts.md` |
| **Comments** | `edge_media_to_parent_comment.count` (IG) / `commentCountInt` (YT) | Both confirmed |
| **Shares / saves** | — | **NOT AVAILABLE.** Neither ScrapeCreators endpoint exposes shares or saves in any captured payload. The steer mentions "shares/saves if available" — **they are not available.** Do not model them, do not leave a nullable field for them, do not let a prompt ask Gemini to guess at them. Recorded so it is not rediscovered mid-ticket. |
| **Counts-hidden flag** | `like_and_view_counts_disabled` (IG) | ✅ **VERIFIED 2026-08-06 (V1).** Flag confirmed at `data.xdt_shortcode_media.like_and_view_counts_disabled: true`. **⚠️ And the like count alongside it is `-1`, with `edges[]` still populated** — read the flag first, and treat any negative count as `UNKNOWN` (§9.2 R1, TDD §1.7). |
| **Audience size** | `profiles.follower_count` (IG) / `subscriberCount` (YT) | IG nesting `edge_followed_by.count` confirmed live 2026-08-05. YT `subscriberCount` confirmed numeric. **7-day-TTL cache ⇒ approximate; nothing may present it as exact.** |
| **Post age** | `taken_at_timestamp` (IG, unix **seconds**) / `publishDate` (YT, **ISO-8601 with offset**) | Two different formats — confirmed in `verified-facts.md`. See §4.5 |
| **Content kind** | `analysis_mode` + media type | Drives comparability bucketing, §4.6 |
| **Creator baseline** | computed from prior analyses in the DB | Tier 2 only; no API cost |

### 4.3 Reach: view count vs play count — the trap that silently corrupts everything

Not a caution — a hard requirement. From `.claude/context/verified-facts.md` and `docs/RUNBOOK.md` §6:

- **Top-level reels:** `video_view_count` can be **0 while the real number is in `video_play_count`**. Captured fixture: `ig_reel_1_zero_view_count.json` — `video_view_count: 0`, `video_play_count: 116333`.
- **Carousel video children: the reliability is REVERSED.** In `ig_carousel_mixed_video_and_image_10_slides.json`, `video_play_count` is `null` on all 7 video children while `video_view_count` is populated. **A single shared "resolve reach" rule is wrong.** It needs a carousel-vs-top-level branch.
- **An all-image carousel has no reach number at all.** No view count, no play count anywhere in the payload.

Product requirements that follow:

- **R-4.3.1** Every stored and displayed reach value carries a **kind** — `PLAYS`, `VIEWS`, or `UNKNOWN` — and the UI and the Gemini prose must use the matching word. A play count must **never** be labelled "Views". There is already a shipped prompt rule and a test behind this (`user.engagementLabel.test.ts`); the new performance prompt block is in scope for the same test.
- **R-4.3.2** A ratio may only be computed between values of the **same reach kind**. Mixing a plays-denominated ratio into a views-denominated baseline is invalid and must fail loudly, not be averaged.
- **R-4.3.3** `video_view_count === 0` on a top-level reel is **UNKNOWN**, not zero, unless `video_play_count` corroborates a genuine zero. A real zero-reach post is possible but vanishingly rare; the fixture proves the false-zero is common.

### 4.4 Hidden, zero and absent counts [CONFIRMED — D3]

**House rule, inherited from the live PRD §5.4 and non-negotiable: loud, honest failure. Never fabricated data.** A parser that invented a default score of `5` was treated as a serious bug. This feature must not reintroduce it under a new field name.

Every performance input carries one of four states:

| State | Meaning | Trigger |
|---|---|---|
| `AVAILABLE` | A trustworthy number | Field present, non-null, not contradicted by §4.3's rules |
| `HIDDEN` | The creator disabled it | `like_and_view_counts_disabled === true` |
| `UNKNOWN` | We do not have it | Field absent/null, a false-zero per R-4.3.3, or an unsupported content kind |
| `ZERO` | Genuinely zero | Only assertable when the flag is false **and** the field is explicitly present as 0 **and** no sibling field contradicts it |

Behaviour:

- **If the reach denominator is not `AVAILABLE`, no performance score is produced.** `performanceScore` is `null`, tier is `UNAVAILABLE`, confidence is `NONE`, and a machine-readable **reason** is stored (`REACH_HIDDEN` / `REACH_UNKNOWN` / `CONTENT_KIND_UNSUPPORTED` / `NO_AUDIENCE_DATA`).
- **The UI shows the reason, not an em-dash.** "Counts hidden by creator" is a useful fact for an agency; a blank cell is not. Direct precedent exists — the shipped engagement-count display-states work already distinguishes hidden from zero from unknown in the table.
- **Gemini is told which inputs are unavailable and is instructed not to estimate them.** It may still comment on the content; it may not speculate about numbers it was not given.
- **A missing performance layer must not fail the whole analysis.** The content scorecard is independent and still ships. This must not be conflated with the live PRD's rule that a *malformed* result fails loudly — absence of an input is a legitimate, expected state; a malformed model response is not.

### 4.5 Post age / recency [CONFIRMED — D5; the 72h floor is an estimate, see caveat C1]

A two-day-old reel and a two-year-old reel have had wildly different time to accumulate reach. **A ratio with no recency term systematically flatters old posts**, which is backwards for a tool meant to say what is working *now*.

Recommendation — the honest minimum, not a fake model:

1. **Pass post age explicitly** to Gemini, in days, alongside the ratios, and instruct it to weigh maturity in its verdict ("this is 3 days old; reach is still accumulating").
2. **Maturity floor for precise claims.** Posts younger than a threshold (**72 hours**, confirmed as a **starting value only** — see caveat C1 in §10.0; nobody has measured how long a post takes to settle, and it is expected to be tuned once real data exists) get their verdict marked `provisional` in the contract and badged as such in the UI. The score is still produced; it is labelled as early. **Implement it as a single named, configurable constant so tuning is a one-line change.**
3. **Age-bounded baseline.** Tier 2 excludes posts under the maturity floor from the baseline median. Otherwise a creator who just posted five times this week gets a baseline made of immature posts.
4. **Explicitly NOT doing:** inventing a views-per-day decay curve. We have **no longitudinal data** — the owner has ruled snapshots out (roadmap §3, 3B) — so any decay curve would be fitted to nothing. A views-per-day *velocity* number is available as an option (D5c) but I do not recommend leading with it: it makes brand-new posts look explosive and mature posts look dead, which is the same distortion in the opposite direction.

### 4.6 Content-type comparability [CONFIRMED — D4]

Reels, carousels and YouTube Shorts **do not perform comparably** and must not share a scoring axis or a baseline.

- **Reels / Shorts (video):** full Tier 1 + 2 + 3. Reach available.
- **Video-bearing carousels:** reach exists per slide, not per post. A post-level reach is a **derived choice** (first slide? max? sum? — summing is wrong; it double-counts the same viewer). **Recommendation:** use the **first slide's** view count as post-level reach, label it as such, and drop confidence one level. Alternatives in D4.
- **All-image carousels and single images:** **no reach exists in the payload at all.** Reach-denominated Tier 1 is impossible. **This is now fully resolved in §12** — they are scored on a follower-denominated engagement rate plus an untouched Tier 2, not excluded. Read §12 before implementing anything in this bullet.
- **Baselines are bucketed.** A creator's median is computed within `(platform, content kind)`, never across. Consequence: **the cold-start minimum of 5 applies per bucket, not per creator** — so a creator with 5 reels and 2 carousels gets Tier 2 on reels only, and a creator with **4 reels and 4 carousels gets it on neither, despite having 8 analysed posts.** That is correct, it is deliberate, and it must be visible in the UI, not silent. **The reason reels and carousels cannot share a pool is R-4.3.2 — reels are measured in plays and carousels in views, and a ratio across two different reach kinds must fail loudly rather than be averaged. §14.2 states this in full and is binding on the 3C copy.**

### 4.7 YouTube: at parity — and this contradicts the roadmap's framing [CONFIRMED — D6]

The roadmap lists YouTube-at-parity as `[OPEN]`, reasoning that YouTube carries "structurally less context than Instagram (no audio flag, no dimensions/resolution)."

**That reasoning is correct but does not apply to this feature.** The audio flag and resolution are **content-analysis** context. **For performance scoring, YouTube's data is if anything cleaner than Instagram's:**

- `viewCountInt`, `likeCountInt`, `commentCountInt` — all confirmed numeric and top-level in `verified-facts.md`.
- `subscriberCount` — confirmed numeric, `/v1/youtube/channel`.
- `publishDate` — confirmed ISO-8601 with offset.
- **No view/play-count ambiguity at all.** YouTube has one reach number. The single worst trap in this feature is an Instagram-only problem.

**Recommendation: YouTube is in scope at full parity for 3B.** Two caveats to record:

- **[VERIFY] V2 — YouTube likes-hidden behaviour is still unverified, and is now RULED rather than pending.** A YouTube creator can hide the like count per-video. Whether `likeCountInt` comes back `0`, `null`, or absent is **still not in `verified-facts.md`** — V2 was attempted 2026-08-06 and no candidate video could be found (0 credits spent). **Do not guess. Owner ruling (TDD OR-21), binding: `0`, `null` AND field-absent all mean `UNKNOWN`.** This is deliberately shape-agnostic — it is correct under whichever of the three shapes V2 would have revealed, which is precisely why 3B does not wait for it. **Accepted cost: a genuinely zero-like video reads "unknown".** Same false-zero suspicion as Instagram's `video_view_count` (R-4.3.3), applied harder. *(A secondary, Google-sourced claim that YouTube "typically returns null, 0, or omits the field" is recorded in TDD §5.4 **labelled as unverified**; it is deliberately kept out of `verified-facts.md`, which holds live observations only.)*
- **Cost asymmetry, already known:** ~2 SC credits per YouTube analysis vs 1 for Instagram (roadmap §3, 1.1), and `/v1/youtube/channel` charges **even on a not-found handle**. No *new* cost from 3B — the channel call already happens for follower resolution.

---

## 5. The output contract

**This is a contract change. `schemaVersion` bumps; existing analyses are DELETED, not migrated** [CONFIRMED, roadmap decision 8; precedent `008_delete_legacy_pre_redesign_analyses.sql`]. Measured 2026-08-05: 3 rows in `analyses`, 0 in `profile_style_fingerprints`, and 2 of those 3 already predate the current schema. **Deletion cost is effectively zero and it sweeps up the legacy rows carried forward in the handoff.**

### 5.1 Computed block — written by code, never by Gemini

Frozen at analysis time. **Never recomputed** as the creator's audience later moves [CONFIRMED, roadmap decision 9].

- Reach value **and reach kind** (`PLAYS` / `VIEWS` / `UNKNOWN`)
- Likes and comments, each with an availability state (§4.4)
- Audience size **and** the age of the cached profile record, so staleness is inspectable
- Post age in days at analysis time
- Tier 1 ratios: engagement-per-reach, likes-per-reach, comments-per-reach — **each carrying the required `denominator` discriminator (`REACH` / `FOLLOWERS`, R-12.2.2)**. For content kinds with no reach, the Tier 1 ratio is follower-denominated per §12.2 and no reach value is stored.
- Tier 2: baseline median, sample size, bucket identity, resulting multiplier
- Tier 3: reach-per-follower
- Content kind and comparability bucket

### 5.2 Gemini block — the judgement

**[AMENDED 2026-08-06 — owner ruling OR-13.]** Five fields that this section originally placed in the Gemini
block have been moved **out of it and into the computed block (§5.1), computed by code**: `tierUsed`,
`confidence`, `basedOnVideos`, `provisional` and `unavailableReason`. **All five are mechanically determined
by the computed block** — which tier was used follows from which inputs exist; `provisional` is
`post_age_hours < MATURITY_FLOOR_HOURS`; `basedOnVideos` is a `COUNT`; confidence is a fixed ladder with
three enumerated demotion reasons (R-13.4.2); `unavailableReason` is decided by the availability resolver.
Letting the model restate them reintroduced exactly the non-determinism **D2** exists to eliminate, and
**S3's byte-diff would have been testing the model's obedience rather than our arithmetic.** They are passed
to Gemini as **inputs it must not contradict**. No acceptance criterion changes observable outcome; what
changes is who is authoritative when the two disagree.

**Gemini's `responseSchema` therefore carries exactly three fields:**

- `performanceScore` — integer **1–5, nullable**. Same scale as the rest of the contract (live PRD §4.6). Null when §4.4 says no score.
- `verdict` — short Indonesian prose. The judgement the owner asked for.
- `drivers[]` — short Indonesian statements, each linking a **specific content trait to the measured performance** (e.g. *"hook 2 detik pertama langsung menyebut angka — kemungkinan besar ini yang menahan scroll"*). This is where the feature earns its keep; a bare number would not need Gemini at all.

**Moved to §5.1 (computed by code) per OR-13:** `tierUsed` (`CREATOR_BASELINE` / `REACH_ONLY` /
`AUDIENCE_FALLBACK` / `UNAVAILABLE`); `confidence` (`HIGH` / `MEDIUM` / `LOW` / `NONE`) plus its demotion
reason; `basedOnVideos`, the Tier 2 sample size — **Tier 2 must never appear without it** (precedent: the
fingerprint's indicator, live PRD §6.1); `provisional`; and `unavailableReason` (§4.4).

### 5.3 Relationship to `overallScore` [CONFIRMED — D7]

**Keep them separate. Do not fold performance into `overallScore`.** They answer different questions, and collapsing them destroys the most useful signal this feature produces (§3.5, point 2): *good content that didn't travel*. Two axes, always shown as two.

### 5.4 Reproducibility discipline

Inherited unchanged from the live contract and binding on this layer:

- `temperature: 0`, structured output via `responseSchema`, no regex-scraping.
- **No invented values on parse failure.** A missing performance field fails loudly.
- Absence of an *input* is an expected state (§4.4) and is **not** a parse failure. These two must not be conflated in implementation.
- Enum identifiers are **English machine-stable**; Indonesian labels via UI lookup (live PRD §4.2).

---

## 6. Acceptance criteria (3B)

Gherkin, phrased so each is actually checkable. **No screenshot-only criteria** — an unmet screenshot criterion has already been merged unverified in this repo (handoff, carried-forward item 2); anything visual below is paired with a mechanical check.

**AC-1 — Tier 1 on a brand-new creator**
*Given* a creator with zero prior analyses and a reel with an available reach count,
*When* the analysis completes,
*Then* `tierUsed` is `REACH_ONLY`, `performanceScore` is an integer 1–5, `basedOnVideos` is 0, and the verdict prose contains no baseline or multiplier claim.

**AC-2 — Tier 2 activates at the threshold, per bucket**
*Given* a creator with exactly N−1 prior completed analyses **in the same format bucket** (N = the confirmed minimum from D4, **5, counted per bucket and never per creator** — §14.2),
*When* one more **in that same bucket** completes,
*Then* the newest analysis reports `tierUsed: CREATOR_BASELINE` with `basedOnVideos` equal to the prior count, and the prior analyses' stored scores are **unchanged** (frozen, per D8).

**AC-3 — Hidden counts produce no score**
*Given* a post with `like_and_view_counts_disabled === true`,
*When* the analysis completes,
*Then* `performanceScore` is `null`, `tierUsed` is `UNAVAILABLE`, `unavailableReason` is `REACH_HIDDEN`, the analysis status is **`completed`, not `failed`**, and the content scorecard is fully populated.

**AC-4 — The false-zero fixture**
*Given* the committed fixture `ig_reel_1_zero_view_count.json` (`video_view_count: 0`, `video_play_count: 116333`),
*When* reach is resolved,
*Then* reach is **116,333** with kind `PLAYS`, and every ratio uses 116,333 as the denominator. A ratio computed against 0 is a test failure.

**AC-5 — Carousel reversal**
*Given* the committed fixture `ig_carousel_mixed_video_and_image_10_slides.json` (`video_play_count: null` on all video children),
*When* reach is resolved,
*Then* it comes from `video_view_count` with kind `VIEWS`, and the result is not `UNKNOWN`.

**AC-6 — All-image carousel** *(superseded by §12; see AC-18 and AC-23)*
*Given* `ig_carousel_all_images_10_slides.json`,
*When* the analysis completes,
*Then* **no reach value and no reach kind is stored**, and the row is scored on the follower-denominated Tier 1 defined in §12.2 (plus Tier 2 where the bucket has history) — **never a reach-based ratio, and never an `UNAVAILABLE` state merely because the content kind is images**.

**AC-7 — No fabricated numbers** (implements S2)
*Given* any completed analysis with a performance block,
*When* numerals are extracted from `verdict` and `drivers[]`,
*Then* every one appears in the computed block of §5.1, within a stated rounding tolerance.

**AC-8 — Reach labelling** (implements S5)
*Given* an analysis whose reach kind is `PLAYS`,
*When* the verdict prose and the table cell render,
*Then* neither presents that number as "Views". Enforced by extending the existing engagement-label test to the performance prompt block.

**AC-9 — Frozen point-in-time**
*Given* a completed analysis,
*When* the creator's follower count later changes and the profile cache refreshes,
*Then* the stored performance score, ratios and audience number are **byte-identical** to before.

**AC-10 — Determinism** ⚠️ **CORRECTED 2026-08-06 (V4). The original half of this criterion cannot pass.**

~~*Then* the computed block is byte-identical **and `performanceScore` is identical**.~~

*Given* identical inputs,
*When* the analysis runs twice at `temperature: 0`,
*Then* **the computed block is byte-identical** — because code, not Gemini, produces every field in it
(§5.2 as amended; TDD OR-13).

**`performanceScore`, `verdict` and `drivers[]` are explicitly excluded from this guarantee.** V4 measured
two byte-identical `analyzeContent()` requests at `temperature: 0` returning non-identical output — and the
divergence was **not confined to prose**: `formatArchetype` flipped `TEXT_SLIDESHOW` → `CAROUSEL_STATIC`,
`pacing` flipped `FAST` → `SLOW`, `estimatedCutsPerMinute` went `20` → `null`, `ctaType` reordered and
`structureBeatMap` resegmented from 10 beats to 6. These are enums and numbers. `overallScore` and all 7
scorecard dimensions were stable, but stability was **observed, not guaranteed**, on n=2.

**This drift is accepted, not defended against** (TDD OR-22): an analysis runs once and is stored, so it is
only observable via Re-analyze. **Its one real consequence is now specified as product behaviour in §14.1**
(and engineering-side in TDD §13 E8) — `formatArchetype`
and `pacing` feed the style fingerprint, so a re-analysis can legitimately change a creator's classification.
**§14.1 is the citable statement; a ticket should cite R-14.1.1, not this criterion.**
**Do not write a test asserting `performanceScore` is reproducible; it would be a flaky test asserting a
false claim.**

**AC-11 — Maturity**
*Given* a post under the confirmed maturity floor (D5),
*When* the analysis completes,
*Then* `provisional` is `true`, the UI shows an "early" badge, and that post is excluded from other analyses' baseline medians.

**AC-12 — Deletion migration**
*Given* the pre-3B `analyses` rows,
*When* the migration runs,
*Then* zero rows remain at the old `schemaVersion`, and the app renders the empty state without error.

---

## 7. Non-goals (3B)

- **Follower/metric snapshots over time.** Explicitly out [CONFIRMED, roadmap decision 9]. The accepted consequence — historical follower counts at post-publication time are permanently unrecoverable — is a deliberate choice, not an oversight.
- **Recomputing scores as a creator grows.** Point-in-time and frozen.
- **Shares and saves.** Not exposed by any verified endpoint (§4.2).
- **A universal industry benchmark.** Rejected, §3.4.
- **Cross-creator comparison / leaderboards.**
- **Predicting future performance.**
- **The job queue (3A).** Separate workstream.
- **Any machinery to keep a creator's style classification stable across re-analyses.** No reconciliation, no versioned re-analysis records, no re-run-until-they-agree, no best-of-three vote. **The drift is accepted product behaviour and is specified in §14.1.** Considered and declined; do not re-open.
- **Pooling formats into a shared Tier 2 baseline, or a lower threshold for any one format.** Both were considered and declined. **§14.2.**

---

## 8. Phase 3C — the analyses table

**Strictly after 3B** [CONFIRMED, roadmap decision 6] — the table's job is to display 3B's output.

**Do NOT produce visual mockups in this document.** Layout, spacing, density and column widths are the UI/UX designer's job, working from this list. This section specifies **what** and **why**, not what it looks like.

### 8.1 Notes for the owner before design starts

- **`AnalysisGrid` / `AnalysisCard` are dead, unreachable code you have already decided to delete** (RUNBOOK §8.5; handoff item 3). **The table is the only view.** Nothing in 3C should be designed around a card layout, and the designer should not be shown one. `AnalysisGridSkeleton` is a **different, live** module — do not delete it by association.
- **Desktop-only.** Not an oversight, a scope decision.
- **The one constraint the designer must not design around: §12.3.** Two different engagement percentages exist in this table and they are **not comparable**. How they are distinguished is entirely the designer's call; **that they are unmistakably distinguished is a requirement, and the mockup review is where it gets signed off.**
- **The column set in §8.3 is provisional until this mockup is reviewed** (caveat C2). The owner approved the *fields*; he has not yet seen the *table*. Expect and welcome cuts.
- **§13 (score explainability) is the other required input to this design pass, and it is the larger one.** The owner has required that every score explain itself inside the app. §13 specifies **what** must be explained and **where**; **how it looks is entirely the designer's decision** and is deliberately unspecified. **Read §13.8 first** — it states the boundary explicitly.

### 8.2 Columns that exist today and are never surfaced

Migration **006** added fourteen, and migration **009** added three more. Per the roadmap (§3, 3C) the list and detail read paths **do not select them** — they feed the Gemini prompt and go nowhere. From the migration files:

`like_count`, `comment_count`, `has_audio`, `audio_title`, `audio_artist`, `audio_id`, `audio_is_original`, `original_width`, `original_height`, `carousel_item_count`, `profile_id`, `follower_count`, `engagement_rate`, `analysis_mode` (006) — plus `play_count`, `coauthor_producers`, `like_and_view_counts_disabled` (009).

Two things the owner should know:

- **`engagement_rate` already exists as a stored `REAL` column and is written today.** **3B supersedes it.** Decision **D10**.
  **[CORRECTED 2026-08-06 — tech-lead code audit, owner ruling OR-12; this bullet previously said the column was "written and never read" and that its denominator was "not documented anywhere". Both were wrong.]**
  - It **is read** — into the Gemini prompt. `lib/server/analysis/pipeline/index.ts:124-135` computes it, writes it, **and assigns it onto `metadata.engagementRate`** so the prompt builder can read it; `lib/server/analysis/prompts/user.ts:111-112` emits `- Engagement rate: <percent>` into the user prompt on **every** analysis. It is unread by the *list/detail read paths* only.
  - Its **denominator is documented** — in code rather than in product docs. `lib/server/profiles/helpers.ts:23` `computeEngagementRate()` is `(likes + comments) ÷ followerCount`, with a docstring saying so, returning `null` when `followerCount` is null or 0.
  - **Consequence: dropping it is a correctness fix, not cleanup.** The prompt currently hands Gemini a **follower-denominated** ratio under the bare, unqualified label `Engagement rate`, on every content type including reels — a live **R-12.3.1** violation and the same bug class `user.engagementLabel.test.ts` exists to prevent on the reach axis.
- The read paths were audited against the code on 2026-08-06 (`lib/server/db.ts` `getAnalysesList()` / `getAnalysisDetail()`). The roadmap's "written and never read" framing holds for the *UI* read paths and not for the *pipeline*.

### 8.3 Default columns [CONFIRMED — D9, provisional until mockup review per caveat C2]

Ordered left to right. The goal is US-6: scan a creator's library and find what worked, without opening rows.

| # | Column | Why it earns a slot |
|---|---|---|
| 1 | Thumbnail + title/caption snippet | Identification. Visual recall is how anyone finds a specific post. |
| 2 | Creator `@username` + platform | The table is cross-creator; without this it is unreadable. Sortable/filterable. |
| 3 | Content kind + `analysis_mode` badge | **A caption-only `metadata_only` analysis currently renders identically to a full video analysis.** That is a correctness problem, not a nicety — it makes an image-carousel row look like the video was watched. Also carries `carousel_item_count`. |
| 4 | Posted date + **age** | Age is load-bearing for reading any performance number (§4.5), and carries the `provisional` badge. |
| 5 | **Reach**, with its kind label (`PLAYS` / `VIEWS`) and hidden/unknown state | The number the agency looks at first. Must never be mislabelled (R-4.3.1). |
| 6 | Likes / comments, with availability states | Same treatment. One combined cell or two — designer's call. |
| 7 | **Performance score (1–5) + tier badge + confidence** | **3B's headline. The reason 3C waited for 3B.** |
| 8 | **Baseline multiplier ("3.2×") when Tier 2 is available**, with `based on N videos` | The single most quotable number the product produces (§3.1, §3.5). |
| 9 | Engagement % — **with its denominator unmistakably visible** (`REACH` vs `FOLLOWERS`) | Tier 1. Pairs with #8 to give the good-content-vs-good-distribution read. **R-12.3.1 applies here in full: a reel's 4% and an image carousel's 4% are different quantities and must not read as one column of comparable numbers.** The designer decides how; that it must be unmissable is not negotiable. |
| 10 | Overall content score (1–5) | The existing quality axis. **Deliberately adjacent to #7 and never merged with it** (§5.3). |
| 11 | `formatArchetype` + `hookType` badges | The two most decision-relevant Tier 1 style fields; they turn the table into "what kind of content works for this creator". |
| 12 | Status | Failures must be visible, not silent. |

**Deliberately not default columns** (available in the detail view instead): `topicNiche` / `topicSubtopic`, `ctaType` / `ctaTiming`, all audio fields, `original_width` / `original_height`, `coauthor_producers`, `follower_count`, `profile_id`, `schema_version`. Rationale: a wide table nobody can read is a worse outcome than a narrow one plus a good detail view, and the detail modal already exists.

### 8.4 Behavioural requirements

- **R-8.4.1** Sortable by performance score, baseline multiplier, reach, engagement, overall score, and date — **subject to R-12.3.2: an engagement sort must never interleave reach-denominated and follower-denominated values.**
- **R-8.4.2** Filterable by creator, platform, content kind, tier, and status.
- **R-8.4.3** **Unavailable states render as their reason, not as blank or `0`.** "Counts hidden", "Not yet enough history", "No reach data for image posts". Precedent exists in the shipped engagement-count display states.
- **R-8.4.4** A Tier 2 number never appears without its sample size.
- **R-8.4.5** No cell fabricates a value. A null score is a null score.
- **R-8.4.6** Contrast: any new badge is measured in **gamma-encoded sRGB** against `--background`, `--card` **and** the row-hover surface, ≥ 4.5:1 on all three. This exact error class has shipped non-compliant twice (RUNBOOK §8.4). It is checkable numerically and is therefore a real acceptance criterion, not a screenshot.
- **R-8.4.7** **The engagement denominator is visible without interaction** on every row that shows an engagement percentage (R-12.3.1). No hover, no legend, no prior knowledge of the content type required. **This is a hard constraint on the design, not a preference**; the mockup review must sign it off explicitly (caveat C2).
- **R-8.4.8** Every row carries the **table-tier explainability information defined in §13.7** (R-13.7.1 to R-13.7.6). See §13 — explainability is a requirement on this table, not a detail-view-only concern.
- **R-8.4.9** **Cold-start copy must be bucket-honest — see R-14.2.5, which is binding on tickets #145–#149.** No empty, cold-start or insufficient-history string in this table may say **"5 posts"**, because the threshold is 5 posts **of that format**, and a creator who has already analysed 8 posts will read "5 posts" as a broken feature. The progress figure and the format noun travel together.

### 8.5 Acceptance criteria (3C)

**AC-13** — *Given* an analysis with `analysis_mode` of `metadata_only` or `images_only`, *When* the table renders, *Then* the row is distinguishable from a `full_video` row by a labelled badge, asserted in a component test.
**AC-14** — *Given* a mix of rows with and without performance scores, *When* sorting by performance descending, *Then* scored rows sort correctly and unscored rows group at the end — never sorted as if they were 0.
**AC-15** — *Given* a Tier 2 row, *When* rendered, *Then* the sample size appears in the same cell as the multiplier (component test).
**AC-16** — *Given* a post whose reach kind is `PLAYS`, *When* the cell renders, *Then* its label reads plays (component test; implements S5 at the UI layer).
**AC-17** — Every new badge's contrast ratio is computed by the §8.4.6 procedure and the three surface values are recorded in the PR body.

---

## 9. Risks, costs and dependencies

### 9.1 Cost

| Item | Impact |
|---|---|
| ScrapeCreators credits | **No increase.** Every metric 3B needs is already fetched today. Tier 3 reads the existing 7-day-TTL profile cache. |
| Gemini prompt tokens | ~+600–1,000 per analysis. Baseline is 24,052 prompt tokens on a real reel — roughly a 3% increase. |
| Gemini output tokens | ~+300–600. Measured headroom is **83%** on a production-sized request; this stays comfortably clear of `MAX_TOKENS`. |
| DB | One extra read per analysis (the creator's prior analyses, for the baseline). |
| Deletion migration | Zero — 3 rows. |
| ~~**Unmeasured risk**~~ → **MEASURED, and the risk framing was WRONG** | ⚠️ **CORRECTED 2026-08-06 by V3.** This row previously read: *"Carousel token headroom has never been measured… a 10-slide carousel plus a longer prompt is the case that would actually bind."* **That is empirically false.** V3 ran a real 10-slide video-bearing carousel through the **production** pipeline (`runAnalysis()` end to end) and measured **~85.5% output-token headroom (4,758 of 32,768 spent)** against the single-reel baseline of **~83%**. **The carousel was cheaper on every token axis than the reel** — `promptTokenCount` 15,663 vs 24,052, candidates 2,192 vs 1,574, thoughts 2,566 vs 3,994. Sixty-one seconds of continuous video plus audio costs more than seven short slides plus three images. **Do not carry "carousels are the higher-risk case for `MAX_TOKENS`" into implementation.** This discharges `docs/HANDOFF-2026-08-05.md` carried-forward item 6. **Residual, stated honestly:** V3 measured the *current, pre-3B* contract, so it falsifies *"carousels bind"* without proving *"3B's longer prompt fits"* — but 3B's budgeted +300–600 output tokens is under 2% of the 28,010 measured free tokens, so this is an observation to record on the first real 3B run, **not a gate**. n=1. See TDD §8.4. |

### 9.2 Risks

- **R1 — ⚠️ RESOLVED 2026-08-06 — V1 IS CAPTURED, and it found something worse than expected.** ~~The counts-disabled payload shape is unverified… approved but not yet captured.~~ Fixture committed at `.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json`. **The finding: on a genuinely counts-disabled post, `edge_media_preview_like.count` is `-1`** — not `0`, not `null`, not absent — **with `edges[]` still populated with real usernames.** The shipped adapter is safe only because it gates on `like_and_view_counts_disabled === true` *before* reading the count. **New 3B code that reads the count first produces a negative engagement ratio and renders it as real.** Binding rule: **a negative count is `UNKNOWN`, never data; never `?? 0`, never `Math.max(x, 0)`.** See TDD §1.7 / OR-20 and ticket #140. §12.1's finding stands unchanged: on an all-image carousel the flag is absent entirely, so absence must never be read as `false` (R-12.2.3). **Still open:** V1's sample is an image post, so a counts-disabled *video* remains unobserved — nothing may infer reach behaviour from the flag.
- **R2 — YouTube likes-hidden behaviour is UNCAPTURED, and is now RULED rather than blocking** ([VERIFY] V2). **0 credits were spent** — the blocker is finding a real candidate video, not budget. **Owner ruling (TDD OR-21), binding and not provisional: on `likeCountInt`, `0`, `null` and field-absent ALL mean `UNKNOWN`.** No score is fabricated, no fake zero is stored. **The accepted cost, deliberately taken: a genuinely zero-like video will read "unknown".** **3B is NOT blocked on V2**; if V2 is ever captured it can only narrow this rule, and nothing has to be rewritten to accept it. See §4.7.
- **R3 — The follower count is up to 7 days stale.** Accepted by the owner. Mitigated by Tier 2 being the headline (it does not use the follower count at all), and by never presenting Tier 3 as exact.
- **R4 — Tier 2 on a 5-post baseline is statistically thin.** Same caveat the fingerprint carries. Mitigated by always showing the sample size, never by hiding it. **⚠️ CLARIFIED 2026-08-07: that 5 is 5 posts *in one format bucket*, not 5 posts by the creator (§14.2). The nearby "same caveat the fingerprint carries" must not be read as "same threshold" — the fingerprint counts per creator, Tier 2 counts per bucket.**
- **R5 — The table gets too wide.** Mitigated by §8.3's explicit non-default list. If the designer pushes back, cut from the bottom of the default list, not from #7/#8.
- **R6 — Two engagement percentages that look identical but are not comparable** (§12.3). **The highest-severity *product* risk introduced by §12**, because the failure is silent: nothing errors, a user simply draws a wrong conclusion and repeats it to a client. Mitigated by R-12.2.2 (a required denominator discriminator that must survive every layer, so dropping it is a type error), R-12.3.1–.3.3, AC-20/21, and explicit designer sign-off at mockup review. **Also the reason §13 exists:** R-12.2.2 makes the system *correct*; **§13.6 requires that the user cannot *misread* it.** Those are two different requirements and R6 is not mitigated until both are met.
- **R7 — Slow Tier 2 cold start on image carousels** (§12.4). For a creator who rarely posts carousels, the bucket may sit under the minimum of 5 indefinitely, leaving image posts on a `MEDIUM`-confidence follower ratio with no baseline. **Accepted deliberately** — lowering the threshold would produce a number we could not defend. Mitigated by showing the state ("3 of 5 carousels"), never hiding it. **The general form of this risk — it is not carousel-specific, it hits any creator who posts a steady mix of formats — is §14.2, and the honest-copy requirement that mitigates it is R-14.2.5.** Revisit when bulk ingestion (3A) lands.

### 9.3 Dependency on 3A (the only genuine one)

3B and 3A are independent [CONFIRMED]. One real touchpoint: **when bulk ingestion arrives (blocked on 3A), a creator's baseline is built from N posts analysed in one batch.** Whether baseline computation happens per-analysis or once at the end of a batch is a 3A-era question, not a 3B one. Recorded so it is not rediscovered; **no 3B ticket should try to solve it.**

---

## 10. Owner decisions — all [CONFIRMED] 2026-08-05

The owner reviewed all ten open decisions and **accepted the recommended option on every one**. This section is now a record of rulings, not a list of questions. **Rejected options are kept visible with their rationale so nobody re-opens them in a ticket.**

### 10.0 Two caveats attached to the acceptances

Recorded honestly rather than allowed to harden into false precision:

- **C1 — The 72-hour maturity floor (D5) is an estimate, not a measured figure.** Nobody has data on how long a post takes to settle; we have explicitly ruled out longitudinal snapshots (§7), so we have no observations to derive it from. **72 hours is a starting value chosen for order-of-magnitude plausibility and is expected to be tuned once real analyses accumulate.** It must not be described anywhere — in code comments, in UI copy, or in a ticket — as a derived or validated constant. The tech lead should make it a single named, configurable constant so tuning it later is a one-line change, not a refactor.
- **C2 — The 12-column set (D9) was accepted without the owner having seen it rendered.** A column list on a page reads very differently from a table on a screen; width, density and scan order are exactly the things a list cannot convey. **The intended review checkpoint is the UI/UX mockup.** Treat §8.3 as **provisional until the designer's mockup is reviewed**, and expect column cuts or reorderings at that point. This is a normal design step, not a re-opened decision — D9's *content* (which fields matter) is confirmed; the *presentation* is not yet judged.

### 10.1 The rulings

**D1 — The formula. [CONFIRMED → Option B]**
The **three-tier degrading model** (§3.3), including both amendments in §3.5 (Tier 3 demoted below "fallback"; Tier 1 and Tier 2 shown **together**, because the pair distinguishes good content that did not travel from weak content that did).
*Rejected:* (a) engagement-per-reach only — blind to distribution, which is most of what the agency is actually asking. (c) universal industry benchmark — published Reels benchmarks in §3.1 differ by ~10× depending on denominator and sample; adopting one encodes a vendor's sampling as truth. Same failure mode that got `trendAlignment` removed from the live contract.

**D2 — Division of labour. [CONFIRMED → arithmetic in code, interpretation in Gemini]**
All ratios, medians and multipliers are computed deterministically in code, stored, and frozen. Gemini receives the computed numbers and produces the judgement only.
*Rejected:* Gemini computing the ratios — non-reproducible, and breaks the `temperature: 0` + `responseSchema` discipline the live contract is built on.

**D3 — Hidden / zero / absent inputs. [CONFIRMED → no score plus a visible reason]**
When a required input is `HIDDEN`, `UNKNOWN` or absent, **no score is produced**: `performanceScore` is `null`, tier is `UNAVAILABLE`, confidence is `NONE`, and a machine-readable reason is stored **and rendered as text in the UI** — never a blank cell, never an em-dash, never a zero.
*Rejected:* (b) hiding the performance column for that row — throws away a fact the agency wants ("counts hidden by creator" is useful). (c) an estimated score at low confidence — this is precisely how the fabricated-`5` bug entered the codebase. **House rule, now doubly confirmed: never invent a number.**

**D4 — Baseline bucketing and minimum sample. [CONFIRMED → (platform, content kind), minimum 5 per bucket]**
A creator's median is computed within `(platform, content kind)` and never across. Cold start applies **per bucket** and must be visible in the UI, not silent.
*Rejected:* (a) platform-only bucketing — mixes reels and carousels, which do not perform comparably. (c) minimum 3 at `LOW` confidence — too thin to quote to a client.
*Sub-question, also confirmed:* for **video-bearing** carousels, post-level reach is the **first slide's** count, labelled as such, at one confidence level lower. Summing slides is invalid (it double-counts the same viewer).
*Consequence now made explicit:* see §12.4 — an **all-image-carousel bucket needs its own 5**, which is a slow cold start for creators who post carousels rarely.
**⚠️ READ THIS AS "5 PER BUCKET", NOT "5 PER CREATOR" (2026-08-07).** Every bucket needs its own 5 independently — this is not a carousel-only footnote. **A creator with 4 reels and 4 carousels has 8 analysed posts and receives no Tier 2 comparison at all.** **§14.2 states the rule, the worked example and the rationale, and is binding on the 3C cold-start copy.** *Also re-confirmed 2026-08-07:* a **lower threshold for the carousel bucket was considered and declined** (`docs/HANDOFF-2026-08-06.md` §11). `BASELINE_MIN_SAMPLE` is **5 for every bucket**. Do not re-open it.

**D5 — Recency. [CONFIRMED → age in prompt + maturity floor + age-bounded baselines]**
All three parts: post age in days is passed to Gemini and weighed in the verdict; posts under the maturity floor are marked `provisional`; posts under the floor are excluded from other analyses' baseline medians.
*Rejected:* (a) doing nothing — systematically flatters old posts, backwards for a tool meant to say what works now. (c) reach-per-day velocity as the headline — makes new posts look explosive and mature posts look dead.
*Sub-question:* **72 hours is confirmed as the starting value, subject to caveat C1 above.**

**D6 — YouTube scope. [CONFIRMED → full parity]**
YouTube is in scope for 3B at full parity. §4.7's reasoning stands: for *performance* scoring YouTube's data is cleaner than Instagram's — one unambiguous view count, confirmed-numeric subscriber count, no play-vs-view trap.
*Rejected:* (b) Tier 3 only, (c) excluded — both were justified by missing *content-analysis* context (audio flag, dimensions), which is irrelevant to this feature.
*Caveat carried:* ~~V2 (below) is now approved and must be captured before code depends on YouTube's likes-hidden shape.~~ **UPDATED 2026-08-06:** V2 could not be captured. Code still may not depend on the *shape*; it depends instead on the **shape-agnostic** OR-21 rule (`0` / `null` / absent → `UNKNOWN`). **Not a blocker.**

**D7 — Score composition. [CONFIRMED → separate axis]**
`performanceScore` stays a **separate axis from `overallScore`**. Two axes, always rendered as two, never merged, never averaged into a single headline number.
*Rejected:* folding performance into `overallScore` — destroys the good-content-vs-good-distribution signal, which §3.5 argues is the most useful thing this feature produces.

**D8 — Baseline freezing. [CONFIRMED → frozen]**
The baseline, the ratios and the audience number are frozen at analysis time. **Old analyses are never re-scored** when new siblings land or when the creator's audience grows.
*Rejected:* recomputing a creator's history on each new analysis — contradicts the point-in-time ruling (roadmap decision 9) and makes the table non-reproducible.

**D9 — The 3C default column set. [SUPERSEDED 2026-08-06 → the approved 9-column set]**
The 12-column set was accepted *as the basis for design*, provisional per caveat **C2**. **C2's mockup review has now happened and the owner has ruled** (OR-1, OR-3, OR-4, OR-5): the default set is **9 columns**, per `docs/design/DESIGN-3C-analyses-table.md` §2.2 and `docs/TDD-3A-3B-3C-phase-3.md` §9.1. Changes from §8.3: **#3** collapses into #1; **#5 + #6** collapse into one two-line Counts column; **#9** splits into **two** columns (reach-denominated and follower-denominated — the R-12.3.4 sign-off, Direction A); **#11** becomes an optional column, **off by default**; **#12 Status is cut** as a column and replaced by a whole-row failure treatment plus the surviving status *filter*. **#7 and #8 are untouched**, per R5.

**D10 — The existing `engagement_rate` column. [CONFIRMED → drop the column; KEEP and repurpose the function]**
`analyses.engagement_rate` is **dropped** and 3B's computed block supersedes it.
**[CORRECTED 2026-08-06 — owner ruling OR-12.]** The original rationale ("its denominator is documented nowhere") was factually wrong: the denominator is **followers**, documented in `lib/server/profiles/helpers.ts:23`. The column is dropped for the *other*, stronger reason — a single column named `engagement_rate` cannot honestly hold 3B's several differently-denominated ratios (R-12.2.2), and the prompt line it feeds is a live mislabelling defect (§8.2). **Dropping it is a bug fix, not cleanup.**
**`computeEngagementRate()` itself is NOT deleted.** It is relocated to `lib/server/analysis/performance/ratios.ts` as 3B's **follower-denominated Tier 1 primitive** with a mandatory `denominator: "FOLLOWERS"` on its return value — it is already exactly the formula R-12.2.1 specifies. The mislabelled prompt line at `prompts/user.ts:111-112` is removed with it.
*Rejected:* (b) redefining the *column* as one of 3B's ratios — see above. (c) leaving it unread — two incompatible "engagement" numbers in one schema is a latent bug.

### 10.2 Verification spends — all three [APPROVED]

**⚠️ STATUS UPDATED 2026-08-06 — three of the four have now run. Actual spend and outcome recorded here so
"Approved" is never again mistaken for "verified".**

| ID | What | Cost | Status |
|---|---|---|---|
| **V1** | Capture one genuinely counts-disabled Instagram post | ~1 SC credit approved · **1 spent** | ✅ **CAPTURED** — `ig_post_counts_disabled.json`. **Finding: `edge_media_preview_like.count` is `-1`.** See §9.2 R1. |
| **V2** | Capture one YouTube video with likes hidden | ~1 SC credit approved · **0 spent** | ⚠️ **NOT CAPTURED** — no candidate video found; discovery blocker, not budget. **No longer blocking:** owner ruled the conservative rule (§9.2 R2, TDD OR-21). **The only outstanding verification in Phase 3.** |
| **V3** | One live Gemini call on a **multi-slide carousel**, reading `usageMetadata`, to measure output-token headroom for the extended contract | 1 Gemini call approved · **1 Gemini call + 2 SC credits spent** (a stale worktree DB forced one retry — recorded, not rounded down) | ✅ **CAPTURED** — **~85.5% headroom, better than the reel's ~83%.** §9.1's risk row is **falsified**. Ungates TDD ticket 3B-4 (#142). |
| **V4** | Two `analyzeContent()` calls on identical input at `temperature: 0` (approved separately, TDD OR-16) | 2 Gemini calls approved · **4 spent** (a script was re-run by mistake — recorded plainly) | ✅ **RUN — and it FAILED.** `temperature: 0` is **not** deterministic on this schema. **S3 and AC-10 are corrected.** Drift accepted (TDD OR-22, §13 E8). |

**These are for the tech lead / developers to execute during implementation. No PM or docs work should spend them.**

**V3 also discharges a pre-existing carried-forward unknown.** Carousel token headroom has been unverified since the analysis schema redesign — `docs/HANDOFF-2026-08-05.md` carried-forward item 6 records that the only live measurement (~83% headroom) was taken on a **single-video reel**, not a multi-slide carousel. V3's measurement closes that item as well as 3B's own risk; whoever runs it should update `.claude/context/verified-facts.md` and strike the handoff item in the same pass.

~~**Until V1 and V2 land, no code may depend on the *shape* of a counts-disabled Instagram payload or a likes-hidden YouTube payload**~~ — **UPDATED 2026-08-06.** V1 has landed: code may now depend on the **committed fixture**, and must depend on it, including the **`-1` sentinel** (§9.2 R1). V2 has not landed and code still may **not** assume any shape for a likes-hidden YouTube payload — but it no longer waits on it either: **`0`, `null` and absent are all `UNKNOWN`** (TDD OR-21), which is shape-agnostic by construction and would survive any of the three shapes V2 might reveal.

---

## 11. Contradictions and corrections found while writing this

Recorded plainly rather than quietly worked around.

1. **The roadmap's stated reason for questioning YouTube parity does not apply to 3B.** §3, 3B lists "[OPEN] whether YouTube is in scope at parity" and cites the missing audio flag and dimensions. Those are **content-analysis** context; for **performance** scoring YouTube is cleaner than Instagram (one unambiguous view count, confirmed numeric subscriber count). The question is still worth asking; the stated reasoning should not drive the answer. (§4.7)
2. **The steer includes "shares/saves if available" — they are not available.** No captured ScrapeCreators payload for either platform exposes shares or saves. Tier 1 is likes and comments only. (§4.2)
3. **There is no single "resolve reach" rule, and the roadmap's framing implies there is one.** §3, 3B correctly warns that view and play counts are distinct, but the reliability is **reversed between top-level reels and carousel children** (`verified-facts.md`, divergence 13). Any shared helper needs a branch, not a rule.
4. **All-image carousels have no reach data at all.** Not mentioned in the roadmap's 3B section, and it means a whole content type can never receive a **reach-based** score on current data sources. **Resolved in §12** — they are scored on a different denominator rather than excluded. (§4.6, §12)
5. **`analyses.engagement_rate` already exists and is populated.** The roadmap describes 3B as adding performance scoring where "nothing captures whether a video performed" — true at the *product* level, but a computed engagement number is already sitting in the schema and must be reconciled, not ignored. (§8.2, D10)
   **[CORRECTED 2026-08-06 — OR-12.]** This item originally added "with a denominator documented nowhere in the product docs". **The denominator is followers and it is documented** — in `lib/server/profiles/helpers.ts:23`. The sharper correction is that the column is **read into the Gemini prompt** (`prompts/user.ts:111-112`) under the bare label `Engagement rate`, which is a live **R-12.3.1** violation. See §8.2.
6. **`docs/PRD-analysis-schema-redesign.md` §9 still cites "2 rows in `analyses`, 1 in `profiles`."** The measured figure as of 2026-08-05 is **3 and 2**. Immaterial to any decision; noted for accuracy.
7. **`verified-facts.md` overstated the `like_and_view_counts_disabled` fixture coverage. [CORRECTED 2026-08-05 — no longer outstanding.]** Its OPEN-gap section stated *"All five committed fixtures … have this field set to `false`."* Two things were wrong with that: there are **seven** committed Instagram fixtures, not five, and the field is **ABSENT entirely** from `ig_carousel_all_images_10_slides.json` (zero occurrences in the file).
   **Re-verified independently by key-set inspection of every committed Instagram fixture, zero live calls.** Five of the six `/v1/instagram/post` fixtures carry it as `false`; the all-image carousel does not carry it at all; the profile fixture carries it on 24 nested timeline nodes. **Critically, the absence tracks neither `__typename` nor image-ness** — see the expanded finding in §12.1.
   The practical effect on shipped code is benign, because `adapter.ts` already tests `=== true` strictly and so does not coerce absent to `false`. The product consequence is not benign: on an all-image carousel we **cannot tell whether counts are hidden**, only that likes and comments happen to be present. That drives **R-13.5.3**.
   **`.claude/context/verified-facts.md` has now been corrected** — append-only, with the original claim retained under a supersede banner per that file's convention. **No tech-lead action is carried forward from this item.**

---

## 12. All-image carousels — the resolution [CONFIRMED direction, pending the checks in §12.7]

The first draft flagged that all-image carousels have no reach data on either platform and left it as a limitation. The owner asked directly what we do about it. **This section answers it.** It supersedes the corresponding bullet in §4.6.

### 12.1 What I actually verified — no assumptions, no credits spent

Everything below comes from the **committed** fixture `.claude/context/fixtures/scrapecreators-instagram/ig_carousel_all_images_10_slides.json` (captured under prior owner authorisation, `RUNBOOK.md` §6; source post `/p/DVtNQtmCQnO/`, 10 slides, every child `XDTGraphImage`) cross-checked against `.claude/context/verified-facts.md`. **Zero live API calls were made.** Field paths are given in full, from the response root.

**Present and usable — the finding the resolution rests on:**

| What | Field path | Value in the fixture |
|---|---|---|
| **Likes** | `data.xdt_shortcode_media.edge_media_preview_like.count` | `32313` |
| **Comments** | `data.xdt_shortcode_media.edge_media_to_parent_comment.count` | `13840` |
| Comments (duplicate #1) | `data.xdt_shortcode_media.edge_media_preview_comment.count` | `13840` — identical |
| Comments (duplicate #2, **carousel-only flat field**) | `data.xdt_shortcode_media.comment_count` | `13840` — identical |
| Post age | `data.xdt_shortcode_media.taken_at_timestamp` | `1773150940` (unix **seconds**) |
| Caption | `data.xdt_shortcode_media.edge_media_to_caption.edges[0].node.text` | populated |
| Slide count | `data.xdt_shortcode_media.edge_sidecar_to_children.edges[]` | length `10` |
| Content-kind discriminators | `data.xdt_shortcode_media.__typename` / `.is_video` / children's `__typename` | `XDTGraphSidecar` / `false` / all `XDTGraphImage` |

**Likes and comments are present. The resolution below therefore stands** (the collapse case in §12.6 does not apply).

**Absent — confirmed by key-set inspection, not by inference:**

- `data.xdt_shortcode_media.video_view_count` — **key not present**
- `data.xdt_shortcode_media.video_play_count` — **key not present**
- No reach-like field anywhere in the payload, top-level or per-child. Image children carry only 7 keys: `__typename, id, shortcode, display_url, video_url (null), is_video, dimensions`. **There is no per-slide impression, view or play count.**
- Shares and saves — absent, as everywhere else (§4.2). Unchanged.

**Two things the PRD had not accounted for, both of which matter:**

1. **`like_and_view_counts_disabled` is ABSENT on this payload** — not `false`, absent. Every other committed Instagram post fixture carries it as `false`. This is recorded as correction 7 in §11 and drives requirement **R-12.2.3** below.
   **Re-verified 2026-08-05 across all seven committed Instagram fixtures, and the picture is sharper than first reported — this matters for implementation.** The absence is **not** predictable from `__typename`, and **not** predictable from "the content is images":
   - **Both** carousel fixtures are `XDTGraphSidecar`. The **mixed** video/image carousel **has** the field (`false`); the **all-image** one does not have it at all.
   - `ig_single_image_post.json` is `XDTGraphImage` — image-only content — and it **does** carry the field as `false`, with a full 17-key `owner` block.
   - The all-image carousel is a **structurally reduced payload variant**: 25 top-level keys, against 49 on the mixed carousel and 48 on the single image post.
   **Consequence, and it strengthens R-12.7.1:** any rule of the form "sidecars have no flag" or "image posts have no flag" would be **wrong**. Branch on **field presence only**. `.claude/context/verified-facts.md` has been corrected accordingly (see §11, correction 7).
2. **The flat `comment_count` field exists only on this carousel shape**, duplicating `edge_media_to_parent_comment.count`. Already on record as divergence 3 in `verified-facts.md`. Harmless, but the implementation should pick **one** path and not treat three fields as three signals.

**The `owner` block: confirmed a 5-key stub.** `data.xdt_shortcode_media.owner` contains exactly `id, username, full_name, is_verified, profile_pic_url`. **No `edge_followed_by`.** A reel or single-image post carries the full 17-key owner block including `edge_followed_by.count`; this carousel does not.

**This is not a blocker, and it is important that nobody reads it as one.** It affects only *where the follower count is sourced*, not whether we have one. The pipeline already resolves the profile separately via `resolveProfile` against `/v1/instagram/profile`, where the follower count lives at `data.user.edge_followed_by.count` — verified live 2026-08-05 and present in the committed profile fixture. **No additional API call and no additional credit is introduced by §12**, because that profile resolution already happens today for every analysis. The only consequence is the one already accepted in §4.2 and R3: the follower count comes from a 7-day-TTL cache and is therefore **approximate**, and nothing may present it as exact.

*Caveat on generality, stated rather than assumed:* this is **one** all-image-carousel sample. `verified-facts.md` has already been burned twice by generalising from a single carousel (the owner-stub and top-level-`dimensions` claims were both falsified by a second sample). I am asserting what this payload contains, not that every all-image carousel is identical. §12.7 turns that into a required defensive behaviour rather than an assumption.

### 12.2 The resolution: substitute the denominator, do not drop the content type

**[CONFIRMED] For all-image carousels and single images, the Tier 1 engagement metric is computed against the follower count instead of reach:**

```
engagement rate (follower-denominated) = (likes + comments) ÷ follower count
```

**I agree with this recommendation and want to be explicit about why, because "we could not get reach so we used followers" would be a bad reason.** This is not an improvisation to paper over a gap — it is **the standard Instagram engagement-rate definition**, and it exists precisely *because* image posts have never exposed reach publicly. It is the metric the industry adopted for exactly the situation we are in. §3.1 already documented it as family (1), "engagement rate by followers — the oldest convention, still the default on influencer rate cards", citing [Brandwatch](https://www.brandwatch.com/blog/social-media-engagement-rate/) and [Hootsuite](https://blog.hootsuite.com/calculate-engagement-rate/). The same research also explains why we do **not** prefer it where reach *is* available: reach fluctuates and most followers never see a given post, which is why engagement-by-reach is the better per-post measure for video. Both statements are true at once. **Use the best denominator available for the content type, and say which one you used.**

Requirements:

- **R-12.2.1** For a content kind with no reach field, the Tier 1 ratio is `(likes + comments) ÷ follower count`, computed in code (D2), stored in the computed block (§5.1) with an explicit denominator identifier of `FOLLOWERS`.
- **R-12.2.2** Every stored engagement ratio carries a **`denominator` discriminator** — `REACH` or `FOLLOWERS` — as a required, non-nullable field alongside the existing reach `kind` (`PLAYS` / `VIEWS` / `UNKNOWN`, R-4.3.1). A ratio without a stated denominator is invalid and must fail loudly. **This field is the mechanism that makes §12.3 enforceable; it is not optional metadata.**
- **R-12.2.3** Because `like_and_view_counts_disabled` may be **absent** on this payload shape (§12.1), absence must **never** be coerced to `false`. Absent means *we cannot tell*. Likes/comments are judged on their own presence: present and non-null ⇒ `AVAILABLE`; absent ⇒ `UNKNOWN`, and per D3 that produces **no score plus a visible reason**, not a zero.
- **R-12.2.4** If the follower count is unavailable (no cached profile, profile resolution failed), the follower-denominated ratio is **not computed**. `unavailableReason` is `NO_AUDIENCE_DATA`. No substitute denominator may be invented.
- **R-12.2.5** Confidence for a follower-denominated Tier 1 is capped at **`MEDIUM`**, never `HIGH`, because the denominator is a cached approximation rather than a same-capture measurement (R3).

### 12.3 THE HARD REQUIREMENT: the two percentages are not comparable, and must never look comparable

**This is the single most important requirement in §12, and it is directed at both the UI/UX designer and the tech lead.**

Engagement-per-**reach** and engagement-per-**follower** both render as a percentage, and they are **not the same quantity, not on the same scale, and not comparable in either direction**. A reel at 4% and an image carousel at 4% mean entirely different things:

- **4% of the people who actually saw it engaged** (reach-denominated), versus
- **engagements equal to 4% of the follower base** (follower-denominated) — a number that can exceed 100% on a post that travels far beyond the followers, and that says nothing about how many people saw it.

Presenting them as two cells in the same column, under the same header, in the same format, would be a **fabricated comparison** — the same class of error as labelling a play count "Views" (R-4.3.1), which this project already treats as a bug with a shipped test behind it.

- **R-12.3.1 (binding)** Wherever an engagement ratio appears — **the analyses table, the detail view, any export, any tooltip, and the Gemini prompt** — the denominator must be **visibly and unambiguously distinguished**. A reader must be able to tell which quantity they are looking at **without hovering, without opening a legend, and without prior knowledge of the content type.**
- **R-12.3.2 (binding)** Sorting, filtering and any baseline comparison must **never mix denominators**. A sort on "engagement" must not interleave reach-denominated and follower-denominated values in one ordering. This extends R-4.3.2 (same-kind ratios only) to cover the denominator axis as well. Mixing must fail loudly, not average.
- **R-12.3.3 (binding)** No aggregate — no average, median, "typical engagement", or roll-up of any kind — may be computed across rows with different denominators.
- **R-12.3.4** **The visual treatment is the designer's decision, not this PRD's.** Distinct columns, a persistent inline qualifier, differing units, separate sections — Jessica chooses. **What is not negotiable is the outcome:** a user must never be able to read the two as the same number. The mockup review (caveat C2) must explicitly sign this off, and the sign-off should be recorded.
- **R-12.3.5** The tech lead should treat R-12.2.2's `denominator` discriminator as **required at every layer it crosses** — storage, the query/transform layer, the component props, and the prompt — so that dropping it is a type error rather than a silent presentation bug.

### 12.4 Tier 2 survives untouched — and is probably the best signal a carousel has

**Tier 2 never required reach.** It requires only a metric that is **comparable across that same creator's own posts**. Likes and comments satisfy that completely.

So for an all-image carousel, Tier 2 reads: **"this post got 1.8× this creator's typical likes+comments for their image carousels."** That is meaningful, self-normalising, and immune to every objection raised against the follower denominator — the follower count does not appear in it at all, so staleness cannot touch it. **On a content type with no reach data, Tier 2 is plausibly the strongest signal available**, and the UI should not bury it beneath a weaker follower-denominated percentage.

**Consistency with the confirmed D4 bucketing — and the cold-start cost, which is real:**

- D4 confirms bucketing by `(platform, content kind)` with a **minimum of 5 per bucket**. An all-image carousel therefore compares only against **that creator's other all-image carousels** — correct, and required, since carousel engagement and reel engagement are not comparable either.
- **R-12.4.1** The all-image-carousel bucket needs **its own 5 analysed posts**. It does not inherit, borrow or pool with the creator's reel bucket. **This is the image-carousel instance of the general rule in §14.2 (R-14.2.1); §14.2 is the citable statement, and it applies to every bucket, not only this one.**
- **Flagging this plainly, because it is a genuine cost of the confirmed decision:** for a creator who posts carousels rarely, this is a **slow cold start**. A creator with 20 reels and 3 image carousels gets Tier 2 on reels and **nothing** on carousels — and the carousels are exactly the posts where Tier 2 matters most, because they have no reach-based Tier 1 to fall back on. **In the worst case an image carousel shows only a `MEDIUM`-confidence follower-denominated ratio and no baseline.**
- **R-12.4.2** That state must be **shown, not hidden**: "not enough carousel history yet — 3 of 5 carousels" (exact wording is the designer's). Per D3 and R-8.4.3, it renders as its reason, never as blank or `0`. **The copy must be format-scoped, not creator-scoped — R-14.2.5.**
- I am **not** recommending lowering the threshold for this bucket. D4 rejected a minimum of 3 for good reason, and a baseline built on two posts would be a number we could not defend in a client meeting. **The honest slow start is the right trade.** It is worth revisiting once bulk ingestion (3A) exists, since a batch import would fill several buckets at once — recorded in §9.3, not a 3B ticket.

### 12.5 Net effect, and what Gemini is told

**Image carousels lose one tier and keep two. They are not excluded from performance scoring.**

| Tier | Reel / Short | Video-bearing carousel | **All-image carousel / single image** |
|---|---|---|---|
| **1 — engagement per reach** | Yes (`PLAYS` or `VIEWS`) | Yes, from the first slide, −1 confidence (D4) | **No — replaced by `(likes + comments) ÷ followers`, denominator `FOLLOWERS`, confidence ≤ `MEDIUM`** |
| **2 — creator's own baseline** | Yes | Yes | **Yes, unchanged** — likes+comments vs. this creator's own all-image-carousel median, min 5 in bucket |
| **3 — audience fallback (reach ÷ followers)** | Yes, demoted (§3.5) | Yes, demoted | **Not applicable** — there is no reach to divide. Tier 1 already uses the follower denominator; producing a second follower-denominated number would be a duplicate wearing a different label. |

**What Gemini receives for an all-image carousel, stated plainly:**

- **The follower-denominated engagement rate**, and **no reach figure of any kind**.
- **R-12.5.1** The prompt must label it explicitly and unambiguously as **engagement relative to follower count**, and must state that **no reach/impression data exists for this post**. It must not be labelled "engagement rate" unqualified, and the word **"reach", "views" or "plays" must not appear** in connection with it.
- **R-12.5.2** This follows the exact precedent already shipped for reach kind: a play count is labelled **PLAYS** and never "Views" (R-4.3.1, `user.engagementLabel.test.ts`). **The same discipline, the same enforcement mechanism, one new axis.** The performance prompt block is in scope for that test.
- **R-12.5.3** The prompt must instruct Gemini **not to compare** a follower-denominated figure against any reach-denominated benchmark, its own prior knowledge of "typical engagement rates", or any other post's ratio with a different denominator. Combined with the D1 rejection of universal benchmarks (§3.4), the only legitimate comparison for this number is **the same creator's own bucket median** — i.e. Tier 2.
- **R-12.5.4** Gemini's Indonesian prose must carry the distinction through to the reader. A verdict that says only *"engagement 4,2%"* is non-compliant; the denominator must be evident in the sentence.

### 12.6 If the verification had gone the other way

Recorded so the reasoning is auditable, and so that a future content type with genuinely no metrics is not forced into a shape that does not fit it.

**Had likes and comments been absent from the all-image carousel payload, this resolution would have collapsed entirely** — there would have been no numerator, and no amount of denominator substitution would have produced a defensible number. The correct outcome would then have been the honest unavailable state confirmed in D3: `performanceScore: null`, `tierUsed: UNAVAILABLE`, `unavailableReason: CONTENT_KIND_UNSUPPORTED`, and UI text stating that Instagram exposes no performance data for this content type. **Never a fabricated number, never a zero standing in for an unknown.** They are present (§12.1), so this branch does not apply — but the rule it expresses is general and binding on any future content type.

### 12.7 Checks this section requires (no new spend)

- **R-12.7.1** Implementation must **detect** the absence of reach fields rather than assume it from `__typename`. A future or regional payload variant that *does* carry a reach field on an image carousel must be picked up, not ignored because we hard-coded "sidecars have no reach". Branch on **field presence**, per the single-sample caveat in §12.1.
- **R-12.7.2** Conversely, an all-image carousel that unexpectedly lacks likes **or** comments must land in the §12.6 unavailable state, not compute a partial ratio from whichever field survived.
- **R-12.7.3** All of §12 is verifiable against the **committed** fixture. **No part of §12 requires V1, V2 or V3, and no part of it justifies a live call.**

### 12.8 Additional acceptance criteria

**AC-18 — Follower-denominated Tier 1 on an all-image carousel**
*Given* the committed fixture `ig_carousel_all_images_10_slides.json` (likes `32313` at `edge_media_preview_like.count`, comments `13840` at `edge_media_to_parent_comment.count`, no `video_view_count`, no `video_play_count`) and a resolved follower count,
*When* the analysis completes,
*Then* a Tier 1 ratio is stored equal to `(32313 + 13840) ÷ follower count`, its `denominator` field is `FOLLOWERS`, its confidence is at most `MEDIUM`, and **no reach value and no `PLAYS`/`VIEWS` reach kind is stored for that analysis**.

**AC-19 — Absent hidden-counts flag is not read as `false`**
*Given* the same fixture, in which the key `like_and_view_counts_disabled` is **absent**,
*When* availability states are resolved,
*Then* the code path evaluates `=== true` strictly, likes and comments are `AVAILABLE` on their own presence, and no branch treats the absent key as an affirmative "counts are visible" signal. Asserted directly against the fixture.

**AC-20 — Denominators never mix in a sort**
*Given* a table containing both reach-denominated and follower-denominated engagement values,
*When* the user sorts by engagement,
*Then* the two denominators are not interleaved into a single ordering (component test), and no aggregate is computed across them (R-12.3.3).

**AC-21 — The distinction is visible without interaction**
*Given* a rendered row for an all-image carousel and a rendered row for a reel, both showing an engagement percentage,
*When* the rendered output is inspected with no hover, no tooltip and no legend,
*Then* each row's engagement cell carries a denominator indicator in its accessible text. Asserted as a component test on the rendered text content — **not a screenshot**, per §6's rule.

**AC-22 — Gemini is told the right thing**
*Given* an all-image carousel analysis,
*When* the assembled prompt is inspected,
*Then* it contains the follower-denominated engagement figure explicitly labelled as relative to follower count, contains an explicit statement that no reach data exists for this post, and contains **no** reach/views/plays figure or label for that post. Enforced by extending `user.engagementLabel.test.ts` to the performance prompt block.

**AC-23 — Tier 2 works with no reach**
*Given* a creator with 5 prior completed all-image-carousel analyses in the same bucket,
*When* a sixth all-image carousel is analysed,
*Then* `tierUsed` is `CREATOR_BASELINE`, `basedOnVideos` is 5, the multiplier is computed from likes+comments against the bucket median, and **no reach value is involved in the computation**.

**AC-24 — Carousel cold start is shown, not hidden**
*Given* a creator with 3 all-image-carousel analyses (below the D4 minimum of 5) and 20 reel analyses,
*When* a fourth all-image carousel is analysed,
*Then* `tierUsed` is not `CREATOR_BASELINE`, the reel bucket is **not** used as a substitute baseline, and the UI renders an explicit insufficient-history reason rather than a blank cell or a `0`.

---

## 13. Score explainability — the score must explain itself, in the app [CONFIRMED — owner requirement, 2026-08-05]

**Owner requirement, stated directly and recorded verbatim in substance:** *every part of the scoring must be explained to the user inside the app — what the score is based on, how it was derived, and why it says what it says.* The owner raised this himself and explicitly expects it to need design work.

**This is a first-class requirement, not a polish item.** It is the difference between a tool an agency can quote to a client and a tool that produces a number nobody can defend. US-2 and US-4 already asked for it in outline; §12.3 made it urgent. This section makes it explicit and testable.

**Read §13.8 before designing anything.** This section specifies **what must be explained and where**. It deliberately does **not** specify how it looks.

### 13.1 The principle, and the five questions

**A number the user cannot interrogate is a number they should not repeat to a client.** Every performance figure the product renders must be traceable, on the surface it appears on, back to the facts it was computed from.

Every displayed performance score — **and every deliberately absent one** — must let the user answer all five of these without leaving the product and without asking a developer:

1. **Which metric is this, and why this one?** (§13.2)
2. **What went into it?** (§13.3)
3. **How much evidence is behind it, and is it final?** (§13.4)
4. **Why is there no score here?** — when there isn't (§13.5)
5. **Can I compare this to that other number?** — and the honest answer is often *no* (§13.6)

- **R-13.1.1** These five are a **completeness requirement on the information available at each surface**, not a prescription for five separate UI elements. One well-chosen sentence may answer three of them. **The designer decides the form; the requirement is that a user can get the answer.**
- **R-13.1.2** **No explanation may be a restatement of the number.** "Performance score: 4 (good)" explains nothing. The explanation must reference the underlying quantities or the comparison that produced the verdict.
- **R-13.1.3** **All explanatory text is written for a non-technical agency strategist.** No field names, no enum identifiers, no error codes, no `snake_case`, no `UNAVAILABLE`. Enum identifiers stay English and machine-stable underneath (§5.4); what the user reads is a human sentence. This is the existing Indonesian-labels-via-UI-lookup pattern, extended to this layer.

### 13.2 Which metric this score used, and why — in plain language

The product computes **different metrics for different content types** (§12). A user who does not know that will misread the product. **The app must tell them, on the score.**

- **R-13.2.1** Every rendered performance figure states **which metric it is** in plain language — engagement measured against **the number of people who saw the post** (reach-denominated) versus against **the creator's follower count** (follower-denominated).
- **R-13.2.2** It also states **why that metric was used**, and the reason must be the real one, in plain language: *Instagram publishes no reach or view data for image-only posts, so this is measured against followers instead.* **The user should come away understanding that this is a limit of what Instagram exposes, not a shortcut we took.**
- **R-13.2.3** The reason is **specific to that post's content type**, not generic boilerplate shown on every row. A reel and an all-image carousel must not carry the same explanation.
- **R-13.2.4** The **tier actually used** (§5.2 `tierUsed`) is explained in the same plain-language register: *compared against this creator's own typical carousel performance* (Tier 2), *measured against how many people saw it* (Tier 1), *a rough read against audience size* (Tier 3). **Tier 3 must read as the weakest of the three** wherever it appears — this carries §3.5's demotion through to the user, where it actually matters.
- **R-13.2.5** Reach kind is carried into the explanation, not just the number: a `PLAYS` figure is described as plays, never as views (R-4.3.1). **The existing prompt-level discipline becomes a UI-level requirement here.**

### 13.3 The inputs behind the number

- **R-13.3.1** For any score, the user can see **the actual counts used** — likes and comments as captured — and **the audience figure it was measured against** (the reach value, or the follower count). Not a formula the user has to evaluate; the operands themselves.
- **R-13.3.2** The audience figure is **attributed and dated**. The follower count comes from a cache with up to a 7-day TTL (§4.2, R3). Where a follower count is used, **its staleness must be inspectable** — the computed block already stores the cached profile record's age precisely so this is possible (§5.1). **A follower-denominated percentage presented as if exact is a false precision the product must not create.**
- **R-13.3.3** For a **Tier 2** figure, the user can see **what the comparison was against**: the creator's own median, the bucket it was drawn from *(this creator's image carousels — not their reels)*, and the number of posts in it. The **bucket identity is part of the explanation**, not an implementation detail — "3.2× typical" is meaningless until the user knows *typical what*.
- **R-13.3.4** **Every numeral shown in an explanation must exist in the stored computed block** (§5.1), **with one stated allow-list**: the configuration constants `BASELINE_MIN_SAMPLE` (the `5` in `3 of 5 carousels`) and the profile cache TTL (the `week` in the staleness copy) are exempt and are **not** stored per row **[AMENDED 2026-08-06 — OR-10; see AC-27]**. This extends S2/AC-7 from Gemini's prose to the explainability layer. **Apart from the allow-list, the explanation is not a place where new numbers may appear.**
- **R-13.3.5** Post age at analysis time is available alongside any score (§4.5), because no performance figure can be read honestly without it.

### 13.4 Confidence and provenance — how much evidence, and is it final

- **R-13.4.1** A **Tier 2** figure never appears without its **sample size**, expressed the way the product already expresses it: the pattern **`based on {N} {noun}`**, with the bucket's own content noun (`reels` / `carousels` / `Shorts` / `videos`, generic fallback `posts`) **[AMENDED 2026-08-06 — OR-9; see AC-28]**. This is not a new pattern — it is the confirmed style-fingerprint precedent (live PRD §6.1, in scope for that phase), and 3B **reuses it rather than inventing a second vocabulary for the same idea**. R-8.4.4 already required the number; this requires that the user understands what it is evidence *of*.
- **R-13.4.2** The **confidence level** (`HIGH` / `MEDIUM` / `LOW` / `NONE`) is surfaced in plain language, **with the reason it was lowered** where it was lowered. The three known reasons must each be expressible: a **cached/approximate follower denominator** (R-12.2.5, capped at `MEDIUM`), a **derived post-level reach taken from a carousel's first slide** (D4, −1 level), and a **thin sample**.
- **R-13.4.3** A **provisional** score — a post below the maturity floor (§4.5) — must **say that it is provisional and why**: the post is new and still accumulating. **A provisional score must never be presentable as final.**
- **R-13.4.4** The maturity floor is a **tunable estimate, not a measured constant** (caveat C1). **Nothing user-facing may imply it is a researched threshold.** No UI copy anywhere may state or imply that 72 hours is a validated settling time.
- **R-13.4.5** Scores are **frozen point-in-time** (D8). Where a user could reasonably believe a figure is live — a follower-denominated percentage on a creator whose audience has since grown — **the as-of nature of the figure must be evident**. The most common wrong conclusion this product can produce is "this number is current". It is not.

### 13.5 Absent scores must explain themselves

**A blank cell is the single worst outcome this feature can produce**, because it looks like a bug and teaches the user to distrust every other cell. D3 is confirmed: **no score, plus a visible reason.** §13 makes the *reason* a product requirement rather than an enum.

- **R-13.5.1** Wherever a score is absent, the surface renders a **reason legible to a non-technical user**. `CONTENT_KIND_UNSUPPORTED` is a storage value, **not** something a user may ever read. `REACH_HIDDEN` / `REACH_UNKNOWN` / `NO_AUDIENCE_DATA` / insufficient-history each map to a plain sentence.
- **R-13.5.2** The reason must distinguish the cases a user would act on differently: **the creator hid their counts** (nothing we can do), **we do not have enough of this creator's history yet** (it will resolve itself — and per R-12.4.2 the progress is shown, e.g. `3 of 5 carousels`; **the progress and the reason are per format, and R-14.2.5 forbids a creator-level "5 posts" framing here**), and **this data does not exist for this content type** (a permanent property of the platform). **Collapsing these into one "unavailable" is a failure of this requirement.**
- **R-13.5.3 — the case we genuinely cannot attribute, specified rather than left undefined.** On an all-image carousel the `like_and_view_counts_disabled` flag is **absent from the payload entirely** (§12.1; `.claude/context/verified-facts.md`, 2026-08-05 correction). Absence means **we cannot tell** whether the creator hid their counts. So where a score is unavailable on such a post, **the app must not assert a cause it cannot evidence** — it must not say "counts hidden by creator", because we do not know that.
  **What the app says instead:** it states **what it does know** — that Instagram published no performance data for this post — and **does not speculate as to why**. The honest form is a statement of the observation, not a diagnosis.
  - **R-13.5.3a** A distinct stored reason is required for *cause not determinable*, separate from *counts confirmed hidden*. **Two different facts must not share one enum value**, or the UI is structurally unable to tell the truth.
  - **R-13.5.3b** Absent must **never** be coerced to `false` to produce a more confident-sounding sentence (R-12.2.3). **A tidier UI string is not a reason to assert a fact we do not have.**
  - **R-13.5.3c** ~~If V1 (§10.2) later establishes the real counts-disabled payload shape and it turns out the flag *is* reliably present on this shape, this requirement may be revisited.~~ **RESOLVED 2026-08-06 — V1 has landed and R-13.5.3 STANDS, unrevised.** V1's sample is a **single image post**, not an all-image carousel, so it says nothing about whether the flag is reliably present on the carousel shape §12.1 describes. The three-case derivation (TDD §9.5, OR-11) is therefore still required in full, **including its mandatory case 3**. V1 in fact *strengthens* the requirement: the payload carried an actively-misleading `-1` like count alongside the flag, which is exactly the kind of thing that makes inferring a cause from surrounding data unsafe.
- **R-13.5.4** An absent score **never renders as `0`, as an em-dash, or as an empty cell** — restating D3 and R-8.4.3 at the surface, because this is exactly the rule that erodes first under layout pressure.

### 13.6 Comparability — the app must make the misread impossible, not merely be correct underneath

**This is the highest-severity product risk in this document (R6, §12.3), and it is the reason explainability is a requirement rather than a nicety.** A reel at 4% and an image carousel at 4% mean entirely different things. **Nothing errors. No test fails. A user simply draws a wrong conclusion and repeats it to a client.**

- **R-13.6.1** Being *technically correct underneath is not sufficient*. R-12.2.2's `denominator` discriminator makes the system correct; **§13 requires that the user cannot misread it.** These are different requirements and both must be met.
- **R-13.6.2** Wherever two engagement figures with **different denominators** can be seen in one view — the table is the obvious case — the difference must be apparent **without interaction**: no hover, no legend, no tooltip, no prior knowledge of content types (R-8.4.7, R-12.3.1).
- **R-13.6.3** The product must **never present a comparison it cannot justify**. No aggregate, average, "typical engagement", ranking or roll-up may span denominators (R-12.3.3). Where a user might reasonably *expect* a comparison and it is not valid, **the app should say why it is not offered** rather than silently omitting it.
- **R-13.6.4** Gemini's Indonesian prose is **part of the explainability surface**, not separate from it. A verdict reading only *"engagement 4,2%"* is non-compliant (R-12.5.4). **The prose is what a strategist will paste into a client deck, so it is the highest-risk surface of all** — an unqualified percentage there escapes the product entirely and can never be corrected.

### 13.7 Where this surfaces — the informational requirement at each location

**Both surfaces are in scope. Neither is sufficient alone.** A detail-view-only explanation fails, because §12.3's misreading happens in the table, where two denominators sit inches apart. A table-only explanation fails, because the table cannot carry the depth.

**The analyses table (3C) — the "cannot be misread" tier.** Available at a glance, without interaction:

- **R-13.7.1** The **metric identity / denominator** on every engagement figure (R-13.6.2).
- **R-13.7.2** The **tier and confidence** of the score.
- **R-13.7.3** The **sample size** on any Tier 2 figure — `based on {N} {noun}` (R-13.4.1, as amended by OR-9).
- **R-13.7.4** The **provisional** state where it applies (R-13.4.3).
- **R-13.7.5** The **plain-language reason** on any absent score (R-13.5.1), in the cell — not deferred to the detail view.
- **R-13.7.6** The table is **not required to carry the full "why this metric" explanation** (R-13.2.2) or the raw operands (R-13.3.1). **It must, however, make it evident that a fuller explanation exists and is reachable.** A user who wonders "why followers and not reach?" must not have to guess that the detail view can answer it.

**The detail view — the "can be interrogated" tier.** Everything the table carries, plus:

- **R-13.7.7** The **full plain-language reason** for the metric choice (§13.2), including that Instagram exposes no reach for image-only content.
- **R-13.7.8** The **operands** — the counts used and the audience figure measured against (R-13.3.1), with the follower count's staleness (R-13.3.2).
- **R-13.7.9** For Tier 2, the **baseline, the bucket identity and the sample size** (R-13.3.3).
- **R-13.7.10** The **confidence reason** (R-13.4.2) and the **point-in-time / as-of** framing (R-13.4.5).
- **R-13.7.11** Gemini's `drivers[]` — the content-trait-to-performance links — presented **as the explanation of the verdict**, which is what they are and the reason the feature uses a model at all (§5.2).

**Any export, if one exists, inherits R-13.6.1 to R-13.6.3 in full.** A percentage that leaves the product without its denominator is the failure mode this whole section exists to prevent. **Exports are not in 3C scope; this is a standing constraint on whoever adds one.**

### 13.8 Boundary — what this section deliberately does NOT specify

**Directed at the UI/UX designer, who works from this PRD next.**

- **This section specifies WHAT must be explained and WHERE. It does not specify how it looks.**
- **Explicitly the designer's decision, and not pre-empted here:** tooltips, popovers, modals, expandable rows, inline captions, footnotes, icons, colour, typography, information density, disclosure patterns, and the **exact user-facing wording** of every string.
- **No mockups appear in this document**, consistent with §8's standing rule.
- **What is not negotiable is the outcome.** Where this section says *without interaction*, that constrains the mechanism (R-13.6.2, R-8.4.7) — it is a correctness constraint, not a style preference, and it is the one place the designer's freedom is genuinely bounded. Everything else is open.
- **Where this section suggests example phrasing, it is illustrative of the register, never approved copy.** Final wording is the designer's, subject to R-13.1.3.
- **The mockup review (caveat C2) is where §13 gets signed off**, alongside §12.3. **The sign-off should be recorded**, because "we assumed the designer had handled it" is precisely how R6 ships.

### 13.9 Acceptance criteria

Each asserts **rendered text content or stored data** and is mechanically checkable. **None is screenshot-only** — an unmet screenshot criterion has already been merged unverified in this repo (§6), so nothing here depends on someone eyeballing an image.

**AC-25 — Every score states its metric**
*Given* a rendered table containing one reel row (reach-denominated) and one all-image-carousel row (follower-denominated), both scored,
*When* the rendered output is inspected with no hover, no tooltip and no legend,
*Then* each row's accessible text identifies which denominator its engagement figure uses, and the two identifiers are distinct strings. Component test on text content.

**AC-26 — The detail view explains why this metric**
*Given* an all-image-carousel analysis,
*When* the detail view renders,
*Then* its text states that no reach/view data exists for image-only posts on Instagram and that the figure is measured against follower count; and it contains **no** occurrence of the words reach, views or plays applied to that post's engagement figure. Component test asserting both presence and absence.

**AC-27 — Operands are shown, and every numeral is real**
*Given* any analysis with a performance block,
*When* the detail view renders,
*Then* the counts used and the audience figure measured against are present in the rendered text, **and** every numeral extracted from all explanatory text exists in the stored computed block of §5.1 within the stated rounding tolerance, **except for the numerals on the allow-list below**. Extends AC-7's mechanism to this layer.

> **[AMENDED 2026-08-06 — owner ruling OR-10.] Allow-list, not storage.** Two numerals in the explainability
> copy are **configuration constants**, not per-row facts: `BASELINE_MIN_SAMPLE`'s `5` (in the cold-start
> string `3 of 5`) and the profile cache TTL's `week` (in the staleness string). They are **formally exempt**
> from R-13.3.4 and from this criterion. The owner explicitly considered storing them per row and **rejected
> it**: the threshold numeral only ever appears in the **sub-threshold cold-start sentence**, so the
> retroactive-rewrite exposure of not storing it is limited to rows that are untrusted anyway. The extractor
> must implement the allow-list explicitly, not by loosening the match.

**AC-28 — Tier 2 never appears without its evidence base**
*Given* a Tier 2 score,
*When* it renders in the table **and** in the detail view,
*Then* both carry the sample size in the **pattern `based on {N} {noun}`**, where `{noun}` is the bucket's own content noun, and the detail view additionally names the bucket the median was drawn from. Component test on both surfaces.

> **[AMENDED 2026-08-06 — owner ruling OR-9.]** This criterion previously required the **literal** word
> `videos`. It is relaxed to the **pattern**, so an image-carousel baseline reads `based on 6 carousels`,
> a reel baseline `based on 7 reels`, a YouTube Shorts baseline `based on 5 Shorts`, with
> `based on N posts` as the generic fallback. Rationale, in the owner's terms: **saying "videos" for a
> carousel-derived figure is the same bug class as labelling a play count "Views"** — the precedent's
> *pattern* (same position, same register) is what R-13.4.1 was reusing, not its noun.

**AC-29 — Provisional says so**
*Given* a post below the confirmed maturity floor,
*When* it renders on either surface,
*Then* the accessible text states the score is early/still accumulating, **and** no rendered string anywhere asserts that the floor is a measured or validated threshold (R-13.4.4). Asserted by string search over the UI copy source.

**AC-30 — Absent scores give a legible, non-speculative reason**
*Given* four analyses — (a) `like_and_view_counts_disabled === true`, (b) insufficient bucket history, (c) an all-image carousel with no usable inputs and the flag **absent** from the payload, (d) no cached follower count —
*When* each renders in the table,
*Then* each shows a distinct plain-language reason; **none** renders as blank, `0` or an em-dash; **none** contains an enum identifier, a field name or an error code; and case (c) specifically **does not** assert that the creator hid their counts, because that is not determinable from an absent flag (R-13.5.3). Component test asserting the four strings are distinct plus a negative assertion on case (c).

---

## 14. Expected behaviours that will be mistaken for defects [CONFIRMED — both settled; do not re-open]

**Why this section exists.** Two behaviours in this product look like bugs and are not. Both were decided by
the owner. Both currently live only in engineering notes — one in `TDD` §13 E8, the other scattered across a
handoff and a constant — which means **nobody building the UI will see them**, and the first person who hits
one will file it as a defect and lose a day proving it is not.

**This section is product behaviour, in product language.** It is not a footnote, an engineering caveat or a
known-issues list. Each behaviour has a requirement ID so tickets can cite it. **Neither is an open question:
alternatives were considered and declined, and both are listed in `docs/HANDOFF-2026-08-06.md` §11 as
deferred/accepted — "do NOT re-litigate as new findings".**

**The through-line, and the owner's standing preference in both cases: reliability over coverage.** Where the
two conflict, this product prefers the option that **cannot produce a confident-looking wrong number**, even
when that means scoring fewer posts or telling the user we do not know yet.

### 14.1 Re-analysing a post can change the creator's style classification. This is expected.

**The behaviour, stated plainly.** If a user re-analyses a post they have already analysed, the post's **style
classification can come back different** — the format it was filed under, or its pacing — with **no change to
the content, no change to the inputs, and no bug anywhere in the system.** Because those classifications feed
the creator's style fingerprint, **the creator's overall style profile can shift too.**

**Why it happens, in one sentence for a non-engineer:** the classification is a judgement made by an AI model,
and asking the same model the same question twice does not guarantee the same answer — this was **measured, not
assumed** (`.claude/context/verified-facts.md`, V4; TDD OR-22).

**What is *not* affected, and this is the important half.** The **scores hold.** The overall content score and
every scorecard dimension were **identical** across repeated identical runs. **The numbers an agency would
quote to a client are the stable part; the descriptive labels are the part that moves.** Anyone weighing how
seriously to take this should weigh it against that.

- **R-14.1.1 (binding, product behaviour)** A style classification that differs after a re-analysis is
  **expected behaviour and is not evidence of a fault.** It must not be triaged as a defect, and no ticket
  should be opened to "fix" it. A ticket that observes it should cite **R-14.1.1** and close.
- **R-14.1.2 (binding, non-goal)** **No reconciliation machinery will be built.** Not versioned re-analysis
  records, not retry-until-they-agree, not a best-of-three vote, not a "classification changed" alert. All
  were considered and **declined** (§7; TDD OR-22; handoff §11). They would buy consistency in a field nobody
  has complained about, at the price of multiplying the per-analysis AI spend on every single analysis.
- **R-14.1.3** **The blast radius is genuinely small, and that is why this is tolerable.** An analysis runs
  **once and is stored**. There is no background re-run and no cache-expiry path that could silently
  reclassify a row. **The only way a user ever sees this is by pressing Re-analyze themselves.**
- **R-14.1.4 (a requirement on whoever builds the style-fingerprint UI)** A style fingerprint **must not be
  presented as a fixed, permanent fact about a creator.** It is the product's current reading of the posts
  analysed so far. Wording that implies permanence — "this creator **is** a…" — is non-compliant; wording that
  frames it as a current read, and that makes clear it is derived from the analysed set, is compliant. **The
  exact wording is the designer's, per §13.8.**
- **R-14.1.5** **This is not a licence to loosen anything else.** The classification labels drift; the
  **performance layer does not**, because §5.2/OR-13 moved every mechanical field into code precisely so that
  it cannot. Nothing in §14.1 weakens S3, AC-10, or the computed block's byte-identical guarantee.
- **R-14.1.6** **Do not write a test asserting a classification is reproducible.** It would be a flaky test
  asserting a claim we have measured to be false. (Restates AC-10; repeated here because this is the section
  someone will actually be reading when they are tempted.)

**AC-31 — The fingerprint does not claim permanence**
*Given* a rendered style fingerprint,
*When* its copy is inspected,
*Then* no string presents the classification as a permanent or immutable property of the creator, and the
surface makes clear the reading is derived from the posts analysed so far. Asserted by string search over the
UI copy source plus a component test on rendered text.

### 14.2 Tier 2 needs 5 comparable posts **per format bucket** — not 5 posts per creator

**⚠️ This corrects a figure stated wrongly across the documentation. Earlier passages in this PRD, and the
figure the 3C frontend tickets (#145–#149) were about to be built against, read as a flat "5 posts". That is
wrong.** The corrected passages are §3.3, §4.6, AC-2, D4, §9.2 R4, §9.2 R7 and R-12.4.1.

**The rule.** The "vs their usual" comparison (Tier 2) needs **5 analysed posts of the same format, by the same
creator, on the same platform.** Reels count only against reels; carousels only against carousels. **Each pool
reaches 5 independently. Nothing is borrowed, pooled or inherited between them.**

**Why, in plain terms.** To say *"this post did 3× better than usual"* we compare a post against the creator's
own past posts. But **reels and carousels are not measured in the same unit** — Instagram reports reels in
**plays** and carousels in **views**. Those are different quantities. **R-4.3.2 forbids computing a ratio
across two different reach kinds, and requires that any attempt to do so fails loudly rather than being
quietly averaged.** So reels and carousels sit in separate baseline pools by construction, and each pool needs
its own 5 before it can say anything.

**The worked example — state this one, it is the case that gets filed as a bug.**

> A creator has **4 reels and 4 carousels** analysed. That is **8 posts**. They get **no "vs their usual"
> comparison at all** — not on the reels, not on the carousels — because **neither pool has reached 5.**

**The consequence, stated rather than buried:** **someone posting a steady mix of formats waits considerably
longer than someone who only posts reels.** A creator with 5 reels and nothing else has the comparison
immediately; a creator alternating formats needs 10 posts to get it on both. That is a real cost and it is
**accepted**.

**The rationale, which is the owner's standing preference.** **A shaky comparison is worse than no
comparison.** "3.2× their usual" is the single most quotable thing this product says — a strategist will put
it in a client deck, and once it is there it cannot be corrected. A multiplier computed off two posts, or off
a pool that quietly mixed plays with views, would look exactly as authoritative as a good one. **We would
rather tell the user "not yet" than hand them a number we cannot defend.**

- **R-14.2.1 (binding)** The Tier 2 minimum of 5 is counted **per format bucket** (`platform`, `content
  kind`), **never per creator**. Each bucket qualifies independently.
- **R-14.2.2 (binding)** Buckets never pool, borrow, substitute or fall back to one another. A creator's reel
  baseline may **never** stand in for their carousel baseline, however sparse the carousel bucket is
  (restates R-12.4.1 and AC-24 as a general rule).
- **R-14.2.3 (settled — not an open question)** The threshold is **5 for every bucket**. **A lower threshold
  for carousels was considered and declined** (handoff §11); **a minimum of 3 at low confidence was considered
  and declined** (D4); **pooling formats was considered and declined** (§7). **Do not propose any of the three
  again.** The single configurable constant `BASELINE_MIN_SAMPLE` exists for tuning, not for per-format
  exceptions.
- **R-14.2.4** The waiting state is **product behaviour, not an error state.** A creator below the threshold in
  a bucket is a **normal, expected, temporary condition that resolves itself as more posts are analysed.** It
  must never be rendered as a failure, a blank, an em-dash or a `0` (restates D3, R-8.4.3, R-13.5.4).
- **R-14.2.5 (binding on 3C — cite this in tickets #145–#149)** **No empty-state, cold-start or
  insufficient-history copy anywhere in the product may say "5 posts", or any other creator-level framing of
  the threshold.** It sets an expectation the product will not meet, and **a user who has already analysed 8
  posts and still sees "needs 5 posts" will read a correctly-working feature as broken.** The honest framing
  must carry **all three** of:
  1. **the format**, named in the user's words — carousels, reels, Shorts (the bucket noun of R-13.4.1 / OR-9);
  2. **the progress**, so the user can see it moving — e.g. `3 of 5 carousels`;
  3. **the reassurance that it resolves on its own**, so it does not read as a permanent limitation.
  **The exact wording is the designer's** (§13.8, R-13.1.3). What is not negotiable is that the copy is
  bucket-scoped and that the number the user sees is the number for **that format**.
- **R-14.2.6** Where a user could reasonably expect the comparison to exist — a creator with plenty of posts
  overall but few in this bucket — the product should make the **per-format** nature of the wait evident,
  rather than leaving the user to infer that the tool is stuck. This is the §13.6 principle ("correct
  underneath is not sufficient") applied to the cold start.
- **R-14.2.7** The `5` in this copy remains a **configuration constant on the allow-list** (R-13.3.4, AC-27,
  OR-10) and is **not** stored per row. Unchanged by this section; noted so nobody reconciles the two rules in
  the wrong direction.

**AC-32 — Two half-full buckets produce no comparison, and say so honestly**
*Given* a creator with exactly 4 completed reel analyses and 4 completed all-image-carousel analyses in the
same platform — 8 analysed posts in total,
*When* a further post in **either** bucket is analysed and the table renders,
*Then* `tierUsed` is **not** `CREATOR_BASELINE` for either bucket; **neither bucket's posts are used as a
baseline for the other**; the cell renders an insufficient-history state rather than a blank, `0` or em-dash;
and the rendered text names the **format** and shows the **per-format progress**. Component test on rendered
text plus an assertion on the stored tier.

**AC-33 — No cold-start copy states a creator-level threshold**
*Given* the full set of user-facing copy strings for empty, cold-start and insufficient-history states,
*When* they are searched,
*Then* **no string** frames the threshold in creator-level or format-agnostic terms — no `5 posts`, no
`5 analyses`, no `5 videos` on a carousel bucket — and every string that names the threshold also names the
format it applies to. Asserted by string search over the UI copy source (R-14.2.5).

> **Scope of the search, stated so a false positive is not filed as a defect.** The search runs over
> **user-facing copy and the modules that render it** — not over `docs/`. Both design documents contain
> the literal `5 posts` **inside the rule that bans it** (`DESIGN-3B` §5.3 R-C1, `DESIGN-3C` §5.3 R-C1).
> A rule quoting the string it forbids is **not a violation**, and an unscoped repository search will
> trip on it. Scope the search, and do not open a bug when a design document matches.

---

## 15. Product rulings on the design documents' open questions

**Why this section exists.** Both design documents end with a short list of questions their author
declined to answer alone, and both records say those questions are the owner's or the PM's to close.
One of them has been closed and the closure was never written anywhere a ticket could cite. Two have
not been closed and must not be assumed. This section is the citable home for all three.

### 15.1 Q4 — the 1–5 performance score stays in the analyses table. **CLOSED.**

**The question, as the designer put it** (`DESIGN-3C` §11 Q4): *do you want the 1–5 performance score in
the table at all?* — on the argument that `3.2× their usual` is a **measured** number while the 1–5 is a
**model judgement**, that keeping both costs a column, and that it creates the *"the score says 2 but
the multiplier says 3.2×, which do I believe?"* question.

**The ruling: the 1–5 score STAYS.** This is the owner's call, recorded as **OR-6** (`TDD` §0.2) and
re-confirmed on **2026-08-07**. The owner's reasoning, in the owner's terms: **the tooltip carries the
explanation, and that is sufficient.**

**What this changes, and it is the part that matters for ticketing:**

- **`DESIGN-3B` §7 — "the 1–5 is a judgement, not a measurement" — is now the *governing treatment*,
  not an argument feeding an open question.** Its four points are requirements: the score is labelled a
  read rather than a measurement; the measured figures appear **above** the judgement in the popover;
  `drivers[]` render as the reasoning for the verdict; and the **deterministic "these disagree because…"
  line is required, not optional** (OR-6 makes that line the *whole* answer to the designer's concern,
  so it is the one part of §7 that cannot be dropped for time).
- **The "cut the score" contingency leaves ticket planning entirely.** No ticket, backlog item or
  design revision may be written against it, and no ticket needs a branch for "if the score is cut".
- **#147 is clear to build the score pips.** Nothing about the score column is pending a decision.

**Do not reopen this.** The alternative (drop the 1–5, let the multiplier be the headline) was
considered — it is `DESIGN-3C` §11 Q4 and `DESIGN-3B` §7's closing paragraph — and **declined**. It is
now in the same class as the items in `docs/HANDOFF-2026-08-06.md` §11: settled, and not to be
re-litigated as a fresh finding.

> **Note for readers of the two design documents.** `DESIGN-3B` §10 and `DESIGN-3C` §12 both still list
> Q4 as *"UNRULED"* / *"not signed off"*. **Those statements are stale as of this section** — they were
> written to record what the owner's 2026-08-07 sign-off did **not** cover, which was accurate then. The
> ruling itself is OR-6; this section is where product records it. Where a design document's sign-off
> record and this section disagree **on Q4 only**, this section is current.

### 15.2 Q2 and Q3 — **BOTH CLOSED, owner-ruled 2026-08-09.**

> **⚠️ This section previously read "STILL OPEN. Do not assume either way." That is superseded.** The
> owner ruled both questions on **2026-08-09**. The text is replaced rather than annotated, but the
> reason the section existed is kept at the end so the record stays legible.

- **Q2 — cut the Status column** (`DESIGN-3C` §11 Q2, §2.1). **RULED 2026-08-09: cut it.** The Status
  *column* does not ship. Failures get the whole-row treatment instead. **The status *filter* survives** —
  it was never contingent on the column and is unaffected.
- **Q3 — Style columns (`formatArchetype`, `hookType`) default-on or default-off** (`DESIGN-3C` §11 Q3).
  **RULED 2026-08-09: default-OFF.** The columns are **built**, and **hidden until a user opts in via the
  column picker.** "Default-off" is not "cut" — the build work stays in scope; only the initial
  visibility changes.

- **R-15.2.1 (binding on #145 and #149)** The analyses table is **materially narrower** than
  `DESIGN-3C` §5 describes: one column removed outright (Status) and two more absent on first paint
  (Style). Any ticket, layout or column-count assertion scoped from `DESIGN-3C` §5 **as it currently
  reads** is scoped from a **superseded** figure. Check the count against this section before asserting
  it.
- **R-15.2.2** The column **picker** is now load-bearing, not a convenience. It is the **only** route to
  the Style columns. Shipping the Style columns without a working picker entry for them ships dead code.
- **R-15.2.3** These rulings **do not** re-open Q4. The 1–5 score **stays** (§15.1, OR-6).

**Design-document status, and what not to do about it.** Both design documents still describe the
pre-ruling table. **A `uiux-designer` pass is in flight updating them**
(`DESIGN-3B-score-explainability.md`, `DESIGN-3C-analyses-table.md`). **Do not edit either document to
chase these rulings** — you will collide with open work. **This section is the citable home until that
pass lands.**

**One record disagreement remains open, and it is not product's to close.** `TDD` §0.2 carries Q2/Q3 as
**OR-4** and **OR-5**, while the design documents' own sign-off records (`DESIGN-3C` §12, `DESIGN-3B`
§10, both 2026-08-07) state that the owner's sign-off **does not** cover them. The two records disagree
about **whether these questions were ever decided before today.** Today's ruling settles *the answers*;
it does not settle *that historical discrepancy*, which is the **tech lead's to reconcile.** Product does
not resolve it by picking the more convenient record.

### 15.3 Standing tiebreak, restated because it decided §15.1's framing

**Reliability over coverage.** Where a choice is ambiguous, prefer the option that **cannot produce a
confident-looking wrong number**, even at the cost of scoring fewer posts. This is why the score
**stays but is labelled a judgement** rather than either being cut or being presented as a measurement:
cutting it loses the only read available on posts with no Tier 2 yet, and presenting it unlabelled
would make a model judgement look like arithmetic.
