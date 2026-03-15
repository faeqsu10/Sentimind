// ---------------------------------------------------------------------------
// POST /api/error-logs — 프론트엔드 에러 배치 수신
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function createErrorLogsRouter({ optionalAuth, logger, collectError }) {
  const router = express.Router();

  router.post('/error-logs', optionalAuth, async (req, res) => {
    const rid = req.rid;
    const { errors, session_id, user_agent } = req.body;

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: 'errors array required', code: 'VALIDATION_ERROR' });
    }

    const batch = errors.slice(0, 10); // 배치 최대 10개
    const userId = req.user?.id || null;
    let accepted = 0;

    for (const err of batch) {
      if (!err || typeof err.message !== 'string' || !err.message.trim()) continue;

      collectError({
        level: err.level === 'warn' ? 'warn' : 'error',
        source: 'frontend',
        message: err.message,
        stack: typeof err.stack === 'string' ? err.stack : null,
        code: typeof err.code === 'string' ? err.code : null,
        fingerprint: typeof err.fingerprint === 'string' ? err.fingerprint.slice(0, 64) : undefined,
        requestId: typeof err.request_id === 'string' ? err.request_id : rid,
        userId,
        sessionId: typeof session_id === 'string' ? session_id : null,
        userAgent: typeof user_agent === 'string' ? user_agent : req.headers['user-agent'] || null,
        metadata: {
          source_file: typeof err.source_file === 'string' ? err.source_file.slice(0, 200) : null,
          lineno: typeof err.lineno === 'number' ? err.lineno : null,
          colno: typeof err.colno === 'number' ? err.colno : null,
          ...(err.metadata && typeof err.metadata === 'object' ? err.metadata : {}),
        },
      });
      accepted++;
    }

    logger.info('프론트엔드 에러 수신', { requestId: rid, accepted, total: batch.length });
    res.status(202).json({ accepted });
  });

  return router;
};
