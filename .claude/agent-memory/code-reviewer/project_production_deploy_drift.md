---
name: production-deploy-drift
description: Production Railway silently stopped deploying after 2026-08-19 — always pin the deployed commit before believing anything observed on the live app
metadata:
  type: project
---

**On 2026-08-21 production was found running `8c772fb` (2026-08-19 00:20) while `main` was at
`f929fb4` (2026-08-20 21:48) — 10 commits / 7 code-bearing PRs behind (#258, #259, #257, #261,
#263, #268, #269, #271). The only `SUCCESS` deployment was `50971c2f`, created 2026-08-19T03:15Z.**

**RESOLVED 2026-08-21T05:02Z:** owner redeployed. Active deployment `a42a6d59`, `meta.commitHash`
= `f929fb4`, one instance `RUNNING`, preDeploy `npx tsx scripts/migrate.ts` ran. Confirmed by BOTH
checks: metadata (railway status --json) AND the behavioural gate (live `<thead>` now has 0
`button[aria-label*=Sort]` / 0 `[aria-sort]`, headers `cursor:auto`). The drift lesson still stands
— pin the commit before believing the live app; don't assume `main` == live.

**Why:** three days of merges to `main` produced zero deployments and nobody noticed, because
everyone assumed `main` == live. Root cause of the non-deploy was not determined from the CLI
(`serviceManifest.build.watchPatterns` is `[]`, `meta.ignoreWatchPatterns` is `true`); it needs the
Railway dashboard.

**How to apply:** before reporting **any** finding observed on the live app, pin the deployed
commit and diff it against `main`, then label every finding `[STALE-BUILD]` or
`[REPRODUCES ON MAIN]`. Two independent checks, both cheap:

1. `~/.railway/bin/railway deployment list --json` → `meta.commitHash` + `createdAt`, then locate
   that hash in `git log --oneline --first-parent`.
2. A behavioural tell. In this instance the live `<thead>` still served 9
   `<button aria-label="Sort by …">` plus `aria-sort="descending"`, which PR #268 had removed —
   `grep -rn "Sort by\|aria-sort" app components` on `main` returns only comments asserting their
   absence. Metadata and behaviour agreeing is the proof; either alone is not.

**Consequence that decided a real call:** with the DB freshly wiped and a 20-analysis credit budget
approved, I held the spend to **0**. #259 is a **write-path and prompt-path** fix (a thin reel
payload was classified as an image post, storing a follower-denominated tier-1 ratio *and* telling
Gemini `hasVideo: false`). Combined with the settled rulings **"no backfill / no recompute"** and
**"never delete analyses to fix a bug"**, any row written by the stale build is permanently
unrepairable. **Rule: never spend credits against a build that is behind `main` on the write path —
redeploy first.** The wiped-DB test window does not expire; the money does.

Related: [[verify-the-brief]], [[owner-preferences]], [[project-production-data-and-qa]].
