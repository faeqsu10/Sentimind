// ---------------------------------------------------------------------------
// Auth Routes (/api/auth/*)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId, IS_PRODUCTION,
    supabase, supabaseAdmin, USE_SUPABASE,
    authMiddleware,
    validateEmail, validatePassword,
    signupLimiter, loginLimiter,
    logSecurityEvent,
  } = deps;

  // Helper: record auth event to auth_events table
  async function recordAuthEvent(eventType, { userId, provider, ip, userAgent, metadata } = {}) {
    if (!supabaseAdmin) return;
    try {
      await supabaseAdmin.from('auth_events').insert({
        user_id: userId || null,
        event_type: eventType,
        provider: provider || 'email',
        ip_address: ip || null,
        user_agent: userAgent || null,
        metadata: metadata || {},
      });
    } catch (err) {
      logger.warn('인증 이벤트 기록 실패', { eventType, error: err.message });
    }
  }

  // Helper: mask email for security logs
  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length <= 2
      ? '*'.repeat(local.length)
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  // POST /signup - 회원가입
  router.post('/signup', signupLimiter, async (req, res) => {
    const rid = requestId();
    logger.info('POST /api/auth/signup', { requestId: rid });

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const emailV = validateEmail(req.body?.email);
    if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

    const passV = validatePassword(req.body?.password);
    if (!passV.valid) return res.status(400).json({ error: passV.error, code: 'VALIDATION_ERROR' });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailV.value,
        password: req.body.password,
        options: {
          data: {
            nickname: req.body.nickname || null,
          },
        },
      });

      if (error) {
        logSecurityEvent('SIGNUP_FAILED', {
          requestId: rid,
          email: maskEmail(emailV.value),
          ip: req.ip,
          reason: error.message,
        });

        if (error.message.includes('already registered') || error.status === 422) {
          return res.status(409).json({ error: '이미 등록된 이메일입니다.', code: 'CONFLICT' });
        }
        if (error.message.includes('email rate limit') || error.status === 429) {
          return res.status(429).json({ error: '이메일 발송 한도를 초과했습니다. 1시간 후 다시 시도해주세요.', code: 'EMAIL_RATE_LIMITED' });
        }
        logger.warn('회원가입 Supabase 오류', { requestId: rid, error: error.message });
        return res.status(400).json({ error: '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.', code: 'SIGNUP_ERROR' });
      }

      // Supabase returns user without identities for repeated signup (already registered)
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        logSecurityEvent('SIGNUP_REPEATED', {
          requestId: rid,
          email: maskEmail(emailV.value),
          ip: req.ip,
        });
        return res.status(409).json({ error: '이미 등록된 이메일입니다.', code: 'CONFLICT' });
      }

      logger.info('회원가입 성공', { requestId: rid, userId: data.user?.id });
      recordAuthEvent('signup', {
        userId: data.user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { has_nickname: !!req.body.nickname, email_confirmed: !!data.session },
      });

      res.status(201).json({
        data: {
          user: {
            id: data.user?.id,
            email: data.user?.email,
          },
          session: data.session,
        },
        message: data.session ? '회원가입 완료' : '인증 이메일이 발송되었습니다. 메일함을 확인해주세요.',
      });
    } catch (err) {
      logger.error('회원가입 처리 중 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // POST /login - 로그인
  router.post('/login', loginLimiter, async (req, res) => {
    const rid = requestId();
    logger.info('POST /api/auth/login', { requestId: rid });

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const emailV = validateEmail(req.body?.email);
    if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

    if (!req.body?.password) {
      return res.status(400).json({ error: '비밀번호를 입력해주세요.', code: 'VALIDATION_ERROR' });
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailV.value,
        password: req.body.password,
      });

      if (error) {
        logSecurityEvent('LOGIN_FAILED', {
          requestId: rid,
          email: maskEmail(emailV.value),
          ip: req.ip,
          reason: error.message,
        });
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.', code: 'UNAUTHORIZED' });
      }

      logger.info('로그인 성공', { requestId: rid, userId: data.user?.id });
      recordAuthEvent('login', {
        userId: data.user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
          },
        },
      });
    } catch (err) {
      logger.error('로그인 처리 중 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // POST /logout - 로그아웃
  router.post('/logout', authMiddleware, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE) {
      return res.json({ data: { success: true } });
    }

    try {
      if (supabaseAdmin) {
        const userId = req.user?.id;
        if (userId) {
          await supabaseAdmin.auth.admin.signOut(userId, 'global');
        }
      }
      logger.info('로그아웃 성공', { requestId: rid, userId: req.user?.id });
      recordAuthEvent('logout', { userId: req.user?.id, ip: req.ip, userAgent: req.get('user-agent') });
      res.json({ data: { success: true } });
    } catch (err) {
      logger.warn('로그아웃 처리 중 오류', { requestId: rid, error: err.message });
      res.json({ data: { success: true } }); // Always succeed for client
    }
  });

  // POST /reset-password - 비밀번호 재설정 이메일 발송
  router.post('/reset-password', loginLimiter, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const emailV = validateEmail(req.body?.email);
    if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

    try {
      // Always return success to prevent email enumeration
      await supabase.auth.resetPasswordForEmail(emailV.value);
      recordAuthEvent('password_reset', { ip: req.ip, userAgent: req.get('user-agent') });
      logger.info('비밀번호 재설정 요청', { requestId: rid });
    } catch (err) {
      logger.warn('비밀번호 재설정 오류', { requestId: rid, error: err.message });
    }

    res.json({ data: { message: '해당 이메일이 존재하면 재설정 링크가 발송됩니다.' } });
  });

  // POST /refresh - 토큰 갱신
  router.post('/refresh', loginLimiter, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const refreshToken = req.body?.refresh_token;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refresh_token이 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

      if (error || !data.session) {
        logSecurityEvent('TOKEN_REFRESH_FAILED', {
          requestId: rid,
          ip: req.ip,
          reason: error?.message || 'session is null',
        });
        return res.status(401).json({ error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.', code: 'UNAUTHORIZED' });
      }

      logger.info('토큰 갱신 성공', { requestId: rid, userId: data.user?.id });

      res.json({
        data: {
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
          },
        },
      });
    } catch (err) {
      logger.error('토큰 갱신 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // GET /oauth/:provider - OAuth 로그인 URL 생성
  router.get('/oauth/:provider', async (req, res) => {
    const rid = requestId();
    const provider = req.params.provider;

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    const allowedProviders = ['google'];
    if (!allowedProviders.includes(provider)) {
      return res.status(400).json({ error: '지원하지 않는 로그인 방식입니다.', code: 'INVALID_PROVIDER' });
    }

    try {
      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: siteUrl,
        },
      });

      if (error) {
        logger.warn('OAuth URL 생성 실패', { requestId: rid, provider, error: error.message });
        return res.status(500).json({ error: 'OAuth 로그인 처리에 실패했습니다.', code: 'OAUTH_ERROR' });
      }

      logger.info('OAuth URL 생성', { requestId: rid, provider });
      recordAuthEvent('oauth_started', { provider, ip: req.ip, userAgent: req.get('user-agent') });
      res.json({ data: { url: data.url } });
    } catch (err) {
      logger.error('OAuth 처리 중 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // GET /me - 현재 사용자 정보
  router.get('/me', authMiddleware, async (req, res) => {
    if (!req.user) {
      return res.json({ data: null });
    }

    res.json({
      data: {
        id: req.user.id,
        email: req.user.email,
      },
    });
  });

  // DELETE /account - 회원탈퇴
  router.delete('/account', authMiddleware, async (req, res) => {
    const rid = requestId();
    const userId = req.user?.id;

    logger.info('DELETE /api/auth/account', { requestId: rid, userId });

    if (!USE_SUPABASE || !supabaseAdmin) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    if (!req.body?.password) {
      return res.status(400).json({ error: '비밀번호를 입력해주세요.', code: 'VALIDATION_ERROR' });
    }

    try {
      // 비밀번호 재확인 (user-scoped client로 세션 오염 방지)
      const { error: verifyError } = await req.supabaseClient.auth.signInWithPassword({
        email: req.user.email,
        password: req.body.password,
      });
      if (verifyError) {
        logSecurityEvent('ACCOUNT_DELETE_VERIFY_FAILED', { requestId: rid, userId, ip: req.ip });
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.', code: 'INVALID_PASSWORD' });
      }

      // 1. Soft-delete all user entries
      await req.supabaseClient
        .from('entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('deleted_at', null);

      // 2. Delete user profile
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      // 3. Delete auth user (requires admin client)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        logger.error('회원탈퇴 실패', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '회원탈퇴 처리에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      logSecurityEvent('ACCOUNT_DELETED', { requestId: rid, userId, ip: req.ip });
      recordAuthEvent('account_deleted', { userId, ip: req.ip, userAgent: req.get('user-agent') });
      logger.info('회원탈퇴 완료', { requestId: rid, userId });
      res.json({ data: { success: true }, message: '회원탈퇴가 완료되었습니다.' });
    } catch (err) {
      logger.error('회원탈퇴 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  // PUT /password - 비밀번호 변경
  router.put('/password', authMiddleware, async (req, res) => {
    const rid = requestId();

    if (!USE_SUPABASE) {
      return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
    }

    if (!req.body?.currentPassword) {
      return res.status(400).json({ error: '현재 비밀번호를 입력해주세요.', code: 'VALIDATION_ERROR' });
    }

    const passV = validatePassword(req.body?.newPassword);
    if (!passV.valid) return res.status(400).json({ error: passV.error, code: 'VALIDATION_ERROR' });

    try {
      // 현재 비밀번호 검증 (user-scoped client로 세션 오염 방지)
      const { error: verifyError } = await req.supabaseClient.auth.signInWithPassword({
        email: req.user.email,
        password: req.body.currentPassword,
      });
      if (verifyError) {
        logSecurityEvent('PASSWORD_CHANGE_VERIFY_FAILED', { requestId: rid, userId: req.user?.id, ip: req.ip });
        return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.', code: 'INVALID_PASSWORD' });
      }

      const { error } = await req.supabaseClient.auth.updateUser({
        password: req.body.newPassword,
      });

      if (error) {
        logger.warn('비밀번호 변경 실패', { requestId: rid, error: error.message });
        return res.status(400).json({ error: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.', code: 'PASSWORD_CHANGE_ERROR' });
      }

      // 비밀번호 변경 후 다른 세션 무효화
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.admin.signOut(req.user.id, 'others');
          logger.info('기존 세션 무효화 완료', { requestId: rid, userId: req.user?.id });
        } catch (signOutErr) {
          logger.warn('기존 세션 무효화 실패 (비밀번호는 변경됨)', { requestId: rid, error: signOutErr.message });
        }
      }

      logSecurityEvent('PASSWORD_CHANGED', { requestId: rid, userId: req.user?.id, ip: req.ip });
      recordAuthEvent('password_changed', { userId: req.user?.id, ip: req.ip, userAgent: req.get('user-agent') });
      logger.info('비밀번호 변경 완료', { requestId: rid, userId: req.user?.id });
      res.json({ data: { success: true }, message: '비밀번호가 변경되었습니다.' });
    } catch (err) {
      logger.error('비밀번호 변경 오류', { requestId: rid, error: err.message });
      res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
