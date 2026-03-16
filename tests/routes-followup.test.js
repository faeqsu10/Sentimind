import { describe, expect, it, vi } from 'vitest';
import express from 'express';

const followupRouteFactory = require('../routes/followup');

class MockGeminiAPIError extends Error {
  constructor(message, status = 500, code = 'GEMINI_ERROR') {
    super(message);
    this.name = 'GeminiAPIError';
    this.status = status;
    this.code = code;
  }
}

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-followup',
    optionalAuth: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = null;
      next();
    },
    config: {
      followup: {
        maxOutputTokens: 256,
        temperature: 0.6,
      },
      gemini: {
        thinkingBudget: 0,
      },
    },
    GEMINI_API_KEY: 'test-api-key',
    callGeminiAPI: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        question: '그때 어떤 마음이 가장 크게 느껴졌나요?',
        empathy: '그 순간이 꽤 크게 남았겠어요.',
      }),
    }),
    GeminiAPIError: MockGeminiAPIError,
    analyzeLimiter: (_req, _res, next) => next(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', followupRouteFactory(deps));
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
      if (body !== undefined) options.body = JSON.stringify(body);
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

describe('Followup Routes', () => {
  it('returns 400 for invalid stage', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'unknown',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid emotion', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: 'a'.repeat(51),
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when userReply is too long', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'insight',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
      userReply: 'x'.repeat(2001),
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when API key is missing', async () => {
    const deps = createMockDeps({ GEMINI_API_KEY: '' });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(500);
    expect(res.data.code).toBe('INTERNAL_ERROR');
  });

  it('limits context to 10 messages and truncates each text to 500 chars', async () => {
    const callGeminiAPI = vi.fn().mockResolvedValue({
      content: JSON.stringify({ question: '다음 질문', empathy: '공감' }),
    });
    const deps = createMockDeps({ callGeminiAPI });
    const app = createApp(deps);
    const context = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'ai',
      text: `ctx-${i}-` + 'x'.repeat(600) + `-END-${i}`,
    }));

    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
      userReply: '한숨이 많이 났다.',
      context,
    });

    expect(res.status).toBe(200);
    const requestBody = callGeminiAPI.mock.calls[0][0];
    const prompt = requestBody.contents[0].parts[0].text;
    const contextLines = prompt.split('\n').filter((line) => line.startsWith('- '));

    expect(contextLines).toHaveLength(10);
    expect(prompt).toContain('ctx-0-');
    expect(prompt).not.toContain('ctx-10-');
    expect(prompt).not.toContain('ctx-11-');
    expect(prompt).not.toContain('-END-0');
  });

  it('parses JSON wrapped in a code block', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockResolvedValue({
        content: '```json\n{"question":"더 자세히 말해줄래요?","empathy":"그 마음이 이해돼요."}\n```',
      }),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      stage: 'explore',
      question: '더 자세히 말해줄래요?',
      empathy: '그 마음이 이해돼요.',
    });
  });

  it('falls back to plain text question when Gemini response is not JSON', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockResolvedValue({
        content: '그때 어떤 생각이 가장 먼저 들었나요?',
      }),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(200);
    expect(res.data.stage).toBe('explore');
    expect(res.data.question).toBe('그때 어떤 생각이 가장 먼저 들었나요?');
  });

  it('passes through GeminiAPIError status and code', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockRejectedValue(
        new MockGeminiAPIError('요청 한도를 초과했습니다.', 429, 'RATE_LIMIT')
      ),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/followup', {
      stage: 'explore',
      emotion: '불안',
      originalText: '오늘은 긴장됐다.',
    });

    expect(res.status).toBe(429);
    expect(res.data.code).toBe('RATE_LIMIT');
  });
});
