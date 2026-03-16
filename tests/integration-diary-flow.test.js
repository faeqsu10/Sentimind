import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('integration diary flow', () => {
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

  it('analyzes text, saves the entry, renders the response, and refreshes entries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          emotion: '기쁨',
          emoji: '😊',
          message: '좋은 하루네요',
          advice: '이 기분을 잠깐 기록해보세요',
          activity_tags: ['산책'],
          ontology: {
            confidence: 82,
            emotion_hierarchy: { level1: '긍정', level2: '기쁨' },
            situation_context: [{ domain: '기타', context: '산책 후' }],
          },
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 201,
        jsonData: { id: 'saved-entry-1', created_at: '2026-03-16T12:00:00Z' },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const diary = await importFresh('../public/js/diary.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'member-access-token';
    state.guestMode = true;
    state.allEntries = [];

    const activeTag = {
      dataset: { tag: '운동' },
      classList: { remove: vi.fn() },
    };
    document.getElementById('activityTags').querySelectorAll = vi.fn((selector) => {
      if (selector === '.activity-tag.active') return [activeTag];
      return [];
    });

    const responseCard = document.getElementById('responseCard');
    responseCard.closest = vi.fn(() => null);
    const feedbackSection = document.getElementById('feedbackSection');
    feedbackSection.querySelector = vi.fn(() => ({
      hidden: false,
      querySelectorAll: vi.fn(() => []),
    }));

    const createConfetti = vi.fn();
    const updateSidebar = vi.fn();
    const loadEntries = vi.fn().mockResolvedValue(undefined);
    diary.setupDiary({
      createConfetti,
      updateSidebar,
      loadEntries,
      showHistoryDetail: vi.fn(),
    });

    document.getElementById('diary-text').value = '산책하고 나니 조금 가벼워졌다';
    document.getElementById('submitBtn').disabled = false;

    await diary.handleSubmit({ preventDefault: vi.fn() });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/analyze', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-access-token',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/entries', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-access-token',
      }),
    }));

    const saveBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(saveBody).toEqual(expect.objectContaining({
      text: '산책하고 나니 조금 가벼워졌다',
      emotion: '기쁨',
      emoji: '😊',
      message: '좋은 하루네요',
      advice: '이 기분을 잠깐 기록해보세요',
      confidence_score: 82,
      activity_tags: ['운동', '산책'],
    }));

    expect(document.getElementById('responseCard').hidden).toBe(false);
    expect(document.getElementById('responseEmotion').textContent).toContain('기쁨');
    expect(document.getElementById('responseMessage').textContent).toBe('좋은 하루네요');
    expect(document.getElementById('responseAdvice').textContent).toBe('이 기분을 잠깐 기록해보세요');
    expect(document.getElementById('similarEntries').hidden).toBe(true);
    expect(document.getElementById('retentionCard').hidden).toBe(false);
    expect(state.latestAnalysisResult).toEqual(expect.objectContaining({
      emotion: '기쁨',
      message: '좋은 하루네요',
    }));
    expect(document.getElementById('diary-text').value).toBe('');
    expect(loadEntries).toHaveBeenCalledOnce();
    expect(createConfetti).toHaveBeenCalledWith('기쁨');
    expect(updateSidebar).toHaveBeenCalledOnce();
    expect(activeTag.classList.remove).toHaveBeenCalledWith('active');
  });
});
