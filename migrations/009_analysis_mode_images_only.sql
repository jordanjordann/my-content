BEGIN TRANSACTION;

-- Ticket #71 (TDD §7, PRD §7). Two changes bundled into one rebuild because
-- SQLite cannot ALTER a CHECK constraint in place — any change to
-- `analysis_mode`'s allowed values requires recreating the table, and once
-- that rebuild is happening the `play_count` column (Q4=(c), see below)
-- rides along for free rather than forcing a second full-table rebuild
-- later (see the ticket's owner-decision comment thread, 2026-07-22).
--
-- 1. `analysis_mode` CHECK widens from ('full_video','metadata_only') to
--    ('full_video','images_only','metadata_only'). An all-image carousel
--    whose slides are actually sent to Gemini is neither of the two
--    existing values — persisting it as 'metadata_only' would repeat the
--    exact defect the roadmap names (a caption-only guess rendering
--    identically to a real analysis). Assignment (pipeline-side, ticket
--    #71): any video part -> 'full_video'; no video but >=1 image part ->
--    'images_only'; no media at all -> 'metadata_only'.
--
-- 2. `play_count INTEGER` (nullable) is added. `view_count` already exists
--    (001_initial.sql) and is unchanged in meaning: it now consistently
--    holds `video_view_count` for every media type (reel or carousel
--    slide), never `video_play_count`. `play_count` is the only new
--    column — Q4's "two persisted count columns" framing was corrected by
--    the owner (2026-07-22): `view_count` needed no new column, only
--    `play_count` did. Backfill for existing rows is NULL (unknown),
--    never 0 — a 0 backfill would be indistinguishable from a genuine
--    zero-play post (the same trap as `like_and_view_counts_disabled`,
--    C8), and historical play counts cannot be recovered after the fact.
--
-- Table rebuild follows the 005 pattern: reproduces every column added by
-- 001-008 and every index created by 001/003/005/006/007 verbatim, so no
-- column or index is silently dropped.

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
  engagement_rate        REAL,
  analysis_mode          TEXT CHECK(analysis_mode IN ('full_video', 'images_only', 'metadata_only')),
  schema_version         INTEGER,
  play_count             INTEGER
);

INSERT INTO analyses_new (
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at, like_count, comment_count, has_audio,
  audio_title, audio_artist, audio_id, audio_is_original, original_width,
  original_height, carousel_item_count, profile_id, follower_count,
  engagement_rate, analysis_mode, schema_version, play_count
)
SELECT
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at, like_count, comment_count, has_audio,
  audio_title, audio_artist, audio_id, audio_is_original, original_width,
  original_height, carousel_item_count, profile_id, follower_count,
  engagement_rate, analysis_mode, schema_version, NULL
FROM analyses;

DROP TABLE analyses;
ALTER TABLE analyses_new RENAME TO analyses;

CREATE INDEX idx_analyses_updated_at ON analyses(updated_at DESC);
CREATE INDEX idx_analyses_title ON analyses(title);
CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_platform ON analyses(platform);
CREATE INDEX idx_analyses_profile_id ON analyses(profile_id);
CREATE INDEX idx_analyses_schema_version ON analyses(schema_version);

COMMIT;
