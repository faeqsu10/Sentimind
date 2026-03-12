-- Migration 024: persona_preset 선택지 확장 (4 → 8개)
-- 새 페르소나: cheerful_supporter, wise_elder, playful_buddy, mindful_guide

-- 기존 CHECK 제약 제거 후 확장된 제약 재생성
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_persona_preset_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_persona_preset_check
  CHECK (persona_preset IN (
    'none', 'gentle_friend', 'calm_coach', 'clear_reflector',
    'cheerful_supporter', 'wise_elder', 'playful_buddy', 'mindful_guide'
  ));
