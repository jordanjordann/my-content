# TDD (SKELETON) — Phase 3: 3A job queue, 3B performance scoring, 3C analyses table

**Status:** **SKELETON — NOT FINAL. Do not write tickets from this document.**
**Author:** John (tech lead)
**Created:** 2026-08-06
**Primary inputs:** `docs/prd/PRD-3B-performance-scoring-and-3C-analyses-table.md` (3B + 3C),
`docs/product-direction-plan.md` §3 Phase 3 (3A + sequencing), `docs/HANDOFF-2026-08-05.md`,
`docs/RUNBOOK.md` §4/§7/§8, `.claude/context/verified-facts.md`.

## Why this is a skeleton and what is missing

1. **The 3A hosting decision is OPEN and this document deliberately does not resolve it.** §2 lays
   out the options and returns the question to the owner. Every 3A section below is written to be
   host-parameterised: the parts that are the same under every option are specified; the parts that
   differ are marked `[HOST-DEPENDENT]` and left unwritten. **A TDD that quietly assumes an answer
   here would be worse than no TDD.**
2. **The 3C UI sections are placeholders.** Jessica is designing 3C and the §13 explainability
   surfaces in parallel; her spec does not exist yet. §8 states the contract the UI will consume and
   the layering rules it must obey, and stops there.
3. **Three verification spends (V1, V2, V3) are approved but NOT yet captured.** No code may be
   built against the shape of a counts-disabled Instagram payload, a likes-hidden YouTube payload,
   or an assumed carousel token headroom until they are. See §10.
4. The ticket outline in §11 is **for sequencing discussion**, not a ticket set. No GitHub issues
   have been created.

---

## 1. Codebase findings that change the PRD's assumptions

These were checked against the actual code, not inferred from the migration files. Two of them
contradict statements in the PRD, and one is a live product defect the PRD does not know about.

### 1.1 `engagement_rate` is NOT unused — and D10's "just drop it" is bigger than stated

PRD §8.2 lists `engagement_rate` among "roughly 17 columns added by migrations 006 and 009 that are
**written and never read**", and says its denominator "is not documented anywhere". Both are wrong.

**It is written, and it is read — into the Gemini prompt.** The chain, verified:

- `lib/server/profiles/helpers.ts:23` — `computeEngagementRate()`. Its denominator is **followers**:
  `(likes + comments) / followerCount`. Returns `null` when `followerCount` is null or 0, and its
  docstring says so explicitly — the denominator *is* documented, in code rather than in product docs.
- `lib/server/analysis/pipeline/index.ts:124-135` — computes it, writes it to the DB (`:256`, `:286`),
  **and assigns it onto `metadata.engagementRate`** specifically so the prompt builder can read it.
  The inline comment at `:130-133` says exactly that.
- `lib/server/analysis/prompts/user.ts:111-112` — emits `- Engagement rate: <percent>` into the user
  prompt on every analysis.
- `lib/server/db.ts` — `getAnalysesList()` / `getAnalysisDetail()` do **not** select it. So it is
  unread by the *UI*, which is presumably what the roadmap meant, but it is very much read by the
  *pipeline*.

**Two consequences the owner should hear:**

- **D10's blast radius is five files, not one column.** Dropping it means removing
  `computeEngagementRate` (or repurposing it — see below), removing `MediaMetadata.engagementRate`
  (`lib/server/analysis/types/metadata.ts:34`), removing the prompt block, updating
  `tests/server/db/migrations.schema.test.ts` (`EXPECTED_ANALYSES_COLUMNS`, currently 39 entries), and
  updating the two pipeline tests that stub the helper
  (`tests/server/analysis/pipeline/fingerprintRecompute.test.ts:75`,
  `tests/server/analysis/pipeline/viewCountBinding.test.ts:83`). Still small — but not a no-op.
- **There is a live R-12.3.1 violation shipping today.** The prompt hands Gemini a
  **follower-denominated** ratio under the bare, unqualified label `Engagement rate`, on *every*
  content type including reels — precisely the failure mode §12.3 and R-12.5.1 exist to prevent, and
  the same class of bug that `user.engagementLabel.test.ts` was written for on the reach axis.
  **This is not a new 3B risk; it is an existing defect that 3B happens to fix.** Worth saying out
  loud, because it makes "drop `engagement_rate`" a *correctness* change rather than cleanup.

**Recommendation (a recommendation, not a decision):** do not literally delete
`computeEngagementRate`. Relocate it as 3B's follower-denominated Tier 1 primitive with a mandatory
`denominator: "FOLLOWERS"` on its return value (R-12.2.2) — it is already exactly the formula
R-12.2.1 specifies. Same arithmetic, honest label, one fewer thing to write.

### 1.2 The `schema_version` bump touches the fingerprint engine, not just `analyses`

`ANALYSIS_SCHEMA_VERSION` (`lib/server/analysis/schema`) is currently `2` and is used as a **filter**
in places beyond persistence:

