import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function loadCollector({ useSupabase = true, insertImpl } = {}) {
  const insert = insertImpl || vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert }));

  const configPath = require.resolve('../config/supabase-config');
  const collectorPath = require.resolve('../lib/error-collector');

  delete require.cache[configPath];
  delete require.cache[collectorPath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      USE_SUPABASE: useSupabase,
      supabaseAdmin: useSupabase ? { from } : null,
    },
  };

  const mod = require('../lib/error-collector');
  return { ...mod, insert, from };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete require.cache[require.resolve('../config/supabase-config')];
  delete require.cache[require.resolve('../lib/error-collector')];
});

describe('error collector', () => {
  it('generates stable fingerprints for normalized messages', () => {
    const { generateFingerprint } = loadCollector({ useSupabase: false });

    const a = generateFingerprint({
      source: 'backend',
      path: '/api/test',
      code: 'ERR',
      message: 'User 123 failed at 2026-03-16T10:00:00',
    });
    const b = generateFingerprint({
      source: 'backend',
      path: '/api/test',
      code: 'ERR',
      message: 'User 999 failed at 2026-03-16T11:30:00',
    });

    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it('masks sensitive data before inserting into Supabase', async () => {
    const { collectError, insert, from } = loadCollector();

    await collectError({
      level: 'error',
      source: 'backend',
      message: 'contact me at test@example.com and Bearer abc123 token=secret',
      stack: 'password=my-secret\nBearer super-secret',
      code: 'FAIL',
      requestId: 'rid-1',
      path: '/api/test?foo=bar',
    });

    expect(from).toHaveBeenCalledWith('error_logs');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('<EMAIL>'),
      stack: expect.stringContaining('<TOKEN>'),
      path: '/api/test',
      code: 'FAIL',
    }));
  });

  it('rate limits repeated fingerprints within the same minute', async () => {
    const { collectError, insert } = loadCollector();

    for (let i = 0; i < 12; i++) {
      await collectError({
        source: 'backend',
        message: 'same message',
      });
    }

    expect(insert).toHaveBeenCalledTimes(10);
  });

  it('falls back to console logging when Supabase is disabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { collectError } = loadCollector({ useSupabase: false });

    await collectError({
      source: 'frontend',
      message: 'client error',
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"error_log"'));
  });

  it('swallows internal collector errors and logs a concise console error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { collectError } = loadCollector({
      insertImpl: vi.fn().mockRejectedValue(new Error('insert failed')),
    });

    await collectError({
      source: 'backend',
      message: 'boom message',
    });

    expect(errorSpy).toHaveBeenCalledWith('[error-collector] 에러 로그 저장 실패:', 'boom message');
  });
});
