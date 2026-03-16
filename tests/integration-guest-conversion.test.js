import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

async function importGuestConversionModules() {
  const auth = await importFresh('../public/js/auth.js');
  const guest = await import('../public/js/guest.js');
  const stateModule = await import('../public/js/state.js');
  return { auth, guest, ...stateModule };
}

describe('integration guest conversion flow', () => {
  beforeEach(() => {
    installBrowserEnv();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('links an anonymous account and migrates guest entries with the refreshed session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            user: {
              id: 'user-123',
              email: 'linked@example.com',
            },
            session: {
              access_token: 'linked-access',
              refresh_token: 'linked-refresh',
            },
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: { imported: 2, skipped: 0 },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const { auth, guest, state, GUEST_STORAGE_KEY } = await importGuestConversionModules();

    state.accessToken = 'anon-access';
    state.refreshToken = 'anon-refresh';
    state.isAnonymous = true;
    state.currentUser = { id: 'anon-1', is_anonymous: true };
    localStorage.setItem('sb-access-token', 'anon-access');
    localStorage.setItem('sb-refresh-token', 'anon-refresh');
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify([
      { text: '체험 기록 1', timestamp: Date.now() - 1000, emotion: '기쁨' },
      { text: '체험 기록 2', timestamp: Date.now() - 2000, emotion: '평온' },
    ]));

    const linkResult = await auth.linkAnonymousAccount('linked@example.com', 'Test1234', '새닉네임');
    await guest.migrateGuestData();

    expect(linkResult.data.user.email).toBe('linked@example.com');
    expect(state.isAnonymous).toBe(false);
    expect(state.currentUser).toEqual({
      id: 'user-123',
      email: 'linked@example.com',
    });
    expect(state.accessToken).toBe('linked-access');
    expect(state.refreshToken).toBe('linked-refresh');
    expect(localStorage.getItem('sb-access-token')).toBe('linked-access');
    expect(localStorage.getItem('sb-refresh-token')).toBe('linked-refresh');
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/link-account', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer anon-access',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/migrate/from-guest', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer linked-access',
      }),
    }));
    const migrateBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(migrateBody.entries).toHaveLength(2);
  });

  it('keeps anonymous auth state unchanged when account linking fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
      status: 409,
      jsonData: { error: '이미 등록된 이메일입니다.' },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const { auth, state, GUEST_STORAGE_KEY } = await importGuestConversionModules();

    state.accessToken = 'anon-access';
    state.refreshToken = 'anon-refresh';
    state.isAnonymous = true;
    state.currentUser = { id: 'anon-1', is_anonymous: true };
    localStorage.setItem('sb-access-token', 'anon-access');
    localStorage.setItem('sb-refresh-token', 'anon-refresh');
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify([
      { text: '체험 기록', timestamp: Date.now() - 1000, emotion: '기쁨' },
    ]));

    await expect(
      auth.linkAnonymousAccount('existing@example.com', 'Test1234')
    ).rejects.toMatchObject({
      userMessage: '이미 등록된 이메일입니다.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.isAnonymous).toBe(true);
    expect(state.currentUser).toEqual({ id: 'anon-1', is_anonymous: true });
    expect(state.accessToken).toBe('anon-access');
    expect(state.refreshToken).toBe('anon-refresh');
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });
});
