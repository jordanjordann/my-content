# PRD — Phase 3B (Performance / Engagement Scoring) + Phase 3C (Analyses Table Redesign)

**Status:** **Owner-reviewed 2026-08-05.** All ten §10 decisions are now **[CONFIRMED]** — the owner accepted the recommended option on every one. All three verification spends (V1, V2, V3) are **approved**. Two caveats attach to the acceptances and are recorded in §10.0; §12 adds the resolution for all-image carousels that the first draft only flagged.
**Owner:** Oden (product owner)
**Author:** Dan (PM)
**Created:** 2026-08-05
**Revised:** 2026-08-05 (owner acceptances recorded; §12 added)
**Extends:** `docs/PRD-analysis-schema-redesign.md` (the live analysis contract). This PRD **adds a third tier** to that contract and **bumps `schemaVersion`**. Everything in that PRD not contradicted here still stands.
**Primary input:** `docs/product-direction-plan.md` §3, Phase 3 (3B and 3C).
**Out of scope:** 3A (the job queue). Referenced only where a real dependency exists (§9.3).

Reading conventions are inherited from the roadmap and used strictly:

- **[CONFIRMED]** — explicit owner decision. Build to it.
- **[RECOMMENDATION]** — my proposal. Owner has not ruled. **Do not treat as approved.**
- **[OPEN]** — genuinely undecided. Nobody invents an answer.
- **[VERIFY]** — an external-API fact this PRD needs that is **not** in `.claude/context/verified-facts.md`. Must be captured live before any code depends on it.

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
| S1 | For any analysis where a reach denominator is available, the table shows a performance score and a tier badge | Query: 0 rows with a usable reach denominator and a null performance score |
| S2 | **Zero fabricated numbers.** Every numeral appearing in Gemini's performance prose exists in the computed input block handed to it | Automated: extract numerals from the prose fields, assert each is present in the stored computed-metrics block (rounding tolerance to be stated by the tech lead) |
| S3 | Re-running the same analysis inputs twice at `temperature: 0` yields an identical performance score and identical computed ratios | Two runs, byte-diff the performance block. (This also discharges the determinism item still formally open from ticket #66 — see `verified-facts.md`, 2026-08-05 entry) |
| S4 | An analysis whose like/view counts are disabled produces **no** performance score, an explicit unavailable state, and prose that says so | Manual + fixture test once a counts-disabled fixture exists ([VERIFY] V1) |
| S5 | Reach is never mislabelled: a play count is never rendered or described as "Views" | Extend the existing `user.engagementLabel` test to the new performance prompt block |
| S6 | Gemini output token usage stays under 50% of the `maxOutputTokens` budget on a production-sized request | Read `usageMetadata` from one live call; compare against the 83% headroom baseline already recorded in `verified-facts.md` |

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

### 3.3 Option B — Tiered, graceful degradation [RECOMMENDATION]

Three tiers, evaluated together, presented in priority order. This is the boss's steer, and I agree with it with two amendments (§3.5).

| Tier | Metric | Needs | Available when |
|---|---|---|---|
| **1 — Engagement-per-reach** | `likes ÷ reach`, `comments ÷ reach` | reach + likes/comments from this post | Always, if the post exposes reach |
| **2 — Creator's own baseline** | `this post's reach ÷ median reach of this creator's other analysed posts in the same bucket` → reported as **"3.2× typical reach"**; same treatment for engagement | ≥ N prior analyses of the same creator in the same comparability bucket | Once history exists |
| **3 — Audience fallback** | `reach ÷ follower or subscriber count` | cached audience count | When there is no history; presented as **approximate**, never precise |

**Design intent: degrade gracefully.** A brand-new creator gets Tier 1 immediately. Tier 2 switches on once history exists and becomes the headline. Tier 3 covers the gap between them, explicitly labelled as the weakest read.

- **Tier 2 is the one the agency will actually quote.** It is self-normalising: it does not care whether the follower count is stale, whether the creator has 500 or 500k followers, or whether two platforms count reach differently — the denominator is *the same creator, measured the same way*.
- **Median, not mean.** One viral post would drag a mean baseline upward and make every subsequent post look like a failure. Median is also what the industry tools use (§3.1).
- **Cost:** one extra database read at analysis time (the creator's prior analyses). **Zero extra ScrapeCreators credits** — the follower count already comes from the existing 7-day-TTL profile cache, which the pipeline already resolves today. Gemini: ~+600–1,000 prompt tokens and ~+300–600 output tokens. Against the measured **83% output headroom on a real production-sized request** (`verified-facts.md`, 2026-08-05), this is comfortable.
- **Weakness:** Tier 2 has a **cold-start problem** — meaningless until several of that creator's videos are analysed, and it inherits the style fingerprint's minimum of 5 (roadmap §1). See decision **D4**.

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

### 4.1 The division of labour [RECOMMENDATION — owner must rule, decision D2]

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
| **Counts-hidden flag** | `like_and_view_counts_disabled` (IG) | Field name confirmed; **the shape of a real counts-disabled payload is NOT verified** — [VERIFY] V1 |
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

### 4.4 Hidden, zero and absent counts — this is a product decision, and here it is [RECOMMENDATION, decision D3]

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

### 4.5 Post age / recency [RECOMMENDATION, decision D5]

A two-day-old reel and a two-year-old reel have had wildly different time to accumulate reach. **A ratio with no recency term systematically flatters old posts**, which is backwards for a tool meant to say what is working *now*.

Recommendation — the honest minimum, not a fake model:

1. **Pass post age explicitly** to Gemini, in days, alongside the ratios, and instruct it to weigh maturity in its verdict ("this is 3 days old; reach is still accumulating").
2. **Maturity floor for precise claims.** Posts younger than a threshold (proposed: **72 hours**) get their verdict marked `provisional` in the contract and badged as such in the UI. The score is still produced; it is labelled as early.
3. **Age-bounded baseline.** Tier 2 excludes posts under the maturity floor from the baseline median. Otherwise a creator who just posted five times this week gets a baseline made of immature posts.
4. **Explicitly NOT doing:** inventing a views-per-day decay curve. We have **no longitudinal data** — the owner has ruled snapshots out (roadmap §3, 3B) — so any decay curve would be fitted to nothing. A views-per-day *velocity* number is available as an option (D5c) but I do not recommend leading with it: it makes brand-new posts look explosive and mature posts look dead, which is the same distortion in the opposite direction.

### 4.6 Content-type comparability [RECOMMENDATION, decision D4]

Reels, carousels and YouTube Shorts **do not perform comparably** and must not share a scoring axis or a baseline.

- **Reels / Shorts (video):** full Tier 1 + 2 + 3. Reach available.
- **Video-bearing carousels:** reach exists per slide, not per post. A post-level reach is a **derived choice** (first slide? max? sum? — summing is wrong; it double-counts the same viewer). **Recommendation:** use the **first slide's** view count as post-level reach, label it as such, and drop confidence one level. Alternatives in D4.
- **All-image carousels and single images:** **no reach exists in the payload at all.** Tier 1 and reach-based Tier 2 are impossible. These get Tier 3 only (engagement ÷ followers) at `LOW` confidence, or `UNAVAILABLE`. **This is a real product limitation, not a bug to fix later** — the data does not exist upstream.
- **Baselines are bucketed.** A creator's median is computed within `(platform, content kind)`, never across. Consequence: cold start applies **per bucket**, so a creator with 5 reels and 2 carousels gets Tier 2 on reels only. That is correct, and it must be visible in the UI, not silent.

### 4.7 YouTube: at parity — and this contradicts the roadmap's framing [RECOMMENDATION, decision D6]

The roadmap lists YouTube-at-parity as `[OPEN]`, reasoning that YouTube carries "structurally less context than Instagram (no audio flag, no dimensions/resolution)."

**That reasoning is correct but does not apply to this feature.** The audio flag and resolution are **content-analysis** context. **For performance scoring, YouTube's data is if anything cleaner than Instagram's:**

- `viewCountInt`, `likeCountInt`, `commentCountInt` — all confirmed numeric and top-level in `verified-facts.md`.
- `subscriberCount` — confirmed numeric, `/v1/youtube/channel`.
- `publishDate` — confirmed ISO-8601 with offset.
- **No view/play-count ambiguity at all.** YouTube has one reach number. The single worst trap in this feature is an Instagram-only problem.

**Recommendation: YouTube is in scope at full parity for 3B.** Two caveats to record:

- **[VERIFY] V2 — YouTube likes-hidden behaviour is unverified.** A YouTube creator can hide the like count. Whether `likeCountInt` comes back `0`, `null`, or absent in that case is **not in `verified-facts.md`**. Do not guess. Until captured, treat YouTube likes with the same false-zero suspicion as Instagram's `video_view_count` (R-4.3.3) and set `UNKNOWN` on a bare 0.
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
- Tier 1 ratios: engagement-per-reach, likes-per-reach, comments-per-reach
- Tier 2: baseline median, sample size, bucket identity, resulting multiplier
- Tier 3: reach-per-follower
- Content kind and comparability bucket

### 5.2 Gemini block — the judgement

- `performanceScore` — integer **1–5, nullable**. Same scale as the rest of the contract (live PRD §4.6). Null when §4.4 says no score.
- `tierUsed` — `CREATOR_BASELINE` / `REACH_ONLY` / `AUDIENCE_FALLBACK` / `UNAVAILABLE`
- `confidence` — `HIGH` / `MEDIUM` / `LOW` / `NONE`, plus **`basedOnVideos`** (the Tier 2 sample size). Precedent: the fingerprint's "based on N videos" indicator, already confirmed in scope (live PRD §6.1). **Tier 2 must never appear without its sample size.**
- `provisional` — boolean; true under the maturity floor (§4.5)
- `verdict` — short Indonesian prose. The judgement the owner asked for.
- `drivers[]` — short Indonesian statements, each linking a **specific content trait to the measured performance** (e.g. *"hook 2 detik pertama langsung menyebut angka — kemungkinan besar ini yang menahan scroll"*). This is where the feature earns its keep; a bare number would not need Gemini at all.
- `unavailableReason` — enum, when applicable (§4.4)

### 5.3 Relationship to `overallScore` [RECOMMENDATION, decision D7]

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

**AC-2 — Tier 2 activates at the threshold**
*Given* a creator with exactly N−1 prior completed analyses in the same bucket (N = the confirmed minimum from D4),
*When* one more completes,
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

**AC-6 — All-image carousel**
*Given* `ig_carousel_all_images_10_slides.json`,
*When* the analysis completes,
*Then* Tier 1 and reach-based Tier 2 are `UNAVAILABLE` with reason `CONTENT_KIND_UNSUPPORTED`, and the row shows either Tier 3 at `LOW` confidence or no score at all — never a reach-based ratio.

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

**AC-10 — Determinism**
*Given* identical inputs,
*When* the analysis runs twice at `temperature: 0`,
*Then* the computed block is byte-identical and `performanceScore` is identical.

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

---

## 8. Phase 3C — the analyses table

**Strictly after 3B** [CONFIRMED, roadmap decision 6] — the table's job is to display 3B's output.

**Do NOT produce visual mockups in this document.** Layout, spacing, density and column widths are the UI/UX designer's job, working from this list. This section specifies **what** and **why**, not what it looks like.

### 8.1 Notes for the owner before design starts

- **`AnalysisGrid` / `AnalysisCard` are dead, unreachable code you have already decided to delete** (RUNBOOK §8.5; handoff item 3). **The table is the only view.** Nothing in 3C should be designed around a card layout, and the designer should not be shown one. `AnalysisGridSkeleton` is a **different, live** module — do not delete it by association.
- **Desktop-only.** Not an oversight, a scope decision.

### 8.2 Columns that exist today and are never surfaced

Migration **006** added fourteen, and migration **009** added three more. Per the roadmap (§3, 3C) the list and detail read paths **do not select them** — they feed the Gemini prompt and go nowhere. From the migration files:

`like_count`, `comment_count`, `has_audio`, `audio_title`, `audio_artist`, `audio_id`, `audio_is_original`, `original_width`, `original_height`, `carousel_item_count`, `profile_id`, `follower_count`, `engagement_rate`, `analysis_mode` (006) — plus `play_count`, `coauthor_producers`, `like_and_view_counts_disabled` (009).

Two things the owner should know:

- **`engagement_rate` already exists as a stored `REAL` column and is written today.** Its denominator is not documented anywhere in the product docs. **3B supersedes it.** Whatever it currently means must be re-specified or dropped as part of the contract reset — otherwise the table would show two different, silently incompatible "engagement" numbers. Decision **D10**.
- Confirming *which* of these the read paths actually select is a tech-lead check against the code. I am reporting the roadmap's claim plus the migration files, not a code audit.

### 8.3 Recommended default columns [RECOMMENDATION, decision D9]

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
| 9 | Engagement-per-reach % | Tier 1. Pairs with #8 to give the good-content-vs-good-distribution read. |
| 10 | Overall content score (1–5) | The existing quality axis. **Deliberately adjacent to #7 and never merged with it** (§5.3). |
| 11 | `formatArchetype` + `hookType` badges | The two most decision-relevant Tier 1 style fields; they turn the table into "what kind of content works for this creator". |
| 12 | Status | Failures must be visible, not silent. |

**Deliberately not default columns** (available in the detail view instead): `topicNiche` / `topicSubtopic`, `ctaType` / `ctaTiming`, all audio fields, `original_width` / `original_height`, `coauthor_producers`, `follower_count`, `profile_id`, `schema_version`. Rationale: a wide table nobody can read is a worse outcome than a narrow one plus a good detail view, and the detail modal already exists.

### 8.4 Behavioural requirements

- **R-8.4.1** Sortable by performance score, baseline multiplier, reach, engagement-per-reach, overall score, and date.
- **R-8.4.2** Filterable by creator, platform, content kind, tier, and status.
- **R-8.4.3** **Unavailable states render as their reason, not as blank or `0`.** "Counts hidden", "Not yet enough history", "No reach data for image posts". Precedent exists in the shipped engagement-count display states.
- **R-8.4.4** A Tier 2 number never appears without its sample size.
- **R-8.4.5** No cell fabricates a value. A null score is a null score.
- **R-8.4.6** Contrast: any new badge is measured in **gamma-encoded sRGB** against `--background`, `--card` **and** the row-hover surface, ≥ 4.5:1 on all three. This exact error class has shipped non-compliant twice (RUNBOOK §8.4). It is checkable numerically and is therefore a real acceptance criterion, not a screenshot.

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
| **Unmeasured risk** | **Carousel token headroom has never been measured** (handoff, carried-forward item 6). The 83% figure comes from a single-video reel. A 10-slide carousel plus a longer prompt is the case that would actually bind. Measure before assuming — [VERIFY] V3. |

### 9.2 Risks

- **R1 — The counts-disabled payload shape is unverified** ([VERIFY] V1). Everything downstream is built defensively around the boolean flag, but the real payload is unseen. Capturing a genuine counts-disabled post costs 1 credit and needs owner approval.
- **R2 — YouTube likes-hidden behaviour is unverified** ([VERIFY] V2). See §4.7.
- **R3 — The follower count is up to 7 days stale.** Accepted by the owner. Mitigated by Tier 2 being the headline (it does not use the follower count at all), and by never presenting Tier 3 as exact.
- **R4 — Tier 2 on a 5-post baseline is statistically thin.** Same caveat the fingerprint carries. Mitigated by always showing the sample size, never by hiding it.
- **R5 — The table gets too wide.** Mitigated by §8.3's explicit non-default list. If the designer pushes back, cut from the bottom of the default list, not from #7/#8.

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

**D5 — Recency. [CONFIRMED → age in prompt + maturity floor + age-bounded baselines]**
All three parts: post age in days is passed to Gemini and weighed in the verdict; posts under the maturity floor are marked `provisional`; posts under the floor are excluded from other analyses' baseline medians.
*Rejected:* (a) doing nothing — systematically flatters old posts, backwards for a tool meant to say what works now. (c) reach-per-day velocity as the headline — makes new posts look explosive and mature posts look dead.
*Sub-question:* **72 hours is confirmed as the starting value, subject to caveat C1 above.**

**D6 — YouTube scope. [CONFIRMED → full parity]**
YouTube is in scope for 3B at full parity. §4.7's reasoning stands: for *performance* scoring YouTube's data is cleaner than Instagram's — one unambiguous view count, confirmed-numeric subscriber count, no play-vs-view trap.
*Rejected:* (b) Tier 3 only, (c) excluded — both were justified by missing *content-analysis* context (audio flag, dimensions), which is irrelevant to this feature.
*Caveat carried:* V2 (below) is now approved and must be captured before code depends on YouTube's likes-hidden shape.

**D7 — Score composition. [CONFIRMED → separate axis]**
`performanceScore` stays a **separate axis from `overallScore`**. Two axes, always rendered as two, never merged, never averaged into a single headline number.
*Rejected:* folding performance into `overallScore` — destroys the good-content-vs-good-distribution signal, which §3.5 argues is the most useful thing this feature produces.

**D8 — Baseline freezing. [CONFIRMED → frozen]**
The baseline, the ratios and the audience number are frozen at analysis time. **Old analyses are never re-scored** when new siblings land or when the creator's audience grows.
*Rejected:* recomputing a creator's history on each new analysis — contradicts the point-in-time ruling (roadmap decision 9) and makes the table non-reproducible.

**D9 — The 3C default column set. [CONFIRMED → §8.3's 12 columns, provisional per caveat C2]**
The 12-column default set and the explicit not-default list are accepted as the basis for design. Subject to mockup review (C2).

**D10 — The existing `engagement_rate` column. [CONFIRMED → drop it]**
`analyses.engagement_rate` is **dropped**. Its denominator is documented nowhere and 3B's computed block supersedes it.
*Rejected:* (b) redefining it as one of 3B's ratios — 3B produces several ratios with different denominators (§12 makes this sharper still); a single column named `engagement_rate` cannot honestly hold them. (c) leaving it unread — two incompatible "engagement" numbers in one schema is a latent bug.

### 10.2 Verification spends — all three [APPROVED]

| ID | What | Cost | Status |
|---|---|---|---|
| **V1** | Capture one genuinely counts-disabled Instagram post | ~1 SC credit | **Approved** |
| **V2** | Capture one YouTube video with likes hidden | ~1 SC credit | **Approved** |
| **V3** | One live Gemini call on a **multi-slide carousel**, reading `usageMetadata`, to measure output-token headroom for the extended contract | 1 billed Gemini call | **Approved** |

**These are for the tech lead / developers to execute during implementation. No PM or docs work should spend them.**

**V3 also discharges a pre-existing carried-forward unknown.** Carousel token headroom has been unverified since the analysis schema redesign — `docs/HANDOFF-2026-08-05.md` carried-forward item 6 records that the only live measurement (~83% headroom) was taken on a **single-video reel**, not a multi-slide carousel. V3's measurement closes that item as well as 3B's own risk; whoever runs it should update `.claude/context/verified-facts.md` and strike the handoff item in the same pass.

**Until V1 and V2 land, no code may depend on the *shape* of a counts-disabled Instagram payload or a likes-hidden YouTube payload** — only on the documented boolean flag and on defensive `UNKNOWN` handling. That constraint is unchanged by the approval; the approval only means the captures may now be made.

---

## 11. Contradictions and corrections found while writing this

Recorded plainly rather than quietly worked around.

1. **The roadmap's stated reason for questioning YouTube parity does not apply to 3B.** §3, 3B lists "[OPEN] whether YouTube is in scope at parity" and cites the missing audio flag and dimensions. Those are **content-analysis** context; for **performance** scoring YouTube is cleaner than Instagram (one unambiguous view count, confirmed numeric subscriber count). The question is still worth asking; the stated reasoning should not drive the answer. (§4.7)
2. **The steer includes "shares/saves if available" — they are not available.** No captured ScrapeCreators payload for either platform exposes shares or saves. Tier 1 is likes and comments only. (§4.2)
3. **There is no single "resolve reach" rule, and the roadmap's framing implies there is one.** §3, 3B correctly warns that view and play counts are distinct, but the reliability is **reversed between top-level reels and carousel children** (`verified-facts.md`, divergence 13). Any shared helper needs a branch, not a rule.
4. **All-image carousels have no reach data at all.** Not mentioned in the roadmap's 3B section, and it means a whole content type can never receive a reach-based score on current data sources. (§4.6)
5. **`analyses.engagement_rate` already exists and is populated**, with a denominator documented nowhere in the product docs. The roadmap describes 3B as adding performance scoring where "nothing captures whether a video performed" — true at the *product* level, but a computed engagement number is already sitting in the schema and must be reconciled, not ignored. (§8.2, D10)
6. **`docs/PRD-analysis-schema-redesign.md` §9 still cites "2 rows in `analyses`, 1 in `profiles`."** The measured figure as of 2026-08-05 is **3 and 2**. Immaterial to any decision; noted for accuracy.
