import { describe, expect, it, vi } from 'vitest';
import express from 'express';

const errorLogsRouteFactory = require('../routes/error-logs');

function createMockDeps(overrides = {}) {
  return {
    optionalAuth: (req, _res, next) => {
      req.user = { id: 'user-123' };
      next();
    },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    collectError: vi.fn(),
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.rid = 'test-rid-error-logs';
    next();
  });
  app.use('/api', errorLogsRouteFactory(deps));
  return app;
}

async function request(app, method, path, body) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const res = await fetch(`http://localhost:${port}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'vitest-agent' },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        resolve({ status: res.status, data });
      } finally {
        server.close();
      }
    });
  });
}

describe('Error Logs Route', () => {
  it('returns 400 when errors array is missing', async () => {
    const app = createApp(createMockDeps());
    const res = await request(app, 'POST', '/api/error-logs', {});

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('accepts only valid errors, caps the batch at 10, and passes sanitized metadata', async () => {
    const collectError = vi.fn();
    const app = createApp(createMockDeps({ collectError }));
    const errors = Array.from({ length: 11 }, (_, index) => ({
      message: `에러 ${index + 1}`,
      level: index % 2 === 0 ? 'warn' : 'error',
      stack: 'stack trace',
      code: 'ERR_CODE',
      fingerprint: 'fp-' + 'x'.repeat(80),
      request_id: 'rid-' + index,
      source_file: '/src/file-' + index + '.js',
      lineno: index,
      colno: index + 1,
      metadata: { extra: index },
    }));
    errors[1] = { message: '   ' };
    errors[2] = { foo: 'bar' };

    const res = await request(app, 'POST', '/api/error-logs', {
      errors,
      session_id: 'session-123',
      user_agent: 'custom-agent',
    });

    expect(res.status).toBe(202);
    expect(res.data.accepted).toBe(8);
    expect(collectError).toHaveBeenCalledTimes(8);
    expect(collectError).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      source: 'frontend',
      message: '에러 1',
      code: 'ERR_CODE',
      requestId: 'rid-0',
      userId: 'user-123',
      sessionId: 'session-123',
      userAgent: 'custom-agent',
      fingerprint: expect.stringMatching(/^fp-x{61}$/),
      metadata: expect.objectContaining({
        source_file: '/src/file-0.js',
        lineno: 0,
        colno: 1,
        extra: 0,
      }),
    }));
  });

  it('falls back to request id and request user-agent for anonymous users', async () => {
    const collectError = vi.fn();
    const app = createApp(createMockDeps({
      collectError,
      optionalAuth: (req, _res, next) => {
        req.user = null;
        next();
      },
    }));

    const res = await request(app, 'POST', '/api/error-logs', {
      errors: [{ message: '프론트 오류' }],
    });

    expect(res.status).toBe(202);
    expect(collectError).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'test-rid-error-logs',
      userId: null,
      userAgent: 'vitest-agent',
    }));
  });
});
