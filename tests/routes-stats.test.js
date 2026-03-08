import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const statsRouteFactory = require('../routes/stats');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    requestId: () => 'test-rid-stats',
    USE_SUPABASE: true,
    optionalAuth: (req, _res, next) => {
      // 기본: 인증된 사용자
      req.user = { id: 'user-123', email: 'test@example.com' };
      req.supabaseClient = null;
      next();
    },
    ...overrides,
  };
}

// Supabase 클라이언트 목 — RPC + from 체인 구성
function createMockSupabase({ rpcData = {}, rpcError = null, profileData = null, latestData = [], weekCount = 3, todayCount = 1 } = {}) {
  // count 쿼리용 체인 (head:true)
  const makeCountChain = (count) => ({
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count, error: null }),
  });

  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    from: vi.fn((table) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: profileData || { current_streak: 5, max_streak: 10, last_entry_date: '2026-03-08' },
                error: null,
              }),
            }),
          }),
        };
      }
      // entries table — select 호출 방식에 따라 분기
      return {
        select: vi.fn((cols, opts) => {
          if (opts && opts.head) {
            // count 쿼리
            const countVal = cols.includes('id') ? weekCount : todayCount;
            return makeCountChain(countVal);
          }
          // 일반 select (recent entries)
          return {
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: latestData, error: null }),
            gte: vi.fn().mockResolvedValue({ count: weekCount, error: null }),
          };
        }),
      };
    }),
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = statsRouteFactory(deps);
  app.use('/api', router);
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

