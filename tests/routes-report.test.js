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

  it('returns a cached report with X-Cache HIT when user_reports already has one', async () => {
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'user_reports') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'report-1',
                        period: 'weekly',
                        entry_count: 4,
                        summary: '캐시된 요약',
                        emotion_trend: '캐시된 흐름',
                        insight: '캐시된 통찰',
                        encouragement: '캐시된 격려',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
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
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.data).toEqual({
      period: 'weekly',
      entryCount: 4,
      summary: '캐시된 요약',
      emotionTrend: '캐시된 흐름',
      insight: '캐시된 통찰',
      encouragement: '캐시된 격려',
    });
    expect(deps.callGeminiAPI).not.toHaveBeenCalled();
  });

  it('returns 502 when the Gemini response cannot be parsed as JSON', async () => {
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
      callGeminiAPI: vi.fn().mockResolvedValue({ content: 'not json', tokenCost: null }),
      authMiddleware: (req, _res, next) => {
        req.user = { id: 'user-123', email: 'test@example.com' };
        req.supabaseClient = mockSupabase;
        next();
      },
    });

    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/report?period=weekly');

    expect(res.status).toBe(502);
    expect(res.data.code).toBe('AI_PARSE_ERROR');
  });

  it('returns report history with count header and mapped fields', async () => {
    const reports = [
      {
        id: 'report-1',
        period: 'weekly',
        period_start: '2026-03-09',
        period_end: '2026-03-15',
        entry_count: 4,
        summary: '요약',
        emotion_trend: '흐름',
        insight: '통찰',
        encouragement: '격려',
        created_at: '2026-03-15T12:00:00Z',
      },
    ];
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: reports, error: null, count: 1 }),
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
    const res = await request(app, 'GET', '/api/reports?period=weekly&limit=10');

    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe('1');
    expect(res.data).toEqual([{
      id: 'report-1',
      period: 'weekly',
      periodStart: '2026-03-09',
      periodEnd: '2026-03-15',
      entryCount: 4,
      summary: '요약',
      emotionTrend: '흐름',
      insight: '통찰',
      encouragement: '격려',
      createdAt: '2026-03-15T12:00:00Z',
    }]);
  });

  it('deletes a report and returns 204', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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
    const res = await request(app, 'DELETE', '/api/reports/report-1');

    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
  });
});
