-- Migration 025: ai_tone 컬럼 제거 (persona_preset으로 통합)
--
-- ai_tone(4개 톤)과 persona_preset(8개 프리셋)이 기능적으로 중복되어
-- persona_preset 하나로 통합합니다.
--
-- 매핑: professional → calm_coach, friendly → gentle_friend, poetic → wise_elder
-- warm은 기본값(none)과 동일하므로 별도 매핑 불필요

-- Step 1: 기존 ai_tone 값을 persona_preset으로 매핑
-- (이미 persona_preset을 직접 선택한 사용자는 건드리지 않음)
UPDATE public.user_profiles
SET persona_preset = CASE ai_tone
  WHEN 'professional' THEN 'calm_coach'
  WHEN 'friendly' THEN 'gentle_friend'
  WHEN 'poetic' THEN 'wise_elder'
  ELSE persona_preset
END
WHERE persona_preset = 'none'
  AND ai_tone IS NOT NULL
  AND ai_tone != 'warm';

-- Step 2: ai_tone 컬럼 삭제
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS ai_tone;
