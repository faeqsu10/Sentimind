-- =============================================================
-- Sentimind: text_not_empty 제약 제거 + 프로필 개인화 컬럼 추가
-- Run order: 021
-- =============================================================
-- 문제 1: entries 테이블에 text_not_empty CHECK (length(text) <= 500)가
--          별도로 존재하여 500자 초과 일기 저장 시 실패.
--          올바른 제약인 entries_text_check (2000자)만 유지.
-- 문제 2: migration 016의 개인화 컬럼이 운영 DB에 미적용.

-- Fix 1: 잘못된 text_not_empty 제약 제거
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS text_not_empty;

-- 올바른 제약 재확인
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_text_check;
ALTER TABLE public.entries ADD CONSTRAINT entries_text_check
  CHECK (length(text) > 0 AND length(text) <= 2000);

-- Fix 2: AI 개인화 컬럼 추가 (migration 016 미적용분)
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

-- ai_tone 확장 값 지원
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_ai_tone_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_ai_tone_check
  CHECK (ai_tone IN ('warm', 'professional', 'friendly', 'poetic', 'calm', 'direct', 'playful'));
