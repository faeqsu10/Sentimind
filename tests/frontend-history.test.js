import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

function makeEntries() {
  return [
    { id: '1', text: '첫 번째 행복 기록', emotion: '기쁨', emoji: '😊', date: '2026-03-15T09:00:00Z', message: '좋아요', advice: '계속 기록해요' },
    { id: '2', text: '두 번째 차분한 기록', emotion: '평온', emoji: '😌', date: '2026-03-14T09:00:00Z', message: '차분해요', advice: '호흡해요' },
    { id: '3', text: '세 번째 슬픈 기록', emotion: '슬픔', emoji: '😢', date: '2026-03-13T09:00:00Z', message: '힘들어요', advice: '쉬어요' },
    { id: '4', text: '네 번째 행복 기록', emotion: '기쁨', emoji: '😊', date: '2026-03-12T09:00:00Z', message: '좋아요', advice: '산책해요' },
    { id: '5', text: '다섯 번째 기록', emotion: '불안', emoji: '😰', date: '2026-03-11T09:00:00Z', message: '긴장돼요', advice: '메모해요' },
    { id: '6', text: '여섯 번째 추가 기록', emotion: '감사', emoji: '🙏', date: '2026-03-10T09:00:00Z', message: '고마워요', advice: '돌아봐요' },
  ];
}

describe('frontend history module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders filter chips and the first history page', async () => {
    const history = await importFresh('../public/js/history.js');
    const { state } = await import('../public/js/state.js');

    history.renderHistory(makeEntries());

    expect(state.allEntries).toHaveLength(6);
    expect(state.filteredEntries).toHaveLength(6);
    expect(document.getElementById('filterChips').children).toHaveLength(5);
    expect(document.getElementById('historyList').innerHTML).toContain('첫 번째 행복 기록');
    expect(document.getElementById('historyList').innerHTML).not.toContain('여섯 번째 추가 기록');
    expect(document.getElementById('loadMoreBtn').hidden).toBe(false);
  });

  it('applies search and emotion filters and updates the result count', async () => {
    const history = await importFresh('../public/js/history.js');
    const { state } = await import('../public/js/state.js');

    history.renderHistory(makeEntries());
    document.getElementById('historySearch').value = '행복';
    state.activeFilters.add('기쁨');

    history.applyFilters();

    expect(state.filteredEntries).toHaveLength(2);
    expect(document.getElementById('historyList').innerHTML).toContain('첫 번째 행복 기록');
    expect(document.getElementById('historyList').innerHTML).toContain('네 번째 행복 기록');
    expect(document.getElementById('filterResultCount').hidden).toBe(false);
    expect(document.getElementById('filterResultCount').textContent).toBe('2건의 이야기를 찾았어요.');
  });

  it('loads the next page when the load more button is clicked', async () => {
    const history = await importFresh('../public/js/history.js');

    history.renderHistory(makeEntries());
    document.getElementById('loadMoreBtn').onclick();

    expect(document.getElementById('historyList').innerHTML).toContain('여섯 번째 추가 기록');
    expect(document.getElementById('loadMoreBtn').hidden).toBe(true);
  });

  it('populates the history detail modal with entry data', async () => {
    const history = await importFresh('../public/js/history.js');

    const detailModal = document.getElementById('historyDetail');
    detailModal.querySelector = vi.fn(() => null);

    history.showHistoryDetail(makeEntries()[0]);

    expect(detailModal.hidden).toBe(false);
    expect(document.getElementById('detailDate').textContent).toContain('2026년');
    expect(document.getElementById('detailEmoji').textContent).toBe('😊');
    expect(document.getElementById('detailEmotion').textContent).toBe('기쁨');
    expect(document.getElementById('detailText').textContent).toBe('첫 번째 행복 기록');
    expect(document.getElementById('detailMessage').textContent).toBe('좋아요');
    expect(document.getElementById('detailAdvice').textContent).toBe('계속 기록해요');
  });
});
