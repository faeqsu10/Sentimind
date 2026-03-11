import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const migrateRouteFactory = require('../routes/migrate');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-migrate',
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = req._mockSupabase || {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: 'entry-1' }], error: null }),
          }),
        })),
      };
      next();
    },
    supabaseAdmin: null,
    sanitizeString: (str, maxLength = 500) => (typeof str === 'string' ? str.slice(0, maxLength) : ''),
    validateEntryText: (text) => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { valid: false, error: '일기 내용을 입력해주세요.' };
      }
      if (text.length > 2000) return { valid: false, error: '일기는 2000자 이내로 작성해주세요.' };
      return { valid: true, value: text.trim() };
    },
    generateId: () => 'generated-id',
    config: { migration: { maxEntries: 10 } },
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', migrateRouteFactory(deps));
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

describe('Migrate Routes', () => {
  it('returns 501 instead of crashing when Supabase client is unavailable', async () => {
    const deps = createMockDeps({
      authMiddleware: (req, _res, next) => {
        req.user = null;
        req.supabaseClient = null;
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/migrate/from-guest', {
      entries: [{ text: '게스트 일기' }],
    });

    expect(res.status).toBe(501);
    expect(res.data.code).toBe('NOT_IMPLEMENTED');
  });

  it('rejects empty entries array', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/migrate/from-guest', { entries: [] });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('migrates valid guest entries', async () => {
    const insertedRows = [];
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn((rows) => {
          insertedRows.push(...rows);
          return {
            select: vi.fn().mockResolvedValue({ data: rows.map((row) => ({ id: row.id })), error: null }),
          };
        }),
      })),
    };
    const deps = createMockDeps({
      authMiddleware: (req, _res, next) => {
        req.user = { id: 'user-123', email: 'test@example.com' };
        req.supabaseClient = mockSupabase;
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/migrate/from-guest', {
      entries: [{ text: '게스트 일기', emotion: '기쁨', date: '2026-03-11T01:00:00Z' }],
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ success: true, imported: 1, skipped: 0 });
    expect(insertedRows[0]).toMatchObject({
      user_id: 'user-123',
      text: '게스트 일기',
      emotion: '기쁨',
    });
  });
});
