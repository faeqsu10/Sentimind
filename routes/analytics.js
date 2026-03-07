const express = require('express');

module.exports = function createAnalyticsRouter({ supabaseAdmin, USE_SUPABASE, logger }) {
  const router = express.Router();

  // POST /api/analytics — batch event ingestion
  router.post('/', async (req, res) => {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }

    // Cap batch size
    const batch = events.slice(0, 50);

    // Extract user_id from auth header if present
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && USE_SUPABASE && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(authHeader.split(' ')[1]);
        if (data?.user) userId = data.user.id;
      } catch {
        // Anonymous event — continue without user_id
      }
    }

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
          logger.error('Analytics insert error', { error: error.message });
          return res.status(500).json({ error: 'Failed to store events' });
        }
      } catch (err) {
        logger.error('Analytics exception', { error: err.message });
        return res.status(500).json({ error: 'Internal error' });
      }
    } else {
      // Fallback: log to console in dev
      logger.info('Analytics events (no Supabase)', { count: rows.length });
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
