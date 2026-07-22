# RUNBOOK

Operational reference card. Verified against `main` at `dd4e57e` (2026-07-22).

---

## 1. Running the app

| Task | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | `next dev`, http://localhost:3000 |
| Production build | `npm run build` | |
| Serve build | `npm start` | |
| Lint | `npm run lint` | flat config, `eslint.config.mjs` |
| Typecheck | `npx tsc --noEmit` | **No `typecheck` script exists** in `package.json`; `tsconfig.json` already sets `noEmit` |
| Migrate DB | `npm run db:migrate` | `tsx scripts/migrate.ts` |

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

`.env.example` is committed but **stale**: it lists none of the rate-limit vars, `TRUST_PROXY_HEADERS`,
or the image-proxy vars, and it describes `RESET_PIN` as `your-reset-pin` when the code only checks
for the literal string `"true"`.

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

### Current state — effectively empty (re-measured 2026-07-22)

Measured on the local `my-content.db` on 2026-07-22 (this section previously claimed 006 was
unapplied and that no `profiles` table existed — that was **stale and has misled at least one
agent**; corrected below):

- Tables present: `_migrations`, `analyses`, **`profiles`**, `settings`.
- `_migrations`: **001–006 all applied.** `006_scrapecreators_fields_and_profiles.sql` was applied
  at `2026-07-22 01:51:31`.
- `analyses`: **1 row**.
- `profiles`: **0 rows** (table exists, empty).
- `settings`: 2 rows (`pin_hash`, `pin_set_at`).

Re-verify rather than trusting this snapshot:

```bash
sqlite3 my-content.db "select name, applied_at from _migrations;"
sqlite3 my-content.db ".tables"
```

This is why the analysis schema redesign is a **replacement, not a migration project** — there is
essentially no data to preserve. Do not budget for backfill.

### Migrations

- Directory `migrations/`, numbered `NNN_name.sql`, applied in filename sort order.
- Runner `scripts/migrate.ts` creates `_migrations(name, applied_at)`, skips already-applied files,
  executes the rest via `db.executeMultiple`. Each file runs once.
- Convention: **additive only, no down-migrations.** Nothing in the repo rolls back — to undo, write
  a new forward migration.
- Run with `npm run db:migrate`.

---

## 5. API cost discipline

ScrapeCreators is **credit-based**, **31,995 credits remaining** as of 2026-07-22 (the account was
topped up since the 2026-07-21 measurement of ~25,000 — don't trust older numbers).

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

`scrapecreators-instagram/` (5 files) — captured live 2026-07-22, all
`GET /v1/instagram/post?url=…&trim=false`, all HTTP 200, 1 credit each (5 total). Full field-level
findings and the list of divergences from `lib/server/scrapecreators/types.ts` are in
`.claude/context/verified-facts.md`:

| File | What it captures |
|---|---|
| `ig_carousel_all_images_10_slides.json` | `XDTGraphSidecar`, 10 children — **every child is `XDTGraphImage`**. Carousel children carry only 7 keys (`__typename, id, shortcode, display_url, video_url:null, is_video, dimensions`); no `thumbnail_src`, no `display_resources`. The sidecar itself has **no** top-level `dimensions`/`display_resources`, and its `owner` is a 5-key stub with **no `edge_followed_by`** |
| `ig_reel_1_zero_view_count.json` | `XDTGraphVideo` — the trap case: `video_view_count: 0` while `video_play_count: 116333` |
| `ig_reel_2.json` | `XDTGraphVideo`, `has_audio: true`, `video_view_count: 305044` |
| `ig_reel_3.json` | `XDTGraphVideo`, `video_view_count: 150780` |
| `ig_single_image_post.json` | `XDTGraphImage` from a `/p/` URL — proof that a `/p/` URL is **not** necessarily a carousel; no `edge_sidecar_to_children` at all |

> ⚠️ **Gap: no video-bearing carousel has ever been captured.** The one sidecar fixture is
> all-image, so `ScrapeCreatorsCarouselChildNode`'s video fields remain modelled, not confirmed.
> Ticket **#71** (carousel support) still needs a carousel URL containing at least one video slide.

No Instagram error case is captured either (`/v1/instagram/post` non-2xx behaviour is unobserved).

`gemini/structured-output-baseline.mjs` — a working Gemini structured-output harness
(enum-constrained schema: hook types, format archetypes, topic niches, CTA types). Reads
`GEMINI_API_KEY` from env; run with `node`. Ported to `@google/genai` by #75; it has **not been
run since the port** (#75 ran under a zero-live-call constraint), so its output is not yet a
captured fixture. Running it makes one live billed Gemini call — #66 owns doing that once and
recording the results in `.claude/context/verified-facts.md`.

---

## 7. Testing

There are **zero test files in the repo** — no `*.test.*`, no `*.spec.*`, no `__tests__/`, and no
test runner in `package.json`. Ticket **#64** establishes the harness. Until it lands, "run the
tests" is not something you can do; verify by typecheck, lint, and manual exercise of the routes.
