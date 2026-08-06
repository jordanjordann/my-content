BEGIN TRANSACTION;

-- Ticket 3B-7 / #155 (TDD docs/TDD-3A-3B-3C-phase-3.md §3.1, §5.3, §0 OR-26).
--
-- `perf_reach_derived_from = 'NONE'` currently overloads two different
-- facts: (1) no node in the post carries a reach field at all (permanent,
-- honest to report as "this post type doesn't report counts"), and (2)
-- carousel slide 0 carries neither reach key but a LATER slide does — the
-- post has real reach data that D4's first-slide rule never consulted
-- (not permanent, and reporting it the same way as case 1 is a fabricated
-- diagnosis, R-13.5.3a). Code review on PR #152 raised this; OR-26 is the
-- resolution.
--
-- The fix is a SEVENTH value on `perf_unavailable_reason`,
-- `REACH_NOT_ON_FIRST_SLIDE` — a `why`, not a `where-from`.
-- `perf_reach_derived_from` is UNCHANGED: it keeps its original three
-- values ('TOP_LEVEL', 'CAROUSEL_FIRST_SLIDE', 'NONE'). `derivedFrom`
-- answers where the number came from; with no number, `NONE` remains the
-- complete and correct answer to that question. Only `perf_unavailable_reason`
-- gains the new enum member.
--
-- Migration 012 (#139/PR #151) is already merged and its `CHECK` is live.
-- SQLite cannot ALTER a CHECK constraint in place, so — following the
-- 009/012 precedent — this is a FULL TABLE REBUILD, not an
-- `ALTER TABLE ... ADD CONSTRAINT`. All 55 columns and all 8 indexes are
-- reproduced verbatim from 012; the ONLY textual difference in the
-- resulting `analyses` schema is inside the `perf_unavailable_reason`
-- CHECK.
--
-- Zero data cost: migration 012 already ran `DELETE FROM analyses` before
-- its own rebuild, so every row is already gone by the time this migration
-- runs, and `profile_style_fingerprints` has 0 rows. The copy-forward
-- INSERT below is kept anyway, for positional-alignment symmetry
-- with the 009/012 test pattern (`tests/server/db/migrations.schema.test.ts`)
-- — it moves zero rows.
--
-- `013` is taken here, not by 3A's job table, as a safety constraint: this
-- migration issues `DROP TABLE analyses`, and 3A's job table is expected to
-- carry `REFERENCES analyses(id)`. Taking `013` for this rebuild guarantees
-- the jobs table is created only after `analyses` reaches its final shape,
-- so the foreign key can never be orphaned. 3A's job table is renumbered to
-- `014_jobs.sql` (TDD §5.3, §10.2, §15).
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
  -- Enum per TDD §5.3 (OR-26 / #155 adds the seventh value,
  -- REACH_NOT_ON_FIRST_SLIDE): REACH_HIDDEN / REACH_UNKNOWN /
  -- CONTENT_KIND_UNSUPPORTED / REACH_NOT_ON_FIRST_SLIDE / NO_AUDIENCE_DATA /
  -- INSUFFICIENT_HISTORY / CAUSE_NOT_DETERMINABLE (corroborated by PRD
  -- §13.5.1/§13.5.3a). REACH_NOT_ON_FIRST_SLIDE is carousel-only: it fires
  -- when slide 0 carries neither reach key but a later slide does — the
  -- post has reach data that D4's first-slide rule did not consult, which
  -- is a different, non-permanent fact from CONTENT_KIND_UNSUPPORTED (no
  -- node in the post carries a reach field at all). Single-column guard.
  perf_unavailable_reason TEXT CHECK(perf_unavailable_reason IS NULL OR perf_unavailable_reason IN ('REACH_HIDDEN', 'REACH_UNKNOWN', 'CONTENT_KIND_UNSUPPORTED', 'REACH_NOT_ON_FIRST_SLIDE', 'NO_AUDIENCE_DATA', 'INSUFFICIENT_HISTORY', 'CAUSE_NOT_DETERMINABLE')),
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
  perf_reach_value, perf_reach_kind, perf_reach_derived_from,
  perf_tier1_ratio, perf_tier1_denominator, perf_bucket_key,
  perf_baseline_median, perf_baseline_sample_size, perf_multiplier,
  perf_post_age_hours, audience_source_fetched_at, perf_tier_used,
  perf_confidence, perf_confidence_reason, perf_provisional,
  perf_unavailable_reason, performance_score
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
