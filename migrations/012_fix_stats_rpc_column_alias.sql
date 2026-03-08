-- =============================================================
-- Sentimind: Stats RPC 함수 수정
-- Run order: 012
-- =============================================================
-- 1. json_agg() 결과에 AS dist 별칭 추가
-- 2. situation_context JSONB 배열을 domain/context로 풀어서 집계

CREATE OR REPLACE FUNCTION get_user_stats_by_period(
  p_user_id UUID,
  p_days INT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  cutoff_date TIMESTAMPTZ;
BEGIN
  IF p_days IS NOT NULL THEN
    cutoff_date := now() - (p_days || ' days')::INTERVAL;
  ELSE
    cutoff_date := '1970-01-01'::TIMESTAMPTZ;
  END IF;

  SELECT json_build_object(
    'total_entries', COALESCE(total.cnt, 0),
    'avg_confidence', COALESCE(total.avg_conf, 0),
    'emotion_distribution', COALESCE(emotions.dist, '[]'::json),
    'situation_counts', COALESCE(situations.dist, '[]'::json),
    'period_days', p_days
  ) INTO result
  FROM
    (SELECT COUNT(*) as cnt, ROUND(AVG(confidence_score)) as avg_conf
     FROM entries
     WHERE user_id = p_user_id
       AND deleted_at IS NULL
       AND created_at >= cutoff_date) total,
    (SELECT json_agg(json_build_object('emotion', emotion, 'count', cnt) ORDER BY cnt DESC) AS dist
     FROM (SELECT emotion, COUNT(*) as cnt
           FROM entries
           WHERE user_id = p_user_id
             AND deleted_at IS NULL
             AND created_at >= cutoff_date
           GROUP BY emotion) e) emotions,
    (SELECT json_agg(json_build_object('situation', situation, 'count', cnt) ORDER BY cnt DESC) AS dist
     FROM (SELECT elem->>'domain' || '/' || elem->>'context' as situation, COUNT(*) as cnt
           FROM entries,
                jsonb_array_elements(situation_context) AS elem
           WHERE user_id = p_user_id
             AND deleted_at IS NULL
             AND situation_context IS NOT NULL
             AND jsonb_array_length(situation_context) > 0
             AND created_at >= cutoff_date
           GROUP BY elem->>'domain', elem->>'context') s) situations;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
