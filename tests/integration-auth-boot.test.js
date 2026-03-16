import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('integration auth boot flow', () => {
  beforeEach(() => {
    installBrowserEnv();
    vi.doMock('../public/js/analytics.js', () => ({
      track: vi.fn(),
      setAnalyticsAnonymous: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('refreshes an expired token, loads the profile, and routes to onboarding', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 401,
        jsonData: { error: 'expired' },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            session: {
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
            },
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            id: 'user-123',
            email: 'test@example.com',
            is_anonymous: false,
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            nickname: '마음이',
            onboarding_completed: false,
          },
        },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    localStorage.setItem('sb-access-token', 'old-access-token');
    localStorage.setItem('sb-refresh-token', 'old-refresh-token');

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

    await auth.checkAuth();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer old-access-token' },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({
      method: 'POST',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer new-access-token' },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/profile', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer new-access-token',
      }),
    }));

    expect(state.accessToken).toBe('new-access-token');
    expect(state.refreshToken).toBe('new-refresh-token');
    expect(state.currentUser).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      is_anonymous: false,
    });
    expect(state.userProfile).toEqual({
      nickname: '마음이',
      onboarding_completed: false,
    });
    expect(localStorage.getItem('sb-access-token')).toBe('new-access-token');
    expect(localStorage.getItem('sb-refresh-token')).toBe('new-refresh-token');
    expect(deps.showOnboarding).toHaveBeenCalledOnce();
    expect(deps.showApp).not.toHaveBeenCalled();
    expect(deps.showLanding).not.toHaveBeenCalled();
  });

  it('clears stored tokens and routes to landing when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 401,
        jsonData: { error: 'expired' },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 401,
        jsonData: { error: 'refresh failed' },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    localStorage.setItem('sb-access-token', 'old-access-token');
    localStorage.setItem('sb-refresh-token', 'old-refresh-token');

    const auth = await importFresh('../public/js/auth.js');
    const { state } = await import('../public/js/state.js');
    state.currentUser = { id: 'user-123' };

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

    expect(state.currentUser).toEqual({ id: 'user-123' });
    expect(localStorage.getItem('sb-access-token')).toBeNull();
    expect(localStorage.getItem('sb-refresh-token')).toBeNull();
    expect(deps.showLanding).toHaveBeenCalledOnce();
    expect(deps.showApp).not.toHaveBeenCalled();
    expect(deps.showOnboarding).not.toHaveBeenCalled();
  });
});
