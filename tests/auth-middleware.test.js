import { afterEach, describe, expect, it, vi } from 'vitest';

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function loadModule({ getUserResult }) {
  const getUser = vi.fn().mockResolvedValue(getUserResult);
  const userClient = { kind: 'user-client' };
  const createUserClient = vi.fn(() => userClient);

  const configPath = require.resolve('../config/supabase-config');
  const middlewarePath = require.resolve('../lib/auth-middleware');

  delete require.cache[configPath];
  delete require.cache[middlewarePath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      USE_SUPABASE: true,
      supabase: { auth: { getUser } },
      createUserClient,
    },
  };

  const mod = require('../lib/auth-middleware');
  return {
    authMiddleware: mod.authMiddleware,
    optionalAuth: mod.optionalAuth,
    getUser,
    createUserClient,
    userClient,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  delete require.cache[require.resolve('../config/supabase-config')];
  delete require.cache[require.resolve('../lib/auth-middleware')];
});

describe('auth middleware', () => {
  describe('authMiddleware', () => {
    it('returns AUTH_MISSING when Authorization header is absent', async () => {
      const { authMiddleware } = loadModule({
        getUserResult: { data: { user: null }, error: null },
      });
      const req = { headers: {}, path: '/api/entries' };
      const res = createRes();
      const next = vi.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_MISSING' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns AUTH_INVALID_TOKEN for too-short bearer token', async () => {
      const { authMiddleware } = loadModule({
        getUserResult: { data: { user: null }, error: null },
      });
      const req = { headers: { authorization: 'Bearer short' }, path: '/api/entries' };
      const res = createRes();
      const next = vi.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_INVALID_TOKEN' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns AUTH_TOKEN_EXPIRED and stores authFailure for expired token', async () => {
      const { authMiddleware, getUser } = loadModule({
        getUserResult: {
          data: { user: null },
          error: { message: 'JWT expired' },
        },
      });
      const req = {
        headers: { authorization: 'Bearer valid-token-12345' },
        path: '/api/entries',
        ip: '127.0.0.1',
      };
      const res = createRes();
      const next = vi.fn();

      await authMiddleware(req, res, next);

      expect(getUser).toHaveBeenCalledWith('valid-token-12345');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_TOKEN_EXPIRED' }));
      expect(req.authFailure).toEqual(expect.objectContaining({
        code: 'AUTH_TOKEN_EXPIRED',
        ip: '127.0.0.1',
        path: '/api/entries',
        reason: 'JWT expired',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns AUTH_TOKEN_INVALID and stores authFailure for invalid token', async () => {
      const { authMiddleware } = loadModule({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid JWT' },
        },
      });
      const req = {
        headers: { authorization: 'Bearer valid-token-12345' },
        path: '/api/profile',
        ip: '127.0.0.1',
      };
      const res = createRes();
      const next = vi.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }));
      expect(req.authFailure).toEqual(expect.objectContaining({
        code: 'AUTH_TOKEN_INVALID',
        path: '/api/profile',
        ip: '127.0.0.1',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('attaches req.user and req.supabaseClient on valid token', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const { authMiddleware, createUserClient, userClient } = loadModule({
        getUserResult: {
          data: { user },
          error: null,
        },
      });
      const req = { headers: { authorization: 'Bearer valid-token-12345' }, path: '/api/profile' };
      const res = createRes();
      const next = vi.fn();

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(user);
      expect(createUserClient).toHaveBeenCalledWith('valid-token-12345');
      expect(req.supabaseClient).toBe(userClient);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('passes through with null auth state when Authorization header is absent', async () => {
      const { optionalAuth } = loadModule({
        getUserResult: { data: { user: null }, error: null },
      });
      const req = { headers: {}, path: '/api/stats' };
      const res = createRes();
      const next = vi.fn();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(req.supabaseClient).toBeNull();
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('passes through with null auth state for too-short bearer token', async () => {
      const { optionalAuth } = loadModule({
        getUserResult: { data: { user: null }, error: null },
      });
      const req = { headers: { authorization: 'Bearer short' }, path: '/api/stats' };
      const res = createRes();
      const next = vi.fn();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(req.supabaseClient).toBeNull();
      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through with null auth state for invalid token', async () => {
      const { optionalAuth } = loadModule({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid token' },
        },
      });
      const req = { headers: { authorization: 'Bearer valid-token-12345' }, path: '/api/stats' };
      const res = createRes();
      const next = vi.fn();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(req.supabaseClient).toBeNull();
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('attaches req.user and req.supabaseClient for a valid token', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const { optionalAuth, createUserClient, userClient } = loadModule({
        getUserResult: {
          data: { user },
          error: null,
        },
      });
      const req = { headers: { authorization: 'Bearer valid-token-12345' }, path: '/api/stats' };
      const res = createRes();
      const next = vi.fn();

      await optionalAuth(req, res, next);

      expect(req.user).toEqual(user);
      expect(createUserClient).toHaveBeenCalledWith('valid-token-12345');
      expect(req.supabaseClient).toBe(userClient);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
