BEGIN TRANSACTION;

-- Ticket #73 sub-ticket A (TDD `docs/archive/specs/TDD-fingerprint-read-override-api.md` §3 D2).
-- `computed_at` records when `computed`/`consistency_index` were last
-- (re)computed by `upsertFingerprint` — a fact distinct from `updated_at`,
-- which also moves on a human-only `PATCH` via `patchFingerprintOverrides`.
-- Without this column, the only candidates for a `computedAt` API field are
-- `created_at` (first-ever compute only) or `updated_at` (wrong the moment
-- anyone edits an override) — both fabricate a value the row doesn't
-- actually know, the exact failure class migration 010's design comment
-- exists to prevent.
--
-- Nullable, no default: `ALTER TABLE ... ADD COLUMN` in SQLite cannot take a
-- non-constant default such as `datetime('now')`, and cannot add `NOT NULL`
-- without one. Existing rows are backfilled below with their current
-- `updated_at` (the best available proxy for "last known compute time" on a
-- pre-migration row); `mapRow` in repository.ts additionally reads
-- `row.computed_at ?? row.updated_at` so a row somehow missed by the
-- backfill can never surface a `null` computedAt.
--
-- Written ONLY by `upsertFingerprint` (both the INSERT list and the
-- `ON CONFLICT ... SET` list) — the overrides writer (`setFingerprintOverrides`
-- / `patchFingerprintOverrides`) must never touch this column, matching how
-- `overrides` itself is excluded from `upsertFingerprint`'s SET list.
ALTER TABLE profile_style_fingerprints ADD COLUMN computed_at TEXT;

UPDATE profile_style_fingerprints SET computed_at = updated_at;

COMMIT;
