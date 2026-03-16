import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

function createMocks() {
  const mocks = {
    utils: {
      showToast: vi.fn(),
      showError: vi.fn(),
      showSkeleton: vi.fn(),
      hideSkeleton: vi.fn(),
      autoResize: vi.fn(),
      openModalFocus: vi.fn(),
      closeModalFocus: vi.fn(),
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

  vi.doMock('../public/js/utils.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      ...mocks.utils,
    };
  });
  vi.doMock('../public/js/auth.js', () => mocks.auth);
  vi.doMock('../public/js/guest.js', () => mocks.guest);
  vi.doMock('../public/js/diary.js', () => mocks.diary);
  vi.doMock('../public/js/history.js', () => mocks.history);
  vi.doMock('../public/js/calendar.js', () => mocks.calendar);
  vi.doMock('../public/js/sidebar.js', () => mocks.sidebar);
  vi.doMock('../public/js/profile.js', () => mocks.profile);
  vi.doMock('../public/js/analytics.js', () => mocks.analytics);
  vi.doMock('../public/js/emotion-graph.js', () => mocks.emotionGraph);
  vi.doMock('../public/js/reminder.js', () => mocks.reminder);
  vi.doMock('../public/js/error-reporter.js', () => mocks.errorReporter);

  return mocks;
}

describe('integration app dashboard/report flow', () => {
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

  it('switches to the dashboard tab, loads stats, generates a report, and renders report history', async () => {
    const mocks = createMocks();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          total_entries: 4,
          this_week: 2,
          today: 1,
          top_emotions: [{ emotion: '기쁨', count: 2 }],
          top_situations: [{ situation: 'work', count: 1 }],
          recent_entries: [],
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: [] }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          summary: '이번 주는 조금 더 차분했어요.',
          emotionTrend: '중반부터 안정적인 흐름이 보였어요.',
          insight: '업무를 마친 뒤 기록이 회복에 도움이 됐어요.',
          encouragement: '이 흐름을 이어가보세요.',
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: [{
          id: 'report-1',
          period: 'weekly',
          periodStart: '2026-03-09',
          periodEnd: '2026-03-15',
          summary: '이번 주는 조금 더 차분했어요.',
          emotionTrend: '중반부터 안정적인 흐름이 보였어요.',
          insight: '업무를 마친 뒤 기록이 회복에 도움이 됐어요.',
          encouragement: '이 흐름을 이어가보세요.',
        }],
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    await importFresh('../public/js/app.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'member-token';
    state.currentUser = { id: 'user-123', email: 'test@example.com' };
    state.userProfile = { current_streak: 2, nickname: '마음이' };
    state.allEntries = [
      { id: 'entry-1', date: '2026-03-16T10:00:00Z', emotion: '기쁨' },
      { id: 'entry-2', date: '2026-03-15T10:00:00Z', emotion: '평온' },
    ];
    document.getElementById('appContainer').hidden = false;

    const dashboardTabHandler = document.getElementById('tab-dashboard').addEventListener.mock.calls.find(([type]) => type === 'click')[1];
    dashboardTabHandler();
    await flushPromises(6);

    expect(fetchMock.mock.calls[0][0]).toContain('/api/stats?');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/reports?limit=10');
    expect(document.getElementById('panel-dashboard').hidden).toBe(false);
    expect(mocks.emotionGraph.loadEmotionGraph).toHaveBeenCalledWith('all');

    const weeklyReportHandler = document.getElementById('btnWeeklyReport').addEventListener.mock.calls[0][1];
    await weeklyReportHandler();
    await flushPromises(6);

    expect(fetchMock.mock.calls[2][0]).toBe('/api/report?period=weekly');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/reports?limit=10');
    expect(document.getElementById('reportResult').hidden).toBe(false);
    expect(document.getElementById('reportResult').innerHTML).toContain('이번 주는 조금 더 차분했어요.');
    expect(document.getElementById('reportHistory').hidden).toBe(false);
    expect(document.getElementById('reportHistoryList').innerHTML).toContain('업무를 마친 뒤 기록이 회복에 도움이 됐어요.');
    expect(mocks.analytics.track).toHaveBeenCalledWith('report_generated', { period: 'weekly' });
  });
});
