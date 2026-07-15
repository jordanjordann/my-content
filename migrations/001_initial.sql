CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
  id              TEXT PRIMARY KEY,
  prompt          TEXT NOT NULL,
  raw_gemini      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_items (
  id              TEXT PRIMARY KEY,
  analysis_id     TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK(platform IN ('instagram', 'youtube')),
  media_type      TEXT NOT NULL CHECK(media_type IN ('reel', 'post', 'carousel', 'short')),
  username        TEXT NOT NULL,
  thumbnail_url   TEXT,
  video_url       TEXT,
  duration_sec    INTEGER,
  view_count      INTEGER,
  post_date       TEXT,
  caption         TEXT,
  gemini_file_uri TEXT,
  gemini_file_expires_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id              TEXT PRIMARY KEY,
  analysis_id     TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analyses_updated_at ON analyses(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_analysis_id ON content_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_content_items_username ON content_items(username);
