import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchResponse, importFresh, installBrowserEnv } from './helpers/browser-env.js';

function createChoiceButton(dataset) {
  return {
    dataset,
    disabled: false,
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
    addEventListener: vi.fn(),
    classList: { toggle: vi.fn() },
  };
}

function setupSelectorMocks() {
  const responseLengthBtns = [
    createChoiceButton({ responseLength: 'short' }),
    createChoiceButton({ responseLength: 'balanced' }),
    createChoiceButton({ responseLength: 'detailed' }),
  ];
  const adviceStyleBtns = [
    createChoiceButton({ adviceStyle: 'comfort' }),
    createChoiceButton({ adviceStyle: 'balanced' }),
    createChoiceButton({ adviceStyle: 'actionable' }),
  ];
  const personaPresetBtns = [
    createChoiceButton({ personaPreset: 'none' }),
    createChoiceButton({ personaPreset: 'mindful_guide' }),
  ];
  const notificationBtns = [
    createChoiceButton({ time: '08:00' }),
    createChoiceButton({ time: '21:00' }),
  ];

  document.querySelectorAll = vi.fn((selector) => {
    if (selector === '.response-length-btn[data-response-length]') return responseLengthBtns;
    if (selector === '.advice-style-btn[data-advice-style]') return adviceStyleBtns;
    if (selector === '.persona-preset-btn[data-persona-preset]') return personaPresetBtns;
    if (selector === '.notification-time-btn[data-time]') return notificationBtns;
    return [];
  });
  document.querySelector = vi.fn((selector) => {
    if (selector === '.notification-time-btn[data-time][aria-pressed="true"]') {
      return notificationBtns.find((btn) => btn.getAttribute.mock.calls.some(([name, value]) => name === 'aria-pressed' && value === 'true')) || null;
    }
    return null;
  });

  return { responseLengthBtns, adviceStyleBtns, personaPresetBtns, notificationBtns };
}

function installNotificationGranted() {
  const NotificationMock = vi.fn();
  NotificationMock.permission = 'granted';
  NotificationMock.requestPermission = vi.fn().mockResolvedValue('granted');
  window.Notification = NotificationMock;
  Object.defineProperty(globalThis, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  });
}

