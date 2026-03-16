import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend analytics module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends authenticated batches with an Authorization header', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    localStorage.setItem('sb-access-token', 'access-token');

    const analytics = await importFresh('../public/js/analytics.js');
    analytics.track('app_opened', { source: 'test' });

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
      }),
      keepalive: true,
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0]).toEqual(expect.objectContaining({
      event: 'app_opened',
      source: 'test',
      is_guest: false,
      platform: 'web',
    }));
  });

  it('uses sendBeacon for unauthenticated batches', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const analytics = await importFresh('../public/js/analytics.js');
    analytics.track('landing_viewed');

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(navigator.sendBeacon).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks anonymous sessions as guest traffic', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    localStorage.setItem('sb-access-token', 'access-token');

    const analytics = await importFresh('../public/js/analytics.js');
    analytics.setAnalyticsAnonymous(true);
    analytics.track('guest_demo_started');

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0]).toEqual(expect.objectContaining({
      event: 'guest_demo_started',
      is_guest: true,
    }));
  });

  it('flushes immediately when the batch reaches max size', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    localStorage.setItem('sb-access-token', 'access-token');

    const analytics = await importFresh('../public/js/analytics.js');
    for (let i = 0; i < 20; i++) {
      analytics.track('evt-' + i);
    }
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(20);
  });
});
