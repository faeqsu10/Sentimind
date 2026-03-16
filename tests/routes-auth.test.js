import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const authRouteFactory = require('../routes/auth');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-001',
    IS_PRODUCTION: false,
    supabase: {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        refreshSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signInAnonymously: vi.fn(),
      },
    },
    supabaseAdmin: {
      auth: { admin: { signOut: vi.fn(), deleteUser: vi.fn() } },
      from: vi.fn(),
    },
    USE_SUPABASE: true,
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = {
        auth: {
          signInWithPassword: vi.fn(),
          updateUser: vi.fn(),
        },
        from: vi.fn(),
      };
      next();
    },
    validateEmail: (email) => {
      if (!email || typeof email !== 'string') return { valid: false, error: '이메일을 입력해주세요.' };
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: '유효한 이메일 형식이 아닙니다.' };
      return { valid: true, value: trimmed };
    },
    validatePassword: (password) => {
      if (!password || typeof password !== 'string') return { valid: false, error: '비밀번호를 입력해주세요.' };
      if (password.length < 8) return { valid: false, error: '비밀번호는 8자 이상이어야 합니다.' };
      if (!/[a-zA-Z]/.test(password)) return { valid: false, error: '비밀번호에 영문자를 포함해주세요.' };
      if (!/\d/.test(password)) return { valid: false, error: '비밀번호에 숫자를 포함해주세요.' };
      return { valid: true };
    },
    signupLimiter: (_req, _res, next) => next(),
    loginLimiter: (_req, _res, next) => next(),
    logSecurityEvent: vi.fn(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = authRouteFactory(deps);
  app.use('/api/auth', router);
  return app;
}

async function request(app, method, path, body) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const url = `http://localhost:${port}${path}`;
      const options = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) options.body = JSON.stringify(body);
      try {
        const res = await fetch(url, options);
        const data = await res.json().catch(() => null);
        resolve({ status: res.status, data });
      } finally {
        server.close();
      }
    });
  });
}

