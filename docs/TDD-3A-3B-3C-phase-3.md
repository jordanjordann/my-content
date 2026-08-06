# TDD — Phase 3: 3B performance scoring, 3C analyses table, 3A job queue, deployment

**Status:** **FINAL for 3B and 3C — tickets cut from this document.**
3A and deployment are specified here as **sections, not tickets** (§10, §11) by owner instruction: they are
two steps out in the sequence and a stale backlog is worse than none.
**Author:** John (tech lead)
**Created:** 2026-08-06 · **Supersedes:** the skeleton on branch `tdd-phase-3-skeleton` (PR #135). **Close #135 unmerged; this is its successor at the same path.**

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

### 0.1 Design

| # | Ruling |
|---|---|
| **OR-1** | **Jessica's design is APPROVED in full**, including the reduction from 12 default columns to **9**. Her width analysis (~1,620–1,730px of content against a ~1,360px budget) is accepted as the reason. **PRD D9's 12-column set is superseded** (§14.5). |
| **OR-2** | **Columns #7 (performance score) and #8 (baseline multiplier) are the visual centre and are untouched.** PRD R5 ("cut from the bottom, not from #7/#8") was honoured and remains binding on any future cut. |

### 0.2 The table (3C)

| # | Ruling |
|---|---|
| **OR-3** | **Engagement split — Direction A: two dedicated columns, never one.** This is the explicit **R-12.3.4 sign-off** the PRD reserved under caveat C2. Recorded as such. The mechanism was the designer's to choose and it is now chosen; the outcome (two denominators must never look comparable) was never negotiable. |
| **OR-4** | **The Status column is cut.** Failures get the whole-row treatment: rose left-edge marker + the failure reason inline in the title cell (design §3.3). The status *filter* survives. |
| **OR-5** | **Style columns (`formatArchetype`, `hookType`) are off by default**, available as an optional column from the `Columns` menu. |
| **OR-6** | **The 1–5 performance score STAYS in the table.** Owner's reasoning: the tooltip carries the explanation and that is sufficient. Jessica's "score says 2 but multiplier says 3.2×" concern is therefore resolved **in the tooltip, not by removing the column** — her deterministic *"these disagree because…"* line (design-3B §7.4) is **required, not optional**. See §9.4. |
| **OR-7** | **Default density is Comfortable (68px).** |
| **OR-8** | **Pagination, not infinite scroll** (50 rows/page). **Default sort stays newest-analysis-first (`Posted`, descending).** Performance is *not* the default sort. This resolves Jessica's "sink group nobody ever sees" concern **by construction**: the sink group only exists under a user-selected sort, and pagination gives it a reachable page. If a residual hidden-rows concern remains for user-selected performance sorts, it is settled with Jessica directly and is **not** escalated. |

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
| **OR-16** | **D-3 / V4 APPROVED.** The second billed Gemini call for temperature-0 determinism is authorised and is being dispatched separately. **S3 / AC-10 is treated as discharged live; no ticket in this document runs it.** |

### 0.5 Sequencing

| # | Ruling |
|---|---|
| **OR-17** | **`3B → 3C → deploy + Turso cutover → 3A queue`.** Deployment is explicitly **not** first. 3B and 3C build fine against the local SQLite file; PRD §9.3 confirms 3B/3A independence. The owner accepts that **nothing is usable by staff until deployment lands** and has chosen to build the value first. |
| **OR-18** | **Tickets are filed for 3B and 3C only.** Deploy and 3A are covered as §10/§11 here and ticketed when 3C lands. |

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

**Three distinct values reach the client today: `true` / `false` / `null`.** The second discriminator the
three-case logic needs — "is this an all-image carousel" — is also available at render time from
`analyses.analysis_mode` (`'images_only'`, migration 009 line 107) and, after 012, from
`perf_reach_derived_from = 'NONE'`. **Nothing needs to be stored. §9.5 specifies the derivation.**

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
│                       # UnavailableReason, Tier1Ratio (discriminated union), ComputedPerformanceBlock
├── constants.ts        # MATURITY_FLOOR_HOURS, BASELINE_MIN_SAMPLE, ROUNDING_TOLERANCE, bucket nouns
├── reach.ts            # resolveReach()      — the carousel/top-level branch (§5.1)
├── availability.ts     # resolveAvailability() — the four states (§5.4)
├── ratios.ts           # Tier 1 / Tier 3 arithmetic, denominator-tagged. Home of the relocated
│                       # computeEngagementRate() (§1.1)
├── baseline.ts         # Tier 2: bucket key, median, sample size, multiplier, bucket noun
├── judgement.ts        # NEW per OR-13: tierUsed, confidence, basedOnVideos, provisional,
│                       # unavailableReason — all computed in code
└── computeBlock.ts     # orchestrates the above into ComputedPerformanceBlock

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
`unavailableReason` is decided by the availability resolver. Letting the model restate them reintroduced
exactly the non-determinism D2 exists to eliminate, and S3's byte-diff would have been testing the model's
obedience rather than our arithmetic.

They are passed to Gemini as **inputs it must not contradict**. `responseSchema` is narrowed to three fields
in ticket **3B-4**.

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
3A's job table takes **`013`** (§10.2). This resolves the collision flagged in the skeleton: two agents in
parallel worktrees would otherwise both create `012_`.

### 5.1 Form

Repo convention is **additive only, no down-migrations** (RUNBOOK §4). D10 requires a **drop**, so 012 is a
**full table rebuild** in the style of `009_analysis_mode_images_only.sql`. Modern SQLite does support
`ALTER TABLE ... DROP COLUMN`, but 009 set the house pattern and `tests/server/db/migrations.schema.test.ts`
asserts positional alignment of the `INSERT...SELECT` column lists — a rebuild keeps that assertion
meaningful. All rows are deleted anyway (schema bump), so the `INSERT...SELECT` copies nothing.

### 5.2 `analyses` — drop 1, add 14 (39 → 52 columns)

`EXPECTED_ANALYSES_COLUMNS` must be updated in the same PR.

| Column | Type | Notes |
|---|---|---|
| ~~`engagement_rate`~~ | — | **DROPPED** (D10). See §1.1 for the five files that go with it. |
| `perf_reach_value` | `INTEGER` | nullable — absent for image-only content **by design**, not failure |
| `perf_reach_kind` | `TEXT` | `CHECK(perf_reach_kind IS NULL OR perf_reach_kind IN ('PLAYS','VIEWS','UNKNOWN'))` |
| `perf_reach_derived_from` | `TEXT` | `TOP_LEVEL` / `CAROUSEL_FIRST_SLIDE` / `NONE` |
| `perf_tier1_ratio` | `REAL` | nullable |
| `perf_tier1_denominator` | `TEXT` | **Required whenever the ratio exists** (R-12.2.2). `CHECK(perf_tier1_ratio IS NULL OR perf_tier1_denominator IN ('REACH','FOLLOWERS'))`. A ratio without a denominator is a **constraint violation**, not a lint. |
| `perf_bucket_key` | `TEXT` | `(platform, content kind)` bucket identity — D4 |
| `perf_baseline_median` | `REAL` | nullable |
| `perf_baseline_sample_size` | `INTEGER` | `basedOnVideos`; **never null when a Tier 2 figure exists** |
| `perf_multiplier` | `REAL` | nullable |
| `perf_post_age_hours` | `INTEGER` | at analysis time |
| `audience_source_fetched_at` | `TEXT` | **§1.3** — copy of `profiles.last_fetched_at` at write time, so staleness stays inspectable after the cache refreshes (R-13.3.2, R-13.4.5) |
| `perf_tier_used` | `TEXT` | **OR-13** — `CREATOR_BASELINE` / `REACH_ONLY` / `AUDIENCE_FALLBACK` / `UNAVAILABLE` |
| `perf_confidence` | `TEXT` | **OR-13** — `HIGH` / `MEDIUM` / `LOW` / `NONE` |
| `perf_confidence_reason` | `TEXT` | nullable — `CACHED_FOLLOWER_DENOMINATOR` / `CAROUSEL_FIRST_SLIDE` / `THIN_SAMPLE` (§4) |
| `perf_provisional` | `INTEGER` | nullable boolean, `toDbBool` convention |
| `perf_unavailable_reason` | `TEXT` | **OR-13** — enum below |
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
| NO_AUDIENCE_DATA | INSUFFICIENT_HISTORY | CAUSE_NOT_DETERMINABLE
```

`CAUSE_NOT_DETERMINABLE` satisfies R-13.5.3a. **Two different facts must not share one enum value.** Jessica
proposed the name `PERFORMANCE_DATA_ABSENT`; naming is the tech lead's call and `CAUSE_NOT_DETERMINABLE` is
chosen because it names the epistemic state rather than the data state — which is precisely the distinction
the value exists to hold.

### 5.4 Availability states

`resolveAvailability(field, raw)` → `AVAILABLE | HIDDEN | UNKNOWN | ZERO` (PRD §4.4). Two rules pinned by
tests rather than by review:

- `like_and_view_counts_disabled` is read `=== true` **strictly**; absent is **not** `false`.
  `fetcher/adapter.ts:236` already does this correctly — the new code must not regress it (AC-19).
- A bare `0` on YouTube's `likeCountInt` is `UNKNOWN` until **V2** is captured (R2) — the same false-zero
  suspicion Instagram's `video_view_count` earns.

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

### 8.4 Token budget

**Unverified for this shape.** V3 (approved, not yet captured) must measure a real multi-slide carousel with
the extended prompt against `maxOutputTokens: 32768`. The 83% headroom figure in verified-facts is from a
**single-video reel** and is not a bound for this case. **No code ships against an assumed headroom.** If V3
shows insufficient headroom the mitigation is to shorten `drivers[]`, not to raise the budget past the
model's real limit.

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

### 10.2 Job table — **migration `013_jobs.sql`** (number fixed here, §5)

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

### 11.2 Host recommendation — **Fly.io**

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

### 11.3 What the deploy work contains

`Dockerfile` (Node + `yt-dlp` + ffmpeg), `fly.toml` with two processes, Turso database + auth token, a
release command running `db:migrate`, secret management for `GEMINI_API_KEY` / `SCRAPECREATORS_API_KEY`, a
deploy step in `.github/workflows/ci.yml`, and a `.env.example` audit (RUNBOOK §3). Since OR-17 puts this
**after** 3C, migrations 012 and 013 will both apply on the first Turso run — which is fine and is why all
SQL in this document is kept libSQL-portable.

---

## 12. Testing strategy

The suite is **29 files / 319 tests** across two vitest projects (RUNBOOK §7).

> **Load-bearing naming convention:** a jsdom test **must** be named `*.dom.test.ts(x)`. A plain `*.test.tsx`
> matches **neither** project and **silently does not run at all**. Every 3C component test is a
> `.dom.test.tsx`. This has already bitten this repo once.

| Layer | Project | What |
|---|---|---|
| `resolveReach` | node | AC-4 (false zero → 116,333 `PLAYS`), AC-5 (carousel reversal → `VIEWS`), AC-6/AC-18 (all-image → no reach, no kind). **All against committed fixtures — zero credits.** |
| `resolveAvailability` | node | AC-19 (absent flag never read as `false`); YouTube bare `0` → `UNKNOWN` pending V2 |
| `ratios` / `baseline` | node | AC-1, AC-2, AC-23, AC-24 (no cross-bucket substitution), R-4.3.2 mixed-kind **throws**, `bucketNoun()` per bucket (OR-9) |
| `judgement` | node | **OR-13** — the confidence ladder and all three demotion reasons; `provisional` boundary at `MATURITY_FLOOR_HOURS`; every `unavailableReason` branch |
| prompt | node | AC-8, AC-22 — **extend** `user.engagementLabel.test.ts`, do not duplicate it |
| **prose guard** | node | **§8** — a bare `4,1%` throws; a bare `4.1%` throws; a qualified `4,1% dari 482,1RB penayangan` passes; a fabricated numeral not in the block throws (proves the extractor non-vacuous) |
| parser / validation | node | Contract v3; a missing performance field fails loudly; an *absent input* is **not** a parse failure (§5.4 — must not be conflated) |
| migration | node | `migrations.schema.test.ts` — updated `EXPECTED_ANALYSES_COLUMNS` (39→52) and `EXPECTED_ANALYSES_INDEXES` (6→8), positional `INSERT...SELECT` alignment, AC-12 |
| S2 numeral extractor | node | AC-7 + AC-27 — handles both `,` and `.` decimal separators, and honours the **OR-10 allow-list** |
| 3C cells | **jsdom** | AC-13, AC-14, AC-15, AC-16, AC-20, AC-21, AC-25 → AC-30 — all assert **rendered text content**; none is a screenshot |
| absent-count derivation | node | **OR-11** — all three cases, plus a negative assertion that case 3 never says "Creator turned off counts" |
| copy lint | node | AC-29's negative assertion: string-search the UI copy source for any claim the maturity floor is measured or validated |

**Gated on approved spends:** the counts-disabled Instagram fixture (V1), the likes-hidden YouTube fixture
(V2), carousel token headroom (V3). **S3/AC-10 is discharged live by V4 (OR-16) and is not a ticket here.**

---

## 13. Risks

PRD §9.2's R1–R7 are inherited unchanged. Engineering risks:

- **E1 — Building against an unverified payload shape.** V1/V2 are approved but **not captured**. *Approved is
  not verified.* No branch may key off an assumed counts-disabled shape.
- **E2 — Carousel token headroom is unmeasured** and the extended prompt makes it worse. V3 gates 3B-4.
- **E3 — The transaction leak** (§1.5). The highest-probability way 3A ships a production defect.
- **E4 — The fingerprint cold-starts** on the schema bump (§1.2). Not a bug; a consequence that will look like
  one if unannounced.
- **E5 — `getAnalysesList()` has no pagination today** and returns every row with `result_content` inline.
  OR-8 makes server-side pagination a 3C requirement rather than a deferred concern.
- **E6 — The S2/AC-7 numeral extractor is the kind of test that passes vacuously** if separator handling is
  wrong. Prove it non-vacuous by asserting it *fails* on a deliberately fabricated numeral, the way #123's
  demonstration test was proven.
- **E7 — The prose guard is a runtime failure on a paid call.** If §8.1's pre-formatted strings drift, we
  burn a Gemini call and fail the analysis. Accepted deliberately (§8.2): a loud failure is better than a
  quietly unqualified percentage in a client deck.

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

---

## 15. Sequencing and ticket map

```
3B-1 [BE] migration 012 + engagement_rate removal + schema-test update   (blocks all of 3B)
  └► 3B-2 [BE] performance module: reach + availability + ratios     (fixture-driven, no spend)
       └► 3B-3 [BE] Tier 2 baseline + bucket noun + composite index
            └► 3B-4 [BE] contract v3: prompt block, prose guard, responseSchema, parser   [gated on V3]
                 └► 3B-5 [BE] judgement module + pipeline wiring + persistence
                      └► 3B-6 [BE] read path + API response shape + server-side pagination

3C-1 [FE] table shell: 9 columns, group header, density, pagination, sort/sink, states   [needs 3B-6]
  ├► 3C-2 [FE] engagement Direction A cells + absent-count derivation
  ├► 3C-3 [FE] score cells + explain popover (incl. the OR-6 disagreement line)
  └► 3C-4 [FE] filters, column menu, dead-code deletion, contrast record
```

**Migration numbers, fixed here and repeated in the tickets:** **3B = `012_performance_block.sql`**,
**3A = `013_jobs.sql`**. No agent picks a number at implementation time.

**FE/BE dependency:** 3C is **blocked on 3B-6**. The two phases are **not** parallelisable — 3C consumes a
response shape 3B-6 creates. Within each phase the chain above is sequential except 3C-2/3C-3/3C-4, which are
parallel once 3C-1 lands.

**Not ticketed yet (OR-18):** deploy + Turso cutover (§11), 3A queue (§10). Cut when 3C lands.
