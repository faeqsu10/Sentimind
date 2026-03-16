import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend api module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('refreshes the token and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ status: 401, jsonData: { error: 'expired' } }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            session: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
            },
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: { ok: true } }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const api = await importFresh('../public/js/api.js');
    const { state } = await import('../public/js/state.js');

    state.currentUser = { id: 'user-123' };
    state.accessToken = 'old-access';
    state.refreshToken = 'old-refresh';
    localStorage.setItem('sb-access-token', 'old-access');
    localStorage.setItem('sb-refresh-token', 'old-refresh');

    const onAuthExpired = vi.fn();
    api.setAuthExpiredHandler(onAuthExpired);

    const res = await api.fetchWithAuth('/api/protected', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/protected');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({
      method: 'POST',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/protected', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer new-access',
      }),
    }));
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(localStorage.getItem('sb-access-token')).toBe('new-access');
    expect(localStorage.getItem('sb-refresh-token')).toBe('new-refresh');
    expect(onAuthExpired).not.toHaveBeenCalled();
  });

  it('clears auth state and notifies when refresh fails after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ status: 401, jsonData: { error: 'expired' } }))
      .mockResolvedValueOnce(createFetchResponse({ status: 401, jsonData: { error: 'refresh failed' } }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const api = await importFresh('../public/js/api.js');
    const { state } = await import('../public/js/state.js');

    state.currentUser = { id: 'user-123' };
    state.accessToken = 'old-access';
    state.refreshToken = 'old-refresh';
    localStorage.setItem('sb-access-token', 'old-access');
    localStorage.setItem('sb-refresh-token', 'old-refresh');

    const onAuthExpired = vi.fn();
    api.setAuthExpiredHandler(onAuthExpired);

    await expect(api.fetchWithAuth('/api/protected')).rejects.toMatchObject({
      userMessage: '세션이 만료되었습니다. 다시 로그인해주세요.',
    });

    expect(state.currentUser).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(localStorage.getItem('sb-access-token')).toBeNull();
    expect(localStorage.getItem('sb-refresh-token')).toBeNull();
    expect(onAuthExpired).toHaveBeenCalledOnce();
  });

  it('paginates through entry pages until the final partial page', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => ({ id: `entry-${index}` }));
    const page2 = [{ id: 'entry-100' }];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: page1 }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: page2 }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const api = await importFresh('../public/js/api.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'page-token';

    const entries = await api.fetchEntries();

    expect(entries).toHaveLength(101);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/entries?limit=100&offset=0', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/entries?limit=100&offset=100', expect.any(Object));
  });
});
