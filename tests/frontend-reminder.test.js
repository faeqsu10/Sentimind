import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

function installNotificationMock({ permission = 'default', requestResult = 'granted' } = {}) {
  const NotificationMock = vi.fn(function MockNotification(title, options) {
    this.title = title;
    this.options = options;
    this.addEventListener = vi.fn();
    this.close = vi.fn();
  });
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = vi.fn().mockResolvedValue(requestResult);
  window.Notification = NotificationMock;
  Object.defineProperty(globalThis, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  });
  return NotificationMock;
}

describe('frontend reminder module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns unsupported when Notification API is unavailable', async () => {
    delete window.Notification;
    Object.defineProperty(globalThis, 'Notification', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const reminder = await importFresh('../public/js/reminder.js');

    await expect(reminder.requestNotificationPermission()).resolves.toBe('unsupported');
  });

  it('requests permission when current state is default', async () => {
    const NotificationMock = installNotificationMock({ permission: 'default', requestResult: 'granted' });

    const reminder = await importFresh('../public/js/reminder.js');
    const result = await reminder.requestNotificationPermission();

    expect(result).toBe('granted');
    expect(NotificationMock.requestPermission).toHaveBeenCalledOnce();
  });

  it('schedules for the next day when the configured reminder time already passed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T21:30:00'));
    installNotificationMock({ permission: 'granted' });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const reminder = await importFresh('../public/js/reminder.js');
    const { state } = await import('../public/js/state.js');

    state.userProfile = {
      notification_enabled: true,
      notification_time: '20:00',
      current_streak: 0,
    };

    reminder.scheduleReminder();

    expect(setTimeoutSpy).toHaveBeenCalledOnce();
    const delay = setTimeoutSpy.mock.calls[0][1];
    expect(delay).toBe(81_000_000);
  });

  it('shows a notification when the scheduled reminder fires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T09:00:00'));
    const NotificationMock = installNotificationMock({ permission: 'granted' });

    const reminder = await importFresh('../public/js/reminder.js');
    const { state } = await import('../public/js/state.js');

    state.userProfile = {
      notification_enabled: true,
      notification_time: '09:01',
      current_streak: 4,
    };
    state.allEntries = [];

    reminder.scheduleReminder();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(NotificationMock).toHaveBeenCalledOnce();
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('Sentimind'),
      expect.objectContaining({
        tag: 'sentimind-reminder',
      })
    );
  });

  it('does not show an evening reminder when the user already wrote today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T18:00:00'));
    const NotificationMock = installNotificationMock({ permission: 'granted' });

    const reminder = await importFresh('../public/js/reminder.js');
    const { state } = await import('../public/js/state.js');

    state.userProfile = {
      notification_enabled: true,
      notification_time: '18:01',
      current_streak: 1,
    };
    state.allEntries = [{ date: '2026-03-15' }];

    reminder.scheduleReminder();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('initializes reminders only when permission is granted', async () => {
    const NotificationMock = installNotificationMock({ permission: 'granted' });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const reminder = await importFresh('../public/js/reminder.js');
    const { state } = await import('../public/js/state.js');

    state.userProfile = {
      notification_enabled: true,
      notification_time: '10:00',
      current_streak: 0,
    };

    reminder.initReminder();

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(NotificationMock.requestPermission).not.toHaveBeenCalled();
  });
});
