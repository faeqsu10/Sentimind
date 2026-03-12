-- =============================================================
-- Sentimind: AI 리포트 저장 테이블
-- Run order: 017
-- =============================================================
-- AI가 생성한 주간/월간 감정 리포트를 영구 저장합니다.
-- 리포트는 immutable (생성 후 수정 불가, UPDATE 정책 없음).
-- 같은 유저 + 같은 기간 + 같은 시작일에는 1개만 존재 (UNIQUE).

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period VARCHAR(10) NOT NULL CHECK (period IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  entry_count INT NOT NULL DEFAULT 0 CHECK (entry_count >= 0),
  summary TEXT NOT NULL,
  emotion_trend TEXT NOT NULL,
  insight TEXT NOT NULL,
  encouragement TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_user_report_period UNIQUE (user_id, period, period_start)
);

COMMENT ON TABLE public.user_reports
  IS 'AI-generated weekly/monthly emotion reports (immutable snapshots)';

-- 2. 인덱스: 유저별 최신 리포트 조회
CREATE INDEX idx_reports_user_created
  ON public.user_reports (user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own"
  ON public.user_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reports_insert_own"
  ON public.user_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_delete_own"
  ON public.user_reports FOR DELETE
  USING (auth.uid() = user_id);
