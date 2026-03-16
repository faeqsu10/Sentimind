import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, flushPromises, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend error reporter module', () => {
  beforeEach(() => {
    installBrowserEnv();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('deduplicates repeated errors before flushing the batch', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({ status: 202, jsonData: { accepted: 1 } }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const reporter = await importFresh('../public/js/error-reporter.js');

    reporter.reportError({
      message: 'API 500: /api/report',
      source: 'https://example.com/app.js',
      lineno: 10,
    });
    reporter.reportError({
      message: 'API 500: /api/report',
      source: 'https://example.com/app.js',
      lineno: 10,
    });

    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0].source_file).toBe('app.js');
  });

  it('falls back to sendBeacon when fetch submission fails', async () => {
    vi.useFakeTimers();
    const env = installBrowserEnv();
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const reporter = await importFresh('../public/js/error-reporter.js');

    reporter.reportError({
      message: '네트워크 오류',
      source: '/static/app.js',
      lineno: 27,
    });

    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(env.navigator.sendBeacon).toHaveBeenCalledOnce();
    expect(env.navigator.sendBeacon).toHaveBeenCalledWith('/api/error-logs', expect.any(Blob));
  });

  it('only reports API responses with 5xx status', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({ status: 202, jsonData: { accepted: 1 } }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const reporter = await importFresh('../public/js/error-reporter.js');

    reporter.reportApiError({
      status: 400,
      headers: { get: vi.fn(() => 'rid-400') },
    }, '/api/not-reported');
    reporter.reportApiError({
      status: 503,
      headers: { get: vi.fn(() => 'rid-503') },
    }, '/api/reported');

    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0]).toEqual(expect.objectContaining({
      message: 'API 503: /api/reported',
      code: 'API_SERVER_ERROR',
    }));
    expect(payload.errors[0].metadata).toEqual(expect.objectContaining({
      request_id: 'rid-503',
      status: 503,
      url: '/api/reported',
    }));
  });

  it('registers unhandled rejection handler and shows the user-facing message', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse({ status: 202, jsonData: { accepted: 1 } }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const reporter = await importFresh('../public/js/error-reporter.js');
    const showToast = vi.fn();
    reporter.setupErrorHandlers({ showToast });

    const event = {
      reason: {
        message: 'boom',
        userMessage: '친절한 메시지',
        stack: 'stack trace',
      },
      preventDefault: vi.fn(),
    };

    window.onunhandledrejection(event);
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('친절한 메시지', 'error');
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.errors[0].code).toBe('UNHANDLED_REJECTION');
  });
});
