BEGIN TRANSACTION;

ALTER TABLE analyses ADD COLUMN url TEXT;
ALTER TABLE analyses ADD COLUMN platform TEXT CHECK(platform IN ('instagram', 'youtube'));
ALTER TABLE analyses ADD COLUMN media_type TEXT CHECK(media_type IN ('reel', 'post', 'carousel', 'short'));
ALTER TABLE analyses ADD COLUMN username TEXT;
ALTER TABLE analyses ADD COLUMN thumbnail_url TEXT;
ALTER TABLE analyses ADD COLUMN video_url TEXT;
ALTER TABLE analyses ADD COLUMN duration_sec INTEGER;
ALTER TABLE analyses ADD COLUMN view_count INTEGER;
ALTER TABLE analyses ADD COLUMN post_date TEXT;
ALTER TABLE analyses ADD COLUMN caption TEXT;
ALTER TABLE analyses ADD COLUMN gemini_file_uri TEXT;
ALTER TABLE analyses ADD COLUMN gemini_file_expires_at TEXT;
ALTER TABLE analyses ADD COLUMN result_content TEXT;
ALTER TABLE analyses ADD COLUMN result_created_at TEXT;

UPDATE analyses
SET
  url = (SELECT url FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  platform = (SELECT platform FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  media_type = (SELECT media_type FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  username = (SELECT username FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  thumbnail_url = (SELECT thumbnail_url FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  video_url = (SELECT video_url FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  duration_sec = (SELECT duration_sec FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  view_count = (SELECT view_count FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  post_date = (SELECT post_date FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  caption = (SELECT caption FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  gemini_file_uri = (SELECT gemini_file_uri FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  gemini_file_expires_at = (SELECT gemini_file_expires_at FROM content_items WHERE analysis_id = analyses.id ORDER BY created_at ASC LIMIT 1),
  result_content = (
    SELECT CASE
      WHEN json_valid(content) THEN json_object(
        'overallScore', json_extract(content, '$.overallScore'),
        'summary', json_extract(content, '$.summary'),
        'strengths', COALESCE(json_extract(content, '$.strengths'), json_extract(content, '$.perItem[0].strengths'), json('[]')),
        'weaknesses', COALESCE(json_extract(content, '$.weaknesses'), json_extract(content, '$.perItem[0].weaknesses'), json('[]')),
        'keyMoments', COALESCE(json_extract(content, '$.keyMoments'), json_extract(content, '$.perItem[0].keyMoments'), json('[]')),
        'scorecard', json_extract(content, '$.scorecard'),
        'patterns', json_extract(content, '$.patterns'),
        'suggestions', COALESCE(json_extract(content, '$.suggestions'), json('[]'))
      )
      ELSE content
    END
    FROM analysis_results
    WHERE analysis_id = analyses.id
    ORDER BY created_at ASC
    LIMIT 1
  ),
  result_created_at = (
    SELECT created_at FROM analysis_results
    WHERE analysis_id = analyses.id
    ORDER BY created_at ASC
    LIMIT 1
  );

DROP TABLE analysis_results;
DROP TABLE content_items;

CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_platform ON analyses(platform);

COMMIT;
