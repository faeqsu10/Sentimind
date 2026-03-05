-- =============================================================
-- Sentimind: 기간 필터 지원 통계 RPC 함수
-- Run order: 008
-- =============================================================
-- GET /api/stats?period=7d|30d|90d|all 지원을 위한 서버측 집계

CREATE OR REPLACE FUNCTION get_user_stats_by_period(
  p_user_id UUID,
  p_days INT DEFAULT NULL  -- NULL = 전체, 7 = 1주, 30 = 1개월, 90 = 3개월
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- 기간 필터 계산
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
    (SELECT json_agg(json_build_object('emotion', emotion, 'count', cnt) ORDER BY cnt DESC)
     FROM (SELECT emotion, COUNT(*) as cnt
           FROM entries
           WHERE user_id = p_user_id
             AND deleted_at IS NULL
             AND created_at >= cutoff_date
           GROUP BY emotion) e) emotions,
    (SELECT json_agg(json_build_object('situation', situation, 'count', cnt) ORDER BY cnt DESC)
     FROM (SELECT situation_context::text as situation, COUNT(*) as cnt
           FROM entries
           WHERE user_id = p_user_id
             AND deleted_at IS NULL
             AND situation_context IS NOT NULL
             AND created_at >= cutoff_date
           GROUP BY situation_context::text) s) situations;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
