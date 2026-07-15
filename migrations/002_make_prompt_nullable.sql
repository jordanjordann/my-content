BEGIN TRANSACTION;

CREATE TABLE analyses_new (
  id              TEXT PRIMARY KEY,
  prompt          TEXT,
  raw_gemini      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO analyses_new (id, prompt, raw_gemini, status, created_at, updated_at)
SELECT id, prompt, raw_gemini, status, created_at, updated_at FROM analyses;

DROP TABLE analyses;

ALTER TABLE analyses_new RENAME TO analyses;

CREATE INDEX idx_analyses_updated_at ON analyses(updated_at DESC);

COMMIT;
