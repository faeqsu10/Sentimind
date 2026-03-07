// ---------------------------------------------------------------------------
// Report Route (/api/report)
// ---------------------------------------------------------------------------

const express = require('express');

// 메모리 캐시: 키 = `${userId}_${period}_${dateKey}`, 값 = { data, expiresAt }
const reportCache = new Map();

function getCacheKey(userId, period) {
  const now = new Date();
  let dateKey;
  if (period === 'weekly') {
    // 이번 주 월요일 (YYYY-MM-DD)
    const day = now.getDay(); // 0=일, 1=월 ... 6=토
    const diff = (day === 0 ? -6 : 1 - day); // 월요일까지의 오프셋
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    dateKey = monday.toISOString().slice(0, 10);
  } else {
    // 이번 달 1일 (YYYY-MM-01)
    dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${userId}_${period}_${dateKey}`;
}

function pruneCache(maxSize) {
  if (reportCache.size <= maxSize) return;
  // 가장 오래된 항목 삭제 (삽입 순서 기준)
  const firstKey = reportCache.keys().next().value;
  reportCache.delete(firstKey);
}

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    USE_SUPABASE,
    authMiddleware,
    config, GEMINI_API_KEY,
    callGeminiAPI, GeminiAPIError,
    readEntries,
    analyzeLimiter,
  } = deps;

  // GET /report - 주간/월간 AI 감정 리포트
  router.get('/report', authMiddleware, analyzeLimiter, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    const period = req.query.period;
    if (period !== 'weekly' && period !== 'monthly') {
      return res.status(400).json({ error: "period 파라미터는 'weekly' 또는 'monthly'여야 합니다.", code: 'VALIDATION_ERROR' });
    }

    const days = period === 'weekly' ? 7 : 30;
    const periodLabel = period === 'weekly' ? '7일' : '30일';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    logger.info(`GET /api/report (${period})`, { requestId: rid, userId: req.user?.id });

    // 캐시 조회
    const cacheKey = getCacheKey(req.user.id, period);
    const cached = reportCache.get(cacheKey);
    if (cached && cached.expiresAt <= Date.now()) {
      reportCache.delete(cacheKey);
    }
    if (cached && cached.expiresAt > Date.now()) {
      logger.info('리포트 캐시 HIT', { requestId: rid, cacheKey });
      res.set('Cache-Control', 'private, max-age=3600');
      res.set('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
    }

    try {
      // 해당 기간 entries 조회
      let entries = [];
      if (USE_SUPABASE && req.supabaseClient) {
        const { data, error } = await req.supabaseClient
          .from('entries')
          .select('text, emotion, emoji, created_at')
          .eq('user_id', req.user.id)
          .is('deleted_at', null)
          .gte('created_at', since)
          .order('created_at', { ascending: true });
        if (error) throw error;
        entries = data || [];
      } else {
        const all = await readEntries();
        const cutoff = new Date(since);
        entries = all
          .filter(e => new Date(e.date || e.created_at) >= cutoff)
          .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
      }

      if (entries.length < config.report.minEntries) {
        return res.status(400).json({
          error: `리포트 생성에 최소 ${config.report.minEntries}건의 일기가 필요합니다.`,
          code: 'INSUFFICIENT_DATA',
          count: entries.length,
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

      // JSON 파싱 (parseGeminiResponse는 emotion/emoji 필드를 강제하므로 직접 파싱)
      let jsonStr = content.trim();
      const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonStr = codeBlock[1].trim();
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        logger.warn('리포트 JSON 파싱 실패', { requestId: rid, raw: jsonStr.slice(0, 200) });
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

      // 캐시 저장
      reportCache.set(cacheKey, { data: report, expiresAt: Date.now() + config.report.cacheTtl });
      pruneCache(config.report.cacheMaxSize);

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

  return router;
};
