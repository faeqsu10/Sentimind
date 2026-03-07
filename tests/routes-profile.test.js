import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const profileRouteFactory = require('../routes/profile');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    requestId: () => 'test-rid-001',
    USE_SUPABASE: true,
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = req._mockSupabase || createMockSupabase();
      next();
    },
    validateNickname: (v) => {
      if (v === undefined) return { valid: true };
      if (typeof v !== 'string') return { valid: false, error: '닉네임은 문자열이어야 합니다.' };
      return { valid: true, value: v.trim() };
    },
    validateBio: (v) => {
      if (v === undefined) return { valid: true };
      if (typeof v !== 'string') return { valid: false, error: '소개는 문자열이어야 합니다.' };
      if (v.length > 200) return { valid: false, error: '소개는 200자 이내여야 합니다.' };
      return { valid: true, value: v.trim() || null };
    },
    validateTheme: (v) => {
      if (v === undefined) return { valid: true };
      if (v !== 'light' && v !== 'dark') return { valid: false, error: '테마는 light 또는 dark여야 합니다.' };
      return { valid: true, value: v };
    },
    validateNotificationTime: (v) => {
      if (v === undefined) return { valid: true };
      if (!/^\d{2}:\d{2}$/.test(v)) return { valid: false, error: '시간 형식이 올바르지 않습니다.' };
      return { valid: true, value: v + ':00' };
    },
    ...overrides,
  };
}

function createMockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', nickname: '테스트', theme: 'light' },
            error: null,
          }),
        }),
        count: 'exact',
        head: true,
      }),
    })),
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = profileRouteFactory(deps);
  app.use('/api', router);
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

describe('Profile Routes', () => {
  describe('GET /api/profile', () => {
    it('returns profile with entry count', async () => {
      const profileData = { id: 'user-123', nickname: '테스트', theme: 'light' };
      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'user_profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
                }),
              }),
            };
          }
          // entries count
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ count: 42 }),
              }),
            }),
          };
        }),
      };

      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123', email: 'test@example.com' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/profile');
      expect(res.status).toBe(200);
      expect(res.data.data.nickname).toBe('테스트');
      expect(res.data.data.email).toBe('test@example.com');
      expect(res.data.data.total_entries).toBe(42);
    });

    it('returns 404 when profile not found', async () => {
      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'user_profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ count: 0 }),
              }),
            }),
          };
        }),
      };

      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123', email: 'test@example.com' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/profile');
      expect(res.status).toBe(404);
      expect(res.data.code).toBe('NOT_FOUND');
    });

    it('returns stub when Supabase disabled', async () => {
      const deps = createMockDeps({ USE_SUPABASE: false });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/profile');
      expect(res.status).toBe(200);
      expect(res.data.data.id).toBeNull();
    });
  });

  describe('PATCH /api/profile', () => {
    it('rejects empty update', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'PATCH', '/api/profile', {});
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid theme', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'PATCH', '/api/profile', { theme: 'neon' });
      expect(res.status).toBe(400);
    });

    it('updates valid fields', async () => {
      const updated = { id: 'user-123', nickname: '새닉네임', theme: 'dark' };
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updated, error: null }),
              }),
            }),
          }),
        })),
      };

      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'PATCH', '/api/profile', { nickname: '새닉네임', theme: 'dark' });
      expect(res.status).toBe(200);
      expect(res.data.data.nickname).toBe('새닉네임');
    });

    it('handles boolean fields', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { onboarding_completed: true }, error: null }),
              }),
            }),
          }),
        })),
      };

      const deps = createMockDeps({
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'PATCH', '/api/profile', { onboarding_completed: true });
      expect(res.status).toBe(200);
    });
  });
});
