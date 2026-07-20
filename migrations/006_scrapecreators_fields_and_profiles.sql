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

CREATE INDEX IF NOT EXISTS idx_analyses_profile_id ON analyses(profile_id);

COMMIT;
