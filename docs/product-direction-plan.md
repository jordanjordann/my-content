# Product Direction — Plan & Roadmap

**Created:** 2026-07-21
**Owner:** Oden (product owner)
**Author:** John (tech lead)
**Status:** Working plan. Supersedes the sequencing assumptions in `docs/product-direction-open-questions.md`.

## 0. What this document is

`docs/product-direction-open-questions.md` is the **audit + the questions + the owner's answers**. It stays as-is; it is the record of what was asked and what was answered.

**This document is what we do about them.** It converts those answers, plus significant new information from a live session between Oden and the boss, into a sequenced plan.

Reading conventions used throughout:

- **[CONFIRMED]** — an explicit decision from the owner. Build to it.
- **[RECOMMENDATION]** — the boss's or tech lead's proposal. The owner has not objected but has not explicitly confirmed. Do not treat as approved.
- **[OPEN]** — genuinely undecided. Nobody should invent an answer here.

---

## 1. The product, defined

This is the single biggest change since the questions doc. Q1.1 — the highest-convergence question in the audit, the one four people independently asked — now has a concrete answer.

### What it is [CONFIRMED]

**An AI content-brief generator anchored by a learned per-creator style fingerprint.**

The flow:

1. The user names a topic. Owner's own example: *"pros and cons of eating eggs everyday."*
2. Optionally supplies reference inputs (see below).
3. The system generates **a detailed content plan/brief/script for ONE piece of content** on that topic.
4. Written **in that specific creator's style**, derived from that creator's previously analyzed videos.
5. Output in **Indonesian**.

The chain is: **analyze videos → aggregate into a style fingerprint → generate a brief for a named topic in that style.**

### What it is NOT [CONFIRMED]

- **Not a calendar.** No dates.
- **Not a scheduler.** No posting times, no cadence recommendation, no "post 3× a week."
- **Not a trend chaser.** No "this format is popping, jump on it."
- **Not a bulk digest.** Generation is on-demand, one topic at a time.

Of the five candidate readings in Q1.1, this is **(c) content generator**, grounded by **(d) performance digest** as an input. (a), (b) and (e) are out.

### Target user [CONFIRMED]

An **Indonesian social media / marketing agency** — explicitly *not* the creator themselves. The agency plans content for the creators it manages, and analyzes competitor videos as reference material.

Consequences:

- Analysis output and generated content: **Indonesian**. App UI stays **English** for now — explicitly not a priority (Q1.6).
- **Desktop dashboard**, not phone-first (Q3.6). This retires the mobile-density concern raised in the design audit.
- Ambition (Q3.1): *"a super app/dashboard for social media agencies."* Noted as direction, not as current scope.

### Reference inputs [CONFIRMED]

"Extra or other references" from Q1.1 means **all forms**:

- pasted URLs to analyze,
- free-text briefs,
- uploaded files.

Three ingestion paths, not one. This affects the generation surface's input design and needs to be in the Q1.4/generation PRD.

### Where generation lives [CONFIRMED]

**Content generation lives under the creator's profile page.** Not a new top-level "Generate" surface.

This **resolves the previously-deferred Q2.8 (sidebar / app-shell IA) question** explicitly. `Sidebar.tsx` today has one section and one link; the answer to "how does the planner coexist with the app shell" is that it does not get its own shell entry — it hangs off the creator you are generating for, because generation is meaningless without a creator whose style you are generating in.

