// ---------------------------------------------------------------------------
// Stats Route (/api/stats)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    USE_SUPABASE,
    authMiddleware,
    readEntries,
  } = deps;

  // GET /stats - 통계 조회
  router.get('/stats', authMiddleware, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    // Period filter: 7d, 30d, 90d, all (default)
    const VALID_PERIODS = { '7d': 7, '30d': 30, '90d': 90, 'all': 0 };
    const periodParam = req.query.period || 'all';
    const periodDays = VALID_PERIODS[periodParam];
    if (periodDays === undefined) {
      return res.status(400).json({ error: "period 파라미터는 '7d', '30d', '90d', 'all' 중 하나여야 합니다.", code: 'VALIDATION_ERROR' });
    }

    const periodCutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString() : null;

    logger.info('GET /api/stats', { requestId: rid, userId: req.user?.id, period: periodParam });

    try {
      // Supabase path: RPC 집계 + 최신 항목/프로필 병렬 조회
      if (USE_SUPABASE && req.supabaseClient) {
        const [rpcResult, latestResult, profileResult] = await Promise.all([
          req.supabaseClient.rpc('get_user_stats_by_period', {
            p_user_id: req.user.id,
            p_days: periodDays > 0 ? periodDays : null,
          }),
          req.supabaseClient
            .from('entries')
            .select('id, emotion, emoji, text, created_at')
            .eq('user_id', req.user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5),
          req.supabaseClient
            .from('user_profiles')
            .select('current_streak, max_streak, last_entry_date')
            .eq('id', req.user.id)
            .single(),
        ]);

        if (rpcResult.error) {
          logger.error('통계 RPC 조회 실패', { requestId: rid, error: rpcResult.error.message });
          return res.status(500).json({ error: '통계 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
        }

        const rpcData = rpcResult.data || {};
        const profile = profileResult.data;
        const latestEntries = (latestResult.data || []).map(e => ({ ...e, date: e.created_at }));

        // RPC 결과에서 emotion_distribution 및 top 항목 구성
        const emotionDist = {};
        const topEmotions = [];
        if (Array.isArray(rpcData.emotion_distribution)) {
          rpcData.emotion_distribution.forEach(item => {
            emotionDist[item.emotion] = item.count;
            if (topEmotions.length < 5) topEmotions.push(item);
          });
        }

        const topSituations = [];
        if (Array.isArray(rpcData.situation_counts)) {
          rpcData.situation_counts.slice(0, 5).forEach(item => {
            topSituations.push({ situation: item.situation, count: item.count });
          });
        }

        const today = new Date().toISOString().split('T')[0];
        const todayCompleted = profile?.last_entry_date === today;

        const stats = {
          total_entries: rpcData.total_entries || 0,
          avg_confidence: rpcData.avg_confidence || 0,
          emotion_distribution: emotionDist,
          top_emotions: topEmotions,
          top_situations: topSituations,
          hourly_distribution: {},
          latest_entries: latestEntries,
          streak: {
            current: profile?.current_streak || 0,
            max: profile?.max_streak || 0,
            today_completed: todayCompleted,
          },
          period: periodParam,
        };

        const duration = Date.now() - startTime;
        logger.info('통계 조회 성공 (RPC)', { requestId: rid, totalEntries: stats.total_entries, period: periodParam, duration: `${duration}ms` });

        res.set('Cache-Control', 'private, max-age=60');
        return res.json(stats);
      }

      // JSON fallback (with period filter)
      let entries = await readEntries();
      if (periodCutoff) {
        const cutoffDate = new Date(periodCutoff);
        entries = entries.filter(entry => new Date(entry.date) >= cutoffDate);
      }

      const emotionFreq = {};
      const situationFreq = {};
      const hourlyEmotions = {};

      entries.forEach(entry => {
        const emotion = entry.emotion || '알 수 없음';
        emotionFreq[emotion] = (emotionFreq[emotion] || 0) + 1;

        if (entry.ontology?.situation_context) {
          entry.ontology.situation_context.forEach(ctx => {
            const key = `${ctx.domain}/${ctx.context}`;
            situationFreq[key] = (situationFreq[key] || 0) + 1;
          });
        }

        const date = new Date(entry.date);
        const hour = date.getHours();
        const hourKey = `${hour}:00`;
        if (!hourlyEmotions[hourKey]) hourlyEmotions[hourKey] = {};
        hourlyEmotions[hourKey][emotion] = (hourlyEmotions[hourKey][emotion] || 0) + 1;
      });

      const avgConfidence = entries.reduce((sum, e) => sum + (e.ontology?.confidence || 0), 0) / Math.max(entries.length, 1);

      const stats = {
        total_entries: entries.length,
        avg_confidence: Math.round(avgConfidence),
        emotion_distribution: emotionFreq,
        top_emotions: Object.entries(emotionFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emotion, count]) => ({ emotion, count })),
        top_situations: Object.entries(situationFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([situation, count]) => ({ situation, count })),
        hourly_distribution: hourlyEmotions,
        latest_entries: entries.slice(0, 5),
        period: periodParam,
      };

      const duration = Date.now() - startTime;
      logger.info('통계 조회 성공 (JSON)', { requestId: rid, totalEntries: entries.length, period: periodParam, duration: `${duration}ms` });
      res.json(stats);
    } catch (err) {
      logger.error('통계 조회 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '통계 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
