-- 011: Add activity_tags column to entries
-- Activity tags for emotion-activity correlation analysis

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS activity_tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN entries.activity_tags IS 'User-selected activity tags (e.g. ["운동","독서","산책"])';
