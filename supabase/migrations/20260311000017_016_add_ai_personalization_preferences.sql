-- =============================================================
-- Sentimind: Add AI personalization preferences
-- Run order: 016
-- Status: draft migration for planned feature
-- =============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS response_length VARCHAR(20)
    CHECK (response_length IN ('short', 'balanced', 'detailed'))
    DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS advice_style VARCHAR(20)
    CHECK (advice_style IN ('comfort', 'balanced', 'actionable'))
    DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS persona_preset VARCHAR(30)
    CHECK (persona_preset IN ('none', 'gentle_friend', 'calm_coach', 'clear_reflector'))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS feature_flags JSONB
    DEFAULT '{"playful_tone_enabled": false, "illustrated_diary_enabled": false}'::jsonb;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_ai_tone_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_ai_tone_check
  CHECK (ai_tone IN ('warm', 'professional', 'friendly', 'poetic', 'calm', 'direct', 'playful'));

COMMENT ON COLUMN public.user_profiles.ai_tone IS
  'AI response tone preference. Legacy values remain supported during migration.';

COMMENT ON COLUMN public.user_profiles.response_length IS
  'Preferred response length: short, balanced, detailed';

COMMENT ON COLUMN public.user_profiles.advice_style IS
  'Preferred advice intensity: comfort, balanced, actionable';

COMMENT ON COLUMN public.user_profiles.persona_preset IS
  'Bounded persona preset. Changes response style only, not analysis criteria.';

COMMENT ON COLUMN public.user_profiles.feature_flags IS
  'Feature-flag style personalization options. Server must validate allowed keys.';
