import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementStub, importFresh, installBrowserEnv } from './helpers/browser-env.js';

describe('frontend tutorial module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  function setupTutorialDom({ hasOverlay = false } = {}) {
    const body = document.body;
    let overlayRef = hasOverlay ? createElementStub({ id: 'tutorialOverlay' }) : null;
    let tooltipRef = hasOverlay ? createElementStub({ id: 'tutorialTooltip' }) : null;

    document.createElement = vi.fn((tag) => createElementStub({ tagName: String(tag).toUpperCase() }));
    body.appendChild = vi.fn((child) => {
      child.parentNode = body;
      body.children.push(child);
      if (child.id === 'tutorialOverlay') overlayRef = child;
      if (child.id === 'tutorialTooltip') tooltipRef = child;
      return child;
    });

    document.getElementById = vi.fn((id) => {
      if (id === 'tutorialOverlay') return overlayRef;
      if (id === 'tutorialTooltip') return tooltipRef;
      if (id === 'tutorialNext' || id === 'tutorialSkip') return createElementStub({ id });
      return createElementStub({ id });
    });

    return {
      get overlay() { return overlayRef; },
      get tooltip() { return tooltipRef; },
    };
  }

  it('creates overlay/tooltip once and does not recreate them', async () => {
    const dom = setupTutorialDom({ hasOverlay: false });
    const tutorial = await importFresh('../public/js/components/tutorial.js');

    tutorial.initTutorial();
    const firstOverlay = dom.overlay;
    expect(firstOverlay).not.toBeNull();
    expect(firstOverlay.id).toBe('tutorialOverlay');
    expect(document.body.appendChild).toHaveBeenCalledOnce();

    tutorial.initTutorial();
    expect(document.body.appendChild).toHaveBeenCalledOnce();
  });

  it('starts the tutorial, highlights the first step, and wires next/skip buttons', async () => {
    const dom = setupTutorialDom({ hasOverlay: false });
    const target = createElementStub({
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn(() => false),
      },
      getBoundingClientRect: vi.fn(() => ({ top: 20, left: 30, width: 100, height: 40, bottom: 60, right: 130 })),
    });
    document.querySelector = vi.fn((selector) => {
      if (selector === '#diary-text') return target;
      return null;
    });
    document.querySelectorAll = vi.fn(() => []);

    const nextBtn = createElementStub({ id: 'tutorialNext' });
    const skipBtn = createElementStub({ id: 'tutorialSkip' });
    document.getElementById = vi.fn((id) => {
      if (id === 'tutorialOverlay') return dom.overlay;
      if (id === 'tutorialTooltip') return dom.tooltip;
      if (id === 'tutorialNext') return nextBtn;
      if (id === 'tutorialSkip') return skipBtn;
      return createElementStub({ id });
    });

    const tutorial = await importFresh('../public/js/components/tutorial.js');
    tutorial.startTutorial();
    const tooltip = dom.overlay.children[0];

    expect(dom.overlay.classList.add).toHaveBeenCalledWith('active');
    expect(tooltip.classList.add).toHaveBeenCalledWith('active');
    expect(tooltip.innerHTML).toContain('나의 이야기 기록하기');
    expect(target.classList.add).toHaveBeenCalledWith('tutorial-highlight');
    expect(tooltip.style.top).toBeDefined();
    expect(tooltip.style.left).toBeDefined();
    expect(nextBtn.onclick).toBeTypeOf('function');
    expect(skipBtn.onclick).toBeTypeOf('function');
  });

  it('skips missing targets and finishes by marking the tutorial as seen', async () => {
    const dom = setupTutorialDom({ hasOverlay: false });
    const target = createElementStub({
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn(() => false),
      },
      getBoundingClientRect: vi.fn(() => ({ top: 20, left: 30, width: 100, height: 40, bottom: 60, right: 130 })),
    });

    let queryCount = 0;
    document.querySelector = vi.fn((selector) => {
      queryCount++;
      if (queryCount === 1 && selector === '#diary-text') return null;
      if (selector === '#promptChips') return target;
      if (selector === '.tab-nav') return target;
      return target;
    });
    document.querySelectorAll = vi.fn(() => [target]);

    const nextBtn = createElementStub({ id: 'tutorialNext' });
    const skipBtn = createElementStub({ id: 'tutorialSkip' });
    document.getElementById = vi.fn((id) => {
      if (id === 'tutorialOverlay') return dom.overlay;
      if (id === 'tutorialTooltip') return dom.tooltip;
      if (id === 'tutorialNext') return nextBtn;
      if (id === 'tutorialSkip') return skipBtn;
      return createElementStub({ id });
    });

    const tutorial = await importFresh('../public/js/components/tutorial.js');
    tutorial.startTutorial();
    const tooltip = dom.overlay.children[0];

    expect(tooltip.innerHTML).toContain('글쓰기가 막막할 때');

    for (let i = 0; i < 4; i++) {
      nextBtn.onclick();
    }

    expect(dom.overlay.classList.remove).toHaveBeenCalledWith('active');
    expect(tooltip.classList.remove).toHaveBeenCalledWith('active');
    expect(target.classList.remove).toHaveBeenCalledWith('tutorial-highlight');
    expect(localStorage.setItem).toHaveBeenCalledWith('sentimind-tutorial-seen', 'true');

    tutorial.startTutorial();
    skipBtn.onclick();
    expect(localStorage.setItem).toHaveBeenCalledWith('sentimind-tutorial-seen', 'true');
  });
});
