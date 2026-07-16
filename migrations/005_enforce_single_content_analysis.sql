BEGIN TRANSACTION;

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
  result_created_at      TEXT
);

INSERT INTO analyses_new (
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at
)
SELECT
  id, prompt, raw_gemini, status, created_at, updated_at, title, url,
  platform, media_type, username, thumbnail_url, video_url, duration_sec,
  view_count, post_date, caption, gemini_file_uri, gemini_file_expires_at,
  result_content, result_created_at
FROM analyses;

DROP TABLE analyses;
ALTER TABLE analyses_new RENAME TO analyses;

CREATE INDEX idx_analyses_updated_at ON analyses(updated_at DESC);
CREATE INDEX idx_analyses_title ON analyses(title);
CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_platform ON analyses(platform);

COMMIT;
