# Ticket #246 — Railway/Turso deploy: live infra inventory + CI-deploy ruling (2026-08-20)

## Why this file exists
#246 originally scoped four steps (Turso DB, Railway service, `railway.json` pre-deploy
migrations, CI auto-deploy). By the time this session picked it up, **three of the four
were already done** and the fourth was **declined by the owner**. This file is the
canonical record so no future agent re-derives the infra or re-proposes CI auto-deploy.

## Live infrastructure (read-only verified, 2026-08-20)

- **Railway** project **`lasa`** (`00be74f5-bae8-4a5f-b41c-ef60eaee187e`), environment
  `production`, service **`my-content`** (`5892fda5-b609-4d5f-97d5-6725bbce54f9`),
  status **● Online**, region **Southeast Asia** (`asia-southeast1-eqsg3a`, Singapore),
  repo `jordanjordann/my-content`, URL `https://my-content-production-e63b.up.railway.app`
  (307 on plain GET — that's the app's own auth redirect, not a failure).
- **Turso** database **`lasa`** (not `my-content` — see correction below), group
  `default`, `libsql://lasa-jordanathaa.aws-ap-northeast-1.turso.io` — **Tokyo**
  (`aws-ap-northeast-1`). `SELECT count(*) FROM _migrations` = 13/13. `analyses` row
  count grows over time (was 12 on 2026-08-20) — don't hardcode it as a fact.
- Region choice (Singapore Railway + Tokyo Turso) matches TDD §11.2c's decision exactly.
- `railway.json` (repo root) ships `preDeployCommand: "npx tsx scripts/migrate.ts"`,
  `healthcheckPath: "/auth/pin"`, `restartPolicyType: "ON_FAILURE"` — shipped in PR #250
  (merged `0cd97ce`, 2026-08-18), verified in the built runner image (apply-13 / no-op /
  broken-migration-fails). **This is why `_migrations` already reads 13/13 in prod** — a
  real deploy has already run the pre-deploy command successfully.

## Correction to #246's own "DECIDED, 2026-08-18" import section
That section's procedure said to `turso db create --from-file` a **new** database named
`my-content`. **That is not what happened.** `turso db list` on 2026-08-20 shows only
`lasa` — the owner imported into (or reused) the pre-existing empty `lasa` database
directly. The section's *reasoning* (import > fresh start, `_migrations` no-op safety,
PIN-carryover caveat) is still sound; only the target DB name differs from the plan.
**There is no `my-content` Turso database. Don't go looking for one.**

## Owner ruling — CI auto-deploy is DECLINED, not merely deferred
The owner wants deploys to stay **manual**. Do not add any `railway up` / deploy job to
`.github/workflows/`. Confirmed zero `railway` references in `.github/workflows/*.yml`
as of 2026-08-20. This is a standing ruling, same tier as "no retry" / "no migrations" —
do not re-propose a CI deploy step in a future session on this or any related ticket.

`RAILWAY_TOKEN` GitHub repo secret exists (created 2026-08-19) but is unused and must
stay unused for CI. Its project-vs-account scope was never resolved and no longer
matters since it won't be wired into automation.

## Net effect
#246 was closed with no code PR — everything actionable was already shipped or declined
by the time this session ran read-only verification. The only edit made was re-scoping
and closing the GitHub issue itself (`gh issue edit` / `gh issue close`), not a repo
commit. If a future ticket needs `docs/RUNBOOK.md` §3a's Turso-import note or a backup
policy, those are still open, unclaimed follow-ups (flagged inside #246, never
promoted to their own ticket as of 2026-08-20).
