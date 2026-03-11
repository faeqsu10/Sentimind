-- =============================================================
-- Sentimind: entries.text 컬럼 길이 확장 (500 → 2000)
-- Run order: 007
-- =============================================================
-- MAX_ENTRY_LENGTH 환경변수 기본값(2000)과 DB 스키마 동기화

ALTER TABLE public.entries
  ALTER COLUMN text TYPE VARCHAR(2000);

COMMENT ON COLUMN public.entries.text IS 'Diary text, max 2000 chars (synced with MAX_ENTRY_LENGTH env)';