- `app/api/profiles/[id]/fingerprint/route.ts:74,136` — `countCompletedV2Analyses(id, ANALYSIS_SCHEMA_VERSION)`.
- `lib/server/fingerprint/*` — `recomputeFingerprint` counts only `schema_version = ANALYSIS_SCHEMA_VERSION`
  completed rows and refuses to write a fingerprint below 5 (pinned by
  `tests/server/fingerprint/service.test.ts`).

**Blast radius of bumping to 3:** every analysis row is deleted (3 rows, cost ~0, as the PRD says)
**and every profile's style fingerprint becomes uncomputable until 5 new analyses exist per profile.**
`profile_style_fingerprints` has 0 rows today so nothing is *destroyed* — but the fingerprint feature,
which the handoff calls "a finished engine", returns to cold start and stays there until the corpus is
rebuilt.

**This is larger than the owner's "3 rows, near-zero cost" framing.** The cost is not the rows; it is
that Phase 5's generator has no fingerprint to generate from until re-analysis happens. It is still
the right call — there is no alternative that preserves a contract we are deliberately breaking — and
bulk ingestion (3A) is exactly what makes rebuilding cheap. **Recorded so it is not a surprise.**
`profile_style_fingerprints.schema_version` is a stored column, so any stale fingerprint row would
already be detectable; no extra work is needed there.

### 1.3 Point-in-time scoring (D3/D8) — the schema expresses it cleanly, with one wrinkle

`analyses.follower_count` already exists and is already written per-analysis at analysis time
(`pipeline/index.ts:285`), independently of `profiles.follower_count`, which `resolveProfile` upserts
over. The freeze is therefore already structurally correct: the analysis row owns its own copy of the
denominator. Nothing in D3/D8 fights the schema.

**The one wrinkle:** R-13.3.2 requires the follower count's **staleness** to be inspectable. Today that
lives on `profiles.last_fetched_at`, which is **mutated by the next refresh** — so a completed analysis
cannot recover how stale its own denominator was. That value must be **copied onto the analysis row at
write time**, not joined from `profiles` at read time. §4.2 adds `audience_source_fetched_at` for this.
Without it, R-13.3.2 and R-13.4.5 are unimplementable and AC-9's byte-identity guarantee is true only
by accident.

### 1.4 The 72-hour maturity floor — a tunable constant, as C1 requires

C1 is explicit that 72h is an unmeasured guess. Implementation: a single named export in
`lib/server/analysis/performance/constants.ts`, env-overridable in the manner already established for
`PROFILE_TTL_DAYS` / `MAX_VIDEO_BYTES` (`docs/RUNBOOK.md` §3):

```
MATURITY_FLOOR_HOURS   default 72   override PERFORMANCE_MATURITY_FLOOR_HOURS
BASELINE_MIN_SAMPLE    default 5    override PERFORMANCE_BASELINE_MIN_SAMPLE
```

D4's bucket minimum gets the same treatment — the roadmap already recommends treating the
fingerprint's 5 as tunable, and 3B inherits the same number for the same reason. Both go into
`.env.example` per RUNBOOK §3's audit rule. **No UI copy may state or imply the floor is validated
(R-13.4.4)**; that is enforced in §9 by a string search over the copy source, not by review.

### 1.5 The `@libsql/client` transaction leak is directly relevant to 3A

Known hazard, source-traced in `docs/RUNBOOK.md` §8 and the 2026-08-05 handoff — **do not re-derive**.
`Sqlite3Client.transaction()` steals the underlying `Database` handle and `Sqlite3Transaction.close()`
is a no-op after a successful commit; there is no userland fix. Harmless in tests, unbounded under a
long-lived server.

