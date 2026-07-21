# Product Direction — Open Questions

**Status:** Living working document. **Every question below is unanswered.**
**Created:** 2026-07-21
**Owner:** Oden (product owner)

## How to use this document

The product today is a **content analysis tool** (paste an Instagram/YouTube URL → Gemini watches the video → returns a scored analysis). The stated destination is a **content planner generator**. This document records every questionable assumption sitting between those two things.

Four perspectives contributed independently and without coordination:

- **Technical** — John (tech lead), full codebase audit
- **Product** — Dan (project manager)
- **Design** — Jessica (UI/UX)
- **Owner** — Oden's own questions

Rules for this document:

1. **These are questions, not answers.** Nothing here has been decided, approved, or agreed to. Every question carries an `**Answer:** _(pending)_` line. Fill them in inline as you work through them; do not delete the question.
2. **Convergence is signal.** Where multiple perspectives independently arrived at the same question, they are merged into one entry and the convergence is noted. Those are the highest-confidence items.
3. **Tiering is about reversibility, not effort.** Tier 1 redirects the roadmap. Tier 2 is architectural and expensive to reverse. Tier 3 is real but non-blocking.
4. The criticism is deliberately unsoftened — it was requested that way.

---

# 0. URGENT — act independently of the strategy questions

These two are not product questions. They do not wait on any answer below.

## 0.1 Command injection in the YouTube fetch path (exploitable today)

`lib/server/analysis/fetcher/youtube.ts` interpolates a user-supplied URL directly into a shell string:

```
`yt-dlp --dump-json ... --no-playlist "${cleanUrl}"`
```

The classifier regex is **not anchored at the end**:

```
^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+
```

and `new URL()` does not percent-encode `$`, `(`, or `)` in a path. Verified:

```js
new URL('https://www.youtube.com/shorts/abc$(id)x')  //  "https://www.youtube.com/shorts/abc$(id)x"
regex.test(...)                                      //  true
```

Inside double quotes in `sh`, `$(...)` is command substitution. Any authenticated user gets **arbitrary command execution as the app process**. Both `fetchShortMetadata` and `extractVideoUrl` are affected.

Authentication is a 4-digit PIN (10,000 combinations) with **no rate limiting on `/api/auth/verify`**.

Fix: `execFile`/`spawn` with an argv array, plus anchoring the regex. Alternative fix: drop YouTube entirely, which removes the vector, the `yt-dlp` binary dependency, and the second-class-platform problem in one move (see Q2.5).

Note the irony: `net/ssrfGuard.ts` and the image proxy were hardened carefully. The shell-out is the soft underbelly.

**Decision needed:** fix, or cut YouTube.
**Answer:** Create a ticket, we can make youtube similar flow like instagram using ScrapeCreators

## 0.2 Middleware treats any cookie value as authenticated

`proxy.ts`:

```ts
const isAuthenticated = token !== undefined;
```

No HMAC verification, no expiry check. `document.cookie = "my_content_session=x"` grants access to every `/app/*` page.

API routes _do_ verify properly via `isAuthenticated()`, so data is not currently exposed — but this is a duplicated, divergent auth check. The moment anyone adds a Server Component that reads data directly, it becomes a real breach.

Also in scope: rate limiting on `/api/auth/verify` against a 10,000-key space.

**Answer:** Create a ticket for this too, we can implement this after this grilling session

---

# 1. Current state of the system (factual snapshot)

Written so this document is legible cold, months from now.

## Shape

Next.js 16 App Router, single process. SQLite/libSQL (`file:./my-content.db`, Turso-capable). No queue, no worker, **no tests anywhere in the repo**, no CI. **2 rows in `analyses`, 1 in `profiles`** — real code quality, no real usage.

## Request flow

`POST /api/analyze` (`app/api/analyze/route.ts`) → auth check → **serial `for` loop** over up to 10 URLs → `runAnalysis()` per URL → returns `{analysisIds, failedUrls}`. `maxDuration = 300`.

## Pipeline — `lib/server/analysis/pipeline/index.ts`

