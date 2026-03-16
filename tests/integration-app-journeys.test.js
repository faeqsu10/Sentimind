import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

function createAppJourneyMocks() {
  const mocks = {
    utils: {
      showToast: vi.fn(),
      showError: vi.fn(),
      showSkeleton: vi.fn(),
      autoResize: vi.fn(),
      openModalFocus: vi.fn(),
      closeModalFocus: vi.fn(),
    },
    guest: {
      setupGuest: vi.fn(),
      initDemoScreen: vi.fn(),
      initDemoEventListeners: vi.fn(),
      migrateGuestData: vi.fn(),
    },
    diary: {
      setupDiary: vi.fn(),
      handleSubmit: vi.fn(),
      processOfflineDraftQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
    },
    history: {
      setupHistory: vi.fn(),
      renderHistory: vi.fn(),
      showHistoryDetail: vi.fn(),
      initHistoryEventListeners: vi.fn(),
    },
    calendar: {
      renderCalendar: vi.fn(),
      setupCalendar: vi.fn(),
    },
    stats: {
      loadDashboard: vi.fn(),
      setupStats: vi.fn(),
    },
    sidebar: {
      updateSidebar: vi.fn(),
      createConfetti: vi.fn(),
      renderProfileBadges: vi.fn(),
    },
    profile: {
      setupProfile: vi.fn(),
      renderProfileScreen: vi.fn(),
      initProfileEventListeners: vi.fn(),
    },
    analytics: {
      track: vi.fn(),
      setAnalyticsAnonymous: vi.fn(),
    },
    emotionGraph: {
      loadEmotionGraph: vi.fn(),
    },
    reminder: {
      initReminder: vi.fn(),
      requestNotificationPermission: vi.fn().mockResolvedValue('granted'),
      scheduleReminder: vi.fn(),
    },
    errorReporter: {
      setupErrorHandlers: vi.fn(),
    },
  };

  vi.doMock('../public/js/utils.js', () => mocks.utils);
  vi.doMock('../public/js/guest.js', () => mocks.guest);
  vi.doMock('../public/js/diary.js', () => mocks.diary);
  vi.doMock('../public/js/history.js', () => mocks.history);
  vi.doMock('../public/js/calendar.js', () => mocks.calendar);
  vi.doMock('../public/js/stats.js', () => mocks.stats);
  vi.doMock('../public/js/sidebar.js', () => mocks.sidebar);
  vi.doMock('../public/js/profile.js', () => mocks.profile);
  vi.doMock('../public/js/analytics.js', () => mocks.analytics);
  vi.doMock('../public/js/emotion-graph.js', () => mocks.emotionGraph);
  vi.doMock('../public/js/reminder.js', () => mocks.reminder);
  vi.doMock('../public/js/error-reporter.js', () => mocks.errorReporter);

  return mocks;
}

describe('integration app journeys', () => {
  beforeEach(() => {
    const env = installBrowserEnv();
    document.querySelector = vi.fn((selector) => {
      if (selector === 'meta[name="theme-color"]') return { content: '' };
      return null;
    });
    env.window.location.search = '';
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('boots with an expired token, refreshes auth, routes to onboarding, completes onboarding, and enters the app', async () => {
    const mocks = createAppJourneyMocks();
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
            current_streak: 2,
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: { data: { success: true } },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          data: {
            nickname: '마음이',
            onboarding_completed: true,
            current_streak: 2,
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: [],
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    localStorage.setItem('sb-access-token', 'expired-access');
    localStorage.setItem('sb-refresh-token', 'refresh-token');

    await importFresh('../public/js/app.js');
    const { state } = await import('../public/js/state.js');

    expect(document.getElementById('onboardingScreen').hidden).toBe(false);
    expect(state.accessToken).toBe('new-access');
    expect(state.userProfile).toEqual({
      nickname: '마음이',
      onboarding_completed: false,
      current_streak: 2,
    });

    const timeSelectHandler = document.getElementById('onboardingTimeSelect').addEventListener.mock.calls[0][1];
    const selectedBtn = {
      dataset: { time: '21:00' },
      setAttribute: vi.fn(),
      closest: vi.fn(() => selectedBtn),
    };
    timeSelectHandler({
      target: {
        closest: vi.fn(() => selectedBtn),
      },
    });

    const finishHandler = document.getElementById('onboardingFinish').addEventListener.mock.calls[0][1];
    await finishHandler();
    await flushPromises(6);

    expect(mocks.reminder.requestNotificationPermission).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/profile', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        Authorization: 'Bearer new-access',
      }),
      body: JSON.stringify({
        onboarding_completed: true,
        notification_time: '21:00',
        notification_enabled: true,
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(7, '/api/entries?limit=100&offset=0', expect.any(Object));
    expect(document.getElementById('appContainer').hidden).toBe(false);
    expect(mocks.profile.renderProfileScreen).toHaveBeenCalled();
    expect(mocks.sidebar.updateSidebar).toHaveBeenCalled();
    expect(mocks.reminder.initReminder).toHaveBeenCalled();
    expect(mocks.analytics.track).toHaveBeenCalledWith('onboarding_completed', {
      notification_set: true,
    });
  });

  it('boots directly into demo mode when the stored session belongs to an anonymous user', async () => {
    const mocks = createAppJourneyMocks();
    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
      status: 200,
      jsonData: {
        data: {
          id: 'anon-1',
          is_anonymous: true,
        },
      },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    localStorage.setItem('sb-access-token', 'anon-access');
    localStorage.setItem('sb-refresh-token', 'anon-refresh');

    await importFresh('../public/js/app.js');
    const { state } = await import('../public/js/state.js');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer anon-access' },
    }));
    expect(state.guestMode).toBe(true);
    expect(state.isAnonymous).toBe(true);
    expect(document.getElementById('demoScreen').hidden).toBe(false);
    expect(mocks.guest.initDemoScreen).toHaveBeenCalledOnce();
    expect(mocks.analytics.setAnalyticsAnonymous).toHaveBeenCalledWith(true);
    expect(mocks.analytics.track).toHaveBeenCalledWith('guest_demo_started', expect.any(Object));
  });
});
