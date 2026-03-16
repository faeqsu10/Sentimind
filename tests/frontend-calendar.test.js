import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementStub, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend calendar module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the current month title, hides the today button, and shows selected day entries and monthly summary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));

    const calendar = await importFresh('../public/js/calendar.js');
    const { state } = await import('../public/js/state.js');

    state.calYear = 2026;
    state.calMonth = 2;
    state.calSelectedDate = '2026-03-15';
    state.allEntries = [
      { date: '2026-03-15T09:00:00Z', text: '선택한 날 기록', emotion: '기쁨', emoji: '😊', message: '좋아요' },
      { date: '2026-03-20T09:00:00Z', text: '다른 날 기록', emotion: '평온', emoji: '😌' },
    ];

    calendar.renderCalendar();

    expect(document.getElementById('calMonthTitle').textContent).toBe('2026년 3월');
    expect(document.getElementById('calToday').style.display).toBe('none');
    expect(document.getElementById('calendarGrid').innerHTML).toContain('data-date="2026-03-15"');
    expect(document.getElementById('calendarGrid').innerHTML).toContain('cal-dot');
    expect(document.getElementById('calDayEntries').innerHTML).toContain('선택한 날 기록');
    expect(document.getElementById('calDayEntries').innerHTML).toContain('1건');
    expect(document.getElementById('calMonthlySummary').innerHTML).toContain('2<small>건</small>');
    expect(document.getElementById('calMonthlySummary').classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('clears an out-of-month selected date and hides the monthly summary when there are no entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));

    const calendar = await importFresh('../public/js/calendar.js');
    const { state } = await import('../public/js/state.js');

    state.calYear = 2026;
    state.calMonth = 2;
    state.calSelectedDate = '2026-04-01';
    state.allEntries = [];

    calendar.renderCalendar();

    expect(state.calSelectedDate).toBeNull();
    expect(document.getElementById('calMonthlySummary').classList.add).toHaveBeenCalledWith('hidden');
    expect(document.getElementById('calMonthlySummary').innerHTML).toBe('');
    expect(document.getElementById('calDayEntries').innerHTML).toBe('');
  });

  it('wires prev, next, and today controls to update calendar state and rerender', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));

    const calendar = await importFresh('../public/js/calendar.js');
    const { state } = await import('../public/js/state.js');

    state.calYear = 2026;
    state.calMonth = 0;
    state.calSelectedDate = '2026-01-10';
    state.allEntries = [];

    calendar.setupCalendar();

    const prevHandler = document.getElementById('calPrev').addEventListener.mock.calls[0][1];
    const nextHandler = document.getElementById('calNext').addEventListener.mock.calls[0][1];
    const todayHandler = document.getElementById('calToday').addEventListener.mock.calls[0][1];

    prevHandler();
    expect(state.calYear).toBe(2025);
    expect(state.calMonth).toBe(11);
    expect(state.calSelectedDate).toBeNull();
    expect(document.getElementById('calMonthTitle').textContent).toBe('2025년 12월');

    nextHandler();
    expect(state.calYear).toBe(2026);
    expect(state.calMonth).toBe(0);
    expect(document.getElementById('calMonthTitle').textContent).toBe('2026년 1월');

    todayHandler();
    expect(state.calYear).toBe(2026);
    expect(state.calMonth).toBe(2);
    expect(state.calSelectedDate).toBe('2026-03-15');
    expect(document.getElementById('calMonthTitle').textContent).toBe('2026년 3월');
  });

  it('handles grid click and keyboard selection by updating the selected date and day entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    installBrowserEnv();

    const grid = document.getElementById('calendarGrid');
    const previouslySelected = createElementStub();
    grid.querySelectorAll = vi.fn(() => [previouslySelected]);

    const selectedDay = createElementStub({
      dataset: { date: '2026-03-15' },
      classList: {
        contains: vi.fn(() => true),
        add: vi.fn(),
        remove: vi.fn(),
      },
    });

    const calendar = await importFresh('../public/js/calendar.js');
    const { state } = await import('../public/js/state.js');

    state.calYear = 2026;
    state.calMonth = 2;
    state.allEntries = [
      { date: '2026-03-15T09:00:00Z', text: '클릭한 날 기록', emotion: '기쁨', emoji: '😊', message: '좋아요' },
    ];

    calendar.setupCalendar();

    const clickHandler = grid.addEventListener.mock.calls.find(([type]) => type === 'click')[1];
    clickHandler({
      target: {
        closest: vi.fn(() => selectedDay),
      },
    });

    expect(state.calSelectedDate).toBe('2026-03-15');
    expect(previouslySelected.classList.remove).toHaveBeenCalledWith('selected');
    expect(selectedDay.classList.add).toHaveBeenCalledWith('selected');
    expect(document.getElementById('calDayEntries').innerHTML).toContain('클릭한 날 기록');

    const keydownHandler = grid.addEventListener.mock.calls.find(([type]) => type === 'keydown')[1];
    const preventDefault = vi.fn();
    keydownHandler({
      key: 'Enter',
      preventDefault,
      target: {
        closest: vi.fn(() => selectedDay),
      },
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(document.getElementById('calDayEntries').innerHTML).toContain('클릭한 날 기록');
  });
});
