-- =============================================================
-- Sentimind: AI API 사용량 로그 테이블
-- Run order: 019
-- =============================================================
-- Gemini API 호출별 토큰 사용량, 비용, 엔드포인트를 기록.
-- 비용 모니터링 및 사용량 분석에 활용.

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  thinking_tokens INT NOT NULL DEFAULT 0,
  cached_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스: 사용자별 + 시간순 조회
CREATE INDEX idx_ai_usage_user_created ON public.ai_usage_logs (user_id, created_at DESC);
-- 인덱스: 엔드포인트별 집계
CREATE INDEX idx_ai_usage_endpoint ON public.ai_usage_logs (endpoint, created_at DESC);

-- RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 로그만 조회 가능
CREATE POLICY "usage_select_own"
  ON public.ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 서버(service_role)만 INSERT 가능 → RLS에서 별도 INSERT 정책 불필요
-- supabaseAdmin(service_role)으로 INSERT하므로 RLS bypass
COMMENT ON TABLE public.ai_usage_logs IS 'Gemini API 호출별 토큰 사용량 및 비용 로그';
