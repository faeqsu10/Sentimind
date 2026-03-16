import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend sidebar module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns no insights when there are fewer than three entries', async () => {
    const sidebar = await importFresh('../public/js/sidebar.js');

    expect(sidebar.generateInsights([
      { date: '2026-03-15T09:00:00Z', emotion: '기쁨' },
      { date: '2026-03-14T09:00:00Z', emotion: '평온' },
    ])).toEqual([]);
  });

  it('generates weekly top-emotion and busiest-day insights', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));

    const sidebar = await importFresh('../public/js/sidebar.js');
    const insights = sidebar.generateInsights([
      { date: '2026-03-10T09:00:00Z', emotion: '기쁨' },
      { date: '2026-03-10T18:00:00Z', emotion: '기쁨' },
      { date: '2026-03-13T09:00:00Z', emotion: '기쁨' },
      { date: '2026-03-04T09:00:00Z', emotion: '기쁨' },
    ]);

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: '이번 주 가장 많이 찾아온 마음',
        body: expect.stringContaining('기쁨 (3회, 지난주 대비 +2)'),
      }),
      expect.objectContaining({
        title: '마음을 가장 많이 꺼낸 요일',
        body: expect.stringContaining('(2회)'),
      }),
    ]));
  });

  it('creates and later removes confetti for positive emotions', async () => {
    vi.useFakeTimers();
    const sidebar = await importFresh('../public/js/sidebar.js');

    sidebar.createConfetti('기쁨');

    expect(document.body.appendChild).toHaveBeenCalledOnce();
    const container = document.body.appendChild.mock.calls[0][0];
    await vi.advanceTimersByTimeAsync(4000);
    expect(container.remove).toHaveBeenCalledOnce();
  });

  it('does not create confetti for neutral or unknown emotions', async () => {
    const sidebar = await importFresh('../public/js/sidebar.js');

    sidebar.createConfetti('복합적');

    expect(document.body.appendChild).not.toHaveBeenCalled();
  });

  it('renders a weekly chart when there are entries in the last seven days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));

    const sidebar = await importFresh('../public/js/sidebar.js');

    sidebar.updateSidebarWeeklyChart({
      entries: [
        { date: '2026-03-15T09:00:00Z' },
        { date: '2026-03-14T09:00:00Z' },
        { date: '2026-03-14T18:00:00Z' },
      ],
    });

    expect(document.getElementById('sidebarWeeklyChart').innerHTML).toContain('mini-chart');
    expect(document.getElementById('sidebarWeeklyChart').innerHTML).toContain('mini-chart-bar-fill');
  });

  it('renders the empty weekly-chart state when there are no recent entries', async () => {
    const sidebar = await importFresh('../public/js/sidebar.js');

    sidebar.updateSidebarWeeklyChart({ entries: [] });

    expect(document.getElementById('sidebarWeeklyChart').innerHTML).toContain('이번 주 첫 이야기를 들려주세요');
  });
});