describe('Auth Routes', () => {
  describe('POST /api/auth/signup', () => {
    it('rejects missing email', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/signup', { password: 'Test1234' });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid email format', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/signup', { email: 'not-email', password: 'Test1234' });
      expect(res.status).toBe(400);
    });

    it('rejects weak password', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/signup', { email: 'test@example.com', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('creates account with valid data', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-1', email: 'test@example.com', identities: [{}] },
          session: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' },
        },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/signup', {
        email: 'test@example.com',
        password: 'Test1234',
      });
      expect(res.status).toBe(201);
      expect(res.data.data.user.id).toBe('new-user-1');
    });

    it('handles duplicate email (409)', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'x', identities: [] }, session: null },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/signup', {
        email: 'existing@example.com',
        password: 'Test1234',
      });
      expect(res.status).toBe(409);
      expect(res.data.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects missing password', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/login', { email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('returns tokens on successful login', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@example.com' },
          session: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' },
        },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/login', {
        email: 'test@example.com',
        password: 'Test1234',
      });
      expect(res.status).toBe(200);
      expect(res.data.data.session.access_token).toBe('tok');
    });

    it('returns 401 on wrong credentials', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/login', {
        email: 'test@example.com',
        password: 'WrongPass1',
      });
      expect(res.status).toBe(401);
      expect(deps.logSecurityEvent).toHaveBeenCalledWith('LOGIN_FAILED', expect.any(Object));
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('always returns success (no email enumeration)', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.resetPasswordForEmail.mockResolvedValue({});
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/reset-password', {
        email: 'anyone@example.com',
      });
      expect(res.status).toBe(200);
      expect(res.data.data.message).toContain('존재하면');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rejects missing refresh_token', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      // refresh uses loginLimiter, not authMiddleware
      const res = await request(app, 'POST', '/api/auth/refresh', {});
      expect(res.status).toBe(400);
    });

    it('returns new tokens on valid refresh', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.refreshSession.mockResolvedValue({
        data: {
          user: { id: 'user-1' },
          session: { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 3600, token_type: 'bearer' },
        },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/refresh', {
        refresh_token: 'old-ref',
      });
      expect(res.status).toBe(200);
      expect(res.data.data.session.access_token).toBe('new-tok');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user info', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.data.data.id).toBe('user-123');
      expect(res.data.data.email).toBe('test@example.com');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns success even when admin signOut throws', async () => {
      const deps = createMockDeps();
      deps.supabaseAdmin.auth.admin.signOut.mockRejectedValue(new Error('signout failed'));
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.data.data.success).toBe(true);
    });
  });

  describe('GET /api/auth/oauth/:provider', () => {
    it('rejects unsupported provider', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/auth/oauth/github');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('INVALID_PROVIDER');
    });

    it('returns google oauth url on success', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth' },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/auth/oauth/google');
      expect(res.status).toBe(200);
      expect(res.data.data.url).toContain('google.com');
    });
  });

  describe('POST /api/auth/anonymous', () => {
    it('returns anonymous session on success', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signInAnonymously.mockResolvedValue({
        data: {
          user: { id: 'anon-1' },
          session: {
            access_token: 'anon-access',
            refresh_token: 'anon-refresh',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/anonymous');
      expect(res.status).toBe(200);
      expect(res.data.data.user).toEqual({ id: 'anon-1', is_anonymous: true });
      expect(res.data.data.session.access_token).toBe('anon-access');
    });

    it('returns 400 when anonymous sign-in fails', async () => {
      const deps = createMockDeps();
      deps.supabase.auth.signInAnonymously.mockResolvedValue({
        data: null,
        error: { message: 'anonymous disabled' },
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/anonymous');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('ANON_LOGIN_ERROR');
    });
  });

  describe('POST /api/auth/link-account', () => {
    it('returns 409 on duplicate email', async () => {
      const updateUser = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'already registered', status: 422 },
      });
      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'anon-1', email: null, is_anonymous: true };
          req.supabaseClient = {
            auth: { signInWithPassword: vi.fn(), updateUser },
            from: vi.fn(),
          };
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/link-account', {
        email: 'existing@example.com',
        password: 'Test1234',
      });
      expect(res.status).toBe(409);
      expect(res.data.code).toBe('CONFLICT');
    });

    it('updates profile and returns linked account on success', async () => {
      const updateUser = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'linked@example.com' },
          session: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      });
      const profileEq = vi.fn().mockResolvedValue({ error: null });
      const profileUpdate = vi.fn().mockReturnValue({ eq: profileEq });
      const deps = createMockDeps({
        supabaseAdmin: {
          auth: { admin: { signOut: vi.fn(), deleteUser: vi.fn() } },
          from: vi.fn(() => ({ update: profileUpdate })),
        },
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'anon-1', email: null, is_anonymous: true };
          req.supabaseClient = {
            auth: { signInWithPassword: vi.fn(), updateUser },
            from: vi.fn(),
          };
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/auth/link-account', {
        email: 'linked@example.com',
        password: 'Test1234',
        nickname: '새닉네임',
      });
      expect(res.status).toBe(200);
      expect(res.data.data.user.email).toBe('linked@example.com');
      expect(deps.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
      expect(profileUpdate).toHaveBeenCalledWith({ is_anonymous: false, nickname: '새닉네임' });
      expect(profileEq).toHaveBeenCalledWith('id', 'anon-1');
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('rejects missing password', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'DELETE', '/api/auth/account');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when password verification fails', async () => {
      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123', email: 'test@example.com' };
          req.supabaseClient = {
            auth: {
              signInWithPassword: vi.fn().mockResolvedValue({
                error: { message: 'Invalid login credentials' },
              }),
              updateUser: vi.fn(),
            },
            from: vi.fn(),
          };
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'DELETE', '/api/auth/account', {
        password: 'WrongPass1',
      });
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_PASSWORD');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('rejects missing current password', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'PUT', '/api/auth/password', {
        newPassword: 'NewPass123',
      });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when current password is invalid', async () => {
      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123', email: 'test@example.com' };
          req.supabaseClient = {
            auth: {
              signInWithPassword: vi.fn().mockResolvedValue({
                error: { message: 'Invalid login credentials' },
              }),
              updateUser: vi.fn(),
            },
            from: vi.fn(),
          };
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'PUT', '/api/auth/password', {
        currentPassword: 'WrongPass1',
        newPassword: 'NewPass123',
      });
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_PASSWORD');
    });
  });
});
