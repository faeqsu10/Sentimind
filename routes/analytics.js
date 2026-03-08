const express = require('express');

// JWT에서 payload를 디코딩하여 user_id 추출 (검증 불필요 — analytics용)
function extractUserIdFromJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

module.exports = function createAnalyticsRouter({ supabaseAdmin, USE_SUPABASE, logger, config }) {
  const router = express.Router();

  // POST /api/analytics — batch event ingestion
  router.post('/', async (req, res) => {
    const rid = req.rid;
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }

    // Cap batch size
    const batchMaxSize = config?.analytics?.batchMaxSize || 50;
    const batch = events.slice(0, batchMaxSize);

    // Extract user_id from JWT payload (no remote validation needed for analytics)
    const userId = extractUserIdFromJwt(req.headers.authorization);

    const rows = batch.map(evt => ({
      event: String(evt.event || '').slice(0, 100),
      session_id: String(evt.session_id || '').slice(0, 100),
      user_id: userId,
      is_guest: !userId,
      properties: sanitizeProperties(evt),
      device_type: evt.device_type === 'mobile' ? 'mobile' : 'desktop',
      theme: evt.theme === 'dark' ? 'dark' : 'light',
    }));

    if (USE_SUPABASE && supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.from('analytics_events').insert(rows);
        if (error) {
          logger.error('이벤트 저장 실패', { requestId: rid, error: error.message, count: rows.length });
          return res.status(500).json({ error: '이벤트 저장에 실패했습니다.' });
        }
      } catch (err) {
        logger.error('이벤트 저장 예외', { requestId: rid, error: err.message });
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
      }
    } else {
      // Fallback: log to console in dev
      logger.info('이벤트 수신 (Supabase 미사용)', { requestId: rid, count: rows.length });
    }

    res.status(202).json({ accepted: rows.length });
  });

  return router;
};

function sanitizeProperties(evt) {
  // Extract only known safe properties, exclude common fields
  const exclude = new Set(['event', 'session_id', 'is_guest', 'timestamp', 'platform', 'theme', 'device_type']);
  const props = {};
  for (const [key, value] of Object.entries(evt)) {
    if (exclude.has(key)) continue;
    if (typeof value === 'string') props[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean') props[key] = value;
    else if (Array.isArray(value)) props[key] = value.slice(0, 20).filter(
      v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    );
  }
  return props;
}
