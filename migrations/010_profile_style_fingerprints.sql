BEGIN TRANSACTION;

-- Ticket #72 (TDD §6.1, PRD §6.1). A new, SEPARATE table from `profiles` —
-- `profiles` holds scraped facts (follower count, bio, ...); this table
-- holds INFERENCE (an aggregation over a creator's own analysed videos).
-- The owner named mixing facts and inference in one table/row as the
-- failure pattern to avoid (the nullable-boolean coercion bug, where an
-- "unknown" silently became a wrong concrete value) — keeping this table
-- apart means a fingerprint recompute can never corrupt a scraped fact and
-- vice versa.
--
-- `computed` and `overrides` are deliberately two separate JSON columns,
-- not one merged blob. The fingerprint must be both (a) recomputed as new
-- analyses land, and (b) human-editable, with corrections improving future
-- generations. A single merged column cannot do both — the next recompute
-- would silently overwrite an agency's manual correction, which is exactly
-- the "unknown silently became a wrong concrete value" failure class this
-- table exists to avoid. Read-time merge (`getFingerprint()`, see
-- lib/server/fingerprint/repository.ts) does `{...computed, ...overrides}`
-- per top-level key, so recompute is idempotent with respect to any human
-- input already stored in `overrides`.
--
-- `fingerprint_version` (the aggregation algorithm) is versioned separately
-- from `schema_version` (the source analysis contract version this
-- fingerprint was computed over) — they change independently, and
-- conflating them would force a needless full recompute whenever either one
-- moves.
--
-- No `is_stale` flag: `sample_size` + `source_analysis_ids` already answer
-- "is this current?" (compare against a fresh count/id-set of qualifying
-- analyses) — a denormalised boolean would be a second source of truth that
-- can only ever drift from the data it's supposed to describe.
CREATE TABLE IF NOT EXISTS profile_style_fingerprints (
  id                    TEXT PRIMARY KEY,
  profile_id            TEXT NOT NULL REFERENCES profiles(id),
  fingerprint_version   INTEGER NOT NULL,
  schema_version        INTEGER NOT NULL,
  sample_size           INTEGER NOT NULL,
  source_analysis_ids   TEXT NOT NULL,
  computed              TEXT NOT NULL,
  overrides             TEXT,
  consistency_index     REAL NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One fingerprint row per profile (UNIQUE), enforced via an explicit index
-- rather than an inline column constraint, matching the `profiles` table's
-- own (platform, username) uniqueness convention (006).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_style_fingerprints_profile_id
  ON profile_style_fingerprints(profile_id);

COMMIT;
