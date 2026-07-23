BEGIN TRANSACTION;

-- TDD §3.3, §10; PRD §9. Versions the analysis result contract on the row
-- itself so the fingerprint (#71) can filter its source corpus with a plain
-- indexed WHERE instead of json_extract on every row.
--
-- Additive only, no backfill: the existing rows carry the old (pre-redesign)
-- contract and stay NULL, which reads as "version 1" by convention (see
-- lib/server/analysis/schema/constants.ts). The pipeline stamps
-- ANALYSIS_SCHEMA_VERSION (currently 2) on every analysis going forward, in
-- both this column and $.schemaVersion inside result_content.
ALTER TABLE analyses ADD COLUMN schema_version INTEGER;

CREATE INDEX IF NOT EXISTS idx_analyses_schema_version ON analyses(schema_version);

COMMIT;
