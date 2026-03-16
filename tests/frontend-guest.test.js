import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend guest module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('filters out stale guest entries when loading from localStorage', async () => {
    const { GUEST_STORAGE_KEY, GUEST_MAX_DAYS } = await import('../public/js/state.js');
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify([
      { text: '최근 기록', timestamp: Date.now() - 60_000 },
      { text: '오래된 기록', timestamp: Date.now() - (GUEST_MAX_DAYS + 1) * 24 * 60 * 60 * 1000 },
    ]));

    const guest = await importFresh('../public/js/guest.js');
    const entries = guest.loadGuestEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('최근 기록');
  });

  it('caps saved guest entries to the maximum allowed count', async () => {
    const { GUEST_STORAGE_KEY, GUEST_MAX_ENTRIES } = await import('../public/js/state.js');
    const guest = await importFresh('../public/js/guest.js');
    const entries = Array.from({ length: GUEST_MAX_ENTRIES + 3 }, (_, index) => ({
      text: `entry-${index}`,
      timestamp: Date.now() + index,
    }));

    guest.saveGuestEntries(entries);

    const saved = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY));
    expect(saved).toHaveLength(GUEST_MAX_ENTRIES);
    expect(saved[0].text).toBe('entry-0');
    expect(saved.at(-1).text).toBe(`entry-${GUEST_MAX_ENTRIES - 1}`);
  });

  it('loads anonymous demo entries from the API and updates remaining count', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({
      status: 200,
      jsonData: [
        {
          id: 'entry-1',
          text: 'DB에서 불러온 체험 기록',
          emotion: '기쁨',
          emoji: '😊',
          message: '좋아요',
          created_at: '2026-03-15T09:00:00Z',
        },
      ],
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const guest = await importFresh('../public/js/guest.js');
    const { state, GUEST_MAX_ENTRIES } = await import('../public/js/state.js');

    state.accessToken = 'anon-token';
    state.isAnonymous = true;

    await guest.initDemoScreen();

    expect(fetchMock).toHaveBeenCalledWith('/api/entries', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer anon-token',
      }),
    }));
    expect(document.getElementById('demoCounterNum').textContent).toBe(GUEST_MAX_ENTRIES - 1);
    expect(document.getElementById('demoHistory').hidden).toBe(false);
    expect(document.getElementById('demoHistoryList').innerHTML).toContain('DB에서 불러온 체험 기록');
  });

  it('migrates guest data successfully and clears local storage', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
      status: 200,
      jsonData: { imported: 2, skipped: 1 },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const { GUEST_STORAGE_KEY } = await import('../public/js/state.js');
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify([
      { text: '첫 기록', timestamp: Date.now() - 1_000 },
      { text: '둘째 기록', timestamp: Date.now() - 2_000 },
    ]));

    const guest = await importFresh('../public/js/guest.js');
    const { state } = await import('../public/js/state.js');
    state.accessToken = 'member-token';

    await guest.migrateGuestData();

    expect(fetchMock).toHaveBeenCalledWith('/api/migrate/from-guest', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer member-token',
      }),
    }));
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    expect(document.getElementById('toastContainer').children).toHaveLength(1);
  });
});
