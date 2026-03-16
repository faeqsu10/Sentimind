import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

function createAppMocks() {
  const mocks = {
    utils: {
      showToast: vi.fn(),
      showError: vi.fn(),
      showSkeleton: vi.fn(),
      autoResize: vi.fn(),
      openModalFocus: vi.fn(),
      closeModalFocus: vi.fn(),
    },
    api: {
      setAuthExpiredHandler: vi.fn(),
      fetchWithAuth: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }),
      fetchEntries: vi.fn().mockResolvedValue([]),
      loadProfile: vi.fn().mockResolvedValue(undefined),
    },
    auth: {
      setupAuth: vi.fn(),
      checkAuth: vi.fn().mockResolvedValue(undefined),
      initAuthForms: vi.fn(),
      signInAnonymously: vi.fn().mockResolvedValue(true),
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
  vi.doMock('../public/js/api.js', () => mocks.api);
  vi.doMock('../public/js/auth.js', () => mocks.auth);
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

describe('frontend app module', () => {
  beforeEach(() => {
    const env = installBrowserEnv();
    document.querySelector = vi.fn((selector) => {
      if (selector === 'meta[name="theme-color"]') return { content: '' };
      return null;
    });
    env.window.location.search = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('wires shared dependencies and starts auth/error setup on import', async () => {
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');

    expect(mocks.api.setAuthExpiredHandler).toHaveBeenCalledOnce();
    expect(mocks.auth.setupAuth).toHaveBeenCalledOnce();
    expect(mocks.guest.setupGuest).toHaveBeenCalledOnce();
    expect(mocks.diary.setupDiary).toHaveBeenCalledOnce();
    expect(mocks.history.setupHistory).toHaveBeenCalledOnce();
    expect(mocks.profile.setupProfile).toHaveBeenCalledOnce();
    expect(mocks.auth.initAuthForms).toHaveBeenCalledOnce();
    expect(mocks.guest.initDemoEventListeners).toHaveBeenCalledOnce();
    expect(mocks.history.initHistoryEventListeners).toHaveBeenCalledOnce();
    expect(mocks.profile.initProfileEventListeners).toHaveBeenCalledOnce();
    expect(mocks.calendar.setupCalendar).toHaveBeenCalledOnce();
    expect(mocks.stats.setupStats).toHaveBeenCalledOnce();
    expect(mocks.errorReporter.setupErrorHandlers).toHaveBeenCalledWith(expect.objectContaining({
      showToast: mocks.utils.showToast,
    }));
    expect(mocks.auth.checkAuth).toHaveBeenCalledOnce();

    const sharedDeps = mocks.auth.setupAuth.mock.calls[0][0];
    expect(sharedDeps).toEqual(expect.objectContaining({
      showAuthScreen: expect.any(Function),
      showApp: expect.any(Function),
      showDemo: expect.any(Function),
      loadEntries: expect.any(Function),
      updateSidebar: expect.any(Function),
    }));
    expect(mocks.guest.setupGuest.mock.calls[0][0]).toBe(sharedDeps);
    expect(mocks.diary.setupDiary.mock.calls[0][0]).toBe(sharedDeps);
  });

  it('opens the auth signup screen when the landing start CTA is clicked', async () => {
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');

    const { track } = mocks.analytics;
    const clickHandler = document.getElementById('landingStartBtn').addEventListener.mock.calls[0][1];
    clickHandler();

    expect(document.getElementById('landingScreen').hidden).toBe(true);
    expect(document.getElementById('authScreen').hidden).toBe(false);
    expect(document.getElementById('authLoginCard').hidden).toBe(true);
    expect(document.getElementById('authSignupCard').hidden).toBe(false);
    expect(history.replaceState).toHaveBeenCalledWith({ screen: 'auth' }, '', '');
    expect(track).toHaveBeenCalledWith('landing_cta_clicked', expect.objectContaining({
      cta_type: 'hero_start',
    }));
    expect(track).toHaveBeenCalledWith('auth_form_started', expect.objectContaining({
      form_type: 'login',
    }));
  });

  it('starts demo mode and anonymous auth from the landing demo CTA', async () => {
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');
    const { state } = await import('../public/js/state.js');

    const clickHandler = document.getElementById('landingDemoBtn').addEventListener.mock.calls[0][1];
    await clickHandler();

    expect(state.guestMode).toBe(true);
    expect(document.getElementById('demoScreen').hidden).toBe(false);
    expect(mocks.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(mocks.guest.initDemoScreen).toHaveBeenCalledOnce();
    expect(mocks.analytics.track).toHaveBeenCalledWith('guest_demo_started', expect.any(Object));
    expect(mocks.analytics.track).toHaveBeenCalledWith('anonymous_auth_attempted', { success: true });
  });

  it('handles keyboard shortcuts for calendar tab and theme toggle', async () => {
    const env = installBrowserEnv();
    document.querySelector = vi.fn((selector) => {
      if (selector === 'meta[name="theme-color"]') return { content: '' };
      return null;
    });
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');

    const keydownHandler = env.documentListeners.get('keydown')[0];
    const preventDefault = vi.fn();

    document.getElementById('appContainer').hidden = false;
    keydownHandler({
      key: '2',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(mocks.calendar.renderCalendar).toHaveBeenCalledOnce();
    expect(document.getElementById('tab-calendar').setAttribute).toHaveBeenCalledWith('aria-selected', 'true');

    const darkPreventDefault = vi.fn();
    keydownHandler({
      key: 'd',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      preventDefault: darkPreventDefault,
    });

    expect(darkPreventDefault).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith('sentimind-theme', 'dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('syncs offline drafts when the browser comes back online', async () => {
    const env = installBrowserEnv();
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');

    env.dispatchWindowEvent('online');

    expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith('SYNC_OFFLINE');
    expect(mocks.diary.processOfflineDraftQueue).toHaveBeenCalledOnce();
  });

  it('completes onboarding, saves notification preferences, and shows the app screen', async () => {
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');
    const { state } = await import('../public/js/state.js');

    state.selectedNotificationTime = '21:00';

    const finishHandler = document.getElementById('onboardingFinish').addEventListener.mock.calls[0][1];
    await finishHandler();

    expect(mocks.reminder.requestNotificationPermission).toHaveBeenCalledOnce();
    expect(mocks.api.fetchWithAuth).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        onboarding_completed: true,
        notification_time: '21:00',
        notification_enabled: true,
      }),
    }));
    expect(mocks.api.loadProfile).toHaveBeenCalledOnce();
    expect(mocks.analytics.track).toHaveBeenCalledWith('onboarding_completed', {
      notification_set: true,
    });
    expect(document.getElementById('appContainer').hidden).toBe(false);
  });

  it('handles service worker messages for updates and offline sync completion', async () => {
    const mocks = createAppMocks();

    await importFresh('../public/js/app.js');

    const swMessageHandler = navigator.serviceWorker.addEventListener.mock.calls.find(([type]) => type === 'message')[1];
    await swMessageHandler({ data: { type: 'SW_UPDATED' } });
    expect(window.location.reload).toHaveBeenCalledOnce();

    mocks.api.fetchEntries.mockResolvedValue([{ id: 'entry-1' }]);
    await swMessageHandler({ data: { type: 'OFFLINE_SYNC_COMPLETE', count: 2 } });

    expect(mocks.utils.showError).toHaveBeenCalledWith('오프라인에서 쓴 이야기 2건이 저장되었어요.');
    expect(mocks.analytics.track).toHaveBeenCalledWith('offline_sync_completed', { synced_count: 2 });
    expect(mocks.api.fetchEntries).toHaveBeenCalled();
    expect(mocks.history.renderHistory).toHaveBeenCalledWith([{ id: 'entry-1' }]);
    expect(mocks.sidebar.updateSidebar).toHaveBeenCalled();
  });
});
