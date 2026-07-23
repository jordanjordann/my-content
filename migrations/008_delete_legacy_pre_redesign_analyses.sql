BEGIN TRANSACTION;

-- TDD §3.3, §8.2; PRD §9. Migration 007 added schema_version but did not
-- backfill existing rows, leaving pre-redesign (old-shape) analyses with
-- schema_version NULL. Those rows carry the old contract: a 1-10
-- overallScore and a scorecard shape that doesn't match the new
-- Scorecard/1-5-scale type the read API (app/api/analyses/route.ts) now
-- returns. Rather than adding schema-version gating/filtering to the read
-- path to handle two incompatible row shapes, the DB is effectively empty
-- (1-2 legacy rows per the RUNBOOK/handoff docs), so we delete the legacy
-- rows outright and start clean on the new schema.
DELETE FROM analyses WHERE schema_version IS NULL;

COMMIT;
