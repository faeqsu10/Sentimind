-- =============================================================
-- Sentimind: Anonymous Auth 지원 — 게스트 체험 DB 저장
-- Run order: 023
-- =============================================================
-- Supabase Anonymous Auth를 통해 게스트 일기도 DB에 저장하고,
-- 회원 전환 시 데이터가 자동으로 이어지도록 지원

-- 1. user_profiles에 is_anonymous 컬럼 추가
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_anonymous
  IS 'Supabase Anonymous Auth로 생성된 사용자 여부';

-- 2. handle_new_user() 트리거 업데이트: is_anonymous 전파
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_nickname TEXT;
BEGIN
  -- Try to extract nickname from user metadata (Google OAuth provides full_name, name, or nickname)
  user_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NULL
  );

  -- Truncate to 30 chars (nickname column limit)
  IF user_nickname IS NOT NULL AND length(user_nickname) > 30 THEN
    user_nickname := left(user_nickname, 30);
  END IF;

  INSERT INTO public.user_profiles (id, nickname, is_anonymous)
  VALUES (NEW.id, user_nickname, COALESCE(NEW.is_anonymous, false));
  RETURN NEW;
END;
$$;

-- 3. 관리자 쿼리용 부분 인덱스 (익명 유저 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_user_profiles_anonymous
  ON public.user_profiles (is_anonymous)
  WHERE is_anonymous = true;