describe('frontend profile module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders profile data, counters, and selected preference buttons from state', async () => {
    const selectors = setupSelectorMocks();
    const profile = await importFresh('../public/js/profile.js');
    const { state } = await import('../public/js/state.js');

    state.currentUser = { email: 'test@example.com' };
    state.userProfile = {
      nickname: '마음이',
      total_entries: 12,
      created_at: '2026-03-10T10:00:00Z',
      bio: '한 줄 소개',
      response_length: 'detailed',
      advice_style: 'actionable',
      persona_preset: 'mindful_guide',
      notification_enabled: true,
      notification_time: '21:00',
    };
    state.allEntries = [
      { date: '2026-03-14T10:00:00Z' },
      { date: '2026-03-15T10:00:00Z' },
    ];

    profile.renderProfileScreen();

    expect(document.getElementById('profileDisplayNickname').textContent).toBe('마음이');
    expect(document.getElementById('profileDisplayEmail').textContent).toBe('test@example.com');
    expect(document.getElementById('profileTotalEntries').textContent).toBe(12);
    expect(document.getElementById('profileAvatar').textContent).toBe('마');
    expect(document.getElementById('profileJoinDate').textContent).not.toBe('--');
    expect(document.getElementById('profile-bio').value).toBe('한 줄 소개');
    expect(document.getElementById('bioCharCount').textContent).toBe('6 / 200');
    expect(document.getElementById('profileNotificationEnabled').checked).toBe(true);
    expect(document.getElementById('profile-notification-custom').value).toBe('');
    expect(selectors.responseLengthBtns[2].setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(selectors.adviceStyleBtns[2].setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(selectors.personaPresetBtns[1].setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(selectors.notificationBtns[1].setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(document.getElementById('profileStreak').textContent).toBe(2);
  });

  it('falls back to the current user email when no profile exists', async () => {
    setupSelectorMocks();
    const profile = await importFresh('../public/js/profile.js');
    const { state } = await import('../public/js/state.js');

    state.userProfile = null;
    state.currentUser = { email: 'fallback@example.com' };

    profile.renderProfileScreen();

    expect(document.getElementById('profileDisplayNickname').textContent).toBe('fallback@example.com');
    expect(document.getElementById('profileDisplayEmail').textContent).toBe('fallback@example.com');
    expect(document.getElementById('profileAvatar').textContent).toBe('F');
  });

  it('updates bio counter and notification controls through event listeners', async () => {
    const selectors = setupSelectorMocks();
    const profile = await importFresh('../public/js/profile.js');

    const bioInput = document.getElementById('profile-bio');
    const notifToggle = document.getElementById('profileNotificationEnabled');
    const customInput = document.getElementById('profile-notification-custom');

    profile.initProfileEventListeners();

    const bioHandler = bioInput.addEventListener.mock.calls.find(([type]) => type === 'input')[1];
    bioInput.value = 'a'.repeat(170);
    bioHandler.call(bioInput);
    expect(document.getElementById('bioCharCount').textContent).toBe('170 / 200');
    expect(document.getElementById('bioCharCount').classList.toggle).toHaveBeenCalledWith('near-limit', true);

    const toggleHandler = notifToggle.addEventListener.mock.calls.find(([type]) => type === 'change')[1];
    notifToggle.checked = false;
    toggleHandler.call(notifToggle);
    selectors.notificationBtns.forEach((btn) => expect(btn.disabled).toBe(true));
    expect(customInput.disabled).toBe(true);

    const customHandler = customInput.addEventListener.mock.calls.find(([type]) => type === 'change')[1];
    customInput.value = '22:30';
    customHandler.call(customInput);
    selectors.notificationBtns.forEach((btn) => {
      expect(btn.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');
    });
  });

  it('submits profile updates with notification time and refreshes local state', async () => {
    installNotificationGranted();
    const selectors = setupSelectorMocks();
    const fetchMock = vi.fn().mockResolvedValueOnce(createFetchResponse({
      status: 200,
      jsonData: {
        data: {
          nickname: '새닉네임',
          notification_enabled: true,
          notification_time: '21:00',
        },
      },
    }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

    const profile = await importFresh('../public/js/profile.js');
    const { state } = await import('../public/js/state.js');

    state.accessToken = 'user-access';
    state.currentUser = { email: 'test@example.com' };
    state.userProfile = {
      nickname: '이전닉네임',
      response_length: 'balanced',
      advice_style: 'balanced',
      persona_preset: 'none',
      notification_enabled: false,
      notification_time: null,
    };

    document.getElementById('profile-nickname').value = '새닉네임';
    document.getElementById('profile-bio').value = '소개';
    document.getElementById('profileNotificationEnabled').checked = true;
    selectors.notificationBtns[1].getAttribute = vi.fn((name) => (name === 'aria-pressed' ? 'true' : null));
    document.querySelector = vi.fn((selector) => {
      if (selector === '.notification-time-btn[data-time][aria-pressed="true"]') {
        return selectors.notificationBtns[1];
      }
      return null;
    });

    const updateUserMenu = vi.fn();
    profile.setupProfile({ updateUserMenu, showLanding: vi.fn() });
    profile.initProfileEventListeners();

    const submitHandler = document.getElementById('profileForm').addEventListener.mock.calls.find(([type]) => type === 'submit')[1];
    await submitHandler({ preventDefault: vi.fn() });

    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        Authorization: 'Bearer user-access',
      }),
    }));
    const patchBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(patchBody).toEqual(expect.objectContaining({
      nickname: '새닉네임',
      bio: '소개',
      notification_enabled: true,
      notification_time: '21:00',
    }));
    expect(state.userProfile.nickname).toBe('새닉네임');
    expect(state.userProfile.notification_time).toBe('21:00');
    expect(document.getElementById('profileMessage').hidden).toBe(false);
    expect(document.getElementById('profileMessage').className).toContain('success');
    expect(updateUserMenu).toHaveBeenCalledOnce();
  });
});
