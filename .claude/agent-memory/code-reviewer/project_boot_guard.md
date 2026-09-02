---
name: project-boot-guard
description: The production boot guard (instrumentation.ts + productionEnv.ts) is load-bearing after a real 2026-08-18 Railway incident — process.exit(1) is mandatory under Next 16.2.10 standalone
metadata:
  type: project
---

Merged from the former `project_boot_guard` and `project_next_standalone_boot_guard`, which covered
overlapping #244/#247 ground.

## What it is

`instrumentation.ts` -> `lib/server/env/productionEnv.ts` (`assertProductionEnv`), shipped by #244 /
PR #247 on 2026-08-18. It fails the boot on:
- a missing or `file:` `TURSO_DATABASE_URL`
- a remote URL with no `TURSO_AUTH_TOKEN`
- a missing `APP_SESSION_SECRET`
- `RESET_PIN === "true"`

## Why it is load-bearing

On 2026-08-18 a Railway deploy went out with unresolved env vars. Before the guard, `lib/server/db.ts`
would have fallen back to `file:./my-content.db` inside an ephemeral container, booted fine, served
traffic, and **silently discarded every database write**. The guard caught it on its first day live.
Regressions here are invisible until they cost real data. Deploy 3/N points this image at real
Railway/Turso; a guard that logs but does not exit is worse than none — the platform never learns to roll
back.

## Facts that cost real Docker cycles to establish (not from docs)

- On **Next 16.2.10**, a throw/rejection inside `register()` is **logged** by the standalone `server.js`
  but does **not** terminate the process. The container stays `Up` with `exitCode=0` and serves HTTP 500
  forever. **An explicit `process.exit(1)` in a `catch` is the only thing that makes the container
  actually die.** Verified by `docker run`.
- `register()` provably does **not** run during `next build`. The Dockerfile builder stage builds under
  `NODE_ENV=production` with `TURSO_DATABASE_URL` unset and the build succeeds — if the guard ran at build
  time it would fail. This is why the guard is **not** in `lib/server/db.ts`.
- `output: "standalone"` tracing **does** carry `instrumentation.ts` and its dynamic import (they land in
  `.next/server/chunks/`). No Dockerfile `COPY` addition is needed — unlike `scripts/migrate.ts` in #241.
  But the guard is reached through dynamic `import()` hops that must survive Next's file tracing: **adding
  a hop adds a way for the guard to silently not load.**
- The guard returns early unless `NODE_ENV === "production"` (`productionEnv.ts:18`), so it does not fire
  under `npm run dev`.
- `tests/server/env/productionEnv.test.ts` contains a string literal beginning `SECRET-CANARY-…`. It is a
  deliberate fake used to prove the boot guard never echoes a URL. **Do not flag it as a leak.**

## How to review changes here

Treat any diff touching `instrumentation*.ts`, `lib/server/env/productionEnv.ts`, or `db.ts`'s URL
fallback as **high severity**. Always ask whether `process.exit(1)` is still genuinely reachable *under
standalone on Railway*, not just under `npm run dev`. As of the #247 review the `process.exit(1)` had
**no** test coverage — raised as finding F3.

Related: [[review-conduct]], [[differential-build-proof]], [[guard-strictness]], [[owner-preferences]].
