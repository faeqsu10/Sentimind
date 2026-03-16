import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend state module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    // resetModules is enough; state module is singleton
  });

  it('resetState restores mutable state to its defaults', async () => {
    const stateModule = await importFresh('../public/js/state.js');
    const { state, resetState } = stateModule;

    state.currentUser = { id: 'user-123' };
    state.accessToken = 'access';
    state.refreshToken = 'refresh';
    state.userProfile = { nickname: '마음이' };
    state.allEntries = [{ id: 'entry-1' }];
    state.activeFilters = new Set(['기쁨']);
    state.currentPage = 5;
    state.filteredEntries = [{ id: 'entry-1' }];
    state.guestMode = true;
    state.isAnonymous = true;
    state.latestAnalysisResult = { emotion: '기쁨' };
    state.appInitialized = true;
    state.lastFocusedElement = { id: 'focus' };
    state.calYear = 2020;
    state.calMonth = 1;
    state.calSelectedDate = '2020-02-20';
    state.activePeriod = '7d';
    state.onboardingStep = 3;
    state.selectedNotificationTime = '21:00';

    resetState();

    expect(state.currentUser).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.userProfile).toBeNull();
    expect(state.allEntries).toEqual([]);
    expect(state.activeFilters).toBeInstanceOf(Set);
    expect([...state.activeFilters]).toEqual([]);
    expect(state.currentPage).toBe(1);
    expect(state.filteredEntries).toEqual([]);
    expect(state.guestMode).toBe(false);
    expect(state.isAnonymous).toBe(false);
    expect(state.latestAnalysisResult).toBeNull();
    expect(state.appInitialized).toBe(false);
    expect(state.lastFocusedElement).toBeNull();
    expect(state.calSelectedDate).toBeNull();
    expect(state.activePeriod).toBe('all');
    expect(state.onboardingStep).toBe(1);
    expect(state.selectedNotificationTime).toBeNull();
  });
});
