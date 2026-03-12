-- =============================================================
-- Sentimind: entries.text 길이 제약 수정 (500 → 2000)
-- Run order: 020
-- =============================================================
-- 프론트엔드(maxlength=2000)와 백엔드(MAX_ENTRY_LENGTH=2000)는
-- 2000자를 허용하지만 DB 제약이 500자로 불일치했음.
-- 500자 초과 일기 저장 시 silent failure 발생.

ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_text_check;
ALTER TABLE public.entries ADD CONSTRAINT entries_text_check
  CHECK (length(text) > 0 AND length(text) <= 2000);