1. `classifyUrl` — regex only. Supports **exactly three** URL forms: `instagram.com/reel/`, `instagram.com/p/`, `youtube.com/shorts/`. No TikTok, no IG Stories, no regular YouTube videos, no `instagram.com/{user}/reel/...`.
2. Insert `analyses` row with `status='pending'`.
3. `fetchMetadata` — Instagram: 1 ScrapeCreators credit on `/v1/instagram/post?trim=false`, unwrap `data.xdt_shortcode_media`, map via `adapter.ts`. YouTube: two `yt-dlp` subprocess shell-outs.
4. `resolveProfile` — cache-first on `profiles` (7-day TTL) → owner-hint from post payload (free) → second SC credit on `/v1/instagram/profile`. Failure is swallowed; `engagementRate = null`.
5. `computeEngagementRate` = `(likes + comments) / followers`.
6. Ollama (`llama3.1:8b`) generates an **Indonesian** title from the caption. Failure → falls back to raw caption.
7. Duration guard: `MAX_VIDEO_SECONDS = 900`.
8. If `videoUrl`: stream-download to `/tmp` (SSRF-guarded, DNS-pinned, 500MB cap, 120s timeout) → `uploadToGemini` → `pollUntilReady` (up to 60s) → `analysis_mode='full_video'`. Otherwise `metadata_only`.
9. Persist ~25 metadata columns.
10. `analyzeContent` — Gemini `gemini-2.5-flash`, `temperature: 0.2`, `maxOutputTokens: 8192`, system + user prompts concatenated into a single text part.
11. `parseContentAnalysis` — regex-extract JSON from free text (`text.indexOf("{")` … `lastIndexOf("}")`), coerce.
12. Persist `raw_gemini` + `result_content`, `status='completed'`.
13. On any error: **delete the row entirely** (new analysis) or mark `failed` (re-analyze). **No retry at any step** except the ScrapeCreators HTTP client.

## Data model

`analyses` is a single wide flat table — migrations 004/005 deliberately collapsed `content_items` + `analysis_results` into it, enforcing one-content-per-analysis. `profiles` is keyed `(platform, username)` and **upserted in place**; `follower_count` is overwritten with no history. `settings` holds `pin_hash`. **No `users`, no `workspaces`, no tenant column anywhere.**

## Analysis output contract — `lib/server/analysis/prompts/system.ts`

Gemini returns: `overallScore`, `summary`, 7 scorecard dimensions, plus free-text `strengths[]`, `weaknesses[]`, `keyMoments[]`, `patterns.{viralFormulas, audiencePsychology, recurringRedFlags}[]`, `suggestions[]`. The prompt mandates `Gunakan BAHASA INDONESIA untuk semua teks`.

## Frontend

Single route `/app/analyses`.

- `AnalysisDataTable.tsx` — a literal spreadsheet: 12 columns (thumb, platform, title, overall score, 7 dimension scores, actions). One row = one post.
- Filter bar — **client-side only**, all filtering in memory.
- `AnalysisDetailModal.tsx` — opens on row click; scorecard + Patterns + Suggestions. Footer actions: **only "Re-analyze" and "Delete."** Re-analyze is a raw `fetch` at `AnalysisDetailModal.tsx:57`, bypassing `lib/api/`.
- `AnalysisPatternsSection.tsx` — labels a block "Recurring Red Flags" but reads `results.patterns` from a **single** analysis.
- `Sidebar.tsx` — one nav section ("Analysis"), one link ("Analyses"). No Planner surface exists.
- Scores render as bare colored numbers (green ≥7, yellow ≥5, red <5). No confidence indicator, no "AI-generated" framing.
- Thumbnails via `/api/image-proxy`, host-allowlisted to `cdninstagram.com`/`fbcdn.net`, disk-cached.
- An unused `AnalysisGrid` component exists in the tree.

## Auth

4-digit PIN → bcrypt(12) in `settings.pin_hash` → HMAC-signed cookie, 30-day TTL. API routes verify properly. `proxy.ts` does not (see §0.2).

---

# 2. Tier 1 — answering these redirects the roadmap

## Q1.1 — What does "content planner generator" actually mean? What does it output?

**Perspectives: Technical + Product + Design + Owner — all four, independently.** This is the single highest-convergence item in the document.

At least five readings, which are not five flavors of one product:

- (a) **Topic/idea suggester** — "post about X next"
- (b) **Calendar/schedule generator** — dates, cadence, platform mix
- (c) **Content generator** — scripts, hooks, captions (a copywriter)
- (d) **Performance digest** — "what's working, do more of this"
- (e) **Trend/competitor recommendations** — "this format is popping, jump on it"

