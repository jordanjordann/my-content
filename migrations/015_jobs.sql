BEGIN TRANSACTION;

-- Ticket #351 / 3A-M1a (docs/planning/PLAN-3A-job-queue.md §4.4, D1, D5, R9).
--
-- The `jobs` table: Phase 3A's background job queue. This migration is
-- schema-only — no application code reads or writes this table yet
-- (#352/#353/#355/#356 build on top of it).
--
-- Migration number: `015`, not `014`. `014_profile_lookup_failure.sql`
-- (#291) is already merged and on disk; the governing TDD's `014` mentions
-- predate that merge and are stale (plan D1). The number is fixed by the
-- plan, not picked at implementation time (plan §15's own rule).
--
-- Two design decisions this migration must NOT "improve" on a future pass:
--
-- 1. `max_attempts` DEFAULT is `1`, not `3`. Owner ruling 2026-09-09
--    (plan Q1/R3): every attempt spends real ScrapeCreators + Gemini
--    credits, and there is no `credits_charged` tracking to notice a wasted
--    retry — the field exists only as a discarded ScrapeCreators response
--    field (`lib/server/scrapecreators/types.ts:206`). Multi-attempt retry
--    is a documented FUTURE prerequisite gated on spend tracking; it is not
--    part of 3A. The column stays so the knob exists for later.
--
-- 2. `analysis_id` carries NO foreign key to `analyses(id)`. The pipeline
--    (`lib/server/analysis/pipeline/index.ts:616-623`) runs
--    `DELETE FROM analyses WHERE id = ?` on the new-analysis failure path.
--    A real FK would either block that delete or, with `ON DELETE SET
--    NULL`, erase the only forensic link between a failed job and the
--    analysis it was working on. Kept as a plain nullable TEXT column,
--    populated when known; `last_error` is the forensic record instead
--    (plan D5/R9, owner ruling Q3 — the DELETE itself is kept as-is).
--
-- `progress_step` / `progress_message` ship in this migration even though
-- nothing writes them until the SSE ticket (#358) — one migration, not two
-- (plan §4.4 point 3).
--
-- Literal `BEGIN TRANSACTION;` / `COMMIT;` pair, per `scripts/migrate.ts`'s
-- transaction-stripping guard (#307): a block opened with bare `BEGIN;` or
-- closed with `END;` is not recognized by the stripper.
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK(kind IN ('analysis')),
  status       TEXT NOT NULL CHECK(status IN ('queued','claimed','running','succeeded','failed','dead')),
  payload      TEXT NOT NULL,
  dedupe_key   TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  claimed_at   TEXT,
  claimed_by   TEXT,
  heartbeat_at TEXT,
  last_error   TEXT,
  analysis_id  TEXT,
  progress_step    TEXT,
  progress_message TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Idempotency: only one live (queued/claimed/running) job per dedupe key.
-- Once a job reaches a terminal state (succeeded/failed/dead) the same key
-- is free to be reused by a fresh enqueue.
CREATE UNIQUE INDEX idx_jobs_dedupe ON jobs(dedupe_key)
  WHERE status IN ('queued','claimed','running');
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX idx_jobs_heartbeat ON jobs(status, heartbeat_at);

COMMIT;
