-- 009: Add user_rating column to entries table
-- Stores user feedback on AI analysis quality ('helpful' or 'not_helpful')

ALTER TABLE entries ADD COLUMN IF NOT EXISTS user_rating TEXT CHECK (user_rating IN ('helpful', 'not_helpful'));
