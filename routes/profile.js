// ---------------------------------------------------------------------------
// Profile Routes (/api/profile)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    USE_SUPABASE,
    authMiddleware,
    validateNickname, validateBio, validateTheme, validateNotificationTime, validateAiTone,
  } = deps;

  // GET /profile - 프로필 조회
  router.get('/profile', authMiddleware, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE || !req.supabaseClient) {
      return res.json({ data: { id: null, email: null } });
    }

    try {
      const [profileResult, countResult] = await Promise.all([
        req.supabaseClient
          .from('user_profiles')
          .select('*')
          .eq('id', req.user.id)
          .single(),
        req.supabaseClient
          .from('entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', req.user.id)
          .is('deleted_at', null),
      ]);

      if (profileResult.error) {
        logger.warn('프로필 조회 실패', { requestId: rid, error: profileResult.error.message });
        return res.status(404).json({ error: '프로필을 찾을 수 없습니다.', code: 'NOT_FOUND' });
      }

      res.json({
        data: {
          ...profileResult.data,
          email: req.user.email,
          total_entries: countResult.count || 0,
        },
      });
    } catch (err) {
      logger.error('프로필 조회 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // PATCH /profile - 프로필 수정
  router.patch('/profile', authMiddleware, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE || !req.supabaseClient) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    // Build update object from validated fields
    const updates = {};
    const validations = [
      ['nickname', validateNickname],
      ['bio', validateBio],
      ['theme', validateTheme],
      ['notification_time', validateNotificationTime],
      ['ai_tone', validateAiTone],
    ];

    for (const [field, validator] of validations) {
      if (req.body[field] !== undefined) {
        const result = validator(req.body[field]);
        if (!result.valid) {
          return res.status(400).json({ error: result.error, code: 'VALIDATION_ERROR' });
        }
        if (result.value !== undefined) {
          updates[field] = result.value;
        }
      }
    }

    // Boolean fields (no complex validation needed)
    if (req.body.notification_enabled !== undefined) {
      updates.notification_enabled = !!req.body.notification_enabled;
    }
    if (req.body.onboarding_completed !== undefined) {
      updates.onboarding_completed = !!req.body.onboarding_completed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 항목이 없습니다.', code: 'VALIDATION_ERROR' });
    }

    try {
      const { data, error } = await req.supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('id', req.user.id)
        .select()
        .single();

      if (error) {
        logger.warn('프로필 수정 실패', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '프로필 수정에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      logger.info('프로필 수정 완료', { requestId: rid, userId: req.user.id, fields: Object.keys(updates) });

      res.json({ data });
    } catch (err) {
      logger.error('프로필 수정 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
