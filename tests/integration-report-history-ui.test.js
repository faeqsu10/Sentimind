import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementStub, createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('integration report history ui flow', () => {
  beforeEach(() => {
    installBrowserEnv();
    vi.doMock('../public/js/analytics.js', () => ({
      track: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
  });

  it('generates a report, loads history, and deletes a history item', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          summary: '이번 주는 조금 가벼워졌어요.',
          emotionTrend: '초반보다 후반이 더 안정적이었어요.',
          insight: '산책 후 기록에서 긍정 흐름이 보였어요.',
          encouragement: '지금처럼 꾸준히 적어보세요.',
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: [{
          id: 'report-1',
          period: 'weekly',
          periodStart: '2026-03-09',
          periodEnd: '2026-03-15',
          summary: '이번 주는 조금 가벼워졌어요.',
          emotionTrend: '초반보다 후반이 더 안정적이었어요.',
          insight: '산책 후 기록에서 긍정 흐름이 보였어요.',
          encouragement: '지금처럼 꾸준히 적어보세요.',
        }],
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 204,
        jsonData: null,
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const listEl = document.getElementById('reportHistoryList');
    const historyEl = document.getElementById('reportHistory');
    const removableItem = createElementStub();
    listEl.querySelector = vi.fn(() => removableItem);
    listEl.children = [];

    const stats = await importFresh('../public/js/stats.js');
    const { state } = await import('../public/js/state.js');
    state.accessToken = 'member-token';

    await stats.fetchReport('weekly');
    await flushPromises(6);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/report?period=weekly', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/reports?limit=10', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(document.getElementById('reportResult').hidden).toBe(false);
    expect(document.getElementById('reportResult').innerHTML).toContain('이번 주는 조금 가벼워졌어요.');
    expect(historyEl.hidden).toBe(false);
    expect(listEl.innerHTML).toContain('주간 리포트');
    expect(listEl.innerHTML).toContain('산책 후 기록에서 긍정 흐름이 보였어요.');

    const clickHandler = listEl.addEventListener.mock.calls.find(([type]) => type === 'click')[1];
    const deleteBtn = {
      dataset: { reportId: 'report-1' },
      closest: vi.fn((selector) => (selector === '.report-history-delete-btn' ? deleteBtn : null)),
    };
    await clickHandler({
      target: deleteBtn,
      stopPropagation: vi.fn(),
    });
    await flushPromises(4);

    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/reports/report-1', expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(removableItem.remove).toHaveBeenCalledOnce();
    expect(historyEl.hidden).toBe(true);
    expect(document.getElementById('toastContainer').children).toHaveLength(1);
  });
});
