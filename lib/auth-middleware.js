// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------
// JWT 토큰을 검증하고 요청에 사용자 정보를 첨부합니다.
// Supabase Auth를 통해 발급된 JWT를 검증합니다.
//
// 사용법:
//   const { authMiddleware, optionalAuth } = require('../lib/auth-middleware');
//   app.get('/api/entries', authMiddleware, handler);
//   app.get('/api/public', optionalAuth, handler);
// ---------------------------------------------------------------------------

const { supabase, createUserClient, USE_SUPABASE } = require('../config/supabase-config');

// ---------------------------------------------------------------------------
// Required Authentication
// ---------------------------------------------------------------------------
// 인증이 필수인 엔드포인트에 사용합니다.
// 토큰이 없거나 유효하지 않으면 401을 반환합니다.

async function authMiddleware(req, res, next) {
  // Supabase가 비활성화된 경우 인증을 건너뜁니다 (개발 환경 호환)
  if (!USE_SUPABASE) {
    req.user = null;
    req.supabaseClient = null;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: '인증이 필요합니다. 로그인해주세요.',
      code: 'AUTH_MISSING',
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  if (!token || token.length < 10) {
    return res.status(401).json({
      error: '유효하지 않은 토큰입니다.',
      code: 'AUTH_INVALID_TOKEN',
    });
  }

  try {
    // Verify the JWT and get the user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // 토큰 만료 vs 변조 구분
      const isExpired = error?.message?.toLowerCase().includes('expired')
        || error?.message?.toLowerCase().includes('jwt expired');
      const code = isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID';
      const message = isExpired
        ? '토큰이 만료되었습니다. 다시 로그인해주세요.'
        : '유효하지 않은 토큰입니다. 다시 로그인해주세요.';

      // 보안 이벤트 로깅을 위해 req에 실패 정보를 남김
      req.authFailure = {
        code,
        ip: req.ip,
        reason: error?.message || 'user is null',
        path: req.path,
      };

      return res.status(401).json({ error: message, code });
    }

    // Attach user info and user-scoped Supabase client to request
    req.user = user;
    req.supabaseClient = createUserClient(token);

    next();
  } catch (err) {
    console.error(JSON.stringify({ level: 'ERROR', message: '인증 미들웨어 예외', data: { error: err.message, path: req.path } }));
    return res.status(401).json({
      error: '인증 처리 중 오류가 발생했습니다.',
      code: 'AUTH_ERROR',
    });
  }
}

// ---------------------------------------------------------------------------
// Optional Authentication
// ---------------------------------------------------------------------------
// 인증이 선택적인 엔드포인트에 사용합니다.
// 토큰이 있으면 사용자 정보를 첨부하고, 없으면 그냥 통과합니다.

async function optionalAuth(req, res, next) {
  if (!USE_SUPABASE) {
    req.user = null;
    req.supabaseClient = null;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.supabaseClient = null;
    return next();
  }

  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    req.user = null;
    req.supabaseClient = null;
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      req.supabaseClient = createUserClient(token);
    } else {
      req.user = null;
      req.supabaseClient = null;
    }
  } catch {
    req.user = null;
    req.supabaseClient = null;
  }

  next();
}

module.exports = { authMiddleware, optionalAuth };