describe('Stats Routes', () => {
  describe('GET /api/stats — 게스트 모드 (req.user 없음)', () => {
    it('빈 통계 구조를 반환한다', async () => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(), // 인증 없음 — 게스트
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.total_entries).toBe(0);
      expect(res.data.avg_confidence).toBe(0);
      expect(res.data.emotion_distribution).toEqual({});
      expect(res.data.top_emotions).toEqual([]);
      expect(res.data.top_situations).toEqual([]);
      expect(res.data.streak).toEqual({ current: 0, max: 0, today_completed: false });
      expect(res.data.period).toBe('all');
    });

    it('period 파라미터가 있어도 게스트는 빈 통계를 반환한다', async () => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(),
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats?period=7d');
      expect(res.status).toBe(200);
      expect(res.data.total_entries).toBe(0);
      expect(res.data.period).toBe('7d');
    });
  });

  describe('GET /api/stats — period 파라미터 유효성 검증', () => {
    it('잘못된 period 값이면 400 VALIDATION_ERROR를 반환한다', async () => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(), // 게스트여도 period 검증은 먼저 실행됨
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats?period=invalid');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('period=week 도 400을 반환한다', async () => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(),
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats?period=week');
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    it('period 없으면 기본값 all로 처리한다 (게스트)', async () => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(),
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.period).toBe('all');
    });

    it.each(['7d', '30d', '90d', 'all'])('유효한 period=%s 는 200을 반환한다 (게스트)', async (period) => {
      const deps = createMockDeps({
        optionalAuth: (req, _res, next) => next(),
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', `/api/stats?period=${period}`);
      expect(res.status).toBe(200);
      expect(res.data.period).toBe(period);
    });
  });

  describe('GET /api/stats — Supabase RPC 경로 (USE_SUPABASE=true)', () => {
    it('RPC 성공 시 응답 구조를 검증한다', async () => {
      const rpcData = {
        total_entries: 15,
        avg_confidence: 82,
        emotion_distribution: [
          { emotion: '기쁨', count: 8 },
          { emotion: '평온', count: 4 },
          { emotion: '슬픔', count: 3 },
        ],
        situation_counts: [
          { situation: 'work/meeting', count: 5 },
        ],
      };
      const mockSupabase = createMockSupabase({ rpcData });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.total_entries).toBe(15);
      expect(res.data.avg_confidence).toBe(82);
      expect(res.data.emotion_distribution['기쁨']).toBe(8);
      expect(res.data.top_emotions).toHaveLength(3);
      expect(res.data.top_emotions[0].emotion).toBe('기쁨');
      expect(res.data.top_situations[0].situation).toBe('work/meeting');
      expect(res.data.streak).toBeDefined();
      expect(res.data.period).toBe('all');
    });

    it('RPC 에러 시 500 INTERNAL_ERROR를 반환한다', async () => {
      const mockSupabase = createMockSupabase({ rpcError: { message: 'RPC function not found' } });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(500);
      expect(res.data.code).toBe('INTERNAL_ERROR');
    });

    it('RPC emotion_distribution 없으면 빈 객체와 빈 배열을 반환한다', async () => {
      const mockSupabase = createMockSupabase({ rpcData: { total_entries: 0, avg_confidence: 0 } });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.emotion_distribution).toEqual({});
      expect(res.data.top_emotions).toEqual([]);
    });

    it('top_emotions은 최대 5개까지만 포함한다', async () => {
      const rpcData = {
        total_entries: 10,
        emotion_distribution: [
          { emotion: '기쁨', count: 6 },
          { emotion: '평온', count: 5 },
          { emotion: '슬픔', count: 4 },
          { emotion: '불안', count: 3 },
          { emotion: '분노', count: 2 },
          { emotion: '공허', count: 1 },
        ],
      };
      const mockSupabase = createMockSupabase({ rpcData });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.top_emotions).toHaveLength(5);
    });

    it('streak 정보가 프로필에서 올바르게 매핑된다', async () => {
      const mockSupabase = createMockSupabase({
        rpcData: { total_entries: 3 },
        profileData: { current_streak: 7, max_streak: 14, last_entry_date: '2026-03-08' },
      });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.data.streak.current).toBe(7);
      expect(res.data.streak.max).toBe(14);
    });

    it('Cache-Control 헤더가 private, max-age=60 으로 설정된다', async () => {
      const mockSupabase = createMockSupabase({ rpcData: { total_entries: 0 } });
      const deps = createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('private');
      expect(res.headers['cache-control']).toContain('max-age=60');
    });

    it('USE_SUPABASE=false + 인증 사용자이면 501을 반환한다', async () => {
      const deps = createMockDeps({
        USE_SUPABASE: false,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = null;
          next();
        },
      });
      const app = createApp(deps);
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(501);
      expect(res.data.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('GET /api/stats — tz_offset 파라미터 (Supabase 경로)', () => {
    function makeAuthDeps(extraOverrides = {}) {
      const mockSupabase = createMockSupabase({ rpcData: { total_entries: 0 } });
      return createMockDeps({
        USE_SUPABASE: true,
        optionalAuth: (req, _res, next) => {
          req.user = { id: 'user-123' };
          req.supabaseClient = mockSupabase;
          next();
        },
        ...extraOverrides,
      });
    }

    it('유효한 tz_offset=-540 (KST)을 처리하여 200을 반환한다', async () => {
      const app = createApp(makeAuthDeps());
      const res = await request(app, 'GET', '/api/stats?tz_offset=-540');
      expect(res.status).toBe(200);
    });

    it('tz_offset=0 (UTC)을 처리하여 200을 반환한다', async () => {
      const app = createApp(makeAuthDeps());
      const res = await request(app, 'GET', '/api/stats?tz_offset=0');
      expect(res.status).toBe(200);
    });

    it('범위 밖 tz_offset=999 이면 서버 UTC 기준으로 폴백하여 200을 반환한다', async () => {
      const app = createApp(makeAuthDeps());
      const res = await request(app, 'GET', '/api/stats?tz_offset=999');
      expect(res.status).toBe(200);
    });

    it('tz_offset=문자열 이면 서버 UTC 기준으로 폴백하여 200을 반환한다', async () => {
      const app = createApp(makeAuthDeps());
      const res = await request(app, 'GET', '/api/stats?tz_offset=abc');
      expect(res.status).toBe(200);
    });

    it('tz_offset 없어도 200을 반환한다', async () => {
      const app = createApp(makeAuthDeps());
      const res = await request(app, 'GET', '/api/stats');
      expect(res.status).toBe(200);
    });
  });
});
