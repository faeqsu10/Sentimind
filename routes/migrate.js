// ---------------------------------------------------------------------------
// Migrate Route (/api/migrate)
// ---------------------------------------------------------------------------
// 게스트 모드 데이터를 회원 계정으로 마이그레이션합니다.

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    authMiddleware,
    supabaseAdmin,
    sanitizeString,
    validateEntryText,
    generateId,
    config,
  } = deps;

  function parseSafeDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  // POST /migrate/from-guest - 게스트 일기 → 회원 계정 마이그레이션
  router.post('/migrate/from-guest', authMiddleware, async (req, res) => {
    const rid = requestId();
    const userId = req.user?.id;

    logger.info('POST /api/migrate/from-guest', { requestId: rid, userId });

    if (!req.user || !req.supabaseClient) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const { entries } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: '마이그레이션할 일기가 없습니다.', code: 'VALIDATION_ERROR' });
    }

    const migrationMax = config?.migration?.maxEntries || 10;
    if (entries.length > migrationMax) {
      return res.status(400).json({ error: `최대 ${migrationMax}개까지 마이그레이션할 수 있습니다.`, code: 'VALIDATION_ERROR' });
    }

    let imported = 0;
    let skipped = 0;

    try {
      const rows = [];

      for (const entry of entries) {
        // Validate text
        const textV = validateEntryText(entry.text);
        if (!textV.valid) {
          skipped++;
          continue;
        }

        rows.push({
          id: generateId(),
          user_id: userId,
          text: sanitizeString(entry.text, 2000),
          emotion: entry.emotion ? sanitizeString(entry.emotion, 50) : null,
          emoji: entry.emoji ? sanitizeString(entry.emoji, 10) : null,
          message: entry.message ? sanitizeString(entry.message, 1000) : null,
          advice: entry.advice ? sanitizeString(entry.advice, 500) : null,
          created_at: parseSafeDate(entry.date),
        });
      }

      if (rows.length > 0) {
        const { data, error } = await req.supabaseClient
          .from('entries')
          .insert(rows)
          .select('id');

        if (error) {
          logger.error('게스트 데이터 마이그레이션 실패', { requestId: rid, error: error.message });
          return res.status(500).json({ error: '마이그레이션 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
        }

        imported = data?.length || rows.length;
      }

      logger.info('게스트 데이터 마이그레이션 완료', { requestId: rid, userId, imported, skipped });

      // Record guest_conversion event in auth_events
      if (supabaseAdmin && imported > 0) {
        supabaseAdmin.from('auth_events').insert({
          user_id: userId,
          event_type: 'guest_conversion',
          provider: 'email',
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
          metadata: { guest_entries: entries.length, imported, skipped },
        }).then(() => {}).catch(err => {
          logger.warn('guest_conversion 이벤트 기록 실패', { requestId: rid, error: err.message });
        });
      }

      res.json({ success: true, imported, skipped });

    } catch (err) {
      logger.error('마이그레이션 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
