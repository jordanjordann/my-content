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

**Secrets note:** the ScrapeCreators key was pasted in plaintext in an earlier chat session —
rotate it.

### 3a. Production env matrix (Docker / web service deploy — TDD §11.3a)

Verified against the code, not copied from the TDD, for the **web service only** (issue #239). No
Railway or Turso account exists yet — this is the audit that the next (Railway/Turso) ticket
consumes.

**Boot-blocking — the app fails or silently corrupts without these:**

| Variable | Why |
|---|---|
| `APP_SESSION_SECRET` | `lib/server/auth/auth.ts:96-107` throws `"APP_SESSION_SECRET is required in production."` when unset under `NODE_ENV=production` — but only lazily, the first time a session is signed/verified. As of #244, `assertProductionEnv()` (`lib/server/env/productionEnv.ts`, called from `instrumentation.ts`'s `register()`) also checks it at **server boot**, so a missing secret now fails the deploy immediately instead of 500ing on the first authenticated request. Also **required at `next build` time** for the same reason — the Dockerfile's builder stage sets a build-time dummy (`ARG APP_SESSION_SECRET=docker-build-not-a-real-secret`), never a real secret. Consumed by root `proxy.ts` (Next 16's rename of `middleware.ts`), which HMAC-gates every `/app` path. Changing it invalidates all live sessions. |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | `lib/server/db.ts:3` falls back to `file:./my-content.db` if unset — an ephemeral in-image file that loses every write on redeploy. As of #244, `instrumentation.ts` -> `lib/server/env/productionEnv.ts`'s `assertProductionEnv()` runs at server boot (`register()`, not at `next build` time) and refuses to start when `TURSO_DATABASE_URL` is unset or starts with `file:`, or when it's a `libsql://`/`https://` URL with `TURSO_AUTH_TOKEN` unset. `db.ts` itself is unchanged — the guard lives in `instrumentation.ts` specifically so it never runs during `next build` (CI and the Dockerfile builder stage both build without `TURSO_DATABASE_URL` set). Set it or leave it fully **unset** — `.env.example` ships it as an empty string (`TURSO_DATABASE_URL=`), and `db.ts:3`'s `??` fallback does not treat `""` as unset, so an empty string fails `next build` itself (`LibsqlError: URL_INVALID`) before the boot guard ever runs, with an error that names neither the variable nor this file. |

**On a guard failure, trust the exit code, not the log line above it.** Next prints `▲ Next.js … / ✓ Ready in 0ms` *before* `register()`'s guard error and `process.exit(1)` — every failing `docker run` shows `Ready` first, then `Invalid production environment: …`, then the process exits 1. Don't read `Ready` as a successful boot; check the container's exit code (or that it stays `Up`, not restarting).

**Requires a deliberate decision — do not inherit the default:**

| Variable | Why |
|---|---|
| `TRUST_PROXY_HEADERS` | Defaults to `false` (`lib/server/auth/constants.ts:92`), which collapses every caller onto the shared rate-limit key `"shared"` at `app/api/auth/verify/route.ts:32` — behind a platform proxy, PIN rate limiting becomes global and one attacker can lock out all staff. Setting it `true` is only safe if the proxy **overwrites** `X-Forwarded-For` rather than appending to it (`.env.example:30-31`); if it appends, `true` is worse than `false` because the header becomes forgeable. **This ticket records the requirement and leaves the value undecided** — the answer depends on Railway's documented proxy behaviour, which the next (Railway) ticket must confirm before setting it. |
| `RESET_PIN` | Must be **absent** in production. When set to the literal string `"true"`, every `hasPinConfigured()` call wipes the PIN (`.env.example:12-15`). As of #244, `assertProductionEnv()` also refuses to boot the server if `RESET_PIN === "true"` under `NODE_ENV=production`. |

**Optional — has a working default, no volume needed:**

| Variable | Why |
|---|---|
| `IMAGE_PROXY_CACHE_DIR` | Defaults to `os.tmpdir()/image-proxy-cache` (`lib/server/imageProxyCache/constants.ts:4-5`) and self-creates (`diskCache.ts:69`). **No volume needed** — a container's `/tmp` is writable. Two things to note, not fix: the cache is ephemeral across redeploys (fine, it's a cache), and `diskCache.ts:61` documents unbounded disk growth, which matters more on metered container disk than on a laptop. |
| `PIN_*` / `PIN_GLOBAL_*` rate-limit vars | All optional; **an invalid value throws at import**. Leave unset in production. |
| `MAX_VIDEO_BYTES`, `MAX_IMAGE_PROXY_BYTES`, `PROFILE_TTL_DAYS`, `SCRAPECREATORS_BASE_URL`, `PERFORMANCE_*` | All have code defaults. |