Product's read: these are four different data pipelines, four different UIs, and arguably four different companies. (a)/(d) can plausibly be built on top of what exists (your own past analyses). (c) needs a generative writing engine and has essentially nothing to do with video analysis. (e) needs ingestion of _other people's_ content at scale, which the single-URL-paste model cannot do.

Technical's read: you have a well-engineered ingestion pipeline for a product that has not been specified. The analysis output is prose-shaped, snapshot-only, single-tenant, and unversioned — every one of those is fine for "look at my analysis" and fatal for "generate my plan." Until this is answered you cannot tell whether the analysis schema is right, what data is missing, or whether the DB needs a rethink — **and every additional analysis you run is corpus you will likely have to re-run under a new schema.**

Design's read: this decides whether the work is redesigning a table or designing a completely different information architecture.

**Pick one, or rank them.**

**Answer:** The content planner generator will be a way for user to get generated content planner from gemini based on the videos that we analyzed (ideally). Thats why this video analysis for the first step is important, this sets the tone for the whole app for later. While the user can still give extra or other references for the content plan that they want to generate, this video analysis now will be very important.

---

## Q1.2 — Does analyzing your own past content actually get you to a plan, or is that a link that doesn't exist yet?

**Perspectives: Product + Owner (converged).**

The whole system is retrospective. A planner is forward-looking. Walk through the mechanism explicitly, not the vibe:

Analysis today outputs things like "hook length was short, engagement dropped after second 8." **How does that become "post a 30-second cooking video on Tuesday"?**

If the honest answer is "trends and competitor content matter more than my own history," then the entire current product — paste-a-URL-you-own, watch-it-with-Gemini — may be solving the wrong 80%.

Product's blunt framing: you have a fully-built retrospective tool and you're calling the destination a prospective tool. Nothing yet establishes that the retrospective tool is a _necessary ingredient_ of the prospective one. It may simply be the thing that got built first because it was the easiest MVP to scope.

Sub-question: is the missing link competitor content, trend data, or your own historical patterns?

**Answer:** This video analysis feature that we have right now will be references to the content generator.

---

## Q1.3 — There is no longitudinal data anywhere. A planner needs a time axis.

**Perspectives: Technical + Owner (converged).**

Every analysis is a one-off snapshot. `view_count`, `like_count`, `engagement_rate` are written once at analysis time and **never refreshed**. `profiles.follower_count` is **overwritten** on every upsert (`repository.ts`, `COALESCE(excluded.follower_count, profiles.follower_count)`) — the previous value is destroyed. There is no `profile_snapshots` table, no `metric_history`, no re-poll job.

So the system cannot answer:

- "Did this account grow after posting X?"
- "Is engagement trending up?"
- "Which format is performing better _this month_ vs last?"

That is the entire substrate of a content plan. A planner that cannot see trajectory can only regurgitate generic advice — which is exactly what the Gemini `suggestions` array already does.

Is this a conscious deferral or was it not yet considered? Is the plan to add metric snapshots plus a scheduled re-fetch, or are you comfortable with a planner that has zero longitudinal signal?

If snapshots: that is a new table, a scheduler (no infrastructure exists for one), and N ScrapeCreators credits per account per interval — a recurring cost not currently modelled at all.

**Answer:** Should this be a separate sub feature? how complex it is to change from what we have to this? This would be nice to have.

---

## Q1.4 — The analysis output schema is diagnostic, not generative. It's a dead end for planning.

