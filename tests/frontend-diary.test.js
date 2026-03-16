import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend diary module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('queues an offline draft and clears the composer when offline', async () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    const activityTag = {
      dataset: { tag: '운동' },
      classList: { remove: vi.fn() },
    };
    document.getElementById('activityTags').querySelectorAll = vi.fn(() => [activityTag]);

    const diary = await importFresh('../public/js/diary.js');
    const { state } = await import('../public/js/state.js');

    state.guestMode = false;
    diary.setupDiary({
      createConfetti: vi.fn(),
      updateSidebar: vi.fn(),
      loadEntries: vi.fn(),
      showHistoryDetail: vi.fn(),
    });

    document.getElementById('diary-text').value = '오프라인 상태에서도 기록한다';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('charCount').textContent = '14/500';

    const preventDefault = vi.fn();
    await diary.handleSubmit({ preventDefault });

    const queued = JSON.parse(localStorage.getItem('sentimind-offline-draft-queue'));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toEqual(expect.objectContaining({
      text: '오프라인 상태에서도 기록한다',
      activityTags: ['운동'],
    }));
    expect(document.getElementById('diary-text').value).toBe('');
    expect(document.getElementById('charCount').textContent).toBe('');
    expect(document.getElementById('submitBtn').disabled).toBe(true);
    expect(activityTag.classList.remove).toHaveBeenCalledWith('active');
  });

  it('processes offline drafts when back online and refreshes entries', async () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: {
          emotion: '기쁨',
          emoji: '😊',
          message: '좋아요',
          advice: '잠깐 산책해보세요',
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        jsonData: { id: 'saved-entry-1' },
      }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    localStorage.setItem('sentimind-offline-draft-queue', JSON.stringify([
      { id: 'offline-1', text: '다시 온라인', activityTags: ['회복'], createdAt: '2026-03-15T10:00:00Z' },
    ]));

    const diary = await importFresh('../public/js/diary.js');
    const { state } = await import('../public/js/state.js');

    state.guestMode = false;
    state.accessToken = 'user-access';

    const loadEntries = vi.fn().mockResolvedValue(undefined);
    diary.setupDiary({
      createConfetti: vi.fn(),
      updateSidebar: vi.fn(),
      loadEntries,
      showHistoryDetail: vi.fn(),
    });

    const result = await diary.processOfflineDraftQueue();

    expect(result).toEqual({ processed: 1, remaining: 0 });
    expect(loadEntries).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('sentimind-offline-draft-queue'))).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders the analysis response card and similar entries', async () => {
    const diary = await importFresh('../public/js/diary.js');
    const { state } = await import('../public/js/state.js');

    const createConfetti = vi.fn();
    const updateSidebar = vi.fn();
    diary.setupDiary({
      createConfetti,
      updateSidebar,
      loadEntries: vi.fn(),
      showHistoryDetail: vi.fn(),
    });

    state._lastDiaryText = '오늘은 마음이 조금 가벼웠다';
    state.guestMode = false;
    state.allEntries = [
      {
        id: 'entry-1',
        emotion: '기쁨',
        emoji: '😊',
        text: '예전에 비슷하게 기뻤던 날',
        date: '2026-03-01T10:00:00Z',
      },
    ];

    diary.showResponse({
      emotion: '기쁨',
      emoji: '😊',
      message: '좋은 하루네요',
      advice: '그 기분을 잠깐 붙잡아보세요',
    });

    expect(document.getElementById('responseCard').hidden).toBe(false);
    expect(document.getElementById('responseEmotion').textContent).toContain('기쁨');
    expect(document.getElementById('responseMessage').textContent).toBe('좋은 하루네요');
    expect(document.getElementById('responseAdvice').textContent).toBe('그 기분을 잠깐 붙잡아보세요');
    expect(document.getElementById('myDiaryText').textContent).toBe('오늘은 마음이 조금 가벼웠다');
    expect(document.getElementById('similarEntries').hidden).toBe(false);
    expect(document.getElementById('similarEntriesList').innerHTML).toContain('예전에 비슷하게 기뻤던 날');
    expect(state.latestAnalysisResult).toEqual(expect.objectContaining({
      emotion: '기쁨',
      message: '좋은 하루네요',
    }));
    expect(createConfetti).toHaveBeenCalledWith('기쁨');
    expect(updateSidebar).toHaveBeenCalledOnce();
  });
});
