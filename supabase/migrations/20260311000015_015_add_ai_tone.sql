-- =============================================================
-- Sentimind: Add AI tone preference to user_profiles
-- Run order: 015
-- =============================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS ai_tone VARCHAR(20)
  CHECK (ai_tone IN ('warm', 'professional', 'friendly', 'poetic'))
  DEFAULT 'warm';

COMMENT ON COLUMN public.user_profiles.ai_tone IS 'AI response tone preference: warm(default), professional, friendly, poetic';
