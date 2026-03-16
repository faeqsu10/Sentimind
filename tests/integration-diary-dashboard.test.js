import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementStub, createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('integration diary to dashboard flow', () => {
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

  it('submits a diary entry, reloads entries, updates sidebar, and refreshes dashboard stats', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          emotion: '기쁨',
          emoji: '😊',
          message: '오늘의 마음이 밝게 빛나네요.',
          advice: '이 좋은 흐름을 잠깐 붙잡아보세요.',
          activity_tags: ['산책'],
          ontology: {
            confidence: 81,
            emotion_hierarchy: { level1: '긍정', level2: '기쁨' },
            situation_context: [{ domain: '기타', context: '산책 후' }],
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 201,
        jsonData: { id: 'saved-entry-1', created_at: '2026-03-16T12:00:00Z' },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: [{
          id: 'saved-entry-1',
          text: '산책하고 나니 마음이 좀 가벼워졌다',
          emotion: '기쁨',
          emoji: '😊',
          message: '오늘의 마음이 밝게 빛나네요.',
          advice: '이 좋은 흐름을 잠깐 붙잡아보세요.',
          date: '2026-03-16T12:00:00Z',
          created_at: '2026-03-16T12:00:00Z',
        }],
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          total_entries: 1,
          this_week: 1,
          today: 1,
          top_emotions: [{ emotion: '기쁨', count: 1 }],
          top_situations: [{ situation: '기타/산책 후', count: 1 }],
          recent_entries: [{
            id: 'saved-entry-1',
            text: '산책하고 나니 마음이 좀 가벼워졌다',
            emotion: '기쁨',
            emoji: '😊',
            date: '2026-03-16T12:00:00Z',
          }],
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: [],
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const historyList = document.getElementById('historyList');
    historyList.parentNode = createElementStub();
    const responseCard = document.getElementById('responseCard');
    responseCard.closest = vi.fn(() => null);
    const feedbackSection = document.getElementById('feedbackSection');
    feedbackSection.querySelector = vi.fn(() => ({
      hidden: false,
      querySelectorAll: vi.fn(() => []),
    }));
    document.getElementById('activityTags').querySelectorAll = vi.fn(() => []);

    const diary = await importFresh('../public/js/diary.js');
    const api = await import('../public/js/api.js');
    const history = await import('../public/js/history.js');
    const sidebar = await import('../public/js/sidebar.js');
    const stats = await import('../public/js/stats.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'member-token';
    state.currentUser = { id: 'user-123', email: 'test@example.com' };
    state.userProfile = { current_streak: 1 };
    state.guestMode = true;
    state.allEntries = [];

    const loadEntries = async () => {
      const entries = await api.fetchEntries();
      history.renderHistory(entries);
      sidebar.updateSidebar();
      await stats.loadDashboard('all', true);
    };

    const createConfetti = vi.fn();
    diary.setupDiary({
      createConfetti,
      updateSidebar: sidebar.updateSidebar,
      loadEntries,
      showHistoryDetail: vi.fn(),
    });

    document.getElementById('diary-text').value = '산책하고 나니 마음이 좀 가벼워졌다';
    document.getElementById('submitBtn').disabled = false;

    await diary.handleSubmit({ preventDefault: vi.fn() });
    await flushPromises(8);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/analyze', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/entries', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/entries?limit=100&offset=0', expect.any(Object));
    expect(fetchMock.mock.calls[4][0]).toBe('/api/reports?limit=10');

    expect(state.allEntries).toHaveLength(1);
    expect(document.getElementById('historyList').innerHTML).toContain('산책하고 나니 마음이 좀 가벼워졌다');
    expect(document.getElementById('sidebarLatestContent').innerHTML).toContain('오늘의 마음이 밝게 빛나네요.');
    expect(document.getElementById('dashboardSummary').innerHTML).toContain('1');
    expect(document.getElementById('responseCard').hidden).toBe(false);
    expect(document.getElementById('retentionCard').hidden).toBe(false);
    expect(createConfetti).toHaveBeenCalledWith('기쁨');
  });
});
