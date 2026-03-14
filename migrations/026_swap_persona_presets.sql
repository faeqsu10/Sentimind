-- Migration 026: 페르소나 프리셋 교체 (3개 제거, 3개 추가)
-- 제거: gentle_friend, wise_elder, mindful_guide
-- 추가: cool_senior, blunt_realist, tsundere

-- 1. 기존 사용자 데이터 마이그레이션 (제거 대상 → 대체)
UPDATE public.user_profiles SET persona_preset = 'none'
  WHERE persona_preset IN ('gentle_friend', 'wise_elder');

UPDATE public.user_profiles SET persona_preset = 'calm_coach'
  WHERE persona_preset = 'mindful_guide';

-- 2. CHECK 제약 재생성
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_persona_preset_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_persona_preset_check
  CHECK (persona_preset IN (
    'none', 'cool_senior', 'calm_coach', 'clear_reflector',
    'cheerful_supporter', 'blunt_realist', 'playful_buddy', 'tsundere'
  ));
