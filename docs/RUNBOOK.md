# RUNBOOK

Operational reference card. Migration section (§4), test counts and layout (§7), and the new
troubleshooting section (§8) re-verified against `main` at `3e58c32` (2026-08-03, post-PR #113) by
running the suite and reading the migration/test sources directly. §5's ScrapeCreators credit
balance was **explicitly NOT re-measured** — checking it costs real credits — and is flagged inline
as stale. The rest of this document is unchanged from the `f181f53` (2026-07-22, session 2)
verification and may be stale outside the areas §4/§7/§8 touch.

---

## 1. Running the app

| Task | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | `next dev`, http://localhost:3000 |
| Production build | `npm run build` | |
| Serve build | `npm start` | |
| Lint | `npm run lint` | flat config, `eslint.config.mjs` |
| Tests | `npm run test` | `vitest run`, node env. `npm run test:watch` for watch mode. **Offline — never calls a live API** (see §7) |
| Typecheck | `npm run typecheck` | `tsc --noEmit`; `tsconfig.json` already sets `noEmit` (ticket #83) |
| Migrate DB | `npm run db:migrate` | `tsx scripts/migrate.ts` |

CI (`.github/workflows/ci.yml`, ticket #83) runs `npm run test`, `npm run typecheck`,
`npm run lint`, and `npm run build` in that order on every PR and every push to `main`. Node
version comes from `.nvmrc` (`24.14.1`), installs use `npm ci`, and no live-API secrets
(`GEMINI_API_KEY`, `SCRAPECREATORS_API_KEY`) are ever set in the workflow — see §7.

Next.js **16.2.10**, React **19.2.4**. This is not the Next.js in your training data — read
`node_modules/next/dist/docs/` before writing app code (see `AGENTS.md`).

---

## 2. Auth for local testing

The whole app is gated by a **4-digit PIN**. There is no `middleware.ts`; each API route calls
`isAuthenticated()` itself (`app/api/analyze/route.ts`, `app/api/analyses/route.ts`,
`app/api/analyses/[id]/route.ts`).

**Model** (`lib/server/auth/`):
- PIN stored bcrypt-hashed (cost 12) in `settings` under key `pin_hash`; `pin_set_at` alongside.
- Session = HMAC-SHA256 signed `{iat, exp}` token in cookie `my_content_session`, TTL **30 days**.
- Signing secret: `APP_SESSION_SECRET`. Unset in dev → falls back to a hardcoded dev secret.
  **Throws in production if unset.**

**Minting a session from scratch:**

```bash
# 1. Start the dev server with the reset flag set
RESET_PIN=true npm run dev

# 2. Any call to hasPinConfigured() (e.g. GET /api/auth/status) deletes pin_hash/pin_set_at,
#    so POST /api/auth/setup is now allowed to set a fresh PIN and returns the session cookie.
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/setup \
  -H 'Content-Type: application/json' -d '{"pin":"1234"}'

# 3. Use the cookie
curl -b cookies.txt http://localhost:3000/api/auth/status
```

Gotcha: `RESET_PIN=true` is checked on **every** `hasPinConfigured()` call, not once at boot. Leave
it set and the PIN is wiped continuously. Unset it after minting the session and restart.

`POST /api/auth/verify` is the normal path for an already-configured PIN.

### Rate limiting (added in PR #52)

`/api/auth/verify` runs two limiters before verifying: a **global** one first, then a **per-client**
one. Both live in `lib/server/auth/rateLimiter.ts`, are in-memory (reset on restart), and escalate
lockouts exponentially. Tripping the global limiter locks out the real owner too — by design, it is
the backstop when client identity can't be trusted.

All windows/durations are overridable by env var (positive finite numbers; an invalid value throws
at import). Defaults from `lib/server/auth/constants.ts`:

| Env var | Default |
|---|---|
| `PIN_RATE_LIMIT_MAX_ATTEMPTS` | 5 |
| `PIN_RATE_LIMIT_WINDOW_MS` | 300000 (5 min) |
| `PIN_RATE_LIMIT_LOCKOUT_MS` | 300000 (5 min) |
| `PIN_RATE_LIMIT_MAX_LOCKOUT_MS` | 1800000 (30 min) |
| `PIN_RATE_LIMIT_MAX_TRACKED_KEYS` | 1000 |
| `PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS` | 100 |
| `PIN_GLOBAL_RATE_LIMIT_WINDOW_MS` | 600000 (10 min) |
| `PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS` | 900000 (15 min) |
| `PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS` | 3600000 (1 hour) |
| `TRUST_PROXY_HEADERS` | `false` |

**Testing lockout without waiting minutes** — short windows:

```bash
PIN_RATE_LIMIT_MAX_ATTEMPTS=2 \
PIN_RATE_LIMIT_WINDOW_MS=2000 \
PIN_RATE_LIMIT_LOCKOUT_MS=2000 \
PIN_RATE_LIMIT_MAX_LOCKOUT_MS=4000 \
PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS=50 \
npm run dev
# then POST wrong PINs to /api/auth/verify until you get 429 + a Retry-After header
```

Raise the global cap while testing per-client behaviour, or the global limiter fires first and masks
what you're measuring.

`TRUST_PROXY_HEADERS=false` (default) means every caller shares the rate-limit key `"shared"` —
per-client keying by `X-Forwarded-For` only happens when you explicitly opt in, and should only be
turned on behind a proxy that overwrites that header.

---

## 3. Environment variables

Live in `.env.local` at repo root — **gitignored** (`.env*`), untracked. Never commit or reproduce
key values.

`.env.example` is committed and, as of 2026-07-22 (session 2), **current** — it now lists every var
below, including the rate-limit vars, `TRUST_PROXY_HEADERS` and the image-proxy vars, and it states
that `RESET_PIN` is only ever compared against the literal string `"true"`. It previously advertised
`RESET_PIN=your-reset-pin`, which is a silent no-op. If you add a `process.env` read, add it there
too — the table below is the audit source.

Full set actually read by the code:

| Var | Purpose | Required? |
|---|---|---|
| `GEMINI_API_KEY` | Gemini analysis calls | Yes for analysis |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators metadata (`lib/server/scrapecreators/client.ts`) | Yes for ingestion |
| `SCRAPECREATORS_BASE_URL` | Override API host | No |
| `TURSO_DATABASE_URL` | libSQL URL; unset → `file:./my-content.db` | No |
| `TURSO_AUTH_TOKEN` | Turso token | Only with Turso |
| `APP_SESSION_SECRET` | Session HMAC key | Prod only (throws), dev falls back |
| `RESET_PIN` | `"true"` wipes `pin_hash`/`pin_set_at` | No (local only) |
| `PIN_*` / `PIN_GLOBAL_*` / `TRUST_PROXY_HEADERS` | Rate limiting (table above) | No |
| `PROFILE_TTL_DAYS` | Profile cache TTL (default 7) | No |
| `MAX_VIDEO_BYTES` | Download size cap | No |
| `MAX_IMAGE_PROXY_BYTES`, `IMAGE_PROXY_CACHE_DIR`, `IMAGE_PROXY_CACHE_TTL_DAYS` | Image proxy | No |
| `OLLAMA_MODEL` | Optional local model | No |

**Secrets note:** the ScrapeCreators key was pasted in plaintext in an earlier chat session —
rotate it.

---

## 4. Database

SQLite via `@libsql/client`, Turso-capable. Local file `./my-content.db`
(`lib/server/db.ts`: `process.env.TURSO_DATABASE_URL ?? "file:./my-content.db"`).

Quirk: `my-content.db` is listed in `.gitignore` **and is also tracked in git** — tracking wins, so
local DB writes show up as a dirty working tree. Don't commit them casually.

Inspect:

```bash
sqlite3 my-content.db ".tables"
sqlite3 my-content.db ".schema analyses"
sqlite3 my-content.db "select name from _migrations;"
sqlite3 my-content.db "select count(*) from analyses;"
```

### Current state — stale, re-verify before trusting

The last hand-measured local-DB snapshot (2026-07-22, session 2: `_migrations` 001–006 applied, 1
`analyses` row, empty `profiles`) predates 007/008/009 below and is **not** re-verified here — the
schema facts that matter are captured in the migration files themselves and in the
`PRAGMA table_info`/`index_list` assertion test (§7), not in a point-in-time row count. Re-measure
your own local DB rather than trusting any snapshot in this doc:

```bash
sqlite3 my-content.db "select name, applied_at from _migrations;"
sqlite3 my-content.db ".tables"
```

This is why the analysis schema redesign is a **replacement, not a migration project** — there was
essentially no production data to preserve as of the redesign's start. Do not budget for backfill.

### Migrations

- Directory `migrations/`, numbered `NNN_name.sql`, applied in filename sort order.
- Runner `scripts/migrate.ts` creates `_migrations(name, applied_at)`, skips already-applied files,
  executes the rest via `db.executeMultiple`. Each file runs once.
- Convention: **additive only, no down-migrations.** Nothing in the repo rolls back — to undo, write
  a new forward migration.
- Run with `npm run db:migrate`.

**Current chain (001 → 010, as of PR #99; unchanged by the #96 chain through PR #113):**

| # | File | What it does |
|---|---|---|
| 001 | `001_initial.sql` | Initial schema: `settings`, `analyses`, `content_items`, `analysis_results` |
| 002 | `002_make_prompt_nullable.sql` | `analyses.prompt` nullable |
| 003 | `003_add_title_to_analyses.sql` | `+ analyses.title` |
| 004 | `004_flatten_analysis_content.sql` | Flattens `content_items`/`analysis_results` into `analyses` |
| 005 | `005_enforce_single_content_analysis.sql` | Full rebuild: enforces single-content-per-analysis, `NOT NULL`s |
| 006 | `006_scrapecreators_fields_and_profiles.sql` | `+ profiles` table; adds ScrapeCreators-sourced columns to `analyses` (audio, engagement, etc.) |
| 007 | `007_add_schema_version.sql` | `+ analyses.schema_version` |
| 008 | `008_delete_legacy_pre_redesign_analyses.sql` | Data-only: deletes pre-redesign rows (no schema change) |
| 009 | `009_analysis_mode_images_only.sql` | Full rebuild (ticket #71 + PR #95 fix-round): widens `analysis_mode` CHECK to include `'images_only'`; adds `play_count`, `coauthor_producers` (JSON array of usernames), `like_and_view_counts_disabled` (nullable boolean). **37 → 39 columns on `analyses`**, no drops — see the migration file's own header comment and the `PRAGMA table_info`/`index_list` assertion test (§7) for the full before/after. |
| 010 | `010_profile_style_fingerprints.sql` | Ticket #72 / PR #99. **New table only — `analyses` untouched.** `+ profile_style_fingerprints` (11 cols: `id`, `profile_id` → `profiles(id)`, `fingerprint_version`, `schema_version`, `sample_size`, `source_analysis_ids`, `computed`, `overrides`, `consistency_index`, `created_at`, `updated_at`) + `idx_profile_style_fingerprints_profile_id` (UNIQUE). Deliberately separate from `profiles` — that table holds scraped **facts**, this one holds **inference**. `computed` and `overrides` are two separate JSON columns on purpose so a recompute can never clobber a human correction; read-time merge is `{...computed, ...overrides}` per top-level key. No `is_stale` flag by design (`sample_size` + `source_analysis_ids` already answer it). |

`analyses` has **39 named columns** and **6 explicitly-created indexes**
(`idx_analyses_updated_at`, `idx_analyses_title`, `idx_analyses_username`, `idx_analyses_platform`,
`idx_analyses_profile_id`, `idx_analyses_schema_version`) — asserted by
`tests/server/db/migrations.schema.test.ts`, which runs the **full 001→latest chain** (it globs
`migrations/*.sql` and sorts, so it picks up new migrations automatically) against a fresh in-memory
database rather than relying on hand-verification of each rebuild.

**Re-derived 2026-08-03 against migration 010:** these two numbers are **still 39 and 6** — 010 is
purely additive of a *new* table and does not touch `analyses`. `EXPECTED_ANALYSES_COLUMNS` in that
test file lists exactly 39 entries and `EXPECTED_ANALYSES_INDEXES` exactly 6, and a third assertion
independently checks that 009's `INSERT...SELECT` column lists are positionally aligned at 39 each.
So the figure is correct, but the reason is "010 added a table, not columns" — not "the figure was
re-confirmed to have changed."

`profile_style_fingerprints` (010) has **11 columns** and **1 explicitly-created index**
(`idx_profile_style_fingerprints_profile_id`, UNIQUE on `profile_id` — one fingerprint row per
profile). It is **not** covered by the `analyses` assertions above.

---

## 5. API cost discipline

ScrapeCreators is **credit-based**.

> ⚠️ **STALE, UNVERIFIED FIGURE — do not treat as current.** The last actual measurement was
> **31,994 credits remaining on 2026-07-22**. As of 2026-08-03 that is ~12 days old and has **not**
> been re-measured, because re-measuring costs real credits. Analysis runs have happened since, so
> the true balance is **lower by an unknown amount**. Treat the number as a historical data point
> only. If you genuinely need the current balance, read `credits_remaining` off the response body of
> a call you were already going to make (see below) — do **not** make a call purely to check it.

| Endpoint | Cost |
|---|---|
| `/v1/youtube/video` | 1 credit on success; **0 on 404** (deleted/invalid id) |
| `/v1/youtube/channel` | 1 credit **always — including not-found/bogus handles** |
| `/v1/instagram/post` | 1 credit (`trim` on/off costs the same); response also echoes `credits_charged: 1` |

`credits_remaining` is present in every response body and is **currently discarded** —
`scRequest()` in `lib/server/scrapecreators/client.ts` returns the parsed JSON untouched and nothing
reads or logs the field. Known gap; no budget alarm exists.

**Do not make live calls to check response shapes.** Use the committed fixtures below. Verified
endpoint facts (field names, envelopes, handle-format behaviour, per-call credit deltas) are in
`.claude/context/verified-facts.md` — **append to it, never clobber it**.

---

## 6. Committed fixtures

`.claude/context/fixtures/` — real captured payloads. **Validate shapes against these rather than
making live calls.**

`scrapecreators-youtube/` (10 files):

| File | What it captures |
|---|---|
| `yt_video_fresh.json` | `/v1/youtube/video`, success |
| `yt_video_trim.json` | same video, `trim` variant |
| `yt_video_deleted.json` | 404 body: `success:false`, `error:"not_found"`, `errorStatus:404` |
| `yt_short.json` | a Short (captured in an earlier session against a different key — ignore its `credits_remaining`) |
| `yt_channel_handle.json` | `/v1/youtube/channel` by bare handle |
| `yt_channel_athandle.json` | by `@handle` |
| `yt_channel_ucid.json`, `yt_channel_ucid2.json` | by `UC…` channel id |
| `yt_channel_trim.json` | `trim` variant |
| `yt_channel_bogus.json` | nonexistent channel — note `success:true` with a near-empty payload, and it **still cost a credit** |

`scrapecreators-instagram/` (6 files) — captured live 2026-07-22, all
`GET /v1/instagram/post?url=…&trim=false`, all HTTP 200, 1 credit each (6 total). Full field-level
findings and the list of divergences from `lib/server/scrapecreators/types.ts` are in
`.claude/context/verified-facts.md`:

| File | What it captures |
|---|---|
| `ig_carousel_all_images_10_slides.json` | `XDTGraphSidecar`, 10 children — **every child is `XDTGraphImage`**. Carousel children carry only 7 keys (`__typename, id, shortcode, display_url, video_url:null, is_video, dimensions`); no `thumbnail_src`, no `display_resources`. The sidecar itself has **no** top-level `dimensions`/`display_resources`, and its `owner` is a 5-key stub with **no `edge_followed_by`** |
| `ig_carousel_mixed_video_and_image_10_slides.json` | `XDTGraphSidecar`, 10 children, **7 `XDTGraphVideo` + 3 `XDTGraphImage`** — the previously-missing video-bearing carousel (closes the #71 gap). See verified-facts.md for the full child-shape breakdown, including the undocumented `dash_info` field and a contradiction of the "carousel owner is always a stub" claim above |
| `ig_reel_1_zero_view_count.json` | `XDTGraphVideo` — the trap case: `video_view_count: 0` while `video_play_count: 116333` |
| `ig_reel_2.json` | `XDTGraphVideo`, `has_audio: true`, `video_view_count: 305044` |
| `ig_reel_3.json` | `XDTGraphVideo`, `video_view_count: 150780` |
| `ig_single_image_post.json` | `XDTGraphImage` from a `/p/` URL — proof that a `/p/` URL is **not** necessarily a carousel; no `edge_sidecar_to_children` at all |

> ✅ **Gap closed 2026-07-22:** a video-bearing carousel has now been captured
> (`ig_carousel_mixed_video_and_image_10_slides.json`). `ScrapeCreatorsCarouselChildNode`'s video
> fields are now confirmed against a real payload — but the real shape is **thinner** than modelled
> (no `video_duration`, no `clips_music_attribution_info`, no `thumbnail_src` on video children) and
> carries one wholly new undocumented field (`dash_info`). See verified-facts.md for the full diff;
> #71 owns applying the fix to `types.ts`.

No Instagram error case is captured either (`/v1/instagram/post` non-2xx behaviour is unobserved).

`gemini/structured-output-baseline.mjs` — a working Gemini structured-output harness
(enum-constrained schema: hook types, format archetypes, topic niches, CTA types). Reads
`GEMINI_API_KEY` from env; run with `node`. Ported to `@google/genai` by #75; it has **not been
run since the port** (#75 ran under a zero-live-call constraint), so its output is not yet a
captured fixture. Running it makes one live billed Gemini call — #66 owns doing that once and
recording the results in `.claude/context/verified-facts.md`.

---

## 7. Testing

Ticket **#64** established the harness: **vitest**, `npm run test` (`vitest run`) and
`npm run test:watch`. Config is `vitest.config.ts` — node environment, `tests/**/*.test.ts`, and an
`@/` alias that must stay in lockstep with `tsconfig.json`'s `paths`.

**The suite is offline by construction, not by convention.** `vitest.config.ts`'s `setupFiles`
installs `tests/setup/blockLiveFetch.ts` before every test file: it stubs `fetch` to throw, naming
the attempted URL, unless a test explicitly opts in with its own `vi.stubGlobal("fetch", ...)`.
`tests/setup/blockLiveFetch.test.ts` proves the guard fires and re-arms between tests. Fixtures are
read from `.claude/context/fixtures/` via `tests/helpers/fixtures.ts`, which throws a clear,
path-naming error if a fixture file is missing. See §5 for why this matters (credits, and
`/v1/youtube/channel` charging even on a miss).

**Current state: 18 test files, 214 tests** — re-measured 2026-08-03 via `npm run test` on `main` at
`3e58c32`. (For reference: the previous main `eef8ffa` measured 14 files / 160 tests, so the #96
chain added 4 files and 54 tests. The "11 files / 138 tests" figure this section used to carry was
two sessions stale.)

Layout — regenerated 2026-08-03 from `git ls-files`, not from the previous edition of this tree:

```
tests/
├── setup/blockLiveFetch.ts                              # global fetch guard, wired via setupFiles
├── setup/blockLiveFetch.test.ts                          # proves the guard works
├── helpers/fixtures.ts                                  # loader for .claude/context/fixtures/ (fail-fast on missing file)
├── fixtures/README.md                                   # fixture inventory + the YouTube/Instagram gaps
├── fixtures/synthetic/instagramMedia.ts                 # hand-built adapter inputs — NOT captures
├── repo/duplicateFileArtifacts.test.ts                  # CI guard: no tracked macOS `<name> <n>.<ext>` duplicates — see §8.3
├── app/app/analyses/components/counts/EngagementCount/helpers.test.ts
│                                                        # formatAbbrev — abbreviated count rendering ("116.3K") (#101)
├── lib/api/analyses/helpers.test.ts                     # classifyViewCount / classifyLikeCount — the CountState discriminated
│                                                        #   union (hidden/zero/unknown/count/plays), incl. a real-fixture trap case
│                                                        #   against ig_reel_1_zero_view_count.json (#101, widened by #109/#110)
├── server/scrapecreators/youtubeFixtures.test.ts
├── server/scrapecreators/client.test.ts                 # includes fake-timer retry/backoff tests
├── server/analysis/fetcher/adapter.test.ts
├── server/analysis/parser/validation.test.ts            # parser + validation rewrite: loud failure, no fabricated scores (#68)
├── server/analysis/media/prepareParts.test.ts           # MAX_TOTAL_MEDIA_BYTES/MAX_MEDIA_PARTS caps and partial-failure temp-file cleanup
├── server/analysis/media/resolveMediaParts.test.ts      # carousel/non-carousel enumeration, kind discrimination by __typename/is_video, MAX_MEDIA_PARTS truncation
├── server/analysis/media/prepareParts.mimeType.test.ts  # real-URL mime resolution — regression test for the carousel mime-type bug fixed in #71
├── server/analysis/pipeline/viewCountBinding.test.ts    # view_count binds from video_view_count, never video_play_count; also covers coauthor_producers / like_and_view_counts_disabled persistence (#71)
├── server/analysis/pipeline/fingerprintRecompute.test.ts # a fingerprint-recompute failure must never fail the analysis (#72, Step 7)
├── server/analysis/prompts/user.slideManifest.test.ts   # slide manifest "N of M" truncation signal (#71)
├── server/analysis/prompts/user.engagementLabel.test.ts  # the prompt labels a play count as PLAYS, never as "Views" (#110, TDD D1)
├── server/fingerprint/aggregate.test.ts                 # aggregateStyleFingerprint — pure aggregation (#72)
├── server/fingerprint/service.test.ts                   # recomputeFingerprint: cold start, schema_version filtering,
│                                                        #   override-safe recompute, co-authored posts at equal weight (#72)
└── server/db/migrations.schema.test.ts                  # full 001→latest migration chain schema assertion (#71); globs
                                                         #   migrations/*.sql so new migrations are picked up automatically
```

**Known gaps:**

- Real `/v1/instagram/post` captures **are now committed** (PR #84, merged) — six fixtures under
  `.claude/context/fixtures/scrapecreators-instagram/`, including a video-bearing carousel that
  closed the previously-open shape gap. The adapter tests in this PR still run on synthetic inputs
  (see `tests/fixtures/synthetic/instagramMedia.ts`); the carousel-video-child describe block in
  `adapter.test.ts` has been relabelled `FALSIFIED` rather than `UNVERIFIED` because #84 has now
  disproven the fields it assumes. Converting the adapter tests to the real fixtures is follow-up
  work, not done here. Details are in `tests/fixtures/README.md` and
  `.claude/context/verified-facts.md`.
- No non-Shorts `/v1/youtube/video` capture is committed — `yt_short.json` is a re-scrape of the
  same Shorts video as `yt_video_fresh.json`/`yt_video_trim.json`, not an independent regular
  video. See `tests/fixtures/README.md`.

**CI (ticket #83):** `.github/workflows/ci.yml` runs on every `pull_request` and every `push` to
`main` — `npm run test`, then `npm run typecheck`, then `npm run lint`, then `npm run build` (last,
since it's the slowest and the others fail faster). `permissions: contents: read`,
`timeout-minutes: 10`, Node pinned via `.nvmrc`, deps installed with `npm ci`. The hard
no-live-API-calls guarantee has two independent layers:

1. **Test-level:** `tests/setup/blockLiveFetch.ts` (above) — a real, credit-charged call would have
   to bypass this stub from inside the test process itself.
2. **CI-level (belt and braces):** the workflow never sets `GEMINI_API_KEY` or
   `SCRAPECREATORS_API_KEY` as env vars or GitHub Actions secrets, and neither is added to the
   repo/environment secrets store. So even if a future test somehow bypassed the fetch stub (e.g. by
   calling `lib/server/scrapecreators/client.ts` in a way that doesn't go through the stubbed
   global), the outbound call would still fail — there is no credential for it to authenticate with.
   `.next/cache` is cached for build speed; the tracked-but-gitignored `my-content.db` (§4) is never
   checked for cleanliness and the workflow has no write permissions, so it can't drift or commit
   it.

---

## 8. Traps that look like something else

Added 2026-08-03. Every entry below cost real debugging time in a session because the symptom
pointed somewhere other than the cause. Read this section **before** debugging anything that
"makes no sense".

### 8.1 A stale local DB surfaces as an opaque React error

**Symptom.** In the browser, with no obvious trigger:

```
Can't perform a React state update on a component that hasn't mounted yet.
```

It reads like a component lifecycle bug — a missing cleanup, a stray `setState` in an async
callback, a race in a `useEffect`. It is not. You will waste the whole session in component code.

**Cause.** Un-applied migrations. The local `my-content.db` is behind `migrations/`, a query fails
on a column that doesn't exist yet, and the failure surfaces through the query layer as this
unrelated-looking React warning instead of a legible "no such column" error.

**Fix.**

```bash
npm run db:migrate
```

**Make this your first check, not your last**, any time the UI misbehaves right after you pull,
switch branches, or check out a worktree. Confirm with:

```bash
sqlite3 my-content.db "select name from _migrations order by name;"
ls migrations/
```

If the two lists differ, that's your bug. Note that every worktree under `.claude/worktrees/` has
its own `my-content.db` — migrating one does not migrate the others.

### 8.2 A stale `.next` cache produces fake `tsc` errors

**Symptom.** `npx tsc --noEmit` / `npm run typecheck` fails on files you never wrote:

```
.next/types/cache-life.d 2.ts
.next/types/routes.d 2.ts
```

**Cause.** These are macOS duplicate-file artifacts ("keep both files") inside the **build cache**,
not source. `tsconfig.json`'s `**/*.ts` include picks them up and typechecks them. They are not
errors in your code and no amount of reading your diff will explain them.

**Fix.**

```bash
rm -rf .next
npm run typecheck
```

Do this before you believe any typecheck failure that names a path under `.next/`. Conversely, a
duplicate artifact under a **tracked** path is a real problem — see §8.3.

### 8.3 A CI guard blocks macOS duplicate-file artifacts

`tests/repo/duplicateFileArtifacts.test.ts` runs `git ls-files` and fails if **any tracked** path
matches the ` <n>.<ext>` suffix pattern (`foo 2.ts`, `bar 3.json`). It deliberately only inspects
tracked files, so the gitignored `.next/` duplicates from §8.2 do **not** trip it.

**Why it exists.** `tests/server/analysis/prompts/user.engagementLabel.test 2.ts` — a byte-identical
duplicate of its real twin — was committed during crash recovery (a broad `git add -A`). It was
**never collected by vitest**, because `vitest.config.ts`'s `include: ["tests/**/*.test.ts"]` does
not match a filename ending `.test 2.ts`. But `tsconfig.json`'s `**/*.ts` include **did** typecheck
it. Net effect: 95 lines of permanently dead, silently driftable test code, with a fully green
suite. Nothing in the toolchain complained.

The guard also self-checks that its own pattern matches that exact historical filename, so it can't
rot into a vacuous assertion.

**If it fails:** `git rm` the offending file (it is a duplicate, not content) and prefer narrow,
explicit `git add <path>` over `git add -A` when recovering work.

### 8.4 Contrast must be computed in GAMMA-encoded sRGB, not linear

**This one shipped non-compliant code through two tickets. Read it before doing any contrast QA.**

**The app is hard-locked to dark mode.** `app/layout.tsx` puts `dark` on `<html>`
(`className={...} dark h-full antialiased`). There is **no theme toggle** and no light surface
anywhere. Consequence: the design mockup
(`docs/design/engagement-count-display-states-mockup.html`) was authored on a **white** surface, so
its `slate-*` values are WHITE-surface values. **Do not transplant them literally** — they are
illegible here. Map onto the app's semantic tokens (`--muted-foreground`, `--background`, `--card`)
instead. `ENGAGEMENT_MUTED_CLASSNAME` in
`app/app/analyses/components/counts/EngagementCount/constants.ts` documents this precedent.

**The actual method error.** When a colour carries alpha (a Tailwind `/70`-style opacity), you must
composite it against its backdrop **before** computing luminance — and that compositing happens in
**gamma-encoded sRGB**, which is what browsers do. Compositing in **linear** light gives a
materially different, wrongly-optimistic answer.

Worked example from this codebase: `text-muted-foreground/70`.

| Method | Ratio vs `--background` | Verdict |
|---|---|---|
| Alpha composited in **linear** sRGB (WRONG) | **6.11:1** | passes — but is fiction |
| Alpha composited in **gamma-encoded** sRGB (CORRECT, matches the browser) | **4.42:1** | **fails** WCAG 1.4.3 (≥4.5:1) |

It shipped at `/70` and was live and non-compliant across tickets #101 and #102. Fixed in #103 /
PR #113 by widening to `/80` (~5.53:1). Measured on every surface the state actually renders on, not
just one: at `/70` it was 4.42:1 vs `--background`, 4.37:1 vs `--card`, and 4.31:1 vs the table
row's hover surface (`bg-muted/50` over `--card`) — all three below the floor.

**Correct procedure:**

1. Resolve both colours to sRGB (the tokens here are OKLCH → convert).
2. If either has alpha, composite it over its **actual** backdrop **in gamma-encoded sRGB**:
   `out = α·fg + (1−α)·bg`, per channel, on the **0–255 / 0–1 gamma-encoded** values.
3. Only **now** linearise each composited colour and apply the WCAG relative-luminance formula.
4. `(L_lighter + 0.05) / (L_darker + 0.05)`.
5. Repeat for **every** backdrop the element renders against — background, card, and row-hover are
   three different answers here, and the tightest one governs.

**Process warning.** Two independent agents both reported 6.11:1 and their agreement was treated as
increased confidence. They had used the same wrong method, so the agreement was worth nothing.
**Agreement between parties sharing a method is not verification** — cross-check with a *different*
method (e.g. browser DevTools' own contrast readout, which composites the way the browser does).

### 8.5 `AnalysisGrid` / `AnalysisCard` are dead code — don't maintain or debug them

`AnalysesContent` (`app/app/analyses/components/AnalysesContent/AnalysesContent.tsx`) renders **only**
`AnalysisDataTable`, plus `AnalysisGridSkeleton` while loading. Verified 2026-08-03 by grep:
**nothing imports `AnalysisGrid`**, and `AnalysisCard` is imported *only* by `AnalysisGrid` itself.
The whole subtree is unreachable at runtime.

Note the near-miss: `AnalysisGridSkeleton` **is** live and **is** imported — it is a separate module
from `AnalysisGrid` despite the similar name. Don't delete it by association.

Unreachable modules:

- `app/app/analyses/components/grids/AnalysisGrid/`
- `app/app/analyses/components/cards/AnalysisCard/`
- plus `AnalysisGridProps` / `AnalysisCardProps` in `app/app/analyses/types.ts`

Issue **#23** (Cards/Table `ViewToggle`) was closed **won't-do** on 2026-08-03: the table is the sole
intended view, so a toggle is moot. The owner has decided to **delete** these modules, but the
deletion is **DEFERRED, not done**. Until then: they still typecheck, still lint, and will still
show up in greps — do not spend time fixing bugs in them or updating them to match new contracts.
