ALTER TABLE analyses ADD COLUMN title TEXT;

CREATE INDEX idx_analyses_title ON analyses(title);
