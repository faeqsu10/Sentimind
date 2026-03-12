// ---------------------------------------------------------------------------
// Entries Routes (/api/entries, /api/export)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    USE_SUPABASE,
    supabaseAdmin,
    authMiddleware,
    validateEntryText, validateConfidenceScore,
    validatePagination,
    sanitizeString, isPlainObject,
    updateStreak,
    generateId,
  } = deps;

  // GET /entries - 일기 목록 조회
  router.get('/entries', authMiddleware, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    logger.info('GET /api/entries', { requestId: rid, userId: req.user?.id });

    try {
      // Supabase path
      if (USE_SUPABASE && req.supabaseClient) {
        const { limit, offset } = validatePagination(req.query);

        let query = req.supabaseClient
          .from('entries')
          .select('*', { count: 'exact' })
          .eq('user_id', req.user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Optional emotion filter
        if (req.query.emotion) {
          query = query.eq('emotion', req.query.emotion);
        }

        // Optional bookmark filter
        if (req.query.bookmarked === 'true') {
          query = query.eq('is_bookmarked', true);
        }

        // Optional text search (escape LIKE wildcards to prevent injection)
        if (req.query.search) {
          const safeSearch = req.query.search.replace(/[%_\\]/g, '\\$&');
          query = query.ilike('text', `%${safeSearch}%`);
        }

        const { data, error, count } = await query;

        if (error) {
          logger.error('일기 조회 실패 (Supabase)', { requestId: rid, error: error.message });
          return res.status(500).json({ error: '일기 목록 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
        }

        // Map created_at -> date for backward compatibility
        const entries = (data || []).map(e => ({ ...e, date: e.created_at }));

        res.set('X-Total-Count', String(count || 0));
        res.set('Cache-Control', 'private, max-age=10');

        const duration = Date.now() - startTime;
        logger.info('일기 목록 조회 성공', { requestId: rid, count: entries.length, duration: `${duration}ms` });

        return res.json(entries);
      }

      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    } catch (err) {
      logger.error('일기 목록 조회 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '일기 목록 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // POST /entries - 일기 저장
  router.post('/entries', authMiddleware, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    logger.info('POST /api/entries', { requestId: rid, userId: req.user?.id });

    if (!req.body) {
      return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    const textV = validateEntryText(req.body.text);
    if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });

    const confV = validateConfidenceScore(req.body.confidence_score);
    if (!confV.valid) return res.status(400).json({ error: confV.error, code: 'VALIDATION_ERROR' });

    try {
      // Supabase path
      if (USE_SUPABASE && req.supabaseClient) {
        const entryData = {
          id: generateId(),
          user_id: req.user.id,
          text: textV.value,
          emotion: sanitizeString(req.body.emotion || '알 수 없음', 50),
          emoji: sanitizeString(req.body.emoji || '💭', 10),
          message: sanitizeString(req.body.message || '', 1000),
          advice: sanitizeString(req.body.advice || '', 500),
          emotion_hierarchy: isPlainObject(req.body.emotion_hierarchy) ? req.body.emotion_hierarchy : {},
          situation_context: Array.isArray(req.body.situation_context) ? req.body.situation_context : [],
          confidence_score: confV.value,
          related_emotions: Array.isArray(req.body.related_emotions) ? req.body.related_emotions : [],
          activity_tags: Array.isArray(req.body.activity_tags)
            ? req.body.activity_tags.filter(t => typeof t === 'string').map(t => sanitizeString(t, 30)).slice(0, 10)
            : [],
          crisis_detected: req.body.crisis_detected === true,
        };

        const { data, error } = await req.supabaseClient
          .from('entries')
          .insert(entryData)
          .select()
          .single();

        if (error) {
          logger.error('일기 저장 실패 (Supabase)', { requestId: rid, error: error.message });
          return res.status(500).json({ error: '일기 저장에 실패했습니다.', code: 'INTERNAL_ERROR' });
        }

        // Update streak (클라이언트 타임존 반영)
        const tzOffset = parseInt(req.body.tz_offset, 10);
        await updateStreak(req.supabaseClient, req.user.id, isNaN(tzOffset) ? undefined : tzOffset);

        const duration = Date.now() - startTime;
        logger.info('일기 저장 완료', { requestId: rid, entryId: data.id, duration: `${duration}ms` });

        // Backward compatible: add date field
        return res.status(201).json({ ...data, date: data.created_at });
      }

      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    } catch (err) {
      logger.error('일기 저장 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '일기 저장에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // PATCH /entries/:id - 일기 수정 (24시간 이내만 가능)
  router.patch('/entries/:id', authMiddleware, async (req, res) => {
    const rid = requestId();
    const { id } = req.params;

    if (!USE_SUPABASE || !req.supabaseClient) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    try {
      // Fetch the entry first to check ownership and edit window
      const { data: existing, error: fetchErr } = await req.supabaseClient
        .from('entries')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
      }

      // Bookmark toggle (no time restriction)
      if (req.body.is_bookmarked !== undefined && Object.keys(req.body).length === 1) {
        const { data, error } = await req.supabaseClient
          .from('entries')
          .update({ is_bookmarked: !!req.body.is_bookmarked })
          .eq('id', id)
          .select()
          .single();
        if (error) {
          return res.status(500).json({ error: '북마크 변경에 실패했습니다.', code: 'INTERNAL_ERROR' });
        }
        return res.json({ ...data, date: data.created_at });
      }

      // Check 24-hour edit window
      const createdAt = new Date(existing.created_at);
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return res.status(403).json({
          error: '작성 후 24시간이 지나 수정할 수 없습니다.',
          code: 'EDIT_WINDOW_EXPIRED',
        });
      }

      const updates = {};
      if (req.body.text !== undefined) {
        const textV = validateEntryText(req.body.text);
        if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });
        updates.text = textV.value;
      }

      // If reanalyze is requested, re-run through Gemini (handled by client calling /api/analyze)
      // Server sanitizes all string fields to prevent stored XSS
      if (req.body.emotion !== undefined) updates.emotion = sanitizeString(req.body.emotion, 50);
      if (req.body.emoji !== undefined) updates.emoji = sanitizeString(req.body.emoji, 10);
      if (req.body.message !== undefined) updates.message = sanitizeString(req.body.message, 1000);
      if (req.body.advice !== undefined) updates.advice = sanitizeString(req.body.advice, 500);
      if (req.body.emotion_hierarchy !== undefined) {
        updates.emotion_hierarchy = isPlainObject(req.body.emotion_hierarchy) ? req.body.emotion_hierarchy : {};
      }
      if (req.body.situation_context !== undefined) {
        updates.situation_context = Array.isArray(req.body.situation_context) ? req.body.situation_context : [];
      }
      if (req.body.confidence_score !== undefined) {
        const confV = validateConfidenceScore(req.body.confidence_score);
        if (!confV.valid) return res.status(400).json({ error: confV.error, code: 'VALIDATION_ERROR' });
        updates.confidence_score = confV.value;
      }
      if (req.body.related_emotions !== undefined) {
        updates.related_emotions = Array.isArray(req.body.related_emotions) ? req.body.related_emotions : [];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: '수정할 항목이 없습니다.', code: 'VALIDATION_ERROR' });
      }

      const { data, error } = await req.supabaseClient
        .from('entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('일기 수정 실패', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '일기 수정에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      logger.info('일기 수정 완료', { requestId: rid, entryId: id });
      res.json({ ...data, date: data.created_at });
    } catch (err) {
      logger.error('일기 수정 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // PATCH /entries/:id/feedback - AI 분석 피드백
  router.patch('/entries/:id/feedback', authMiddleware, async (req, res) => {
    const rid = requestId();
    const { id } = req.params;

    if (!USE_SUPABASE || !req.supabaseClient) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const { rating } = req.body || {};
    if (!rating || !['helpful', 'not_helpful'].includes(rating)) {
      return res.status(400).json({ error: "rating은 'helpful' 또는 'not_helpful'만 가능합니다.", code: 'VALIDATION_ERROR' });
    }

    try {
      // Verify entry exists and belongs to user
      const { data: existing, error: fetchErr } = await req.supabaseClient
        .from('entries')
        .select('id')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
      }

      const { data, error } = await req.supabaseClient
        .from('entries')
        .update({ user_rating: rating })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('피드백 저장 실패', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '피드백 저장에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      logger.info('피드백 저장 완료', { requestId: rid, entryId: id, rating });
      res.json({ ...data, date: data.created_at });
    } catch (err) {
      logger.error('피드백 저장 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // DELETE /entries/:id - 일기 삭제 (소프트 삭제)
  router.delete('/entries/:id', authMiddleware, async (req, res) => {
    const rid = requestId();
    const { id } = req.params;

    logger.info('DELETE /api/entries/:id', { requestId: rid, id, userId: req.user?.id });

    try {
      // Supabase path: soft delete
      if (USE_SUPABASE && req.supabaseClient) {
        // Check entry exists and belongs to user
        const { data: existing, error: fetchErr } = await req.supabaseClient
          .from('entries')
          .select('id')
          .eq('id', id)
          .eq('user_id', req.user.id)
          .is('deleted_at', null)
          .single();

        if (fetchErr || !existing) {
          return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
        }

        // Soft delete: set deleted_at
        const { error } = await req.supabaseClient
          .from('entries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          logger.error('일기 삭제 실패 (Supabase)', { requestId: rid, error: error.message });
          return res.status(500).json({ error: '일기 삭제에 실패했습니다.', code: 'INTERNAL_ERROR' });
        }

        logger.info('일기 삭제 성공 (소프트 삭제)', { requestId: rid, id });
        return res.json({ success: true });
      }

      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    } catch (err) {
      logger.error('일기 삭제 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '일기 삭제에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // GET /export - 데이터 내보내기 (CSV/JSON)
  router.get('/export', authMiddleware, async (req, res) => {
    const rid = requestId();
    logger.info('GET /api/export', { requestId: rid, userId: req.user?.id });

    try {
      if (!USE_SUPABASE || !req.supabaseClient) {
        return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
      }

      const { data, error } = await req.supabaseClient
        .from('entries')
        .select('text, emotion, emoji, message, advice, confidence_score, created_at')
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const entries = data || [];

      const format = req.query.format || 'csv';

      if (format !== 'csv' && format !== 'json') {
        return res.status(400).json({ error: "format은 'csv' 또는 'json'만 가능합니다.", code: 'VALIDATION_ERROR' });
      }

      // E-18: data_exported (server-side analytics)
      if (USE_SUPABASE && supabaseAdmin) {
        supabaseAdmin.from('analytics_events').insert({
          user_id: req.user.id,
          event: 'data_exported',
          properties: { format, entry_count: entries.length },
          created_at: new Date().toISOString(),
        }).catch(() => {});
      }

      if (format === 'json') {
        res.setHeader('Content-Disposition', 'attachment; filename="sentimind-export.json"');
        return res.json(entries);
      }

      // CSV format - CSV injection 방지: 위험 문자로 시작하는 셀에 단일 따옴표 접두사 추가
      function csvSafe(str) {
        let s = (str || '').replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(s)) {
          s = "'" + s;
        }
        return s;
      }

      const csvHeader = '날짜,감정,이모지,텍스트,공감메시지,조언,신뢰도';
      const csvRows = entries.map(e => {
        const date = csvSafe(e.created_at || e.date || '');
        const text = csvSafe(e.text || '');
        const msg = csvSafe(e.message || '');
        const advice = csvSafe(e.advice || '');
        const emotion = csvSafe(e.emotion || '');
        const emoji = csvSafe(e.emoji || '');
        return `"${date}","${emotion}","${emoji}","${text}","${msg}","${advice}",${e.confidence_score || 0}`;
      });
      const csv = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sentimind-export.csv"');
      res.send(csv);
    } catch (err) {
      logger.error('데이터 내보내기 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '데이터 내보내기에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
