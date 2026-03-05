CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_entries', COALESCE(total.cnt, 0),
    'avg_confidence', COALESCE(total.avg_conf, 0),
    'emotion_distribution', COALESCE(emotions.dist, '[]'::json),
    'situation_counts', COALESCE(situations.dist, '[]'::json)
  ) INTO result
  FROM
    (SELECT COUNT(*) as cnt, ROUND(AVG(confidence_score)) as avg_conf
     FROM entries WHERE user_id = p_user_id AND deleted_at IS NULL) total,
    (SELECT json_agg(json_build_object('emotion', emotion, 'count', cnt) ORDER BY cnt DESC)
     FROM (SELECT emotion, COUNT(*) as cnt FROM entries WHERE user_id = p_user_id AND deleted_at IS NULL GROUP BY emotion) e) emotions,
    (SELECT json_agg(json_build_object('situation', situation, 'count', cnt) ORDER BY cnt DESC)
     FROM (SELECT situation_context::text as situation, COUNT(*) as cnt FROM entries WHERE user_id = p_user_id AND deleted_at IS NULL AND situation_context IS NOT NULL GROUP BY situation_context::text) s) situations;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
