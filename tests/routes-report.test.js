import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const reportRouteFactory = require('../routes/report');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-report',
    USE_SUPABASE: true,
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = req._mockSupabase || {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        })),
      };
      next();
    },
    config: {
      report: { minEntries: 3, maxOutputTokens: 512, cacheTtl: 1000, cacheMaxSize: 10 },
      gemini: { temperature: 0.5, thinkingBudget: 0 },
    },
    GEMINI_API_KEY: 'test-api-key',
    callGeminiAPI: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: '요약',
        emotionTrend: '흐름',
        insight: '통찰',
        encouragement: '격려',
      }),
      tokenCost: null,
    }),
    GeminiAPIError: class MockGeminiAPIError extends Error {},
    analyzeLimiter: (_req, _res, next) => next(),
    logAiUsage: vi.fn(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', reportRouteFactory(deps));
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
        resolve({ status: res.status, data, headers: Object.fromEntries(res.headers) });
      } finally {
        server.close();
      }
    });
  });
}

describe('Report Routes', () => {
  it('returns 501 instead of crashing when Supabase is disabled', async () => {
    const deps = createMockDeps({
      USE_SUPABASE: false,
      authMiddleware: (req, _res, next) => {
        req.user = null;
        req.supabaseClient = null;
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/report?period=weekly');

    expect(res.status).toBe(501);
    expect(res.data.code).toBe('NOT_IMPLEMENTED');
  });

  it('returns 400 when there are not enough entries', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ text: '하루 기록', emotion: '평온', emoji: '😌', created_at: '2026-03-10T10:00:00Z' }],
                  error: null,
                }),
              }),
            }),
          }),
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
    const res = await request(app, 'GET', '/api/report?period=weekly');

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('INSUFFICIENT_DATA');
    expect(deps.callGeminiAPI).not.toHaveBeenCalled();
  });

  it('returns parsed report for valid data', async () => {
    const entries = [
      { text: '하루1', emotion: '기쁨', emoji: '😊', created_at: '2026-03-08T10:00:00Z' },
      { text: '하루2', emotion: '평온', emoji: '😌', created_at: '2026-03-09T10:00:00Z' },
      { text: '하루3', emotion: '감사', emoji: '🙏', created_at: '2026-03-10T10:00:00Z' },
    ];
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'user_reports') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: entries, error: null }),
                }),
              }),
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
    const res = await request(app, 'GET', '/api/report?period=weekly');

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      period: 'weekly',
      entryCount: 3,
      summary: '요약',
      emotionTrend: '흐름',
      insight: '통찰',
      encouragement: '격려',
    });
  });
});
