import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

const analyzeRouteFactory = require('../routes/analyze');

// GeminiAPIError를 모방하는 커스텀 에러 클래스
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
    requestId: () => 'test-rid-analyze',
    optionalAuth: (req, _res, next) => {
      // 기본: 인증된 사용자
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = null;
      next();
    },
    config: {
      gemini: {
        maxOutputTokens: 1024,
        temperature: 0.7,
        thinkingBudget: 0,
        model: 'gemini-2.5-flash',
      },
      crisis: {
        keywords: ['죽고 싶', '자해', '자살', '살고 싶지 않', '끝내고 싶', '사라지고 싶'],
        severeEmotions: ['절망', '극심한 우울', '자기혐오', '공허'],
      },
    },
    GEMINI_API_KEY: 'test-api-key',
    ontologyEngine: vi.fn().mockReturnValue(null),
    SYSTEM_PROMPT: '당신은 감정 분석 AI입니다.',
    callGeminiAPI: vi.fn().mockResolvedValue({
      content: JSON.stringify({ emotion: '기쁨', message: '좋은 하루네요', emoji: '😊' }),
      tokenCost: null,
    }),
    GeminiAPIError: MockGeminiAPIError,
    validateEntryText: (text) => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { valid: false, error: '일기 내용을 입력해주세요.' };
      }
      if (text.length > 2000) return { valid: false, error: '일기는 2000자 이내로 작성해주세요.' };
      return { valid: true, value: text.trim() };
    },
    parseGeminiResponse: vi.fn((content) => JSON.parse(content)),
    analyzeLimiter: (_req, _res, next) => next(),
    logAiUsage: vi.fn(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = analyzeRouteFactory(deps);
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

describe('Analyze Routes', () => {
  describe('POST /api/analyze — 입력 유효성 검증', () => {
    it('빈 텍스트이면 400 VALIDATION_ERROR를 반환한다', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '' });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('text 필드가 없으면 400 VALIDATION_ERROR를 반환한다', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', {});
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('공백만 있는 텍스트이면 400을 반환한다', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '   ' });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('2000자 초과 텍스트이면 400을 반환한다', async () => {
      const deps = createMockDeps();
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: 'a'.repeat(2001) });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/analyze — API 키 설정', () => {
    it('API 키 미설정이면 500 INTERNAL_ERROR를 반환한다', async () => {
      const deps = createMockDeps({ GEMINI_API_KEY: '' });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 기분이 좋아요' });
      expect(res.status).toBe(500);
      expect(res.data.code).toBe('INTERNAL_ERROR');
    });

    it('API 키가 null이면 500을 반환한다', async () => {
      const deps = createMockDeps({ GEMINI_API_KEY: null });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 기분이 좋아요' });
      expect(res.status).toBe(500);
      expect(res.data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/analyze — Gemini API 성공', () => {
    it('감정 분석 결과를 반환한다', async () => {
      const geminiResult = { emotion: '기쁨', message: '좋은 하루네요', emoji: '😊', confidence: 85 };
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue(geminiResult),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 정말 즐거운 하루였어요' });
      expect(res.status).toBe(200);
      expect(res.data.emotion).toBe('기쁨');
      expect(res.data.message).toBe('좋은 하루네요');
      expect(res.data.emoji).toBe('😊');
    });

    it('callGeminiAPI에 올바른 requestBody 구조를 전달한다', async () => {
      const callGeminiAPI = vi.fn().mockResolvedValue({
        content: JSON.stringify({ emotion: '평온', message: '안정적이네요', emoji: '😌' }),
        tokenCost: null,
      });
      const parseGeminiResponse = vi.fn().mockReturnValue({ emotion: '평온', message: '안정적이네요', emoji: '😌' });
      const deps = createMockDeps({ callGeminiAPI, parseGeminiResponse });
      const app = createApp(deps);
      await request(app, 'POST', '/api/analyze', { text: '오늘은 평온한 날이에요' });
      expect(callGeminiAPI).toHaveBeenCalledOnce();
      const [requestBody] = callGeminiAPI.mock.calls[0];
      expect(requestBody.contents[0].role).toBe('user');
      expect(requestBody.systemInstruction.parts[0].text).toContain('당신은 감정 분석 AI입니다.');
      expect(requestBody.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    });

    it('프로필 개인화 설정을 프롬프트와 응답 메타에 반영한다', async () => {
      const callGeminiAPI = vi.fn().mockResolvedValue({
        content: JSON.stringify({ emotion: '평온', message: '안정적이네요', emoji: '😌' }),
        tokenCost: null,
      });
      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    response_length: 'detailed',
                    advice_style: 'actionable',
                    persona_preset: 'gentle_friend',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }),
      };
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123', email: 'test@example.com' };
          req.supabaseClient = mockSupabase;
          next();
        },
        callGeminiAPI,
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘은 한숨 돌릴 수 있었다' });

      expect(res.status).toBe(200);
      expect(res.data.personalization).toEqual({
        applied_response_length: 'detailed',
        applied_advice_style: 'actionable',
        applied_persona_preset: 'gentle_friend',
        safety_mode: 'normal',
      });

      const [requestBody] = callGeminiAPI.mock.calls[0];
      expect(requestBody.systemInstruction.parts[0].text).toContain('단짝 친구처럼 반응하세요');
      expect(requestBody.systemInstruction.parts[0].text).toContain('조금 더 자세히');
      expect(requestBody.systemInstruction.parts[0].text).toContain('작고 구체적인 다음 행동');
    });
  });

  describe('POST /api/analyze — GeminiAPIError 처리', () => {
    it('429 Rate Limit 에러를 처리한다', async () => {
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockRejectedValue(
          new MockGeminiAPIError('API 요청 한도를 초과했습니다.', 429, 'RATE_LIMIT')
        ),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 기분이 좋아요' });
      expect(res.status).toBe(429);
      expect(res.data.code).toBe('RATE_LIMIT');
    });

    it('502 Bad Gateway 에러를 처리한다', async () => {
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockRejectedValue(
          new MockGeminiAPIError('Gemini API 서버 오류', 502, 'BAD_GATEWAY')
        ),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 기분이 좋아요' });
      expect(res.status).toBe(502);
      expect(res.data.code).toBe('BAD_GATEWAY');
    });

    it('일반 Error이면 500 INTERNAL_ERROR를 반환한다', async () => {
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockRejectedValue(new Error('예상치 못한 오류')),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 기분이 좋아요' });
      expect(res.status).toBe(500);
      expect(res.data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/analyze — 위기 키워드 감지', () => {
    it('위기 키워드 포함 시 crisis_detected=true를 반환한다', async () => {
      const geminiResult = { emotion: '슬픔', message: '힘드시겠어요', emoji: '😢' };
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '죽고 싶다는 생각이 든다' });
      expect(res.status).toBe(200);
      expect(res.data.crisis_detected).toBe(true);
    });

    it('위기 감정(절망)이면 crisis_detected=true를 반환한다', async () => {
      const geminiResult = { emotion: '절망', message: '많이 힘드시겠어요', emoji: '😔' };
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘은 너무 힘들었다' });
      expect(res.status).toBe(200);
      expect(res.data.crisis_detected).toBe(true);
    });

    it('위기 키워드 없고 일반 감정이면 crisis_detected 가 없다', async () => {
      const geminiResult = { emotion: '기쁨', message: '좋은 하루네요', emoji: '😊' };
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 날씨가 좋아서 기분이 좋았다' });
      expect(res.status).toBe(200);
      expect(res.data.crisis_detected).toBeUndefined();
    });

    it('다른 위기 감정(자기혐오)도 crisis_detected=true를 반환한다', async () => {
      const geminiResult = { emotion: '자기혐오', message: '많이 힘드시겠어요', emoji: '😞' };
      const deps = createMockDeps({
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘도 별로였다' });
      expect(res.status).toBe(200);
      expect(res.data.crisis_detected).toBe(true);
    });
  });

  describe('POST /api/analyze — optionalAuth (게스트/인증 모두 접근 가능)', () => {
    it('인증 없이도(게스트) 분석 요청이 성공한다', async () => {
      const geminiResult = { emotion: '평온', message: '안정적이네요', emoji: '😌' };
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => {
          // 인증 없음 — 게스트 모드
          next();
        },
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘은 평범한 하루였다' });
      expect(res.status).toBe(200);
      expect(res.data.emotion).toBe('평온');
    });

    it('인증된 사용자도 분석 요청이 성공한다', async () => {
      const geminiResult = { emotion: '기쁨', message: '좋은 하루네요', emoji: '😊' };
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-456' };
          req.supabaseClient = null;
          next();
        },
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(geminiResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...geminiResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 좋은 일이 있었다' });
      expect(res.status).toBe(200);
      expect(res.data.emotion).toBe('기쁨');
    });
  });

  describe('POST /api/analyze — 온톨로지 enrichment', () => {
    it('ontologyEngine이 있으면 enrichEmotion이 호출된다', async () => {
      const enrichedResult = {
        emotion: '기쁨',
        message: '좋은 하루네요',
        emoji: '😊',
        ontology: { confidence: 85, situation_context: [] },
      };
      const mockEnrich = vi.fn().mockReturnValue(enrichedResult);
      const mockEngine = { enrichEmotion: mockEnrich };
      const rawResult = { emotion: '기쁨', message: '좋은 하루네요', emoji: '😊' };

      const deps = createMockDeps({
        ontologyEngine: vi.fn().mockReturnValue(mockEngine),
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(rawResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...rawResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘 좋은 일이 있었다' });
      expect(res.status).toBe(200);
      expect(mockEnrich).toHaveBeenCalledOnce();
      expect(mockEnrich).toHaveBeenCalledWith('기쁨', '오늘 좋은 일이 있었다', rawResult);
      expect(res.data.ontology).toBeDefined();
      expect(res.data.ontology.confidence).toBe(85);
    });

    it('ontologyEngine이 null이면 원본 결과를 그대로 반환한다', async () => {
      const rawResult = { emotion: '평온', message: '안정적이네요', emoji: '😌' };
      const deps = createMockDeps({
        ontologyEngine: vi.fn().mockReturnValue(null),
        callGeminiAPI: vi.fn().mockResolvedValue({
          content: JSON.stringify(rawResult),
          tokenCost: null,
        }),
        parseGeminiResponse: vi.fn().mockReturnValue({ ...rawResult }),
      });
      const app = createApp(deps);
      const res = await request(app, 'POST', '/api/analyze', { text: '오늘은 조용한 하루였다' });
      expect(res.status).toBe(200);
      expect(res.data.emotion).toBe('평온');
      expect(res.data.ontology).toBeUndefined();
    });
  });
});
