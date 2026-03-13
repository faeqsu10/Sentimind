// ---------------------------------------------------------------------------
// Report Route (/api/report)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    USE_SUPABASE,
    authMiddleware,
    config, GEMINI_API_KEY,
    callGeminiAPI, GeminiAPIError,
    parseGeminiResponse,
    analyzeLimiter,
    logAiUsage,
  } = deps;

  /**
   * 주어진 period에 대한 period_start(Date)와 period_end(Date)를 계산.
   * weekly: 이번 주 월요일 ~ 일요일
   * monthly: 이번 달 1일 ~ 말일
   */
  function getPeriodRange(period) {
    const now = new Date();
    if (period === 'weekly') {
      const day = now.getDay(); // 0=일, 1=월 ... 6=토
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: monday.toISOString().slice(0, 10),
        end: sunday.toISOString().slice(0, 10),
      };
    }
    // monthly
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
    };
  }

  // GET /report - 주간/월간 AI 감정 리포트
  router.get('/report', authMiddleware, analyzeLimiter, async (req, res) => {
    const rid = req.rid || requestId();
    const startTime = Date.now();

    const period = req.query.period;
    if (period !== 'weekly' && period !== 'monthly') {
      return res.status(400).json({ error: "period 파라미터는 'weekly' 또는 'monthly'여야 합니다.", code: 'VALIDATION_ERROR' });
    }

    const regenerate = req.query.regenerate === 'true';
    const days = period === 'weekly' ? 7 : 30;
    const periodLabel = period === 'weekly' ? '7일' : '30일';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    logger.info(`GET /api/report (${period})`, { requestId: rid, userId: req.user?.id, regenerate });

    if (!USE_SUPABASE || !req.supabaseClient || !req.user) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    // ── DB 캐시 조회 ──
    if (!regenerate) {
      try {
        const { data: existing } = await req.supabaseClient
          .from('user_reports')
          .select('*')
          .eq('user_id', req.user.id)
          .eq('period', period)
          .eq('period_start', periodStart)
          .maybeSingle();

        if (existing) {
          logger.info('리포트 DB HIT', { requestId: rid, reportId: existing.id });
          res.set('Cache-Control', 'private, max-age=3600');
          res.set('X-Cache', 'HIT');
          return res.json({
            period: existing.period,
            entryCount: existing.entry_count,
            summary: existing.summary,
            emotionTrend: existing.emotion_trend,
            insight: existing.insight,
            encouragement: existing.encouragement,
          });
        }
      } catch (dbErr) {
        // user_reports 테이블이 아직 없을 수 있음 — 무시하고 생성 진행
        logger.warn('리포트 DB 조회 실패 (테이블 미존재 가능)', { requestId: rid, error: dbErr.message });
      }
    } else {
      // regenerate: 기존 리포트 삭제
      try {
        await req.supabaseClient
          .from('user_reports')
          .delete()
          .eq('user_id', req.user.id)
          .eq('period', period)
          .eq('period_start', periodStart);
      } catch {
        // 삭제 실패 무시
      }
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
    }

    try {
      const { data: entries, error } = await req.supabaseClient
        .from('entries')
        .select('text, emotion, emoji, created_at')
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if ((entries || []).length < config.report.minEntries) {
        return res.status(400).json({
          error: `리포트 생성에 최소 ${config.report.minEntries}건의 일기가 필요합니다.`,
          code: 'INSUFFICIENT_DATA',
          count: (entries || []).length,
        });
      }

      // Gemini 프롬프트 구성
      const diaryList = entries.map((e, i) =>
        `${i + 1}. [${e.emotion || '알 수 없음'} ${e.emoji || ''}] ${e.text}`
      ).join('\n');

      const prompt =
        `아래는 사용자의 최근 ${periodLabel}간 일기입니다. 감정 흐름을 종합 분석해주세요.\n` +
        `반드시 JSON으로 응답: { "summary": "전체 요약(2-3문장)", "emotionTrend": "감정 변화 설명", "insight": "패턴 인사이트", "encouragement": "따뜻한 격려 메시지" }\n\n` +
        diaryList;

      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: config.report.maxOutputTokens,
          temperature: config.gemini.temperature,
          thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget },
        },
      };

      const { content, tokenCost } = await callGeminiAPI(requestBody, { rid, label: '리포트' });

      // JSON 파싱 — 코드블록 제거는 parseGeminiResponse와 동일한 로직 사용
      let parsed;
      try {
        let jsonStr = content.trim();
        const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlock) jsonStr = codeBlock[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        logger.warn('리포트 JSON 파싱 실패', { requestId: rid, raw: content.slice(0, 200) });
        return res.status(502).json({ error: 'AI 응답을 해석할 수 없습니다. 다시 시도해주세요.', code: 'AI_PARSE_ERROR' });
      }

      const report = {
        period,
        entryCount: entries.length,
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        emotionTrend: typeof parsed.emotionTrend === 'string' ? parsed.emotionTrend : '',
        insight: typeof parsed.insight === 'string' ? parsed.insight : '',
        encouragement: typeof parsed.encouragement === 'string' ? parsed.encouragement : '',
      };

      const duration = Date.now() - startTime;
      logAiUsage({
        userId: req.user?.id,
        endpoint: 'report',
        tokenCost,
        durationMs: duration,
      });

      logger.info('리포트 생성 완료', {
        requestId: rid,
        period,
        entryCount: entries.length,
        duration: `${duration}ms`,
        ...(tokenCost && {
          tokens: { input: tokenCost.input, output: tokenCost.output, total: tokenCost.total },
          costUsd: { total: tokenCost.totalCost },
        }),
      });

      // ── DB 저장 (INSERT ... ON CONFLICT DO NOTHING) ──
      try {
        await req.supabaseClient
          .from('user_reports')
          .upsert({
            user_id: req.user.id,
            period,
            period_start: periodStart,
            period_end: periodEnd,
            entry_count: report.entryCount,
            summary: report.summary,
            emotion_trend: report.emotionTrend,
            insight: report.insight,
            encouragement: report.encouragement,
          }, { onConflict: 'user_id,period,period_start' });
      } catch (saveErr) {
        // DB 저장 실패해도 응답은 정상 반환
        logger.warn('리포트 DB 저장 실패', { requestId: rid, error: saveErr.message });
      }

      res.set('Cache-Control', 'private, max-age=3600');
      res.set('X-Cache', 'MISS');
      return res.json(report);

    } catch (err) {
      if (err instanceof GeminiAPIError) {
        logger.error('리포트 Gemini API 실패', { requestId: rid, error: err.message });
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      logger.error('리포트 조회 오류', { requestId: rid, error: err.message });
      return res.status(500).json({ error: '리포트 생성에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // GET /reports - 리포트 히스토리 목록
  router.get('/reports', authMiddleware, async (req, res) => {
    const rid = req.rid || requestId();

    if (!USE_SUPABASE || !req.supabaseClient || !req.user) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const period = req.query.period; // optional filter
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    try {
      let query = req.supabaseClient
        .from('user_reports')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .order('period_start', { ascending: false })
        .range(offset, offset + limit - 1);

      if (period === 'weekly' || period === 'monthly') {
        query = query.eq('period', period);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const reports = (data || []).map(r => ({
        id: r.id,
        period: r.period,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        entryCount: r.entry_count,
        summary: r.summary,
        emotionTrend: r.emotion_trend,
        insight: r.insight,
        encouragement: r.encouragement,
        createdAt: r.created_at,
      }));

      res.set('X-Total-Count', String(count || 0));
      res.set('Cache-Control', 'private, max-age=60');
      return res.json(reports);
    } catch (err) {
      logger.error('리포트 히스토리 조회 오류', { requestId: rid, error: err.message });
      return res.status(500).json({ error: '리포트 목록 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // DELETE /reports/:id - 리포트 삭제
  router.delete('/reports/:id', authMiddleware, async (req, res) => {
    const rid = req.rid || requestId();
    const { id } = req.params;

    if (!USE_SUPABASE || !req.supabaseClient || !req.user) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    try {
      const { error } = await req.supabaseClient
        .from('user_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

      if (error) throw error;

      logger.info('리포트 삭제', { requestId: rid, reportId: id, userId: req.user.id });
      return res.status(204).end();
    } catch (err) {
      logger.error('리포트 삭제 오류', { requestId: rid, error: err.message });
      return res.status(500).json({ error: '리포트 삭제에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
