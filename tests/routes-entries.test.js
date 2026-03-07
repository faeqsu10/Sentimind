import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Dynamic import of route factory
const entriesRouteFactory = require('../routes/entries');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-001',
    USE_SUPABASE: true,
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = req._mockSupabase || createMockSupabase();
      next();
    },
    validateEntryText: (text) => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { valid: false, error: '일기 내용을 입력해주세요.' };
      }
      if (text.length > 2000) return { valid: false, error: '일기는 2000자 이내로 작성해주세요.' };
      return { valid: true, value: text.trim() };
    },
    validateConfidenceScore: (score) => {
      if (score === undefined || score === null) return { valid: true, value: 0 };
      const num = parseInt(score, 10);
      if (isNaN(num) || num < 0 || num > 100) return { valid: false, error: '신뢰도 점수는 0~100 사이여야 합니다.' };
      return { valid: true, value: num };
    },
    validatePagination: (query) => ({
      limit: Math.min(Math.max(parseInt(query.limit) || 20, 1), 100),
      offset: Math.max(parseInt(query.offset) || 0, 0),
    }),
    sanitizeString: (str, maxLength = 500) => {
      if (typeof str !== 'string') return '';
      return str.slice(0, maxLength).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    isPlainObject: (val) => val !== null && typeof val === 'object' && !Array.isArray(val),
    updateStreak: vi.fn().mockResolvedValue(undefined),
    readEntries: vi.fn().mockResolvedValue([]),
    writeEntries: vi.fn().mockResolvedValue(undefined),
    generateId: () => 'mock-entry-id-001',
    ...overrides,
  };
}

function createMockSupabase(overrides = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined, // not a promise itself
  };

  return {
    from: vi.fn(() => ({
      ...chainable,
      ...overrides,
    })),
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = entriesRouteFactory(deps);
  app.use('/api', router);
  return app;
}

async function request(app, method, path, body) {
  // Simple integration test using supertest-like approach
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
        resolve({ status: res.status, data, headers: Object.fromEntries(res.headers) });
      } finally {
        server.close();
      }
    });
  });
}

describe('Entries Routes', () => {
  describe('POST /api/entries', () => {
    it('rejects empty body', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/entries', {});
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty text', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/entries', { text: '' });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('creates entry with valid data', async () => {
      const mockEntry = {
        id: 'mock-entry-id-001',
        user_id: 'user-123',
        text: '오늘 기분이 좋아요',
        emotion: '기쁨',
        emoji: '😊',
        message: '좋은 하루네요',
        created_at: '2026-03-08T10:00:00Z',
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEntry, error: null }),
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
      const res = await request(app, 'POST', '/api/entries', {
        text: '오늘 기분이 좋아요',
        emotion: '기쁨',
        emoji: '😊',
        message: '좋은 하루네요',
      });
      expect(res.status).toBe(201);
      expect(res.data.id).toBe('mock-entry-id-001');
      expect(res.data.date).toBe('2026-03-08T10:00:00Z');
      expect(deps.updateStreak).toHaveBeenCalled();
    });

    it('handles Supabase insert error', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
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
      const res = await request(app, 'POST', '/api/entries', {
        text: '테스트 일기',
        emotion: '평온',
      });
      expect(res.status).toBe(500);
      expect(res.data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/entries', () => {
    it('returns entries list', async () => {
      const entries = [
        { id: '1', text: '일기1', emotion: '기쁨', created_at: '2026-03-08T10:00:00Z' },
        { id: '2', text: '일기2', emotion: '평온', created_at: '2026-03-07T10:00:00Z' },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: entries, error: null, count: 2 }),
                }),
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
      const res = await request(app, 'GET', '/api/entries');
      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(2);
      expect(res.data[0].date).toBe('2026-03-08T10:00:00Z');
    });
  });

  describe('DELETE /api/entries/:id', () => {
    it('soft-deletes an entry', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'entry-1' }, error: null }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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
      const res = await request(app, 'DELETE', '/api/entries/entry-1');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('returns 404 for non-existent entry', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
                }),
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
      const res = await request(app, 'DELETE', '/api/entries/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/export', () => {
    it('exports JSON format', async () => {
      const entries = [
        { text: '일기1', emotion: '기쁨', emoji: '😊', created_at: '2026-03-08T10:00:00Z', confidence_score: 85 },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: entries, error: null }),
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
      const res = await request(app, 'GET', '/api/export?format=json');
      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(1);
    });

    it('rejects invalid format', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/export?format=xml');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });
  });
});
