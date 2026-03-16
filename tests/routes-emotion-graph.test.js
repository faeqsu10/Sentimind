import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const emotionGraphRouteFactory = require('../routes/emotion-graph');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-emotion-graph',
    optionalAuth: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = createMockSupabase([]);
      next();
    },
    ...overrides,
  };
}

function createMockSupabase(result) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue(result),
            }),
          }),
        }),
      }),
    })),
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', emotionGraphRouteFactory(deps));
  return app;
}

async function request(app, method, path) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const url = `http://localhost:${port}${path}`;
      try {
        const res = await fetch(url, { method: method.toUpperCase() });
        const data = await res.json().catch(() => null);
        resolve({ status: res.status, data, headers: Object.fromEntries(res.headers) });
      } finally {
        server.close();
      }
    });
  });
}

describe('Emotion Graph Route', () => {
  it('returns empty structure for guest users', async () => {
    const deps = createMockDeps({
      optionalAuth: (req, _res, next) => {
        req.user = null;
        req.supabaseClient = null;
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      nodes: [],
      edges: [],
      constellations: [],
      meta: { totalEntries: 0, uniqueEmotions: 0 },
    });
  });

  it('rejects invalid period values', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph?period=weekly');

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when the entries query fails', async () => {
    const deps = createMockDeps({
      optionalAuth: (req, _res, next) => {
        req.user = { id: 'user-123' };
        req.supabaseClient = createMockSupabase({
          data: null,
          error: { message: 'db error' },
        });
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph');

    expect(res.status).toBe(500);
    expect(res.data.code).toBe('INTERNAL_ERROR');
  });

  it('returns empty structure when there are no entries', async () => {
    const deps = createMockDeps({
      optionalAuth: (req, _res, next) => {
        req.user = { id: 'user-123' };
        req.supabaseClient = createMockSupabase({ data: [], error: null });
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph');

    expect(res.status).toBe(200);
    expect(res.data.nodes).toEqual([]);
    expect(res.data.edges).toEqual([]);
    expect(res.data.constellations).toEqual([]);
  });

  it('canonicalizes emotion aliases and builds edges and constellations correctly', async () => {
    const entries = [
      {
        emotion: '행복',
        emoji: '😊',
        emotion_hierarchy: { level1: '긍정', level2: '기쁨' },
        related_emotions: ['감사'],
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        emotion: '감사',
        emoji: '🙏',
        emotion_hierarchy: { level1: '긍정', level2: '감사' },
        related_emotions: ['행복'],
        created_at: '2026-03-02T00:00:00Z',
      },
      {
        emotion: '행복',
        emoji: '😊',
        emotion_hierarchy: { level1: '긍정', level2: '기쁨' },
        related_emotions: [],
        created_at: '2026-03-03T00:00:00Z',
      },
      {
        emotion: '감사',
        emoji: '🙏',
        emotion_hierarchy: { level1: '긍정', level2: '감사' },
        related_emotions: ['안도'],
        created_at: '2026-03-04T00:00:00Z',
      },
      {
        emotion: '안도',
        emoji: '😌',
        emotion_hierarchy: { level1: '평온', level2: '안도감' },
        related_emotions: [],
        created_at: '2026-03-05T00:00:00Z',
      },
      {
        emotion: '자신감',
        emoji: '💪',
        emotion_hierarchy: { level1: '긍정', level2: '자신감' },
        related_emotions: [],
        created_at: '2026-03-06T00:00:00Z',
      },
      {
        emotion: '설렘',
        emoji: '✨',
        emotion_hierarchy: { level1: '긍정', level2: '설렘' },
        related_emotions: [],
        created_at: '2026-03-07T00:00:00Z',
      },
    ];

    const deps = createMockDeps({
      optionalAuth: (req, _res, next) => {
        req.user = { id: 'user-123' };
        req.supabaseClient = createMockSupabase({ data: entries, error: null });
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
      expect(res.data.meta.totalEntries).toBe(7);
    expect(res.data.meta.uniqueEmotions).toBe(5);
    expect(res.data.meta.dominantEmotion).toBe('기쁨');

    const emotionIds = res.data.nodes.map((node) => node.id);
    expect(emotionIds).toContain('기쁨');
    expect(emotionIds).toContain('안도감');
    expect(emotionIds).not.toContain('행복');
    expect(emotionIds).not.toContain('안도');

    const transitionEdge = res.data.edges.find((edge) =>
      edge.type === 'transitionsTo' && edge.source === '기쁨' && edge.target === '감사'
    );
    expect(transitionEdge).toEqual({
      source: '기쁨',
      target: '감사',
      type: 'transitionsTo',
      count: 2,
    });

    const relatedEdge = res.data.edges.find((edge) =>
      edge.type === 'relatedTo' && edge.source === '감사' && edge.target === '기쁨'
    );
    expect(relatedEdge).toEqual({
      source: '감사',
      target: '기쁨',
      type: 'relatedTo',
      count: 2,
    });

    const challengeConstellation = res.data.constellations.find((item) => item.name === '도전의 별자리');
    expect(challengeConstellation).toEqual(expect.objectContaining({
      matched: ['설렘', '안도감', '자신감'],
      progress: 0.75,
      complete: true,
    }));
  });

  it('caps the node list at 50 items', async () => {
    const entries = Array.from({ length: 55 }, (_, index) => ({
      emotion: `감정-${index}`,
      emoji: '',
      emotion_hierarchy: null,
      related_emotions: [],
      created_at: `2026-03-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const deps = createMockDeps({
      optionalAuth: (req, _res, next) => {
        req.user = { id: 'user-123' };
        req.supabaseClient = createMockSupabase({ data: entries, error: null });
        next();
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'GET', '/api/stats/emotion-graph');

    expect(res.status).toBe(200);
    expect(res.data.nodes).toHaveLength(50);
  });
});
