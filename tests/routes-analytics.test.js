import { describe, it, expect, vi } from 'vitest';
import express from 'express';

const analyticsRouteFactory = require('../routes/analytics');

function createMockDeps(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    USE_SUPABASE: true,
    supabaseAdmin: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    optionalAuth: (req, _res, next) => next(),
    config: { analytics: { batchMaxSize: 50 } },
    ...overrides,
  };
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  const router = analyticsRouteFactory(deps);
  app.use('/api/analytics', router);
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

describe('Analytics Routes', () => {
  it('rejects missing events array', async () => {
    const app = createApp(createMockDeps());
    const res = await request(app, 'POST', '/api/analytics', {});
    expect(res.status).toBe(400);
  });

  it('rejects empty events array', async () => {
    const app = createApp(createMockDeps());
    const res = await request(app, 'POST', '/api/analytics', { events: [] });
    expect(res.status).toBe(400);
  });

  it('accepts valid events batch', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/analytics', {
      events: [
        { event: 'page_view', session_id: 'sess-1', device_type: 'mobile', theme: 'dark' },
        { event: 'button_click', session_id: 'sess-1' },
      ],
    });
    expect(res.status).toBe(202);
    expect(res.data.accepted).toBe(2);
    expect(deps.supabaseAdmin.from).toHaveBeenCalledWith('analytics_events');
  });

  it('caps batch at 50 events', async () => {
    const deps = createMockDeps();
    const app = createApp(deps);
    const events = Array.from({ length: 60 }, (_, i) => ({ event: `evt_${i}`, session_id: 's' }));
    const res = await request(app, 'POST', '/api/analytics', { events });
    expect(res.status).toBe(202);
    expect(res.data.accepted).toBe(50);
  });

  it('handles Supabase insert error', async () => {
    const deps = createMockDeps({
      supabaseAdmin: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        })),
      },
    });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/analytics', {
      events: [{ event: 'test', session_id: 's' }],
    });
    expect(res.status).toBe(500);
  });

  it('falls back to logging when Supabase is disabled', async () => {
    const deps = createMockDeps({ USE_SUPABASE: false });
    const app = createApp(deps);
    const res = await request(app, 'POST', '/api/analytics', {
      events: [{ event: 'test', session_id: 's' }],
    });
    expect(res.status).toBe(202);
    expect(deps.logger.info).toHaveBeenCalled();
  });

  it('sanitizes event properties', async () => {
    const deps = createMockDeps();
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    deps.supabaseAdmin.from = vi.fn(() => ({ insert: insertMock }));

    const app = createApp(deps);
    await request(app, 'POST', '/api/analytics', {
      events: [{
        event: 'a'.repeat(200),
        session_id: 'b'.repeat(200),
        custom_prop: 'hello',
        nested: { obj: true },
      }],
    });

    const rows = insertMock.mock.calls[0][0];
    expect(rows[0].event.length).toBe(100);
    expect(rows[0].session_id.length).toBe(100);
    expect(rows[0].properties.custom_prop).toBe('hello');
    expect(rows[0].properties.nested).toBeUndefined();
  });

  it('creates fresh router per factory call (no shared state)', async () => {
    const deps1 = createMockDeps();
    const deps2 = createMockDeps();
    const app1 = createApp(deps1);
    const app2 = createApp(deps2);

    await request(app1, 'POST', '/api/analytics', {
      events: [{ event: 'from_app1', session_id: 's' }],
    });
    await request(app2, 'POST', '/api/analytics', {
      events: [{ event: 'from_app2', session_id: 's' }],
    });

    expect(deps1.supabaseAdmin.from).toHaveBeenCalledTimes(1);
    expect(deps2.supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});
