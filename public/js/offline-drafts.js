import { OFFLINE_DRAFT_QUEUE_KEY } from './state.js';

const OFFLINE_DRAFT_LIMIT = 20;
let activeFlushPromise = null;

export function loadOfflineDraftQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.text === 'string')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : createOfflineDraftId(),
        text: item.text.slice(0, 2000),
        activityTags: Array.isArray(item.activityTags)
          ? item.activityTags.filter((tag) => typeof tag === 'string').slice(0, 10)
          : [],
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function getOfflineDraftQueueCount() {
  return loadOfflineDraftQueue().length;
}

export function saveOfflineDraftQueue(queue) {
  try {
    const safeQueue = (Array.isArray(queue) ? queue : []).slice(-OFFLINE_DRAFT_LIMIT);
    localStorage.setItem(OFFLINE_DRAFT_QUEUE_KEY, JSON.stringify(safeQueue));
  } catch {
    // Ignore quota/storage errors and fail silently for now.
  }
}

export function enqueueOfflineDraft({ text, activityTags = [] }) {
  const queue = loadOfflineDraftQueue();
  queue.push({
    id: createOfflineDraftId(),
    text: String(text || '').slice(0, 2000),
    activityTags: Array.isArray(activityTags)
      ? activityTags.filter((tag) => typeof tag === 'string').slice(0, 10)
      : [],
    createdAt: new Date().toISOString(),
  });
  saveOfflineDraftQueue(queue);
  return queue.length;
}

export async function flushOfflineDraftQueue({ analyzeEmotion, saveEntry }) {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const queue = loadOfflineDraftQueue();
    if (queue.length === 0) {
      return { processed: 0, remaining: 0 };
    }

    const remaining = [];
    let processed = 0;

    for (let i = 0; i < queue.length; i++) {
      const draft = queue[i];
      try {
        const result = await analyzeEmotion(draft.text);
        await saveEntry(draft.text, result, draft.activityTags);
        processed++;
      } catch {
        remaining.push(draft, ...queue.slice(i + 1));
        break;
      }
    }

    saveOfflineDraftQueue(remaining);
    return { processed, remaining: remaining.length };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}

function createOfflineDraftId() {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
