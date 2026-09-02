---
name: partial-insert-default-trap
description: When a PR claims "this write does NOT touch column X", check the CREATE TABLE DEFAULT for every column the INSERT omits — the ON CONFLICT branch and the INSERT branch usually disagree
metadata:
  type: feedback
---

Whenever a PR adds a write that claims to leave a column alone ("records the failure without
pretending it succeeded", "never bumps `last_fetched_at`"), read the **`CREATE TABLE`** for every
column the new `INSERT` omits. An `INSERT ... ON CONFLICT DO UPDATE` has two branches and they
almost always disagree: the UPDATE branch really does leave the column alone, while the INSERT
branch silently fills it from `DEFAULT (datetime('now'))`.

**Why:** PR #302 (#291) added `recordProfileLookupFailure`, whose doc comment, PR body and migration
comment all stated it does not bump `last_fetched_at`. True on UPDATE; false on INSERT, because
migration 006 declares `last_fetched_at TEXT NOT NULL DEFAULT (datetime('now'))`. The first-failure
row — the exact case the ticket is about — was therefore created looking 7-day-fresh, which is the
same "unknown persisted as a fact" anti-pattern the PR was written to avoid. The test asserted
`follower_count` and the new marker column but never the freshness column, so nothing caught it.

**How to apply:** on any diff touching `migrations/` plus a repository write, diff the INSERT's
column list against the table definition. Ask two follow-ups: (a) which other readers consume the
defaulted column — on #302 `pipeline/index.ts` copies `profile.lastFetchedAt` verbatim into the
persisted `audienceSourceFetchedAt`, so a failed lookup's timestamp becomes a recorded
"audience source fetched at"; and (b) does returning a previously-`null` row now populate a
foreign key that gates something downstream (`profile_id` is one of the four live-comparator gate
conditions in `baseline.ts` — see [[project-performance-read-model]] §4).

Related: [[review-conduct]], [[verify-the-brief]], [[mutation-proof-playbook]].
