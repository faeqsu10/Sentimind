-- =============================================================
-- Sentimind: 인증 이벤트 테이블 생성
-- Run order: 015
-- =============================================================
-- 회원가입, 로그인, 로그아웃, OAuth, 회원탈퇴 등
-- 인증 관련 이벤트를 별도 테이블로 관리하여
-- 보안 감사 및 리텐션 분석에 활용

CREATE TABLE IF NOT EXISTS public.auth_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  provider    TEXT DEFAULT 'email',
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 사용자별 이벤트 조회 (최신순)
CREATE INDEX idx_auth_events_user_id ON public.auth_events(user_id, created_at DESC);

-- 이벤트 타입별 조회 (관리자 대시보드)
CREATE INDEX idx_auth_events_type ON public.auth_events(event_type, created_at DESC);

-- RLS 활성화
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- 사용자는 자기 이벤트만 조회 가능
CREATE POLICY "Users can view own auth events"
  ON public.auth_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- service_role은 RLS를 우회하므로 별도 INSERT 정책 불필요.
-- 일반 사용자의 INSERT는 차단됨 (정책 없음 = 거부).

-- COMMENT
COMMENT ON TABLE public.auth_events IS '인증 이벤트 로그 (가입, 로그인, 탈퇴 등)';
COMMENT ON COLUMN public.auth_events.event_type IS 'signup | login | logout | oauth_login | password_reset | password_changed | account_deleted';
COMMENT ON COLUMN public.auth_events.provider IS 'email | google 등 인증 제공자';
