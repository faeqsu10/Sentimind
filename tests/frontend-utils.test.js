import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementStub, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend utils module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('safeEmoji falls back for plain ASCII labels but preserves real emoji', async () => {
    const utils = await importFresh('../public/js/utils.js');

    expect(utils.safeEmoji('perplexed')).toBe('💭');
    expect(utils.safeEmoji('  ')).toBe('💭');
    expect(utils.safeEmoji('😊')).toBe('😊');
    expect(utils.safeEmoji('마음')).toBe('마음');
  });

  it('toLocalDateStr returns a normalized local date string and calculateStreak counts backward from yesterday when needed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T12:00:00'));

    const utils = await importFresh('../public/js/utils.js');

    expect(utils.toLocalDateStr('2026-03-16T23:59:00Z')).toMatch(/2026-03-(16|17)/);
    expect(utils.calculateStreak([
      { date: '2026-03-15T08:00:00Z' },
      { date: '2026-03-14T08:00:00Z' },
      { date: '2026-03-13T08:00:00Z' },
    ])).toBe(3);
  });

  it('showToast appends a toast and dismisses it on click', async () => {
    vi.useFakeTimers();
    const utils = await importFresh('../public/js/utils.js');
    const toastContainer = document.getElementById('toastContainer');

    utils.showToast('테스트 메시지', 'success');

    expect(toastContainer.children).toHaveLength(1);
    const toast = toastContainer.children[0];
    expect(toast.className).toBe('toast toast-success');
    expect(toast.textContent).toBe('테스트 메시지');

    const clickHandler = toast.addEventListener.mock.calls.find(([type]) => type === 'click')[1];
    clickHandler();

    expect(toast.classList.add).toHaveBeenCalledWith('toast-dismissing');
  });

  it('openModalFocus and closeModalFocus trap focus and restore the previous element', async () => {
    const utils = await importFresh('../public/js/utils.js');
    const { state } = await import('../public/js/state.js');

    const previous = createElementStub({ id: 'prev' });
    document.activeElement = previous;

    const firstFocusable = createElementStub();
    const secondFocusable = createElementStub();
    const modalContent = createElementStub();
    modalContent.querySelectorAll = vi.fn(() => [firstFocusable, secondFocusable]);

    utils.openModalFocus(modalContent, modalContent);

    expect(document.body.classList.add).toHaveBeenCalledWith('focus-trap-active');
    expect(state.lastFocusedElement).toBe(previous);
    expect(modalContent.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(firstFocusable.focus).toHaveBeenCalled();

    utils.closeModalFocus(modalContent, modalContent);

    expect(document.body.classList.remove).toHaveBeenCalledWith('focus-trap-active');
    expect(previous.focus).toHaveBeenCalled();
    expect(state.lastFocusedElement).toBeNull();
  });
});
