import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend auth module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('handles signup redirect by storing tokens and showing the welcome screen', async () => {
    const env = installBrowserEnv();
    env.window.location.hash = '#access_token=tok123456789&refresh_token=ref123456789&type=signup';

    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
      status: 200,
      jsonData: {
        data: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const auth = await importFresh('../public/js/auth.js');
    const { state } = await import('../public/js/state.js');

    const deps = {
      showWelcomeScreen: vi.fn(),
      showAuthScreen: vi.fn(),
      showApp: vi.fn(),
      showOnboarding: vi.fn(),
      showLanding: vi.fn(),
      showDemo: vi.fn(),
    };
    auth.setupAuth(deps);

    const handled = await auth.handleAuthRedirect();

    expect(handled).toBe(true);
    expect(state.currentUser).toEqual({
      id: 'user-123',
      email: 'test@example.com',
    });
    expect(state.accessToken).toBe('tok123456789');
    expect(state.refreshToken).toBe('ref123456789');
    expect(localStorage.getItem('sb-access-token')).toBe('tok123456789');
    expect(localStorage.getItem('sb-refresh-token')).toBe('ref123456789');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(deps.showWelcomeScreen).toHaveBeenCalledOnce();
    expect(deps.showApp).not.toHaveBeenCalled();
  });

  it('refreshes expired auth and restores anonymous demo mode', async () => {
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
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            id: 'anon-1',
            is_anonymous: true,
          },
        },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const auth = await importFresh('../public/js/auth.js');
    const { state } = await import('../public/js/state.js');

    localStorage.setItem('sb-access-token', 'old-access');
    localStorage.setItem('sb-refresh-token', 'old-refresh');

    const deps = {
      showWelcomeScreen: vi.fn(),
      showAuthScreen: vi.fn(),
      showApp: vi.fn(),
      showOnboarding: vi.fn(),
      showLanding: vi.fn(),
      showDemo: vi.fn(),
    };
    auth.setupAuth(deps);

    await auth.checkAuth();

    expect(state.currentUser).toEqual({ id: 'anon-1', is_anonymous: true });
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.isAnonymous).toBe(true);
    expect(state.guestMode).toBe(true);
    expect(localStorage.getItem('sb-access-token')).toBe('new-access');
    expect(localStorage.getItem('sb-refresh-token')).toBe('new-refresh');
    expect(deps.showDemo).toHaveBeenCalledOnce();
    expect(deps.showLanding).not.toHaveBeenCalled();
  });

  it('links an anonymous account and updates auth state with the returned session', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
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
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const auth = await importFresh('../public/js/auth.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'anon-access';
    state.refreshToken = 'anon-refresh';
    state.isAnonymous = true;

    const result = await auth.linkAnonymousAccount('linked@example.com', 'Test1234', '새닉네임');

    expect(result.data.user.email).toBe('linked@example.com');
    expect(state.isAnonymous).toBe(false);
    expect(state.currentUser).toEqual({
      id: 'user-123',
      email: 'linked@example.com',
    });
    expect(state.accessToken).toBe('linked-access');
    expect(state.refreshToken).toBe('linked-refresh');
    expect(localStorage.getItem('sb-access-token')).toBe('linked-access');
    expect(localStorage.getItem('sb-refresh-token')).toBe('linked-refresh');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/link-account', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer anon-access',
      }),
    }));
  });
});
