# syntax=docker/dockerfile:1
#
# Web service only (TDD §11.3a A). Debian slim.
# Node version pinned to .nvmrc (24.14.1).
#
# Three stages: deps (npm ci) -> builder (next build, standalone output) ->
# runner (traced runtime + migrations, non-root).
#
# Ticket #295: yt-dlp is REMOVED. It was the only external binary this
# image installed (lib/server/analysis/fetcher/youtube.ts execFile("yt-dlp",
# ...)); that call site is gone — the YouTube path now hands the public
# video URL straight to Gemini as a native `fileData.fileUri` part and
# Google fetches it server-side. Confirmed no other caller before removing
# the install step below.

ARG NODE_VERSION=24.14.1

# ---------------------------------------------------------------------------
# 1. deps — install dependencies from the committed lockfile only.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2. builder — next build with output: "standalone".
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

# APP_SESSION_SECRET is required at build time: lib/server/auth/auth.ts
# throws under NODE_ENV=production when it is unset. This is a build-time
# dummy only — never a real secret in a layer. Mirrors .github/workflows/ci.yml.
ARG APP_SESSION_SECRET=docker-build-not-a-real-secret
ENV APP_SESSION_SECRET=${APP_SESSION_SECRET}
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# 3. runner — minimal runtime image.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

# ENV NODE_ENV=production: lib/server/auth/constants.ts derives the session
# cookie's `secure` flag from it, and the APP_SESSION_SECRET production
# guard is conditioned on it — without it the cookie ships un-Secure and
# the guard goes quiet.
ENV NODE_ENV=production
# HOSTNAME=0.0.0.0: standalone's server.js binds loopback by default
# (output.md:54); without this the platform health check never connects.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# tsx: scripts/migrate.ts runs under it, and it is a devDependency that
# `output: "standalone"` does not trace (it only traces what the app
# imports). The release command itself is the next ticket, but the image
# must already be capable of running `db:migrate`. Pinned to match the
# devDependency range in package.json.
RUN npm install --global tsx@4.23.1

# Standalone server + traced node_modules. Does NOT include public/ or
# .next/static/ (output.md:36) — copied explicitly below, or the site
# ships with no CSS/JS.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# migrations/ + scripts/migrate.ts: scripts/migrate.ts resolves
# join(process.cwd(), "migrations") and standalone tracing does not carry
# either path (they are read via fs, not imported).
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
# scripts/migrate.ts imports "../lib/server/db" as TypeScript source, which
# standalone tracing does not carry (it only bundles compiled server code).
# db.ts itself imports only @libsql/client, already present in the traced
# node_modules copied above.
COPY --from=builder /app/lib/server/db.ts ./lib/server/db.ts

# Non-root runtime user.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
