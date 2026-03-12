-- =============================================================
-- Sentimind: entries 테이블에 위기 감지 플래그 추가
-- Run order: 018
-- =============================================================
-- AI 분석에서 위기 상황이 감지되면 해당 엔트리에 기록.
-- 추후 위기 감지 추세 분석, 리포트 강화에 활용.

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS crisis_detected BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.entries.crisis_detected
  IS 'AI가 감지한 위기 상황 플래그 (crisis keywords 매칭)';
