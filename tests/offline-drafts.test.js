import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueOfflineDraft,
  flushOfflineDraftQueue,
  getOfflineDraftQueueCount,
  loadOfflineDraftQueue,
} from '../public/js/offline-drafts.js';

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('offline draft queue', () => {
  beforeEach(() => {
    global.localStorage = createStorage();
  });

  it('queues a draft with text and tags', () => {
    enqueueOfflineDraft({ text: '오프라인 일기', activityTags: ['운동', '산책'] });

    const queue = loadOfflineDraftQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      text: '오프라인 일기',
      activityTags: ['운동', '산책'],
    });
    expect(getOfflineDraftQueueCount()).toBe(1);
  });

  it('flushes queued drafts in order and clears successful items', async () => {
    enqueueOfflineDraft({ text: '첫 번째 초안', activityTags: ['운동'] });
    enqueueOfflineDraft({ text: '두 번째 초안', activityTags: ['휴식'] });

    const analyzeEmotion = vi.fn()
      .mockResolvedValueOnce({ emotion: '기쁨', emoji: '😊', message: 'm1', advice: 'a1', ontology: {} })
      .mockResolvedValueOnce({ emotion: '평온', emoji: '😌', message: 'm2', advice: 'a2', ontology: {} });
    const saveEntry = vi.fn().mockResolvedValue({});

    const result = await flushOfflineDraftQueue({ analyzeEmotion, saveEntry });

    expect(result).toEqual({ processed: 2, remaining: 0 });
    expect(analyzeEmotion).toHaveBeenCalledTimes(2);
    expect(saveEntry).toHaveBeenNthCalledWith(
      1,
      '첫 번째 초안',
      expect.objectContaining({ emotion: '기쁨' }),
      ['운동']
    );
    expect(getOfflineDraftQueueCount()).toBe(0);
  });

  it('keeps failed and remaining drafts in the queue', async () => {
    enqueueOfflineDraft({ text: '첫 번째 초안', activityTags: ['운동'] });
    enqueueOfflineDraft({ text: '두 번째 초안', activityTags: ['휴식'] });

    const analyzeEmotion = vi.fn()
      .mockResolvedValueOnce({ emotion: '기쁨', emoji: '😊', message: 'm1', advice: 'a1', ontology: {} })
      .mockRejectedValueOnce(new Error('network'));
    const saveEntry = vi.fn().mockResolvedValue({});

    const result = await flushOfflineDraftQueue({ analyzeEmotion, saveEntry });

    expect(result).toEqual({ processed: 1, remaining: 1 });
    expect(getOfflineDraftQueueCount()).toBe(1);
    expect(loadOfflineDraftQueue()[0].text).toBe('두 번째 초안');
  });
});