**A job queue is precisely the code that reaches for `transaction()`** — claim-a-job is the textbook
`SELECT ... FOR UPDATE` shape. **Binding constraint on 3A: the claim must be a single atomic
`UPDATE ... RETURNING *`, never a transaction.** See §7.3. This is the same fix pattern already proven
in `lib/server/fingerprint` (PR #120).

---

## 2. `[OPEN — OWNER DECISION REQUIRED]` Where does the worker run?

**This is the single blocking decision for 3A and I am not making it.**

### 2.1 The constraint, stated precisely

3A needs a process that (a) outlives an HTTP request, (b) polls a job table, and (c) runs
`runAnalysis()` — which downloads video to `/tmp`, shells out to `yt-dlp` for YouTube, uploads to the
Gemini File API, polls it, and waits on a Gemini generation. Observed today:
`app/api/analyze/route.ts` sets `maxDuration = 300` and runs a **serial `for` loop** over up to
`MAX_URLS_PER_BATCH` URLs inside one request. A single 61s reel is not fast; ten in series has no
realistic chance inside 300s.

**Vercel serverless cannot host a background worker.** Its cron is minutes-granular and each
invocation is itself a bounded function; there is no long-lived process. There is also no persistent
filesystem, and `yt-dlp` is a binary dependency we deliberately retained (roadmap §3, 1.1) — an
independent problem on serverless.

**Current deployment reality, verified:** there is **no `vercel.json`, no Dockerfile, no deploy
workflow**, and `next.config.ts` is empty. `.github/workflows/ci.yml` runs test/typecheck/lint/build
and nothing else. `TURSO_DATABASE_URL` is unset by default, so the app runs against a **local SQLite
file** (`file:./my-content.db`). **As far as the repo is concerned, this app is not deployed anywhere
today.** That is good news: the hosting choice is genuinely open, not a migration.

### 2.2 The options, with honest trade-offs

| | **A. Local / self-hosted (single long-lived Node process)** | **B. Container PaaS (Fly.io / Railway / Render)** | **C. Vercel + external worker** | **D. Vercel + cron-driven "worker-lite"** |
|---|---|---|---|---|
| **Shape** | `npm start` on the owner's machine or one VPS; worker is a second process (or a same-process loop) beside Next.js | One image runs Next.js; a second process/machine in the same project runs the worker | Next.js on Vercel; worker on a small always-on box elsewhere; both point at Turso | Next.js on Vercel; a cron function claims **one** job per invocation and returns |
| **DB** | Local SQLite file works today, unchanged | **Turso required** (container filesystems are ephemeral) | **Turso required** | **Turso required** |
| **Cost** | £0 | ~$5–15/mo | ~$5–15/mo + Vercel | Vercel + Turso free tiers |
| **Ops burden** | Lowest to build, **highest to keep running** — nothing restarts it, no logs, no uptime | Low. Restarts, logs, health checks are the platform's job | Highest — two platforms, two deploy paths, two sets of env vars, split logs | Low platform burden, **highest correctness burden** |
| **Migration effort from today** | ~none | Dockerfile + Turso cutover + `db:migrate` in the release step | Everything in B, plus a second deploy target | Turso cutover; no worker to write, but a heavy queue redesign |
| **`yt-dlp`** | Fine | Fine (install in image) | Fine on the worker box | **Broken.** Binary + long download inside a bounded function |
| **Fits the runtime a real analysis needs?** | No limit | No limit | No limit | **No** — a Gemini video analysis can exceed a cron function's ceiling; the job would have to be split into resumable steps, which is a far larger design |
| **Honest verdict** | Correct for a single-owner internal tool **today**; wrong the day anyone else uses it | The boring, obvious answer if this is ever shared | Only worth it if Vercel's CDN/preview workflow is independently valuable | Recommend against — buys serverless purity at the price of re-architecting the pipeline |

### 2.3 What I need from the owner

**Question O-1:** Is this tool (a) staying a single-user local/internal tool for the foreseeable
future, or (b) going to be hosted somewhere the agency's staff reach over the internet?

- If **(a)** → **Option A**, and 3A gets substantially cheaper: same process, same SQLite file, an
  in-process worker loop started from an entrypoint script. **No Turso migration, no Docker, no cloud
  bill.** The job table and claim semantics are identical under every option, so this is not a dead
  end — it is the same code with a different `main`.
- If **(b)** → **Option B**, and 3A grows a Dockerfile, a Turso cutover and a deploy pipeline. That is
  a real chunk of work belonging in its own ticket **before** any queue ticket, because migrating a
  live job table later is worse than starting on Turso.

**Question O-2 (only if (b)):** are we already committed to Vercel for anything? Nothing in the repo
says we are. If not, Option C's split-brain cost is pure loss and B is strictly better.

**My recommendation, offered as a recommendation and nothing more:** **A now, designed so that B is a
deploy change and not a rewrite.** Keep every queue primitive host-agnostic (§7), keep the worker
entrypoint a thin `scripts/worker.ts` importing `runWorkerLoop()` from `lib/server/jobs/`, and keep
all SQL libSQL-portable so the Turso cutover is an env var. That preserves the option without paying
for it.

**Everything below marked `[HOST-DEPENDENT]` stays unwritten until O-1 is answered.**

---

## 3. Architecture overview

Existing layering (roadmap §2 verified it as the right shape; nothing in Phase 3 changes it):

```
classifier → fetcher → adapter → pipeline → gemini → parser → persist
```

Phase 3 adds:

- **3A** wraps `runAnalysis()` in a job queue. **It changes who calls `runAnalysis()`, not what it
  does.** No fetcher/adapter/parser change.
- **3B** inserts a **new deterministic stage between adapter and prompt-build**, and extends the output
  contract the parser validates:

  ```
  adapter → [NEW: performance/computeBlock] → prompt-build → gemini → parser → persist
  ```

  The computed block is written by code, never by Gemini (D2). It is both an **input** to the prompt
  and a **stored artefact** in its own right.
- **3C** is read-path plus UI only.

**Module placement (AGENTS.md conventions):**

```
lib/server/analysis/performance/
├── index.ts            # barrel
├── types.ts            # ReachKind, AvailabilityState, Denominator, Tier, ComputedPerformanceBlock
├── constants.ts        # MATURITY_FLOOR_HOURS, BASELINE_MIN_SAMPLE, rounding tolerance
├── reach.ts            # resolveReach() — the carousel/top-level branch (§4.1)
├── availability.ts     # resolveAvailability() — the four states (§4.3)
├── ratios.ts           # Tier 1 / Tier 3 arithmetic, denominator-tagged
├── baseline.ts         # Tier 2: bucket key, median, sample size, multiplier
└── computeBlock.ts     # orchestrates the above into ComputedPerformanceBlock

lib/server/jobs/        # 3A — see §7
```

Nothing under `app/` computes anything. Per AGENTS.md's data-transformation rule, the API route returns
the stored block verbatim, all derivation happens in `lib/api/analyses/hooks.ts`'s `select`, and
components receive already-shaped props.

---

## 4. 3B — the computed block

### 4.1 Reach resolution — a branch, not a rule

PRD §11 correction 3 is right: there is no single resolve-reach rule. From
`.claude/context/verified-facts.md`:

| Case | Rule | Source |
|---|---|---|
| Top-level reel/video | `video_play_count` is authoritative; `video_view_count === 0` alongside a non-zero `video_play_count` is a **false zero** | fixture `ig_reel_1_zero_view_count.json` (`view 0` / `play 116333`) |
| Carousel **video child** | **Reversed** — `video_play_count` is `null` on all 7 children, `video_view_count` is populated | fixture `ig_carousel_mixed_video_and_image_10_slides.json` |
| Video-bearing carousel, post level | **First slide's** count (D4), kind from that slide, confidence −1 | D4 |
| All-image carousel / single image | **No reach field exists at all** — neither key is present | fixture `ig_carousel_all_images_10_slides.json` |
| YouTube | `viewCountInt`, one unambiguous number, kind `VIEWS` | verified-facts, `/v1/youtube/video` |

**R-12.7.1 is binding: branch on field *presence*, never on `__typename` or on "is this image
content".** verified-facts' 2026-08-05 correction proves both discriminators are wrong — two
`XDTGraphSidecar` payloads differ from each other, and an `XDTGraphImage` single-image post carries
fields the all-image carousel does not.

`resolveReach()` returns `{ value, kind, state, derivedFrom }`, where `derivedFrom` is
`TOP_LEVEL | CAROUSEL_FIRST_SLIDE | NONE` so the confidence penalty and R-13.4.2's explanation have
something to read. A bare `0` with no corroborating sibling is `UNKNOWN`, not `ZERO` (R-4.3.3).

**Rounding tolerance for S2/AC-7, since the PRD asks the tech lead to state it:** a numeral extracted
from Gemini prose matches the computed block if it agrees to **1 decimal place** for multipliers and
percentages, and **exactly** for integer counts, after stripping thousands separators.
**Indonesian prose uses `,` as the decimal separator (`4,2%`)** — the extractor must handle both `,`
and `.` or it will silently pass everything. Flagged explicitly because that is exactly how an
automated criterion becomes vacuous.

### 4.2 Migration 012 — schema

Repo convention is **additive only, no down-migrations** (RUNBOOK §4). D10 requires a **drop**, so 012
is a **full table rebuild** in the style of `009_analysis_mode_images_only.sql`. (Modern SQLite does
support `ALTER TABLE ... DROP COLUMN`, but 009 set the house pattern and
`tests/server/db/migrations.schema.test.ts` asserts positional alignment of the `INSERT...SELECT`
column lists — a rebuild keeps that assertion meaningful.) Since all rows are deleted anyway, the
`INSERT...SELECT` copies nothing and the rebuild is trivial.

**`analyses` — drop 1, add 12 (39 → 50 columns).** `EXPECTED_ANALYSES_COLUMNS` must be updated in the
same PR.

| Column | Type | Notes |
|---|---|---|
| ~~`engagement_rate`~~ | — | **DROPPED** (D10). See §1.1 for the code that must go with it. |
| `perf_reach_value` | `INTEGER` | nullable — absent for image-only content **by design**, not by failure |
| `perf_reach_kind` | `TEXT` | `CHECK(... IN ('PLAYS','VIEWS','UNKNOWN'))`, nullable |
| `perf_reach_derived_from` | `TEXT` | `TOP_LEVEL` / `CAROUSEL_FIRST_SLIDE` / `NONE` |
| `perf_tier1_ratio` | `REAL` | nullable |
| `perf_tier1_denominator` | `TEXT` | **Required whenever the ratio exists** — R-12.2.2. `CHECK(perf_tier1_ratio IS NULL OR perf_tier1_denominator IN ('REACH','FOLLOWERS'))`. A ratio without a denominator is a constraint violation, not a lint. |
| `perf_bucket_key` | `TEXT` | `(platform, content kind)` bucket identity — D4 |
| `perf_baseline_median` | `REAL` | nullable |
| `perf_baseline_sample_size` | `INTEGER` | Tier 2's `basedOnVideos`; never null when a Tier 2 figure exists |
| `perf_multiplier` | `REAL` | nullable |
| `perf_post_age_hours` | `INTEGER` | at analysis time |
| `audience_source_fetched_at` | `TEXT` | **§1.3** — copy of `profiles.last_fetched_at` at write time, so staleness stays inspectable after the cache refreshes (R-13.3.2) |

`performanceScore`, `tierUsed`, `confidence`, `provisional`, `verdict`, `drivers[]` and
`unavailableReason` are **model output** and live inside `result_content` JSON alongside the rest of
the contract, exactly as `overallScore` and `scorecard` do today. They are **not** columns.

**Open sub-question flagged, not decided:** the computed block is denormalised into columns so the
table can sort and filter (R-8.4.1) without parsing every row's JSON. But `performanceScore`, which
R-8.4.1 says must be **sortable**, is model output and therefore in JSON. Options: (a) promote
`performance_score` / `performance_tier` / `performance_confidence` to columns too, (b) sort
client-side over the full list (`getAnalysesList()` currently has no pagination and returns
everything), (c) `json_extract` in `ORDER BY`. **I lean (a)** — three columns is cheaper than either
alternative and matches how `schema_version` was handled. Deferred to the final TDD because it
interacts with whether 3C paginates, which depends on Jessica's density decision.

`unavailableReason` enum, from D3 plus R-13.5.3a (**note the last value — two different facts must not
share one enum**):

```
REACH_HIDDEN | REACH_UNKNOWN | CONTENT_KIND_UNSUPPORTED | NO_AUDIENCE_DATA
| INSUFFICIENT_HISTORY | CAUSE_NOT_DETERMINABLE
```

`CAUSE_NOT_DETERMINABLE` is the all-image-carousel case where `like_and_view_counts_disabled` is
**absent** and we therefore cannot assert the creator hid anything (R-13.5.3, verified-facts
2026-08-05 correction).

### 4.3 Availability states

`resolveAvailability(field, raw)` → `AVAILABLE | HIDDEN | UNKNOWN | ZERO`, per PRD §4.4. Two rules that
are easy to get wrong and are therefore pinned by tests rather than by review:

- `like_and_view_counts_disabled` is read `=== true` **strictly**; absent is **not** `false`.
  `lib/server/analysis/fetcher/adapter.ts` already does this correctly — the new code must not regress
  it (AC-19).
- A bare `0` on YouTube's `likeCountInt` is `UNKNOWN` until **V2** is captured (R2) — the same
  false-zero suspicion Instagram's `video_view_count` earns.

### 4.4 Division of labour (D2) — and one place I think §5.2 undoes D2

**Code produces** (deterministic, frozen, stored): reach + kind, likes/comments + states, audience size
+ its capture time, post age, Tier 1 ratio + denominator, Tier 2 median/sample/bucket/multiplier,
Tier 3 reach-per-follower, content kind + bucket.

**Gemini produces** (judgement): `performanceScore` 1–5 nullable, `tierUsed`, `confidence` +
`basedOnVideos`, `provisional`, `verdict`, `drivers[]`, `unavailableReason`.

**Disagreement, raised rather than silently implemented:** PRD §5.2 places `tierUsed`, `confidence`,
`provisional`, `basedOnVideos` and `unavailableReason` in the **Gemini block**. **All five are
mechanically determined by the computed block.** Which tier was used follows from which inputs exist;
`provisional` is `post_age_hours < MATURITY_FLOOR_HOURS`; `basedOnVideos` is a `COUNT`; confidence is a
fixed ladder with three enumerated demotion reasons (R-13.4.2); `unavailableReason` is decided by the
availability resolver. Letting the model restate them re-introduces exactly the non-determinism D2
exists to eliminate, and S3's byte-diff would then be testing the model's obedience rather than our
arithmetic.

**Recommendation:** compute all five in code, store them in the computed block, and pass them to Gemini
as **inputs it must not contradict**. Gemini's response schema then carries only `performanceScore`,
`verdict` and `drivers[]` — the three things that genuinely need judgement. No acceptance criterion
changes observable outcome; what changes is who is authoritative when the two disagree. **This edits
§5.2, so it needs a PM/owner nod** — recorded as D-2 in §12.

### 4.5 Prompt changes

A new block in `buildUserPrompt()`, plus removal of the existing unqualified `Engagement rate` line
(§1.1). The new block must:

- label every figure with its **denominator in words** (R-12.5.1) and its reach kind in words (R-4.3.1);
- state explicitly which inputs are **unavailable**, and instruct the model not to estimate them (§4.4);
- for image-only content, state that **no reach data exists**, and contain no reach/views/plays token
  anywhere near that post's engagement figure (AC-22);
- forbid comparison against the model's own priors or against any other post's differently-denominated
  ratio (R-12.5.3);
- forbid computing or restating any number it was not given (S2).

`tests/server/analysis/prompts/user.engagementLabel.test.ts` is **extended**, not duplicated — the PRD
names it three times as the enforcement mechanism (S5, R-12.5.2, AC-22).

**Token budget: unverified for this shape.** V3 (approved, not captured) must measure a real
multi-slide carousel with the extended prompt against `maxOutputTokens: 32768`. The 83% headroom figure
in verified-facts is from a **single-video reel** and is not a bound for this case. **No code ships
against an assumed headroom.** If V3 shows insufficient headroom, the mitigation is to shorten
`drivers[]`, not to raise the budget past the model's real limit.

---

## 5. API surface (3B)

No new endpoints. `GET /api/analyses` and `GET /api/analyses/[id]` grow fields.

`lib/server/db.ts`'s `getAnalysesList()` / `getAnalysisDetail()` currently select **20** and **19**
columns respectively out of 39 (verified by reading them). They gain the `perf_*` columns and
`audience_source_fetched_at`. `app/api/analyses/route.ts` already parses `result_content` and lifts
`overallScore` / `scorecard`; it lifts the performance judgement the same way.

Response shape (purely additive; **no** existing field changes):

```
performance: {
  computed: {
    reach:    { value, kind, derivedFrom, state },
    likes:    { value, state },
    comments: { value, state },
    audience: { value, capturedAt, sourceFetchedAt },
    postAgeHours,
    tier1: { ratio, denominator },          // discriminated union — see below
    tier2: { median, sampleSize, bucketKey, multiplier },
    tier3: { reachPerFollower }
  },
  judgement: {
    performanceScore, tierUsed, confidence, basedOnVideos,
    provisional, verdict, drivers[], unavailableReason
  }
} | null
```

`performance` is `null` only for rows written before schema 3 — which, post-012, is none.

Per AGENTS.md the route returns this **verbatim**; every derived value (formatted percentages, the
denominator label, the plain-language reason, the "3 of 5" progress string) is computed in
`lib/api/analyses/hooks.ts`'s `select`, **never** in a component.

**R-12.3.5 is a type-level requirement and should be implemented as one:** model the ratio as a
discriminated union —

```ts
type Tier1Ratio =
  | { denominator: "REACH"; ratio: number; reachKind: ReachKind }
  | { denominator: "FOLLOWERS"; ratio: number };
```

— rather than an object with an optional `denominator` string. Dropping the discriminator then fails
`tsc`. That is what the PRD means by "dropping it is a type error rather than a silent presentation
bug", and it is worth the extra ten lines. Precedent exists: PR #122 shipped a comparable type-level
guard on the fingerprint client so a regression is a compile error rather than a lint nit.

---

## 6. Tier 2 (baseline) data flow

One extra DB read per analysis (PRD §9.1). Query shape:

```sql
SELECT perf_tier1_ratio, perf_reach_value, like_count, comment_count
FROM analyses
WHERE profile_id = ? AND perf_bucket_key = ? AND status = 'completed'
  AND schema_version = ? AND id != ?
  AND perf_post_age_hours >= ?    -- age-bounded baseline, D5 part 3
```

Needs a composite index — **`idx_analyses_profile_bucket` on `(profile_id, perf_bucket_key, status)`**
— added in 012. The median is computed in JS over the returned set; these sets are tiny and a SQL
median in SQLite is not worth the complexity.

**R-4.3.2 / R-12.3.2 enforcement lives here.** The baseline set is single-denominator by construction,
because `perf_bucket_key` encodes content kind and content kind determines the denominator. **Assert it
anyway** — a mixed set must **throw**, not average.

**Explicitly out of scope per §9.3:** whether the baseline is computed per-analysis or once at the end
of a bulk batch. That is a 3A-era question. **No 3B ticket touches it.**

---

## 7. 3A — job queue `[PARTIALLY HOST-DEPENDENT]`

### 7.1 Settled regardless of hosting

- **`runAnalysis()` survives unchanged.** 3A changes its caller. The roadmap says this and the code
  agrees — `runAnalysis` already accepts an `onProgress` callback that nothing currently passes.
- **`app/api/analyze/route.ts` stops running the pipeline.** It enqueues N jobs and returns job IDs
  immediately; `maxDuration = 300` becomes irrelevant on that route.
- **`lib/server/analysis/pipeline/progress.ts` gets wired up** (currently dead from the client's
  perspective) rather than deleted — the queue is what makes it meaningful.
- **Idempotency is a requirement, not a nicety.** Today a user retry re-spends credits. A dedupe key of
  `(normalised_url, prompt_hash)` over non-terminal jobs is the minimum.
- **A reaper for stale `pending`/`claimed` rows** — today rows stay `pending` forever with no reaper.

### 7.2 Job table (migration 012 or 013 — see §11)

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK(kind IN ('analysis')),
  status       TEXT NOT NULL CHECK(status IN ('queued','claimed','running','succeeded','failed','dead')),
  payload      TEXT NOT NULL,               -- JSON
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

SQLite supports partial indexes, so the dedupe index above is valid and expresses "one live job per
URL+prompt" declaratively rather than in application code.

### 7.3 Claiming a job — the constraint from §1.5

**No `db.transaction()`.** A claim is exactly one statement:

```sql
UPDATE jobs
SET status='claimed', claimed_at=datetime('now'), claimed_by=?,
    attempts=attempts+1, updated_at=datetime('now')
WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
RETURNING *;
```

Zero returned rows means "nothing to claim" — the same NOT_FOUND-vs-no-op discrimination PR #120
established. This is not stylistic: `Sqlite3Transaction.close()` leaks the connection and there is no
userland fix (RUNBOOK §8; handoff 2026-08-05). **Do not re-derive this, and do not "improve" it back
into a transaction.**

### 7.4 `[HOST-DEPENDENT]` — unwritten until O-1 is answered

- Worker entrypoint and process model (in-process interval vs separate `scripts/worker.ts` vs separate
  machine).
- Concurrency (1 worker vs N) and whether `claimed_by` needs to be meaningful.
- Heartbeat and reaper timings — these depend on whether the platform can kill a worker mid-job.
- Client progress transport: polling vs SSE. **SSE is fine on a long-lived Node process and awkward on
  serverless**, so this genuinely depends on O-1.
- Turso cutover, Dockerfile, deploy pipeline, secret management.
- Whether the spend cap (roadmap Decision 2) can be enforced at enqueue time. It needs
  `credits_charged` tracking, which does not exist (handoff carried-forward item 5). **Bulk ingestion
  is blocked on that, not on the queue.** Not a 3A ticket, but 3A is where it stops being deferrable.

---

## 8. 3C — analyses table `[PLACEHOLDER — awaiting Jessica's approved design spec]`

**Deliberately not designed here.** Jessica is working from PRD §8, §12.3 and §13 in parallel. This
section gets filled in on re-dispatch with her approved spec.

What I can commit to now, because it is architecture rather than design:

- **Data contract:** §5's response shape is what the table consumes. It is stable regardless of layout.
- **Layering (AGENTS.md, non-negotiable):** `lib/api/analyses/api.ts` returns the payload as-is; **all**
  derivation happens in `hooks.ts`'s `select`; components do presentation formatting only and parse
  nothing.
- **Module placement:** `AnalysisDataTable` is the live table. `AnalysisGrid` / `AnalysisCard` are
  **dead, unreachable code the owner has already decided to delete** (RUNBOOK §8.5; handoff item 3) —
  3C should delete them, and must **not** delete `AnalysisGridSkeleton`, which is a different, live
  module. New cells live under `components/.../cells/` as flat files or module directories per
  AGENTS.md.
- **Contrast (R-8.4.6):** every new badge measured in **gamma-encoded sRGB** against `--background`,
  `--card` and the row-hover surface, ≥4.5:1 on all three, with the three numbers in the PR body. This
  error class has shipped non-compliant twice (RUNBOOK §8.4). Issue #132 tracks the missing automated
  guard; 3C is the natural place to finally add it.
- **Sorting (R-8.4.1 + R-12.3.2):** an engagement sort must not interleave denominators. The clean
  implementation is a comparator over the §5 discriminated union that refuses a mixed set, **not** a
  sort on a bare number. Unscored rows group at the end and are never treated as `0` (AC-14).

**Blocked on Jessica:** column widths and order, the mechanism distinguishing the two denominators
(R-12.3.4 makes the mechanism hers and the outcome non-negotiable), all §13 explainability surfaces and
disclosure patterns, and every user-facing string.

---

## 9. Testing strategy

The suite is **29 files / 319 tests** across two vitest projects (RUNBOOK §7).

> **Load-bearing naming convention:** a jsdom test **must** be named `*.dom.test.ts(x)`. A plain
> `*.test.tsx` matches **neither** project and **silently does not run at all**. Every 3C component
> test is a `.dom.test.tsx`. This has already bitten this repo once.

| Layer | Project | What |
|---|---|---|
| `resolveReach` | node | AC-4 (false zero → 116,333 `PLAYS`), AC-5 (carousel reversal → `VIEWS`), AC-6/AC-18 (all-image → no reach, no kind). **All three against committed fixtures — zero credits.** |
| `resolveAvailability` | node | AC-19 (absent flag never read as `false`); YouTube bare `0` → `UNKNOWN` pending V2 |
| `ratios` / `baseline` | node | AC-1, AC-2 (threshold + priors unchanged), AC-23, AC-24 (no cross-bucket substitution), R-4.3.2 mixed-kind throws |
| prompt | node | AC-8, AC-22 — **extend** `user.engagementLabel.test.ts` |
| parser / validation | node | Contract v3; a missing performance field fails loudly; an *absent input* is **not** a parse failure (§5.4 — these two must not be conflated) |
| migration | node | `migrations.schema.test.ts` — updated `EXPECTED_ANALYSES_COLUMNS`, new index, positional `INSERT...SELECT` alignment, AC-12 (zero rows at the old version) |
| S2 numeral extractor | node | AC-7 + AC-27 — handles both `,` and `.` decimal separators (§4.1) |
| jobs | node | claim is single-statement; concurrent claim yields one winner; dedupe rejects a duplicate enqueue; reaper requeues a stale claim |
| 3C cells | **jsdom** | AC-13, AC-14, AC-15, AC-16, AC-20, AC-21, AC-25 → AC-30 — all assert **rendered text content**; none is a screenshot |
| copy lint | node | AC-29's negative assertion: string-search the UI copy source for any claim that the maturity floor is measured or validated |

**Not testable offline, and therefore gated on the approved spends:** the counts-disabled Instagram
fixture (V1), the likes-hidden YouTube fixture (V2), carousel token headroom (V3). **S3 (determinism,
two runs at `temperature: 0`) requires a second billed Gemini call and is NOT in the approved V1–V3
list** — see §12, D-3.

---

## 10. Risks

PRD §9.2's R1–R7 are inherited unchanged. Additional engineering risks:

- **E1 — Building against an unverified payload shape.** V1/V2 are approved but **not captured**.
  "Approved is not verified." No branch may key off an assumed counts-disabled shape.
- **E2 — Carousel token headroom is unmeasured** and the extended prompt makes it worse. V3 must land
  before the prompt block is final.
- **E3 — The transaction leak** (§1.5). The highest-probability way 3A ships a production defect.
- **E4 — The fingerprint cold-starts** on the schema bump (§1.2). Not a bug; a consequence that will
  look like one if unannounced.
- **E5 — `getAnalysesList()` has no pagination** and returns every row with `result_content` inline.
  Fine at 3 rows; 3C plus bulk ingestion makes it a real payload. Out of scope here, but 3C is where it
  will first hurt.
- **E6 — S2/AC-7's numeral extractor is the kind of test that passes vacuously** if separator handling
  is wrong. Prove it non-vacuous by asserting it *fails* on a deliberately fabricated numeral, the way
  #123's demonstration test was proven.

---

## 11. Sequencing (outline only — NO tickets created)

Dependency order; FE/BE noted. **Nothing here is a ticket yet.**

```
O-1 (hosting) ────────────────► 3A-0 [BE] deploy / Turso cutover   [HOST-DEPENDENT]
                                     └► 3A-1 [BE] jobs table + claim primitive
                                          └► 3A-2 [BE] worker loop + reaper + idempotency
                                               └► 3A-3 [BE] enqueue route + progress transport
                                                    └► 3A-4 [FE] progress panel wiring

3B-1 [BE] migration 012 + schema-test update + engagement_rate removal   (blocks all of 3B)
  └► 3B-2 [BE] performance module: reach + availability + ratios   (fixture-driven, no spend)
       └► 3B-3 [BE] Tier 2 baseline + composite index
            └► 3B-4 [BE] contract v3: prompt block, responseSchema, parser, validation
                 └► 3B-5 [BE] pipeline wiring + persistence
                      └► 3B-6 [BE] read path + API response shape

V1 / V2 capture ──► feed 3B-2's hidden-count branch
V3 capture      ──► gates 3B-4

3C — blocked on 3B-6 AND on Jessica's approved spec. Not broken down yet.
```

**3A and 3B are genuinely independent and can run in parallel** (roadmap §3; PRD §9.3) — different
files, different tests. **3C is strictly last.**

**Migration numbering conflict to resolve before dispatch:** 3A and 3B both want **012**. Whichever
starts first takes 012; the other takes 013. The runner applies in filename sort order and the two are
independent, so either order is safe — but two agents in parallel worktrees will both create `012_` if
not told. **Assign the numbers at dispatch time, not at implementation time.**

---

## 12. Decisions needed before this becomes a final TDD

- **O-1 (owner, blocking 3A):** local/self-hosted vs cloud-hosted — §2.3. **Nothing in 3A below the
  queue primitives can be specified until this is answered.**
- **O-2 (owner, conditional on O-1(b)):** are we committed to Vercel for anything? If not, Option C is
  dominated by Option B.
- **D-1 (owner, informational but should be acknowledged):** the schema bump cold-starts every style
  fingerprint (§1.2). The rows lost number 3; the capability lost is the fingerprint engine until the
  corpus is rebuilt.
- **D-2 (PM/owner):** move `tierUsed`, `confidence`, `basedOnVideos`, `provisional` and
  `unavailableReason` from the Gemini block to the computed block (§4.4). I believe §5.2 as written
  partially undoes D2. No AC changes; authority changes.
- **D-3 (owner, spend):** S3/AC-10 (determinism across two runs at `temperature: 0`) requires a
  **second billed Gemini call** and is **not** covered by the approved V1–V3. It is also the item
  formally left open from ticket #66. Either approve a **V4**, or accept S3 as discharged by offline
  reasoning and say so explicitly. **I have made no call and spent nothing.**
- **D-4 (PM, correction):** PRD §8.2's claim that `engagement_rate` is "written and never read" and
  that its denominator is "documented nowhere" is factually wrong (§1.1). Worth correcting so the next
  reader is not misled — and worth noting that removing it fixes a live mislabelling defect.
- **Blocked on Jessica, not a decision:** all of §8.
