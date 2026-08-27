BEGIN TRANSACTION;

-- Ticket 3B-1 / #139 (TDD docs/TDD-3A-3B-3C-phase-3.md §1.1, §5, OR-12).
--
-- Two things land in this migration:
--
-- 1. `engagement_rate` is DROPPED (D10). This is a bug fix, not cleanup:
--    the column fed a follower-denominated ratio into the Gemini prompt
--    under the bare, unqualified label "Engagement rate" on every content
--    type — a live R-12.3.1 violation (TDD §1.1). The FUNCTION that
--    computed it (`computeEngagementRate`, formerly
--    `lib/server/profiles/helpers.ts`) is relocated, not deleted, to
--    `lib/server/analysis/performance/ratios.ts` as 3B's follower-
--    denominated Tier 1 primitive (OR-12) — nothing in this migration
--    concerns the function, only the column.
--
-- 2. The performance-block schema (TDD §5.2) is added: reach + kind +
--    derivedFrom, Tier 1 ratio + its required denominator, Tier 2 bucket/
--    baseline/multiplier, post age, the audience snapshot's own staleness
--    timestamp (`audience_source_fetched_at` — §1.3, copied from
--    `profiles.last_fetched_at` at analysis write time because that
--    profile-level value is overwritten on the next refresh and a
--    completed analysis would otherwise be unable to recover how stale
--    its own denominator was), the tier/confidence/provisional/
--    unavailable-reason judgement fields computed in code (OR-13), and
--    `performance_score` PROMOTED to a real column — 3C paginates
--    server-side (OR-8) and a `json_extract` sort is not viable.
--
--    NOTE (flagged in ticket #139's PR, not silently corrected): the TDD
--    header and the ticket both say "drop 1, add 14 (39 -> 52 columns)".
--    The actual §5.2 table lists 17 distinct new column names (not 14),
--    which the rest of the TDD depends on by name in multiple other
--    sections (§4's `perf_confidence_reason`, §6's `perf_tier1_ratio`/
--    `perf_reach_value`, §7's full computed-block shape, §9.1's `ⓘ`
--    tooltip fields). The per-column table, not the summary arithmetic, is
--    treated as authoritative here — 38 (39 - 1) + 17 = 55 columns, not
--    52. See the PR description for the full accounting.
--
-- Repo convention is additive-only, no down-migrations (RUNBOOK §4). D10
-- requires a drop, so — following the 009 precedent — this is a FULL
-- TABLE REBUILD rather than an in-place `ALTER TABLE ... DROP COLUMN`,
-- which keeps `tests/server/db/migrations.schema.test.ts`'s positional
-- insert/copy column-list assertion meaningful for future rebuilds.
--
-- Existing analyses are DELETED, not migrated forward (owner ruling, no
-- backward compatibility — recorded in ticket #139). They cannot carry a
-- meaningful value for any of the new perf_* columns, and the
-- ANALYSIS_SCHEMA_VERSION bump (2 -> 3, lib/server/analysis/schema) makes
-- them unreadable by the fingerprint engine's schema_version filter
-- regardless. `profile_style_fingerprints` has 0 rows today, so nothing
-- downstream is destroyed — the fingerprint engine simply cold-starts
-- until 5 new schema-3 analyses exist per profile (TDD §1.2, accepted
-- consequence, not a bug). The DELETE below runs before the rebuild so the
-- copy-forward statement further down — kept for positional-alignment
-- symmetry with the 009 test pattern — genuinely moves zero rows, matching
-- TDD §5.1's own description ("the copy moves nothing").
--
-- PR #305 review (issue #277 follow-up) — guarded, not unconditional:
--
-- `_migrations` is keyed by filename. Atomicity (this same PR) closes the
-- CRASH window between a migration body and its tracking row, but not the
-- RENAME window: renaming this file, or losing/restoring `_migrations` to
-- a pre-012 state, makes the runner treat this file as brand-new and
-- re-apply it — atomically and durably committing this DELETE against a
-- since-repopulated, real `analyses` table. `schema_version` was added in
-- 007 and is stamped on every row; every row that existed BEFORE this
-- migration first ran carries `schema_version` 2 or NULL (2 is "current"
-- per 007's own comment; NULL is pre-007 legacy). Every row the pipeline
-- writes AFTER this migration first ran carries `schema_version` 3 (the
-- bump noted above) and depends on the `perf_*` columns this file is
-- about to create seconds from now on a first run — deleting a
-- schema_version-3 row would destroy a real, paid-for, already-migrated
-- analysis.
--
-- On a genuine first application, no row has `schema_version` 3 yet (that
-- value does not exist anywhere until this migration's own CREATE TABLE
-- below ships it for the first time), so `schema_version IS NULL OR
-- schema_version < 3` matches every existing row — byte-identical in
-- effect to the unconditional form. On a forced re-run, only true
-- schema-3 survivors are preserved.
--
-- Interaction with #278's checksum (same PR): this edit changes this
-- file's on-disk content, but every environment's `_migrations` row for
-- this filename is a legacy row (checksum NULL) until the first deploy
-- after this PR merges. Per `runMigrations`'s adopt-on-first-sight policy,
-- a NULL stored checksum is adopted from the current on-disk file, never
-- compared — so this edit lands in the same deploy that starts
-- checksum-tracking it, with no checksum collision and no re-execution.
DELETE FROM analyses WHERE schema_version IS NULL OR schema_version < 3;

CREATE TABLE analyses_new (
  id                     TEXT PRIMARY KEY,
  prompt                 TEXT,
  raw_gemini             TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  title                  TEXT,
  url                    TEXT NOT NULL,
  platform               TEXT NOT NULL CHECK(platform IN ('instagram', 'youtube')),
  media_type             TEXT NOT NULL CHECK(media_type IN ('reel', 'post', 'carousel', 'short')),
  username               TEXT,
  thumbnail_url          TEXT,
  video_url              TEXT,
  duration_sec           INTEGER,
  view_count             INTEGER,
  post_date              TEXT,
  caption                TEXT,
  gemini_file_uri        TEXT,
  gemini_file_expires_at TEXT,
  result_content         TEXT,
  result_created_at      TEXT,
  like_count             INTEGER,
  comment_count          INTEGER,
  has_audio              INTEGER,
  audio_title            TEXT,
  audio_artist           TEXT,
  audio_id               TEXT,
  audio_is_original      INTEGER,
  original_width         INTEGER,
  original_height        INTEGER,
  carousel_item_count    INTEGER,
  profile_id             TEXT REFERENCES profiles(id),
  follower_count         INTEGER,
  analysis_mode          TEXT CHECK(analysis_mode IN ('full_video', 'images_only', 'metadata_only')),
  schema_version         INTEGER,
  play_count             INTEGER,
  coauthor_producers     TEXT,
  like_and_view_counts_disabled INTEGER,
  -- --- Performance block (TDD §5.2) — new in this migration ---
  perf_reach_value       INTEGER,
  perf_reach_kind        TEXT CHECK(perf_reach_kind IS NULL OR perf_reach_kind IN ('PLAYS', 'VIEWS', 'UNKNOWN')),
  -- Enum per TDD §5.2's per-column table and §6's `derivedFrom` type union
  -- (`"TOP_LEVEL" | "CAROUSEL_FIRST_SLIDE" | "NONE"`). Single-column guard
  -- (reviewer-verified safe form) — see the `perf_tier1_denominator` comment
  -- below for why cross-column guards are the unsafe form.
  perf_reach_derived_from TEXT CHECK(perf_reach_derived_from IS NULL OR perf_reach_derived_from IN ('TOP_LEVEL', 'CAROUSEL_FIRST_SLIDE', 'NONE')),
  perf_tier1_ratio        REAL,
  -- R-12.2.2: a ratio without a denominator is a constraint violation, not
  -- a lint (ticket #139 implementation step 3). Two independent conditions
  -- are ANDed together, not chained as a single OR-shortcut:
  --   1. Whenever perf_tier1_denominator IS NOT NULL, it must be one of the
  --      enum values. This holds regardless of perf_tier1_ratio, so a NULL
  --      ratio (the common path — image-only content never has a Tier 1
  --      ratio) does NOT exempt the denominator column from enum
  --      enforcement.
  --   2. Whenever perf_tier1_ratio IS NOT NULL, perf_tier1_denominator must
  --      be NOT NULL.
  -- An earlier version of this constraint short-circuited on
  -- `perf_tier1_ratio IS NULL` (via `... IS NULL OR (denominator IS NOT
  -- NULL AND denominator IN (...))`), which accepted
  -- `(NULL, 'BOGUS')` — the ratio being absent silently waived the enum
  -- check on the denominator. That is the single highest-severity path
  -- here because a NULL ratio is the common case, not an edge case. The
  -- form below rejects `(NULL, 'BOGUS')` because condition 1 fails
  -- independent of the ratio's value (verified against a live `:memory:`
  -- insert before writing this comment).
  perf_tier1_denominator  TEXT CHECK(
    (perf_tier1_denominator IS NULL OR perf_tier1_denominator IN ('REACH', 'FOLLOWERS'))
    AND (perf_tier1_ratio IS NULL OR perf_tier1_denominator IS NOT NULL)
  ),
  perf_bucket_key         TEXT,
  perf_baseline_median    REAL,
  perf_baseline_sample_size INTEGER,
  perf_multiplier         REAL,
  perf_post_age_hours     INTEGER,
  audience_source_fetched_at TEXT,
  -- Enum per TDD §5.2 + PRD §5.2 (OR-13): CREATOR_BASELINE / REACH_ONLY /
  -- AUDIENCE_FALLBACK / UNAVAILABLE. Single-column guard.
  perf_tier_used          TEXT CHECK(perf_tier_used IS NULL OR perf_tier_used IN ('CREATOR_BASELINE', 'REACH_ONLY', 'AUDIENCE_FALLBACK', 'UNAVAILABLE')),
  -- Enum per TDD §5.2 + PRD §5.2 (OR-13): HIGH / MEDIUM / LOW / NONE.
  -- Also matches the confidence ladder in TDD §4. Single-column guard.
  perf_confidence         TEXT CHECK(perf_confidence IS NULL OR perf_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  -- Enum per TDD §5.2: CACHED_FOLLOWER_DENOMINATOR / CAROUSEL_FIRST_SLIDE /
  -- THIN_SAMPLE — the "three enumerated demotion reasons" TDD §4 / PRD §5.2
  -- reference, one per row of the confidence ladder (TDD §4). Single-column
  -- guard.
  perf_confidence_reason  TEXT CHECK(perf_confidence_reason IS NULL OR perf_confidence_reason IN ('CACHED_FOLLOWER_DENOMINATOR', 'CAROUSEL_FIRST_SLIDE', 'THIN_SAMPLE')),
  perf_provisional        INTEGER,
  -- Enum per TDD §5.3: REACH_HIDDEN / REACH_UNKNOWN / CONTENT_KIND_UNSUPPORTED
  -- / NO_AUDIENCE_DATA / INSUFFICIENT_HISTORY / CAUSE_NOT_DETERMINABLE
  -- (corroborated by PRD §13.5.1/§13.5.3a). Single-column guard.
  perf_unavailable_reason TEXT CHECK(perf_unavailable_reason IS NULL OR perf_unavailable_reason IN ('REACH_HIDDEN', 'REACH_UNKNOWN', 'CONTENT_KIND_UNSUPPORTED', 'NO_AUDIENCE_DATA', 'INSUFFICIENT_HISTORY', 'CAUSE_NOT_DETERMINABLE')),
  performance_score       INTEGER
);

INSERT INTO analyses_new (
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at, like_count, comment_count, has_audio,
  audio_title, audio_artist, audio_id, audio_is_original, original_width,
  original_height, carousel_item_count, profile_id, follower_count,
  analysis_mode, schema_version, play_count, coauthor_producers,
  like_and_view_counts_disabled,
  perf_reach_value, perf_reach_kind, perf_reach_derived_from,
  perf_tier1_ratio, perf_tier1_denominator, perf_bucket_key,
  perf_baseline_median, perf_baseline_sample_size, perf_multiplier,
  perf_post_age_hours, audience_source_fetched_at, perf_tier_used,
  perf_confidence, perf_confidence_reason, perf_provisional,
  perf_unavailable_reason, performance_score
)
SELECT
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at, like_count, comment_count, has_audio,
  audio_title, audio_artist, audio_id, audio_is_original, original_width,
  original_height, carousel_item_count, profile_id, follower_count,
  analysis_mode, schema_version, play_count, coauthor_producers,
  like_and_view_counts_disabled,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL
FROM analyses;

DROP TABLE analyses;
ALTER TABLE analyses_new RENAME TO analyses;

CREATE INDEX idx_analyses_updated_at ON analyses(updated_at DESC);
CREATE INDEX idx_analyses_title ON analyses(title);
CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_platform ON analyses(platform);
CREATE INDEX idx_analyses_profile_id ON analyses(profile_id);
CREATE INDEX idx_analyses_schema_version ON analyses(schema_version);
CREATE INDEX idx_analyses_profile_bucket ON analyses(profile_id, perf_bucket_key, status);
CREATE INDEX idx_analyses_performance_score ON analyses(performance_score);

COMMIT;
