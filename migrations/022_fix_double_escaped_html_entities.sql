-- =============================================================
-- Sentimind: 이중 이스케이프된 HTML 엔티티 복원
-- Run order: 022
-- =============================================================
-- sanitizeString이 저장 시점에 HTML 이스케이프를 수행하여
-- 프론트엔드 escapeHtml()과 이중 이스케이프 발생.
-- 기존 데이터의 HTML 엔티티를 원본 문자로 복원.

UPDATE public.entries SET
  emotion = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(emotion, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
  emoji = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(emoji, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
  message = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(message, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
  advice = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(advice, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', '''')
WHERE emotion LIKE '%&amp;%' OR emotion LIKE '%&lt;%' OR emotion LIKE '%&gt;%' OR emotion LIKE '%&quot;%' OR emotion LIKE '%&#39;%'
   OR emoji LIKE '%&amp;%' OR emoji LIKE '%&lt;%' OR emoji LIKE '%&gt;%' OR emoji LIKE '%&quot;%' OR emoji LIKE '%&#39;%'
   OR message LIKE '%&amp;%' OR message LIKE '%&lt;%' OR message LIKE '%&gt;%' OR message LIKE '%&quot;%' OR message LIKE '%&#39;%'
   OR advice LIKE '%&amp;%' OR advice LIKE '%&lt;%' OR advice LIKE '%&gt;%' OR advice LIKE '%&quot;%' OR advice LIKE '%&#39;%';
