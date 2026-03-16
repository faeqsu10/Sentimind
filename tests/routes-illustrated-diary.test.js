import { describe, expect, it, vi } from 'vitest';
import express from 'express';

const illustratedDiaryRouteFactory = require('../routes/illustrated-diary');

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
    requestId: () => 'test-rid-illustrated',
    optionalAuth: (req, _res, next) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = null;
      next();
    },
    config: {
      gemini: {
        thinkingBudget: 0,
      },
    },
    GEMINI_API_KEY: 'test-api-key',
    callGeminiAPI: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        title: '한숨 뒤의 햇살',
        panels: [
          { scene: 1, caption: '회의 전 마음이 무거웠다', mood: 'tense', emoji: '😮‍💨' },
          { scene: 2, caption: '점심 후 조금 숨이 트였다', mood: 'calm', emoji: '🌿' },
          { scene: 3, caption: '퇴근길엔 마음이 가벼워졌다', mood: 'relief', emoji: '🌤️' },
        ],
        closing: '오늘도 버텨낸 나를 다독여본다.',
      }),
      tokenCost: { input: 10, output: 20, total: 30, totalCost: 0.001 },
    }),
    GeminiAPIError: MockGeminiAPIError,
    validateEntryText: (text) => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { valid: false, error: '일기 내용을 입력해주세요.' };
      }
      if (text.length > 2000) {
        return { valid: false, error: '일기는 2000자 이내로 작성해주세요.' };
      }
      return { valid: true, value: text.trim() };
    },
    analyzeLimiter: (_req, _res, next) => next(),
    logAiUsage: vi.fn(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', illustratedDiaryRouteFactory(deps));
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

describe('Illustrated Diary Routes', () => {
  it('returns 400 for invalid text', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '',
      emotion: '불안',
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when emotion is missing', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when API key is missing', async () => {
    const deps = createMockDeps({ GEMINI_API_KEY: null });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
    });

    expect(res.status).toBe(500);
    expect(res.data.code).toBe('INTERNAL_ERROR');
  });

  it('truncates emoji to 10 characters in the Gemini prompt', async () => {
    const callGeminiAPI = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        title: '테스트 제목',
        panels: [
          { scene: 1, caption: '하나', mood: 'calm', emoji: '🙂' },
          { scene: 2, caption: '둘', mood: 'calm', emoji: '🙂' },
          { scene: 3, caption: '셋', mood: 'calm', emoji: '🙂' },
        ],
        closing: '테스트 마무리',
      }),
      tokenCost: null,
    });
    const deps = createMockDeps({ callGeminiAPI });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
      emoji: '123456789012345',
    });

    expect(res.status).toBe(200);
    const requestBody = callGeminiAPI.mock.calls[0][0];
    const prompt = requestBody.contents[0].parts[0].text;
    expect(prompt).toContain('1234567890');
    expect(prompt).not.toContain('12345678901');
  });

  it('parses JSON wrapped in a code block', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockResolvedValue({
        content: '```json\n{"title":"퇴근길의 숨","panels":[{"caption":"긴장이 조금 풀렸다","mood":"tense","emoji":"😮‍💨"},{"caption":"창밖 바람이 시원했다","mood":"calm","emoji":"🍃"},{"caption":"집 앞에서 마음이 놓였다","mood":"relief","emoji":"🌙"}],"closing":"오늘도 무사히 지나갔다."}\n```',
        tokenCost: null,
      }),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
      emoji: '😮‍💨',
    });

    expect(res.status).toBe(200);
    expect(res.data.title).toBe('퇴근길의 숨');
    expect(res.data.panels).toHaveLength(3);
  });

  it('returns 500 when Gemini returns invalid panel structure', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          title: '패널 부족',
          panels: [
            { caption: '하나', mood: 'calm', emoji: '🙂' },
            { caption: '둘', mood: 'calm', emoji: '🙂' },
          ],
          closing: '끝',
        }),
        tokenCost: null,
      }),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
    });

    expect(res.status).toBe(500);
    expect(res.data.code).toBe('INTERNAL_ERROR');
  });

  it('passes through GeminiAPIError status and code', async () => {
    const deps = createMockDeps({
      callGeminiAPI: vi.fn().mockRejectedValue(
        new MockGeminiAPIError('Gemini 장애', 503, 'UPSTREAM_UNAVAILABLE')
      ),
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
    });

    expect(res.status).toBe(503);
    expect(res.data.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('logs AI usage on success', async () => {
    const logAiUsage = vi.fn();
    const deps = createMockDeps({ logAiUsage });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/illustrated-diary', {
      text: '오늘은 긴장했지만 결국 잘 끝냈다.',
      emotion: '불안',
      emoji: '😮‍💨',
    });

    expect(res.status).toBe(200);
    expect(logAiUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-123',
      endpoint: 'illustrated-diary',
      durationMs: expect.any(Number),
    }));
  });
});
