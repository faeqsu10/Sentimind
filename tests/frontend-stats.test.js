import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend stats module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads dashboard stats with period and tz_offset, then tracks the view', async () => {
    vi.useFakeTimers();
    const env = installBrowserEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          total_entries: 8,
          this_week: 3,
          today: 1,
          top_emotions: [{ emotion: '기쁨', count: 3 }],
          top_situations: [{ situation: 'work', count: 2 }],
          recent_entries: [],
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: [] }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const stats = await importFresh('../public/js/stats.js');
    const { state } = await import('../public/js/state.js');
    state.allEntries = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));

    await stats.loadDashboard('7d');
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    const firstUrl = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(firstUrl.pathname).toBe('/api/stats');
    expect(firstUrl.searchParams.get('period')).toBe('7d');
    expect(firstUrl.searchParams.get('tz_offset')).toBe(String(new Date().getTimezoneOffset()));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/reports?limit=10');
    expect(document.getElementById('dashboardContent').setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
    expect(document.getElementById('dashboardContent').removeAttribute).toHaveBeenCalledWith('aria-busy');
    expect(env.navigator.sendBeacon).toHaveBeenCalledOnce();
  });

  it('skips duplicate dashboard fetches for the same period and entry count unless forced', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse({
        status: 200,
        jsonData: {
          total_entries: 8,
          this_week: 3,
          today: 1,
          top_emotions: [],
          top_situations: [],
          recent_entries: [],
        },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const stats = await importFresh('../public/js/stats.js');
    const { state } = await import('../public/js/state.js');
    state.allEntries = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));

    await stats.loadDashboard('30d');
    await stats.loadDashboard('30d');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(createFetchResponse({
      status: 200,
      jsonData: {
        total_entries: 8,
        this_week: 3,
        today: 1,
        top_emotions: [],
        top_situations: [],
        recent_entries: [],
      },
    }));
    fetchMock.mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: [] }));

    await stats.loadDashboard('30d', true);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('renders an error message when dashboard loading fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({
      status: 500,
      jsonData: { error: 'broken' },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const stats = await importFresh('../public/js/stats.js');

    await stats.loadDashboard('all', true);

    expect(document.getElementById('dashboardSummary').innerHTML).toContain('마음의 흐름을 불러오지 못했어요');
  });

  it('renders a report on success and tracks report generation', async () => {
    vi.useFakeTimers();
    const env = installBrowserEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          summary: '요약입니다.',
          emotionTrend: '감정 변화입니다.',
          insight: '패턴입니다.',
          encouragement: '격려입니다.',
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, jsonData: [] }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const stats = await importFresh('../public/js/stats.js');

    await stats.fetchReport('weekly');
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/report?period=weekly');
    expect(document.getElementById('reportResult').hidden).toBe(false);
    expect(document.getElementById('reportResult').innerHTML).toContain('요약입니다.');
    expect(document.getElementById('btnWeeklyReport').disabled).toBe(false);
    expect(document.getElementById('btnMonthlyReport').disabled).toBe(false);
    expect(env.navigator.sendBeacon).toHaveBeenCalledOnce();
  });

  it('renders the server error message when report generation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({
      status: 400,
      jsonData: { error: '리포트 생성에 최소 3건의 일기가 필요합니다.' },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const stats = await importFresh('../public/js/stats.js');

    await stats.fetchReport('monthly');

    expect(document.getElementById('reportResult').hidden).toBe(false);
    expect(document.getElementById('reportResult').innerHTML).toContain('리포트 생성에 최소 3건의 일기가 필요합니다.');
    expect(document.getElementById('btnWeeklyReport').disabled).toBe(false);
    expect(document.getElementById('btnMonthlyReport').disabled).toBe(false);
  });
});