**This promotes the profiles module significantly, and it is the largest sequencing change in this revision.** Profiles was previously placed "down the long line" (the owner's Q2.7 answer, and the last revision of this plan had it in the final phase). It is now the **home of the core feature**.

The creator profile page is **no longer a detail page**. It becomes a real destination holding:

- scraped **facts** (`profiles` — follower count, bio, account type),
- the **editable style fingerprint** (the separate derived record from above),
- **that creator's analyses**,
- the **Generate** action.

Sequencing consequence: the profiles-module work moves out of the long line and into the mainline plan — see §3 Phase 4. Nothing about generation can ship without it.

### Bulk ingestion by profile [CONFIRMED] — NEW

The owner asked whether building a style fingerprint from analyzed videos means pasting content links **one at a time**. The answer given, and not disputed: **no.** One-at-a-time pasting is unworkable for an agency onboarding a creator — at the 5-video minimum that is 5 manual pastes per creator, and agencies onboard creators in batches.

Intended flow:

**Add creator `@username` → system fetches their recent N posts via ScrapeCreators → queues N analyses → the style fingerprint builds itself.**

One action instead of N manual pastes. **The same flow applies to competitor profiles** — the creator-vs-competitor distinction (§3, 2.1a) rides along unchanged.

Three technical notes that constrain when and how this can be built:

**(a) The profile endpoint exists; post listing is NOT verified.** A ScrapeCreators profile endpoint is **already integrated** — `lib/server/profiles/`, used today for follower count. **Whether ScrapeCreators can list a profile's recent posts is unverified.** Treat it as requiring verification before any ticket is written, and **do not guess at response shapes.** This repo has a documented history of exactly that bug class: the `trim=true` bug that broke **100% of live traffic**, and a dual-shape adapter built against a response shape that **never occurs**. Verification output goes into `.claude/context/verified-facts.md` (which still does not exist — see 2.2).

**(b) CRITICAL DEPENDENCY: bulk ingestion is blocked on the job queue (Q2.3).** Analyzing 5–20 posts in one user action **cannot** run synchronously behind the existing `maxDuration = 300` HTTP request in `app/api/analyze/route.ts`. That loop is **serial**, and this is precisely the timeout failure mode the audit identified. Bulk ingest is therefore **not a standalone feature — it is the first real CONSUMER of the queue work.** "Add creator → auto-analyze their posts" **cannot ship before Q2.3 lands.** This strengthens the case for keeping Q2.3 at its current priority rather than sliding it.

**(c) Cost implication.** N posts × (1–2 SC credits + one Gemini video analysis per post). At a 5-post minimum this is modest. The **ceiling** scales with how many posts an agency chooses to ingest per creator, and there is currently **no quota and no spend visibility** (Q2.4 — `credits_remaining` is returned by ScrapeCreators and discarded). **Bulk ingest is the point at which the missing cost controls start to actually matter.** They were deferrable while ingestion was one URL at a time; they stop being deferrable when one click spends 20 analyses.

### The style fingerprint

Answers Q2.7's open sub-question. All of the following is **[RECOMMENDATION]** — proposed by the boss, not objected to by the owner, but not explicitly confirmed:

- **Derive it by AGGREGATING that creator's analyzed videos.** Do **not** run a separate analysis pass on profile metadata. Bio and profile picture tell you nothing about speaking tone; style lives in the content.
- **Store it as a derived, versioned `profile_style` record** — computed and persisted, **not** computed on the fly at generation time. It is reused on every generation for that creator and is cheap to recompute when new analyses land.
- **Keep it in a table SEPARATE from `profiles`.** `profiles` holds scraped **facts**; style is **inferred**. Mixing the two invites the exact bug class this repo has already hit twice — the nullable-boolean coercion bug in `lib/server/profiles/repository.ts` / `service.ts` where "unknown" silently became a concrete wrong value.
- **Human-editable / overridable.** The user is an agency; they will want to correct *"no, this creator's tone is warmer than that."* Corrections improve every future generation and build trust. Cheap to build now, awkward to retrofit once generations depend on the record.
- **Include caption/text style**, not just video style. Captions are where text voice lives and they are already stored on `analyses`.

### Cold start [CONFIRMED]

**Minimum: 5 analyzed videos before a style fingerprint is generated.** Previously [OPEN]; now decided by the owner. Below 5, no fingerprint exists.

Why 5 holds up:

- **It meaningfully reduces over-fitting versus a smaller threshold.** One off-brand video skews a 3-video sample by 33%; at 5 it skews by 20%. Five is also likelier to capture a creator's actual **range** than a coincidence of three similar posts.

Caveat — recorded as a caveat, **not** as a blocking risk:

- **5 is still thin for a true style fingerprint.** It is a working floor, not a statistically comfortable sample. The **human-editable style profile therefore remains the necessary backstop** — it is what makes a thin sample safe to ship on. This raises, not lowers, the priority of the editable override described above.

**[RECOMMENDATION]** (tech lead — *not* owner-confirmed):

- **Surface confidence in the UI.** Show the sample size on the generation surface and on the profile page, e.g. *"based on 5 videos."* The agency should never be guessing how much evidence sits behind a brief.
- **Treat 5 as a tunable threshold**, stored as config rather than hardcoded, so it can be raised once real output quality is observed. Expect to raise it.

---

## 2. "Should we start fresh?" — the verdict

The owner asked directly whether to restart the project given the scale of the changes. This was his headline question, so it gets real estate.

### Verdict: NO. Do not rewrite the code. DO reset the analysis output schema.

Summary line: **the plumbing is good, the contract is wrong.** Rewriting the plumbing to fix the contract is the expensive way to solve a cheap problem.

### Why the code should not be rewritten

**1. The expensive, hard-won parts are exactly the parts the answers don't change.**

- ScrapeCreators integration — `lib/server/analysis/fetcher/instagram.ts`
- Envelope-unwrapping metadata adapter — `lib/server/analysis/fetcher/adapter.ts`
- SSRF-hardened downloader — `lib/server/analysis/downloader/`, `lib/server/net/ssrfGuard.ts`
- Gemini upload/poll lifecycle — `lib/server/analysis/gemini/`
- Image proxy — `app/api/image-proxy/`

Rewriting re-derives all of it and re-makes the same bugs already paid for once: the `trim` bug that broke 100% of live traffic, envelope unwrapping, the DNS-rebinding TOCTOU, the carousel duration-guard bypass, the `followerCount` silent no-op.

**2. Almost nothing in the answers is architectural.**

- Q1.4 (schema redesign) = a prompt + parser change — `lib/server/analysis/prompts/system.ts`, `lib/server/analysis/parser/analysis.ts`.
- Q1.5 (reproducibility) = a config change + rubric text — `lib/server/analysis/gemini/generate.ts`, `system.ts`.
- Q1.8 ("Recurring Red Flags" → "Red Flags") = a string change.
- Q2.5 (YouTube) = swap a fetcher implementation. The platform-neutral `MediaMetadata` interface was designed precisely to allow this.

The layering — **fetcher → adapter → pipeline → Gemini → persist** — is the right shape for everything described above, including generation.

**3. The genuinely architectural items are ADDITIVE, not replacements.**

- Job queue (Q2.3): does not invalidate `runAnalysis()`. It changes *who calls it*.
- Metric snapshots (Q1.3): a new table alongside `profiles`.
- Multi-part carousels (Q2.6): generalizes the media path; the pipeline stages stay.

**4. There is no data to start fresh FROM.** 2 rows in `analyses`, 1 in `profiles`. No migration burden, no users to break. Starting fresh *on data* is free right now and requires no rewrite.

### But: reset the analysis output schema immediately

That is the thing genuinely worth "starting fresh" on. Every analysis run under the current schema is corpus that will need re-running. At 2 rows that cost is zero; it will not stay zero.

The correct move is **"stop running analyses under the current schema, redesign it, resume."** Not *"rewrite the app."*

**Operational instruction:** avoid accumulating analyses until the Q1.4 schema lands.

### One factual correction to record

The owner's Q1.8 answer says *"Gemini compared it with similar videos out there I believe."* **This is incorrect.**

Gemini saw **exactly one video** — the uploaded one — and nothing else. It has general training knowledge about what performs well, but it has:

- no access to "similar videos out there" as data, and
- no visibility into the user's other posts.

The relabel "Recurring Red Flags" → "Red Flags" is therefore correct for a *stronger* reason than given: the output is neither **recurring** nor **comparative**. It is single-video commentary.

---

## 3. Sequenced plan

Order below follows the owner's explicitly stated priorities. Deviations and additions are marked.

### Phase 1 — Security & platform parity [APPROVED AND DISPATCHED — IN PROGRESS]

**Status:** the owner has **approved** this phase and it has been **dispatched to the team**. It is in progress, **not complete**. Currently in flight:

- **(a)** `proxy.ts` HMAC auth verification fix,
- **(b)** rate limiting on `/api/auth/verify`,
- **(c)** the `existingId` guard (Q3.7)

— all three in **one PR by the backend developer**; and separately,

- **(d)** the YouTube → ScrapeCreators migration, currently in **FEASIBILITY VERIFICATION by the tech lead**. It is **not yet confirmed** that ScrapeCreators supports YouTube adequately. If it does not, the fallbacks are (i) fixing `yt-dlp` with `execFile` / argv arrays plus an anchored classifier regex, or (ii) cutting YouTube entirely — **that decision goes back to the owner.**

#### 1.1 Migrate YouTube to ScrapeCreators [CONFIRMED — feasibility verification in progress]

Owner: *"we can make youtube similar flow like instagram using ScrapeCreators."*

This is **not merely a security patch**. It does three things at once:

- kills the command-injection vector in `lib/server/analysis/fetcher/youtube.ts` (user URL interpolated into a shell string; classifier regex unanchored),
- drops the `yt-dlp` binary dependency entirely,
- fixes YouTube's structurally second-class status — no follower count, no like/comment counts, no engagement rate, and no UI acknowledgement of any of it (Q2.5).

**Touches:** `lib/server/analysis/fetcher/youtube.ts` (rewrite), `lib/server/analysis/fetcher/router.ts`, `lib/server/analysis/fetcher/adapter.ts`, `lib/server/analysis/classifier/`, `lib/server/analysis/pipeline/index.ts` (the `if (classified.platform === "instagram")` profile-resolution guard).

**Downstream is unaffected** — the `MediaMetadata` interface absorbs the swap. That is the whole point of it.

**Cost: moderate.** New SC endpoint, new adapter mapping, classifier regex anchoring. Must be verified against real responses (see 2.2 below — `.claude/context/verified-facts.md` still does not exist).

**Current status: feasibility verification, tech lead.** Not yet confirmed that ScrapeCreators covers YouTube adequately. Fallbacks if it does not: harden `yt-dlp` (`execFile` + argv array, anchored regex) or cut YouTube. Either fallback is an owner decision, not a team one.

**Unblocks:** honest cross-platform analysis; removes the single worst security hole.

#### 1.2 Auth middleware + rate limiting [CONFIRMED — dispatched, in progress]

Owner: *"create a ticket for this too, we can implement this after this grilling session."*

- `proxy.ts`: `const isAuthenticated = token !== undefined;` — any cookie value passes. Add real HMAC verification and expiry check, reusing the API-route logic rather than duplicating a third variant.
- Rate-limit `POST /api/auth/verify` against a 10,000-combination PIN space.

**Touches:** `proxy.ts`, `app/api/auth/verify/route.ts`, `lib/server/auth/`.

**Cost: cheap.** Hours, not days.

#### 1.3 `existingId` guard (Q3.7) [IN PROGRESS — included in the dispatched Phase 1 PR]

Q3.7 was never answered in the questions doc and remains the **only unanswered question from the original set**. `app/api/analyze/route.ts` line ~45 passes the same `existingId` to every URL in the loop, so `{urls: [a,b,c], existingId: "x"}` makes three analyses fight over one row. Only reachable via the detail modal today, but it is an unguarded API contract.

**Status change:** the boss proposed bundling the fix with the security work. The owner has since **approved the security work going ahead, and the `existingId` fix was included in that dispatch.** It is therefore **no longer merely a proposal** — it is in progress as part of Phase 1, in the same backend PR as 1.2.

Fix: reject `existingId` when `urls.length > 1`.

**Cost: trivial.**

---

### Phase 2 — The analysis contract (the core of the work)

This phase is where the product is actually decided. It needs **a dedicated PRD** — owner: *"We will need a separate PRD for this to plan in details."*

**Status: the Q1.4 + Q1.5 PRD is being written now** by the project manager at **`docs/PRD-analysis-schema-redesign.md`**. In progress, not finished. It is the input to every ticket in this phase; do not write Phase 2 tickets ahead of it. It must absorb the confirmed cold-start minimum of **5 analyzed videos** (§1) and the style-first output contract below.

#### 2.1 Q1.4 + Q1.5 as ONE scope [CONFIRMED as next priority; the merge is the tech lead's position]

Owner: *"This should be the next in line after fixing the youtube and rate-limiting stuffs"* and, on Q1.5, *"if this is the same scope as 1.4, then we can put it together."*

**They are the same scope.** You cannot fix reproducibility without redefining the contract, and you cannot define a contract you can't reproduce.

**The schema's primary job has changed.** The questions doc (Q1.4) argued the output needed structured attributes so they could be cross-tabulated against performance. **That is now SECONDARY.** The primary job is **capturing STYLE**:

- tone
- pacing
- hook construction
- narrative structure
- verbal patterns / verbal tics
- caption & on-screen text voice

Performance attributes still matter — they answer *"what works for this creator"* — but **style is the payload**, because style is what feeds generation. This meaningfully redirects the Q1.4 PRD away from how it was framed in the questions doc.

Also in this scope, from Q1.5:

- `temperature: 0.2` → `0` in `lib/server/analysis/gemini/generate.ts`.
- Use `responseSchema` + `responseMimeType: "application/json"` instead of regex-scraping JSON out of free text in `lib/server/analysis/parser/analysis.ts`.
- **Parse failure must become an error, not a silent `5`.** `lib/server/analysis/parser/validation.ts` currently invents scorecard values — indistinguishable in the DB from a genuine 5/10. Expect previously invisible failures to start surfacing once this lands.
- Anchored rubric text per score band in `system.ts`. Today nothing defines what a 4 vs a 7 in `retentionFlow` means, so scores are not comparable across videos.
- Add a **`result_content` schema version field**. None exists.

**Two data-model items that belong in this PRD:**

**(a) Creator vs. competitor [CONFIRMED context; the boss raised the implication].** The agency analyzes both the creators it manages **and** competitors it studies. `profiles` must distinguish the two. This is **not auth** — it is a data-model question and it belongs here regardless of when auth ships. A style fingerprint for "a creator we manage" and a reference analysis of "a competitor" are different objects with different downstream use.

**(b) Cross-post aggregation vs. longitudinal — a distinction the questions doc conflated.**

- **Cross-post aggregation** (patterns across a creator's posts, at a point in time) is **REQUIRED**. It is the basis of the style fingerprint and of the owner's Q1.7 answer: *"help me understand what makes MY good posts good, then help me plan more like them."*
- **Longitudinal time-series** (re-polling the same post's/account's metrics over time) is **optional and now further deprioritized** (see 4.4).

These are not the same thing and the schema design depends on keeping them apart.

**Touches:** `lib/server/analysis/prompts/system.ts`, `lib/server/analysis/gemini/generate.ts`, `lib/server/analysis/parser/analysis.ts`, `lib/server/analysis/parser/validation.ts`, `lib/server/analysis/types/`, a new migration in `migrations/`, plus the frontend detail modal under `components/` / `app/analyses/`.

**Cost: expensive.** This is the real work. Prompt design, rubric authoring, schema design, parser rewrite, UI rewrite of the detail view.

**Unblocks:** everything about generation. Nothing downstream can be built on the current contract.

#### 2.2 [RECOMMENDATION] Validation harness + tests — ALONGSIDE 2.1, not after

Owner answered **"yes"** to Q2.9 but placed it after the queue in the priority list.

**The tech lead's position: it belongs in Phase 2, running in parallel with the schema redesign.** Reason: redesigning the schema without tests means you cannot distinguish a **prompt regression** from an **extraction bug**. You will be changing the prompt and the parser simultaneously, with no signal telling you which one broke.

Current state: **zero test files in the entire repo.** No CI. GitHub issue **#36** ("[BE] Validation harness: verify ScrapeCreators mapping against real URLs") is still open. `.claude/context/verified-facts.md` **does not exist**, despite `AGENTS.md` mandating that all external-API work read it and halt if it is absent — which means every external-API ticket in this plan is technically blocked by its absence.

Minimum viable version:

- fixture-based tests for `lib/server/analysis/fetcher/adapter.ts` against captured real SC payloads (Instagram post, carousel, video-child, and the new YouTube shape),
- golden-file tests for `lib/server/analysis/parser/analysis.ts` + `validation.ts`,
- create `.claude/context/verified-facts.md` and populate it from the YouTube migration work in Phase 1.

**Owner has not explicitly re-sequenced this. Flagged as a recommendation.**

**Cost: moderate, front-loaded.** Pays for itself inside Phase 2.

---

### Phase 3 — Job queue / async pipeline [CONFIRMED]

Owner: *"This will be our 3rd priority after 1.4, let's make this right first."*

Current state: `app/api/analyze/route.ts` runs a **serial `for` loop** over up to 10 URLs inside one HTTP request with `maxDuration = 300`. There is no realistic batch of 10 that completes in 300s. On timeout the connection dies, the Node process keeps running, rows stay `pending` forever with **no reaper**, and there is **no idempotency** — the user retries and the credits burn again.

Progress reporting is **fake**: `runAnalysis` accepts `onProgress` but `/api/analyze` never passes it, so `lib/server/analysis/pipeline/progress.ts` is dead code from the client's perspective, and `AnalysisProgressPanel.onRetry` is never wired.

Scope: job table + background worker + polling or SSE + a reaper for stale `pending` rows + idempotency.

**This decision also decides HOSTING.** A job table plus a background worker **cannot run on Vercel serverless.** That needs to be an explicit decision inside this phase, not a discovery during it.

**Touches:** `app/api/analyze/route.ts`, `lib/server/analysis/pipeline/index.ts` (caller changes only — `runAnalysis()` itself survives), `lib/server/analysis/pipeline/progress.ts` (wire it up or delete it), new migration, new worker entrypoint, the progress panel under `components/`.

**Cost: expensive.** Architectural, but **additive** — it changes who calls `runAnalysis()`, not what it does.

---

### Phase 4 — Media & efficiency

#### 4.1 Carousel multi-media analysis [CONFIRMED]

Owner: **a 7-slide carousel = ONE content analysis** — one holistic verdict on how the whole thing goes. **ALL slides included as input, both images AND videos.**

**Explicit note, because the questions doc flagged this as a conflict: it is NOT a conflict with migration 005.** `migrations/005_enforce_single_content_analysis.sql` enforces **one CONTENT per analysis**. A carousel is still **one content** — it just has **multiple MEDIA PARTS** sent in a single Gemini call. The constraint holds unchanged.

The real work is technical, not schematic. Today `lib/server/analysis/fetcher/adapter.ts` `resolveVideoChild()` takes the **first** video slide only; duration, audio and video URL all come from that one node. The download/upload path in `lib/server/analysis/downloader/` and `lib/server/analysis/gemini/` handles **exactly one video file end to end**.

Scope:

- generalize the media path from one file to **N media parts** per analysis (mixed images + videos),
- N uploads, or inline image parts for images,
- extend the duration guard to sum across video slides (the current guard is bypassable via carousels),
- surface `analysis_mode` in `/api/analyses` — a caption-only `metadata_only` guess currently renders **identically** to a real video analysis.

**Cost scales with slide count.** A 10-slide carousel is up to 10× the media cost of a single reel. Needs a cap decision.

**Cost: moderate-to-expensive**, concentrated in the downloader/Gemini layer.

#### 4.2 Reuse `gemini_file_uri` [CONFIRMED]

Owner: *"reuse the gemini_file_url."*

`gemini_file_uri` and `gemini_file_expires_at` are **written on every run and never read** — a half-built cache sitting idle. On re-analyze, check expiry and skip download + upload entirely.

**Touches:** `lib/server/analysis/pipeline/index.ts`, `lib/server/analysis/gemini/`, `lib/server/db.ts`.

**Cost: cheap.** Immediate saving on every re-analyze.

#### 4.3 "Recurring Red Flags" → "Red Flags" [CONFIRMED]

String change in `AnalysisPatternsSection.tsx`. See §2's factual correction for why: the output is neither recurring nor comparative.

**Cost: trivial.** Can ship any time.

#### 4.4 `metric_snapshots` groundwork [RECOMMENDATION — reduced scope]

Owner marked Q1.3 as *"nice to have."* Given the product definition, **it drops further than that**: if plans are generated on-demand per topic, trajectory data is not load-bearing for anything.

But: **history cannot be backfilled**, and `lib/server/profiles/repository.ts` currently **destroys** the previous `follower_count` on every upsert (`COALESCE(excluded.follower_count, profiles.follower_count)`).

Proposal: **record snapshots cheaply if convenient** — a small append-only table written on the upsert path we already run — and **deprioritize the scheduled re-fetch entirely.** No scheduler, no recurring SC credit spend, no re-poll job.

**Cost: cheap** for the recording half. The half that was expensive (scheduler + recurring credits) is the half we're not doing.

---

### Phase 5 — Later / long line [CONFIRMED as direction, not scheduled]

- **Profiles as its own module.** Owner: *"down the long line will be expanded to its own module... its own module in the UI... The content generator will also be accounting the profile since the profile will have its own analysis like speaking tone, video style, text style."* Note this is the same object as the style fingerprint in §1 — plan them as one thing, not two.
- **Generation UI / IA.** Blocked on [OPEN 2] below.
- **Table field selection.** Owner wants to revisit which fields the analyses table shows (Q3.4). Migration 006 added ~14 columns that `getAnalysesList()` and `getAnalysisDetail()` in `lib/server/db.ts` **do not select** — they feed the Gemini prompt and then go nowhere. Sequence this **after** Phase 2, since the schema redesign changes what's worth showing.
- **Market research.** Owner: *"I have not done a full market research of this. From what I know this is very niche."* Not blocking engineering. Flagged so it isn't forgotten before any monetization decision.

---

## 4. What changed since the questions doc

Explicit list of premises in `product-direction-open-questions.md` that are now **obsolete**. Do not re-derive from them.

| Premise in the questions doc | Status now |
| --- | --- |
| "Content planner generator" might mean a calendar/schedule with dates, cadence, platform mix (Q1.1b) | **Obsolete.** No calendar, no schedule, no cadence. One brief per named topic, on demand. |
| Trend/competitor recommendation engine as a candidate product (Q1.1e) | **Obsolete.** Not being built. Competitor videos are *reference material*, not a trend feed. |
| Longitudinal time-series is "the entire substrate of a content plan" (Q1.3) | **Obsolete as stated.** On-demand per-topic generation doesn't need trajectory. Reduced to cheap snapshot recording; the scheduled re-fetch is dropped. |
| The analysis schema's job is structured attributes for cross-tabulating against performance (Q1.4) | **Demoted to secondary.** Primary job is now capturing **STYLE**. Redirects the PRD. |
| Cross-post aggregation and longitudinal data are roughly the same need | **Wrong — they were conflated.** Cross-post aggregation is REQUIRED (it *is* the style fingerprint). Longitudinal is optional. |
| Multi-slide carousels "mean the schema stops being one-row-one-video — which migration 005 explicitly enforced" (Q2.6) | **Not a conflict.** One content, N media parts. Migration 005 holds unchanged. The work is in the download/upload path, not the schema. |
| Phone-native information density needed from the start (Q3.6) | **Retired.** Desktop dashboard, confirmed. |
| "Cut YouTube" as the cheap fix for the command-injection vector (§0.1) | **Superseded.** Migrate it to ScrapeCreators instead — same fix, plus platform parity. |
| Q1.8: Gemini's "recurring" patterns are per-video commentary | **Still true, and the owner's stated reason for it was wrong.** Gemini saw one video and nothing else. Neither recurring nor comparative. |
| Auth/tenancy is "the highest-leverage answer in the audit" (Q2.1) | **Downgraded.** Deferrable — see §6. But the creator-vs-competitor data-model distinction it surfaced is **not** deferrable and moves into the Q1.4 PRD. |

---

## 5. Open questions still blocking

Three. None have answers. **Do not invent them.**

### [OPEN 1] Cold-start minimum for the style fingerprint

A fingerprint from 1 analyzed video is noise; from ~15 it is meaningful. What is the minimum N, and what happens below it?

- (a) block generation until N analyses exist,
- (b) warn but proceed,
- (c) generate with an explicit low-confidence flag.

An agency onboarding a new creator hits this **on day one, every time**. Must be decided in the Q1.4 PRD. **Blocking Phase 2 design.**

### [OPEN 2] Where does generation live in the app IA?

A new top-level "Generate" surface, or hanging off a creator's profile page?

The boss suspects **inside the profile**, now that generation is per-creator-style — which would incidentally resolve the previously-deferred Q2.8 sidebar question (`Sidebar.tsx` currently has one section, one link). **Not confirmed by the owner.** Blocking any generation UI work in Phase 5.

### [OPEN 3] Q3.7 — `existingId` applied to every URL in the batch

Never answered in the questions doc. The boss proposes bundling the fix with the Phase 1 security work. **Not yet approved.** Blocking nothing, but it is an open API-contract hole.

---

## 6. Deferred / explicitly not doing now

Recorded with reasons so nobody relitigates them.

| Item | Decision | Reason |
| --- | --- | --- |
| **Rewriting the app** | **No** | Plumbing is good, contract is wrong. See §2. |
| **Auth / multi-tenancy (`user_id` on every table)** | **Deferred** | At 2 rows, retrofitting `user_id` is an afternoon, not a project. **Two conditions:** (1) do it **before a second organization touches the app** — not merely when it becomes annoying; (2) the creator-vs-competitor distinction is **independent of this** and ships with Q1.4 regardless. |
| **Scheduled metric re-fetch / longitudinal polling** | **Not doing** | Not load-bearing for on-demand per-topic generation. Costs a scheduler plus recurring SC credits per account per interval. Only the cheap snapshot-recording half survives (§4.4). |
| **Calendar / posting schedule / cadence** | **Not doing** | Not the product. See §1. |
| **Trend feed / competitor recommendation engine** | **Not doing** | Not the product. Requires ingesting other people's content at scale, which the single-URL model can't do. |
| **App UI internationalization** | **Deferred** | Owner: English UI is *"not a priority."* Analysis and generated content stay Indonesian. |
| **Monetization work** | **Deferred** | Personal tool for now; possible later. Not a current constraint. Note `formatCount` in `helpers.ts` hardcodes `toLocaleString("en-US")` — cosmetic debt, not blocking. |
| **Auto-onboarding / pulling a creator's account automatically** (Q3.5) | **Not doing** | Owner: *"No need for now."* |
| **Mobile-first layout** (Q3.6) | **Not doing** | Desktop dashboard confirmed. |
| **Hiding the analysis feature behind the planner** (Q1.9) | **Not doing** | Analysis stays a **real user-facing feature**. Owner's plan: a video link given to the planner also shows up in the analysis feature, and the analysis is the **basis** of the generated plan. |
| **Analyses table redesign / card grid** (Q3.4, unused `AnalysisGrid`) | **Deferred to Phase 5** | Owner wants to revisit which fields are shown. Pointless before the Q1.4 schema changes what fields exist. |
| **Error UX beyond current toast** (Q3.3) | **Deferred** | Today: a toast with the BE error passed through. Revisit with the Phase 3 progress/SSE work. |
| **Deduplication / unique index on `analyses.url`** (Q2.4) | **Partially addressed** | The `gemini_file_uri` reuse (§4.2) captures most of the saving. Full dedup + quota + `credits_remaining` persistence is unscheduled. |

---

## 7. Critical-path summary

```
Phase 1  YouTube → ScrapeCreators        [CONFIRMED]  cheap-moderate  ─┐
         Auth middleware + rate limit    [CONFIRMED]  cheap           ─┤ independent
         existingId fix                  [RECOMMEND]  trivial         ─┘

Phase 2  Q1.4 + Q1.5 schema redesign     [CONFIRMED]  EXPENSIVE       ← needs a PRD
         ├─ style-first output contract
         ├─ creator-vs-competitor model
         ├─ cold-start decision           [OPEN 1] ← blocks design
         └─ validation harness + tests    [RECOMMEND] run in parallel

Phase 3  Job queue / async pipeline      [CONFIRMED]  EXPENSIVE       ← also decides hosting

Phase 4  Carousel multi-media            [CONFIRMED]  moderate-expensive
         gemini_file_uri reuse           [CONFIRMED]  cheap
         "Red Flags" relabel             [CONFIRMED]  trivial (ship any time)
         metric_snapshots recording      [RECOMMEND]  cheap

Phase 5  Profiles module + style UI      [CONFIRMED direction]        ← blocked on [OPEN 2]
         Generation surface              [CONFIRMED direction]        ← blocked on [OPEN 2]
         Table field selection           [CONFIRMED direction]
         Market research                 [not engineering]
```

**Operational rule for the whole of Phase 1:** do not accumulate analyses under the current output schema. Every one is corpus that will need re-running after Phase 2.
