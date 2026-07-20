BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS profiles (
  id                  TEXT PRIMARY KEY,
  platform            TEXT NOT NULL CHECK(platform IN ('instagram', 'youtube')),
  username            TEXT NOT NULL,
  external_id         TEXT,
  follower_count      INTEGER,
  following_count     INTEGER,
  full_name           TEXT,
  profile_pic_url     TEXT,
  biography           TEXT,
  is_verified         INTEGER,
  is_business_account INTEGER,
  is_private          INTEGER,
  raw_payload         TEXT,
  last_fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_platform_username
  ON profiles(platform, username);
CREATE INDEX IF NOT EXISTS idx_profiles_platform_external_id
  ON profiles(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_fetched_at
  ON profiles(last_fetched_at);

ALTER TABLE analyses ADD COLUMN like_count          INTEGER;
ALTER TABLE analyses ADD COLUMN comment_count       INTEGER;
ALTER TABLE analyses ADD COLUMN has_audio           INTEGER;
ALTER TABLE analyses ADD COLUMN audio_title         TEXT;
ALTER TABLE analyses ADD COLUMN audio_artist        TEXT;
ALTER TABLE analyses ADD COLUMN audio_id            TEXT;
ALTER TABLE analyses ADD COLUMN audio_is_original   INTEGER;
ALTER TABLE analyses ADD COLUMN original_width      INTEGER;
ALTER TABLE analyses ADD COLUMN original_height     INTEGER;
ALTER TABLE analyses ADD COLUMN carousel_item_count INTEGER;
ALTER TABLE analyses ADD COLUMN profile_id          TEXT REFERENCES profiles(id);
ALTER TABLE analyses ADD COLUMN follower_count      INTEGER;
ALTER TABLE analyses ADD COLUMN engagement_rate     REAL;

-- Distinguishes a genuine full video analysis from an intentional
-- metadata-only analysis (image post / carousel with no video slide).
-- Both would otherwise persist identically as status = 'completed' with
-- a NULL gemini_file_uri, making it impossible to tell "no video existed"
-- apart from "a video existed" downstream. There is no third, degraded
-- persisted state: if a video was expected (videoUrl resolved non-null)
-- but download or Gemini upload fails, the analysis fails outright and
-- no row survives to be marked with an analysis_mode at all (see the
-- pipeline's existing "content not found" failure convention). NULL is
-- allowed only for rows that predate this column (pre-existing
-- analyses); the pipeline always sets one of the two values going
-- forward.
ALTER TABLE analyses ADD COLUMN analysis_mode TEXT
  CHECK(analysis_mode IN ('full_video', 'metadata_only'));

CREATE INDEX IF NOT EXISTS idx_analyses_profile_id ON analyses(profile_id);

COMMIT;