**Perspective: Technical.** (Related to Design's Q1.7 on what a planner consumes.)

Everything actionable in the current contract is **unstructured Indonesian prose**. There is no machine-readable extraction of:

- content topic / niche
- hook _type_ (question / shock / POV / stat)
- format archetype
- video structure / beat map
- CTA type
- on-screen text
- hashtags
- pacing / cut rate
- target audience

A planner needs to reason over `format=talking-head-POV, hook_type=contrarian-claim, topic=personal-finance, length=32s` and cross-tabulate that against performance. You cannot cross-tabulate `"Hook-nya kuat karena..."`.

The seven scorecard dimensions are also aesthetic-quality judgements (`visualPolish`, `brandConsistency`) rather than planning primitives. Ranking a library by `visualPolish` tells a creator nothing about what to post next Tuesday.

Are you willing to redesign the Gemini output schema **now, before accumulating a corpus**, to include structured/enumerated content attributes?

Trade-off: invalidates the existing 2 rows (trivial), forces a `result_content` schema version field (none exists), lengthens the prompt. The alternative is a planner built on prose — i.e. "ask an LLM to summarize a pile of Indonesian paragraphs," a much weaker product.

**Answer:** This should be the next in line after fixing the youtube and rate-limiting stuffs. We will need a separate PRD for this to plan in details.

---

## Q1.5 — Scores are non-reproducible and silently fabricated on parse failure.

**Perspectives: Technical + Design (converged from opposite ends — Technical on reproducibility, Design on whether the UI overstates certainty).**

Three compounding problems:

1. **Non-determinism.** `generate.ts` uses `temperature: 0.2` — not 0. Same video, two runs, different scores. No seed, no `responseSchema`, no `responseMimeType: "application/json"` despite SDK support. JSON is regex-scraped out of free text in `parser/analysis.ts`.
2. **Fabrication.** `validation.ts` **invents data on failure**: any missing or non-numeric scorecard key becomes `5`; a missing `scorecard` object entirely becomes all-5s. That is indistinguishable in the DB from Gemini genuinely scoring a video 5/10 across the board. `overallScore` defaults to `0`.
3. **No rubric anchors.** `system.ts` gives 1–10 dimension names with a one-line gloss and **nothing defining what a 4 vs a 7 in `retentionFlow` means.** Scores are therefore not comparable across videos, accounts, or time. Comparing them — which any planner must do — is comparing noise.

Design's angle: the table renders `overallScore` as a plain colored number, visually identical to a real analytics metric like view count. It is Gemini's subjective read on one prompt pass. There is no confidence indicator and no "AI-generated" framing anywhere. If a creator makes real posting decisions off a 6 vs an 8, the UI is overstating certainty. (The existence of a "Re-analyze" button implicitly concedes inconsistency.)

Do you accept that today's scores cannot legitimately be ranked or averaged? Fixing it means: temperature 0, `responseSchema` structured output, anchored rubric text per score band, and — critically — making a parse failure an **error** instead of a silent `5`. That last change will start surfacing failures currently invisible.

Separately: should the UI label scores as opinion rather than fact?

**Answer:** We should fix this. Plan this after the 1.4, or if possible, if this is the same scope as 1.4, then we can put it together

---

## Q1.6 — Who is the user, and is Indonesian a deliberate market bet?

**Perspectives: Product + Technical + Design + Owner — all four.** Second-highest convergence in the document.

The evidence:

- `system.ts` demands `Gunakan BAHASA INDONESIA untuk semua teks`.
- `ollama.ts` generates Indonesian titles.
- Every UI string is English ("New Analysis", "Analyses", "Pending").
- `helpers.ts` `formatCount` hardcodes `toLocaleString("en-US")`, so Indonesian analysis text sits next to `12,345` instead of `12.345`.
- No i18n layer, no locale setting, no language column.

Two intertwined questions:

**(a) Who is the user, concretely?** Solo creator, agency managing multiple client accounts, or a brand/marketing team? A solo creator wants "tell me what to post tomorrow" in under 10 seconds. An agency wants cross-account reporting and probably wants a _dashboard with defensible numbers to show a client_, not a generator. A brand wants competitor benchmarking. These three want almost nothing in common except "video went into a black box, insight came out."

**(b) Is Indonesian-only deliberate or artifact?** If deliberate — a wedge on creator-economy specifics, language, platform behavior — then the rest of the product (English shell, `en-US` number formatting) is misaligned with that audience. Note that "Indonesian content inside an English shell" is a real and common pattern for Indonesian SaaS, but it should be a _stated decision_.

If language is instead a per-user setting, that requires a preference column, a prompt-template layer, and frontend i18n — none of which exist, and all of which get harder once there's a corpus of Indonesian-only analyses a future English-speaking user can't read.

**Answer:** The user will be indonesian, a social media agency/marketing agency. The content generated and the analysis must be in indonesian, but we can keep the app language as english for now - this is not a priority.

---

## Q1.7 — Is the primary unit a post, or a creator's body of work? And what does the planner consume?

**Perspectives: Design (primary) + Technical.**

Every data structure today is post-scoped: `AnalysisListItem`, `AnalysisDetail`, the table, the modal. But planners are inherently about a stream of future output informed by patterns across _many_ past posts.

If the true mental model is "help me understand what makes MY good posts good, then help me plan more like them," the data model needs a creator/account-level aggregate layer that does not exist.

Coupled sub-question: **what does an analysis hand forward?** Today the modal's only actions are Re-analyze and Delete. There is no "turn this into a content idea," "save this hook style," "add to planner," or "flag as a pattern to repeat."

- If the planner is a separate generator that does not read analysis output at all, that's two products stapled together.
- If it does consume analysis output, what specifically carries forward — the scorecard numbers? the prose suggestions? the raw video? That defines what "save" even means as a UI action.

This decides whether the front page becomes a dashboard → planner with individual analyses as a drill-down.

**Answer:** Yes, u are right, it is "help me understand what makes MY good posts good, then help me plan more like them,"

---

## Q1.8 — "Patterns" currently lies about itself.

**Perspective: Design.**

`AnalysisPatternsSection.tsx` labels a block "Recurring Red Flags" but reads `results.patterns` from a **single** `ContentAnalysis` object. It is not cross-post pattern mining. Gemini cannot identify anything "recurring" across a corpus it never saw — it's per-video commentary dressed in a label implying aggregation the system does not do.

Two options:

- (a) make it real cross-post aggregation — a backend and prompt change, not a UI change; or
- (b) relabel it to stop implying analysis it isn't doing.

This blocks designing an honest planner surface: a planner built on fake "recurring" patterns will make bad recommendations look authoritative.

**Answer:** We can relabel it to "Red flags". Gemini compared it with similar videos out there I believe.

---

## Q1.9 — Is the analysis feature the product, or plumbing?

**Perspectives: Product + Design (converged).**

If the planner is the real product, does a user ever need to see "views: 4,200, engagement rate: 3.1%, resolution: 1080p" in a table with a modal — or should that entire UI eventually disappear behind the scenes with only the plan surfacing?

This determines whether to keep polishing the analyses table and filter bar, or to stop investing there now.

Related: once the planner ships, what happens to the analysis feature as it exists today — user-facing, backend-only, or cut?

## **Answer:** This should be a feature. Later on my plan is: in the planner, when the user gives video link to analyze, it will also be showing here in the feature analysis. This video analysis then will be the basis of the content plan generator.

# 3. Tier 2 — architectural, expensive to reverse

## Q2.1 — Single-tenant by construction. Multi-user SaaS, or permanently a personal tool?

**Perspectives: Technical + Product + Owner — three-way convergence.**

Evidence:

- One global `pin_hash` in `settings`.
- Zero `user_id` / `workspace_id` on `analyses` or `profiles`.
- `getAnalysesList()` is `SELECT ... FROM analyses ORDER BY updated_at DESC` — unfiltered, unpaginated.
- `getUniqueAccounts()` returns every username in the DB.
- Anyone with the 4-digit PIN (10,000 combinations, no rate limiting) sees everything.

Additionally, a content planner is inherently per-creator: it needs to know _whose_ account is being planned for, which is not the same as "whose analyses are in the table." `profiles` today does not distinguish "my account" from "a competitor I'm studying."

Technical calls this the highest-leverage answer in the audit. "Yes, multi-user" means: real auth, `user_id` on every table plus backfill, per-user quota, per-user cost accounting, rate limiting, and an `is_own_account` flag on profiles. **Doing it at 2 rows is free; doing it at 50,000 is a migration project.**

**Answer:** The user is not the content creator itself. The user is a social media agency, it plans for it's content creators by analyzing their videos, or competitor videos. Is it possible that we create auth later?

---

## Q2.2 — Who pays, and do the unit economics survive a planner?

**Perspective: Product.** (Tightly coupled to Q2.4 on cost visibility.)

Each analysis already costs real money. A planner that wants "analyze this account's last 50 posts plus 20 competitor posts" is ~70× the cost of today's one-off.

Is this a tool for yourself, where cost is whatever you're willing to eat? Or something you intend to charge others for? If commercial, has cost-per-plan been sanity-checked against what a user would actually pay?

**Answer:** This is a tool for myself for now. I might want to monetize it later, but its still far due to the product is way far from done.

---

## Q2.3 — Synchronous pipeline behind an HTTP request. This will time out in production.

**Perspectives: Technical + Product (Product arrives at it via bulk ingestion; Design via progress UI, see Q3.3).**

`maxDuration = 300`. Worst case for a **single** URL: SC fetch 30s (×3 retries = 90s) + Ollama (unbounded, local model, no timeout) + 500MB download at 120s + Gemini upload + `pollUntilReady` 60s + Gemini video analysis of a 15-minute video. And `/api/analyze` loops up to **10 URLs serially** through all of that. There is no realistic batch of 10 that completes in 300s.

On timeout: the HTTP connection dies, the Node process keeps running the loop, the client shows a generic error, and rows stay `pending` forever with **no reaper**. There is **no idempotency** — the user retries and the credits burn again.

Progress reporting is **fake**. `runAnalysis` accepts `onProgress`, but `/api/analyze` never passes it. `AnalysesContent.tsx` sets progress to "Starting analysis..." then jumps to complete. The entire `pipeline/progress.ts` module is dead code from the client's perspective, and the panel's retry button is never wired (`onRetry` is optional, never passed).

Product's related question: today's interaction model is "paste one URL, get one analysis." A planner reasoning about trends or an account's pattern over time needs continuous or bulk ingestion, not a paste box. If so, the URL-chip input with a 10-at-a-time cap is a dead end.

Do you accept a job queue plus polling or SSE now, or keep shipping a UI that lies about progress? Note: a job table plus background worker cannot run on Vercel serverless — **this answer also decides your hosting.**

**Answer:** This will be our 3rd priority after 1.4, let's make this right first.

---

## Q2.4 — Zero deduplication, zero cost visibility.

**Perspective: Technical.**

Analyze the same URL twice → two SC credits, two 500MB downloads, two Gemini video analyses, two rows. Nothing checks `SELECT id FROM analyses WHERE url = ?`. No unique index on `url`. No quota, no per-day cap, no spend counter.

The SC client already receives `credits_remaining` in the envelope and **throws it away** (`instagram.ts` mentions it; nothing persists it).

You do not know what one analysis costs. Rough order: 1–2 SC credits + Gemini video tokens (~250–300 tokens per second of video → a 15-minute video at `MAX_VIDEO_SECONDS=900` is ~250k input tokens, roughly 100× a 30-second reel). **The cost variance between the cheapest and most expensive permitted analysis is two orders of magnitude**, and nothing warns the user or the operator.

Should re-analyzing an already-analyzed URL be free (serve cached), cheap (re-use `gemini_file_uri`), or full price? And should `credits_remaining` be persisted to see the burn?

Note: `gemini_file_uri` and `gemini_file_expires_at` are **written on every run and never read** — a half-built caching mechanism sitting idle.

**Answer:** reuse the gemini_file_url

---

## Q2.5 — Is YouTube actually in scope, or a leftover to cut?

**Perspective: Technical.**

`pipeline/index.ts` guards profile resolution with `if (classified.platform === "instagram")`. YouTube content therefore has no follower count and no engagement rate, and per `youtube.ts` no like or comment counts either. YouTube analyses are **structurally second-class and the UI does not say so.**

Keeping it half-supported means every planner feature must handle a platform with no engagement data. Cutting it also removes the command-injection vector (§0.1) and the `yt-dlp` binary dependency.

**Answer:** We will fix the youtube as the first priority per section 0 answer

---

## Q2.6 — Carousels lose everything after the first video slide.

**Perspective: Technical.**

`adapter.ts` `resolveVideoChild()` takes `getCarouselChildren(raw).find(child => __typename === "XDTGraphVideo" || is_video)` — the **first** video slide only. Duration, audio, and video URL all come from that one node. Slides 2–10 are never downloaded, never described, never sent to Gemini. `carousel_item_count` is stored, so the model is told "carousel (7 slides)" while seeing one.

Carousels are a major Instagram format where the payoff is deliberately on the last slide. Image-only carousels get `analysis_mode='metadata_only'` — meaning Gemini scores `visualPolish` and `hookStrength` for a video **it never saw**, from the caption alone, and stores it in the same `scorecard` shape as a real video analysis. Nothing in the API or UI surfaces `analysis_mode` (`/api/analyses` doesn't select it), so a caption-only guess is displayed identically to a real analysis.

Is single-video-per-analysis a permanent constraint or a stopgap? Multi-slide means either N Gemini uploads (N× cost) or inline image parts, and it means the schema stops being one-row-one-video — which migration 005 explicitly enforced.

**Answer:** We need to analyze all image in carousels.

---

## Q2.7 — `profiles` is nearly vestigial and the new metadata columns are invisible.

**Perspective: Technical.**

Migration 006 added `like_count`, `comment_count`, `has_audio`, `audio_title`, `audio_artist`, `audio_id`, `audio_is_original`, `original_width`, `original_height`, `carousel_item_count`, `profile_id`, `follower_count`, `engagement_rate`, `analysis_mode`.

In `db.ts`, **`getAnalysesList()` and `getAnalysisDetail()` select none of them.** They go into the Gemini prompt and then nowhere. The user cannot see, sort by, or filter on engagement rate.

`profiles` exists only to supply one number (`followerCount`) to one formula. There is no profile page, no "my accounts" view; `biography`, `is_business_account`, `profile_pic_url`, and `raw_payload` are stored and never read.

Was `profiles` built for the planner (creator identity, "plan for @me") or purely as the engagement-rate denominator? If the former, it needs an owner flag and a UI. If the latter, it is over-built.

**Answer:** Profile later on down the long line will be expanded to its own module. It will have its own module in the UI, showing all the details needed. The content generator will also be accounting the profile since the profile will have its own analysis like speaking tone, video style, text style, etc.

---

## Q2.8 — How does the planner coexist with the app shell?

**Perspective: Design.**

`Sidebar.tsx` has one section with one link. When the planner ships, is it a peer nav item, or does "Analyses" get demoted into a sub-view? Cheap to answer now, expensive to retrofit.

**Answer:** I am still not sure about this, we can revisit this later after having more features.

---

## Q2.9 — Do you want a validation harness and tests before building the planner on this?

**Perspective: Technical.**

`AGENTS.md` mandates: "Before writing any code that interacts with an external API, read `.claude/context/verified-facts.md`... If the file doesn't exist, **stop and flag it**." **There is no `.claude/context/` directory.**

Meanwhile GitHub issue **#36 — "[BE] Validation harness: verify ScrapeCreators mapping against real URLs" — is still open**, and there are **zero test files in the entire repo**. The ScrapeCreators field mapping, which the whole Instagram path depends on, was verified once by hand against two URLs, and nothing will signal when the upstream shape changes. `adapter.ts` `resolveAudio()` even admits the carousel-child shape is unconfirmed and only `console.warn`s.

Building a planner on an unverified, untested extraction layer means planner outputs will be wrong in ways indistinguishable from bad prompting.

**Answer:** yes

---

# 4. Tier 3 — real but non-blocking

## Q3.1 — What job is the user hiring this for?

**Perspective: Product.**

What is the actual moment a user opens this app — what are they trying to avoid or get out of doing themselves? Do they sit staring at a blank content calendar? Do they have ideas but not know if they're good? Do they know what to post but not when or how often?

"Analysis" answers none of these directly. It answers "why did my last video do what it did."

**Answer:** User will have ideas on content, but will ask this app to generate one. Or user can also just visit this app to analyze some contents out there and get some insights. I want this app to be a super app/dashboard for social media agencies out there

---

## Q3.2 — What's the wedge against what already exists?

**Perspective: Product.**

What already does some version of this, and why does someone pick you over it? If the wedge can't be articulated in one sentence, the planner concept needs more definition before dev time goes into it.

**Answer:** I have not done a full market research of this. From what I know this is very niche

---

## Q3.3 — What does the user see during a 30–90s run, and on hard failure?

**Perspective: Design.** (See Q2.3 — the progress plumbing is not wired.)

There is an `AnalysisProgressPanel` with a `ProgressState`, but what does it look like mid-run for multiple URLs, and what does "the video download failed" communicate to a non-technical user? Does the error ever explain _why_ — private account, deleted post, unsupported format — or is it a generic toast?

**Answer:** Its a toast with the error passed from BE.

---

## Q3.4 — Is a 12-column spreadsheet the right container for narrative content?

**Perspective: Design.**

Every non-score field — summary, strengths, weaknesses, key moments, suggestions — is prose. The list view shows none of it, only numbers, forcing a modal open to read anything qualitative. Should the primary list become a card grid?

Sub-question: there is already an unused `AnalysisGrid` component in the tree. Dead prototype, or intended replacement?

**Answer:** This is what I want to revisit about the fields needed. We can discuss this later.

---

## Q3.5 — What is the first-run experience for a brand-new user?

**Perspective: Design.**

`AnalysesContent.tsx` shows `AnalysisEmptySection` when `analyses.length === 0` — an empty table with a "New Analysis" button. The user must already have specific post URLs in hand to get any value. For a planner product, should onboarding pull a creator's own account and recent posts automatically?

**Answer:** No need for now

---

## Q3.6 — Phone-first tool or desktop dashboard?

**Perspective: Design.**

The data table has 12 columns with `overflow-auto` — a horizontal-scroll spreadsheet on a phone, close to unusable for daily habitual checking. If creators use this like an Instagram-adjacent daily tool, information density needs to be phone-native from the start.

**Answer:** Desktop dashboard

---

## Q3.7 — `existingId` is applied to every URL in the batch.

**Perspective: Technical.** Bug, not a question — recorded here for tracking.

`/api/analyze/route.ts` line 45 passes the same `existingId` inside the loop over all URLs. Sending `{urls: [a, b, c], existingId: "x"}` makes all three analyses fight over one row, each overwriting the last. Only reachable via the detail modal today (which sends one URL), but it is an unguarded API contract.

**Answer:** _(pending)_

---

# 5. The convergence

Four people looked at this independently — a tech lead reading the whole codebase, a PM reading it as a product, a designer reading it as an interface, and the owner reading his own intent. They arrived at different tiers, different vocabularies, and different evidence.

All four asked the same question:

> **What does the planner actually output?**

- **Technical** framed it as: the schema, tenancy, and time-axis decisions are all unanswerable until this is.
- **Product** framed it as: five candidate products, four different data pipelines, arguably four different companies.
- **Design** framed it as: I don't know whether I'm redesigning a table or designing a new information architecture.
- **Owner** framed it as: at least five readings — which, or which combination?

Nothing else in this document can be sequenced until Q1.1 has an answer. And note the cost of delay called out by the audit: every additional analysis run under the current schema is corpus that will likely need re-running under a new one.

---

# 6. Known open tickets / debt referenced above

- **Issue #36** — "[BE] Validation harness: verify ScrapeCreators mapping against real URLs" — still open (§Q2.9).
- **Zero test files in the entire repo.** No CI (§1, §Q2.9).
- **`.claude/context/verified-facts.md` does not exist**, despite `AGENTS.md` mandating that all external-API work read it and halt if absent (§Q2.9).
- **`gemini_file_uri` / `gemini_file_expires_at`** — written on every run, never read. Half-built cache (§Q2.4).
- **`credits_remaining`** — returned by ScrapeCreators, discarded, never persisted (§Q2.4).
- **`pipeline/progress.ts`** — dead code from the client's perspective; `onProgress` never passed by `/api/analyze` (§Q2.3).
- **`AnalysisProgressPanel.onRetry`** — optional prop, never passed; retry button never wired (§Q2.3).
- **`analysis_mode`** — persisted but not selected by `/api/analyses`, so metadata-only guesses render identically to real video analyses (§Q2.6).
- **Migration 006 columns** (`like_count`, `comment_count`, `engagement_rate`, audio fields, dimensions, `carousel_item_count`, etc.) — persisted, fed to the prompt, never selected by `getAnalysesList()` / `getAnalysisDetail()`, never surfaced in UI (§Q2.7).
- **`profiles` fields** `biography`, `is_business_account`, `profile_pic_url`, `raw_payload` — stored, never read (§Q2.7).
- **`AnalysisGrid`** — unused component in the tree; status unknown (§Q3.4).
- **Re-analyze in `AnalysisDetailModal.tsx:57`** — raw `fetch`, bypasses the `lib/api/` layer (§1).
- **No reaper for `pending` rows** left behind by timeouts (§Q2.3).
- **No unique index on `analyses.url`**; no dedup (§Q2.4).
- **No rate limiting on `/api/auth/verify`** against a 10,000-key PIN space (§0.1, §0.2).
- **No `result_content` schema version field** (§Q1.4).
