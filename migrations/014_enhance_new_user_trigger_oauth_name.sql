-- =============================================================
-- Sentimind: 신규 유저 트리거 개선 — OAuth 이름 자동 반영
-- Run order: 014
-- =============================================================
-- Google OAuth 등 소셜 로그인 시 raw_user_meta_data에서
-- nickname/full_name/name을 추출하여 user_profiles에 저장

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

  INSERT INTO public.user_profiles (id, nickname)
  VALUES (NEW.id, user_nickname);
  RETURN NEW;
END;
$$;