**Needed for function, not for boot (read lazily, no import-time throw):** `GEMINI_API_KEY`
(`gemini/upload.ts:4`, `generate.ts:6`), `SCRAPECREATORS_API_KEY` (`scrapecreators/client.ts:67`).

**Deliberately out of scope for this ticket:** any Railway or Turso account, the release/migration
command — both belong to the deploy ticket that follows this one (#246). The production boot guard
for `TURSO_DATABASE_URL` / `APP_SESSION_SECRET` / `RESET_PIN` shipped in #244 (`instrumentation.ts`
-> `lib/server/env/productionEnv.ts`); see the boot-blocking table above.

### 3b. Railway config-as-code — pre-deploy migrations + healthcheck (issue #246)

`railway.json` (repo root) is the config-as-code file
(https://docs.railway.com/reference/config-as-code):

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "preDeployCommand": "npx tsx scripts/migrate.ts",
    "healthcheckPath": "/auth/pin",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- **`preDeployCommand`** runs `scripts/migrate.ts` between build and container start. Per Railway's
  docs, if it exits non-zero it "will not be retried and the deployment will not proceed" — a broken
  migration blocks the release instead of shipping code against an un-migrated schema. Verified
  locally against the built `Dockerfile` runner image (not just assumed from the `package.json`
  script name): first run against an empty file DB applied all 13 migrations and exited 0; a second
  run against the now-migrated DB printed nothing and exited 0 (the no-op case — this is what the
  imported production DB will do on first deploy, see below); a deliberately broken migration file
  exited 1. The image already carries everything the command needs
  (`migrations/`, `scripts/migrate.ts`, `lib/server/db.ts` as source, and `tsx@4.23.1` installed
  globally) — shipped in #241's `Dockerfile`, not added here.
- **`healthcheckPath`** is `/auth/pin` — public, returns 200, exercises a real render path. There is
  no `/api/health` and none is being added (owner-declined).
- **Precedence, per the same doc:** "Configuration defined in code will always override values from
  the dashboard," and dashboard values are left untouched, not overwritten — so a value set in
  `railway.json` wins for every deploy, but the dashboard field still shows its old value until
  someone edits it there too. No dashboard click is required for `railway.json` to take effect —
  Railway looks for the file automatically on the next deploy.
- **On first deploy against the imported production DB:** `_migrations` already has all 13 rows
  (`001_initial.sql` … `013_reach_unavailable_reason.sql`), so the migration runner's per-file
  `SELECT ... WHERE name = ?` gate skips every one of them. **An empty pre-deploy log on first
  deploy is success, not a misconfiguration** — do not treat it as evidence the command didn't run.
  The import procedure that produced this state is recorded in
  `.claude/context/verified-facts.md` (issue #246 / PR #249): the production Turso DB (`my-content`,
  `aws-ap-northeast-1`) was created with `turso db create --from-file` from a `VACUUM INTO` snapshot
  of the owner's local `my-content.db`, converted to WAL and integrity-checked before upload, never
  from a from-scratch empty database.

Owner dashboard actions this ticket does **not** perform (infrastructure is live; no agent may
change it): confirming the Railway service actually redeployed with `railway.json` applied (check
the deployment's settings show "config as code" as the source, per the doc above), and rotating the
imported PIN after first successful login (the imported DB carries the owner's dev-era PIN hash).

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
- Runner `scripts/migrate.ts` (tickets #277/#278) tracks `_migrations(name, applied_at, checksum)`
  by **filename**, not content. An unapplied file's body and its `_migrations` tracking row commit
  in one interactive transaction (`client.transaction("write")`) -- no applied-but-untracked window.
  An already-tracked row is checksum-compared: `NULL` stored checksum (pre-#278 legacy row) is
  adopted from disk as the trusted baseline and NOT re-run; a mismatch throws and aborts the whole
  script (deploy fails); a match is a silent no-op. **Renaming an applied file makes the runner
  treat it as brand-new and re-apply it** -- `_migrations` is keyed by filename, and checksum
  tracking does not protect against this (a rename has no prior row to compare against). Do not
  rename an already-applied migration file. `runMigrations` also warns (does not error) if a
  `_migrations` row's filename has no matching file on disk, which is the symptom of exactly that.
- Convention: **additive only, no down-migrations.** Nothing in the repo rolls back — to undo, write
  a new forward migration.
- **`BEGIN TRANSACTION; ... COMMIT;` wrapper contract** (enforced by `stripOuterTransaction`,
  `scripts/migrate.ts`): a migration file either has NO transaction wrapper at all, or wraps its
  entire body in exactly ONE `BEGIN TRANSACTION;` as its first statement and `COMMIT;` as its last
  -- nothing before `BEGIN TRANSACTION;` (no header comment), no other wrapper form (`BEGIN;`,
  `COMMIT TRANSACTION;`, `END;`, `BEGIN IMMEDIATE TRANSACTION;`), no second transaction block, and
  no content after `COMMIT;`. `migrate.ts` owns the actual outer transaction and strips this wrapper
  at runtime (never edits the file); any other shape throws a loud, file-named error before the
  driver ever sees the SQL, rather than a bare "cannot start a transaction within a transaction"
  with no indication of which file or why.
  - **The residual-token check scans statement position, not raw text.** After stripping, the
    remaining body is comment- and string-literal-stripped (`--` line comments, `/* */` block
    comments, and `'...'` string literals are all blanked out) and then split into statements on
    `;`; only a statement that itself *starts* with `BEGIN TRANSACTION` or `COMMIT` trips the
    error. A bare `COMMIT` mentioned inside a comment (`-- do not COMMIT here`) or a string literal
    (`INSERT INTO t VALUES ('COMMIT')`), or `commit` used as a bare column identifier
    (`CREATE TABLE t (commit TEXT)`), does **not** trip it -- only an actual second
    `BEGIN TRANSACTION`/`COMMIT` statement does.
- Run with `npm run db:migrate`.

**Current chain (001 → 012, as of ticket #139):**

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
| 011 | `011_fingerprint_computed_at.sql` | Ticket #115 (`docs/archive/specs/TDD-fingerprint-read-override-api.md` §3 D2). `+ profile_style_fingerprints.computed_at` (nullable `TEXT`, backfilled `= updated_at` for existing rows) — **11 → 12 columns**, `analyses` untouched. Written ONLY by `upsertFingerprint` (never by the overrides writer), so it stays "last recompute time" even after a human `PATCH` moves `updated_at`. Nullable because SQLite's `ALTER TABLE ... ADD COLUMN` can't take a non-constant default (`datetime('now')`) or `NOT NULL` without one; `mapRow` reads `row.computed_at ?? row.updated_at` so a legacy row can never surface `null`. |
| 012 | `012_performance_block.sql` | Ticket #139 (`docs/TDD-3A-3B-3C-phase-3.md` §1.1, §5.2). Full rebuild: **drops** `engagement_rate` (R-12.3.1 fix — `computeEngagementRate` relocates to `lib/server/analysis/performance/ratios.ts`, only the column is dropped) and **adds** the 17-column performance block (`perf_reach_value`, `perf_reach_kind`, `perf_reach_derived_from`, `perf_tier1_ratio`, `perf_tier1_denominator`, `perf_bucket_key`, `perf_baseline_median`, `perf_baseline_sample_size`, `perf_multiplier`, `perf_post_age_hours`, `audience_source_fetched_at`, `perf_tier_used`, `perf_confidence`, `perf_confidence_reason`, `perf_provisional`, `perf_unavailable_reason`, `performance_score`) — **39 → 55 columns** (38 survivors + 17 new; see the migration file's own header for the 14-vs-17 accounting). Existing `analyses` rows are deleted (owner ruling, no backward compatibility — `ANALYSIS_SCHEMA_VERSION` bumps 2 → 3 regardless). Adds `idx_analyses_profile_bucket` and `idx_analyses_performance_score` — **6 → 8 indexes**. `perf_tier1_denominator`'s CHECK is the one cross-column constraint in the table (R-12.2.2): both "denominator, if set, must be a valid enum value" and "ratio set requires denominator set" are enforced as independently-ANDed conditions, not a single ratio-IS-NULL short-circuit — see the migration file's own comment for the SQLite `NULL`-in-`CHECK` semantics that make the naive OR-form unsafe. The other five judgement/derivation enum columns (`perf_reach_derived_from`, `perf_tier_used`, `perf_confidence`, `perf_confidence_reason`, `perf_unavailable_reason`) each carry a single-column `CHECK(col IS NULL OR col IN (...))` (PR #151 review, non-blocking item 1 + owner ruling), the safe form per the same NULL-in-`CHECK` reasoning — no cross-column condition is introduced. |

`analyses` has **55 named columns** and **8 explicitly-created indexes**
(`idx_analyses_updated_at`, `idx_analyses_title`, `idx_analyses_username`, `idx_analyses_platform`,
`idx_analyses_profile_id`, `idx_analyses_schema_version`, `idx_analyses_profile_bucket`,
`idx_analyses_performance_score`) — asserted by `tests/server/db/migrations.schema.test.ts`, which
runs the **full 001→latest chain** (it globs `migrations/*.sql` and sorts, so it picks up new
migrations automatically) against a fresh in-memory database rather than relying on
hand-verification of each rebuild.

**Re-derived 2026-08-06 against migration 012 (ticket #139 / PR #151):** 39 → 55 columns, 6 → 8
indexes. `EXPECTED_ANALYSES_COLUMNS` in that test file lists exactly 55 entries and
`EXPECTED_ANALYSES_INDEXES` exactly 8, and a further assertion independently checks that 012's
`INSERT...SELECT` column lists are positionally aligned at 55 each.

`profile_style_fingerprints` (010, +011) has **12 columns** and **1 explicitly-created index**
(`idx_profile_style_fingerprints_profile_id`, UNIQUE on `profile_id` — one fingerprint row per
profile) — asserted by its own `PRAGMA table_info`/`index_list` block in
`tests/server/db/migrations.schema.test.ts` (added ticket #115; previously this table had no
dedicated schema assertion, only the `analyses`-focused one above).

---

## 5. API cost discipline

ScrapeCreators is **credit-based**.

> ⚠️ **STALE, UNVERIFIED FIGURE — do not treat as current.** The last actual measurement was
> **31,984 credits remaining (inferred) as of the 2026-08-06 V1/V3 verification session** —
> `credits_remaining: 31986` was directly observed on the V1 capture, then arithmetically reduced by
> V3's two calls (see `.claude/context/verified-facts.md`'s "Credit ledger for this verification
> session (2026-08-06)"). The post-session figure was **not** independently re-checked — doing so
> would itself be a balance-check-only call, which this section explicitly prohibits. Treat the
> number as a historical data point only. If you genuinely need the current balance, read
> `credits_remaining` off the response body of a call you were already going to make (see below) —
> do **not** make a call purely to check it.

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

`scrapecreators-instagram/` also now has an 8th file, captured 2026-08-06 for PRD 3B's V1
verification spend:

| File | What it captures |
|---|---|
| `ig_post_counts_disabled.json` | `XDTGraphImage`, `like_and_view_counts_disabled: true` — the first genuinely counts-disabled post ever captured. **`edge_media_preview_like.count` is `-1`, not `0`/`null`/absent** — a negative sentinel. See verified-facts.md's "V1 CAPTURED" section for the full finding and why code must never read that field without checking the flag first, even defensively. |

`gemini/structured-output-baseline.mjs` — a working Gemini structured-output harness
(enum-constrained schema: hook types, format archetypes, topic niches, CTA types). Reads
`GEMINI_API_KEY` from env; run with `node`. Ported to `@google/genai` by #75; it has **not been
run since the port** (#75 ran under a zero-live-call constraint), so its output is not yet a
captured fixture. Running it makes one live billed Gemini call — #66 owns doing that once and
recording the results in `.claude/context/verified-facts.md`.

---

## 7. Testing

Ticket **#64** established the harness: **vitest**, `npm run test` (`vitest run`) and
`npm run test:watch`. Config is `vitest.config.ts`, and an `@/` alias that must stay in lockstep with
`tsconfig.json`'s `paths`.

**Two vitest projects, one `vitest.config.ts` (ticket #123).** `test.projects` (vitest 4's
replacement for the deprecated `defineWorkspace`/`vitest.workspace.ts` file) runs two environments
out of the single root config, in one `vitest run` invocation:

- **`node` project** — the original ticket #64 suite. `tests/**/*.test.ts`, `environment: "node"`,
  unchanged. Nothing here touches the DOM.
- **`jsdom` project** (new, #123) — for tests that render a real React tree
  (`@testing-library/react` + `@testing-library/jest-dom`). Scoped to its own glob,
  `` tests/**/*.dom.test.{ts,tsx} ``, and kept as a *separate* project rather than flipping the
  global environment to `jsdom` — jsdom is slower and unnecessary for the ~300 existing node tests,
  which stay exactly as fast and DOM-free as before. `tests/setup/domMatchers.ts`
  (jsdom-project-only `setupFiles` entry) imports `@testing-library/jest-dom/vitest`, which
  auto-extends `expect` with the DOM matchers — no manual `expect.extend()` call needed — and also
  registers `afterEach(cleanup)` from `@testing-library/react`, and sets
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, both explicitly, since the `jsdom` project's
  `globals: false` would otherwise silently disable RTL's own auto-cleanup AND its act-environment
  registration (both only self-register when `afterEach`/`beforeAll`/`afterAll` are globals).

**Naming convention — required.** A jsdom-flavored test file MUST be named `*.dom.test.ts` or
`*.dom.test.tsx`. The `node` project's glob (`` tests/**/*.test.ts ``) would otherwise also match a
`.dom.test.ts` file (it still ends in `.test.ts`); the `node` project's `exclude` closes that gap
explicitly. A plain `*.test.tsx` file with no `.dom.` segment matches **neither** project and will
silently not run at all — see the comment above `test.projects` in `vitest.config.ts` for the full
reasoning.

Both projects still run from the single `npm run test` (`vitest run`) invocation — no change to the
CI step or the script. Run one project in isolation with `npx vitest run --project=node` /
`--project=jsdom` when iterating.

New dev dependencies (#123, versions chosen for Node `24.14.1` per `.nvmrc` — `jsdom@30` requires
Node `^24.15.0`+ and is NOT installable here): `jsdom@29.1.1`, `@testing-library/react@16.3.2`,
`@testing-library/dom@10.4.1` (peer of RTL 16, must be installed explicitly), and
`@testing-library/jest-dom@7.0.0`.

**The suite is offline by construction, not by convention.** Both projects' `setupFiles` install
`tests/setup/blockLiveFetch.ts` before every test file: it stubs `fetch` to throw, naming the
attempted URL, unless a test explicitly opts in with its own `vi.stubGlobal("fetch", ...)`.
`tests/setup/blockLiveFetch.test.ts` proves the guard fires and re-arms between tests. Fixtures are
read from `.claude/context/fixtures/` via `tests/helpers/fixtures.ts`, which throws a clear,
path-naming error if a fixture file is missing. See §5 for why this matters (credits, and
`/v1/youtube/channel` charging even on a miss).

**Current state (re-measured 2026-08-06, ticket #139 / PR #151): 29 test
files, 340 tests total** — 26 files / 336 tests in the `node` project (25 files / 311 tests
unchanged from the original ticket, +1 file / 4 tests for
`tests/config/vitestProjectGlobs.test.ts`, added during PR #126 review to pin the glob-routing
fix), + 3 files / 4 tests in the `jsdom` project: `tests/lib/api/fingerprint/hooks.dom.test.tsx`
(see the layout tree above), `tests/setup/domCleanup.dom.test.tsx` (added during PR #126 review
round 1 to pin the RTL auto-cleanup fix), and `tests/setup/reactActEnvironment.dom.test.tsx`
(added during PR #126 review round 2 to pin the `IS_REACT_ACT_ENVIRONMENT` fix). The node-project
figures above (19 → 237 in earlier editions of this doc) had already drifted upward from unrelated
feature work between #115 and this ticket; the 311 figure is a fresh measurement, not a
re-derivation of the old delta math. The further growth from 315 to 336 node-project tests reflects
unrelated feature work landed between PR #126 and this branch (139-migration-012-performance-block,
PR #151), not a re-derivation of the 311/315 delta math either.

Layout — regenerated from `git ls-files`, including this PR's review-fix additions:

```
tests/
├── setup/blockLiveFetch.ts                              # global fetch guard, wired via setupFiles
├── setup/blockLiveFetch.test.ts                          # proves the guard works
├── setup/domMatchers.ts                                 # jsdom-project-only setupFiles entry — imports
│                                                        #   @testing-library/jest-dom/vitest and registers
│                                                        #   afterEach(cleanup) AND
│                                                        #   globalThis.IS_REACT_ACT_ENVIRONMENT = true
│                                                        #   explicitly (#123, PR #126 review rounds 1 + 2)
├── setup/domCleanup.dom.test.tsx                        # proves RTL's afterEach(cleanup) actually runs between
│                                                        #   jsdom tests (#123, PR #126 review round 1)
├── setup/reactActEnvironment.dom.test.tsx               # proves IS_REACT_ACT_ENVIRONMENT is set to true by
│                                                        #   the jsdom setup file (#123, PR #126 review round 2)
├── config/vitestProjectGlobs.test.ts                    # re-derives regexes from vitest.config.ts's actual
│                                                        #   node/jsdom include+exclude globs and asserts they route
│                                                        #   representative filenames — incl. a JSX-free `.dom.test.ts`
│                                                        #   hook file — to exactly one project (#123, PR #126 review)
├── lib/api/fingerprint/hooks.dom.test.tsx               # jsdom harness demonstration test (#123) — renders
│                                                        #   useFingerprint + useUpdateFingerprintOverrides together
│                                                        #   in a real QueryClientProvider tree and asserts the
│                                                        #   mutation's onSuccess invalidation actually triggers a
│                                                        #   refetch the query hook observes — the exact contract PR
│                                                        #   #122's review flagged as previously only "verified by
│                                                        #   construction"
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
├── server/fingerprint/overrides.test.ts                 # validateOverridePatch, patchFingerprintOverrides,
│                                                        #   applyFingerprintOverridePatch, countCompletedV2Analyses,
│                                                        #   NON_OVERRIDABLE_FIELDS write+read guards, computed_at vs
│                                                        #   updated_at independence (#115). Uses a per-test TEMP FILE
│                                                        #   db, not `:memory:` — db.transaction() steals the shared
│                                                        #   client's connection and a fresh `:memory:` reconnect is an
│                                                        #   unrelated empty database; a real file path is not.
└── server/db/migrations.schema.test.ts                  # full 001→latest migration chain schema assertion (#71); globs
                                                         #   migrations/*.sql so new migrations are picked up automatically.
                                                         #   Also asserts profile_style_fingerprints' own column/index
                                                         #   list (11→12 cols, #115).
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
(`docs/archive/specs/engagement-count-display-states-mockup.html`) was authored on a **white** surface, so
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
