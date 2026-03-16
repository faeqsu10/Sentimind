import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importFresh, installBrowserEnv } from './helpers/browser-env.js';

function mockEmotionGraphDeps({ response, reject = false } = {}) {
  const fetchWithAuth = reject
    ? vi.fn().mockRejectedValue(new Error('network error'))
    : vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(response),
      });
  const track = vi.fn();
  const emotionColor = vi.fn((emotion) => `color-${emotion}`);

  vi.doMock('../public/js/api.js', () => ({ fetchWithAuth }));
  vi.doMock('../public/js/analytics.js', () => ({ track }));
  vi.doMock('../public/js/utils.js', () => ({ emotionColor }));

  return { fetchWithAuth, track, emotionColor };
}

describe('frontend emotion graph module', () => {
  beforeEach(() => {
    installBrowserEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns early when the constellation container is missing', async () => {
    installBrowserEnv();
    document.getElementById = vi.fn((id) => (id === 'constellationChart' ? null : null));
    const deps = mockEmotionGraphDeps({ response: { nodes: [], edges: [], constellations: [], meta: {} } });

    const graph = await importFresh('../public/js/emotion-graph.js');
    await graph.loadEmotionGraph();

    expect(deps.fetchWithAuth).not.toHaveBeenCalled();
  });

  it('renders the constellation graph and tracks the view on success', async () => {
    const deps = mockEmotionGraphDeps({
      response: {
        nodes: [
          { id: '기쁨', count: 3, firstSeen: '2026-03-01T00:00:00Z', lastSeen: '2026-03-10T00:00:00Z' },
          { id: '감사', count: 2, firstSeen: '2026-03-02T00:00:00Z', lastSeen: '2026-03-11T00:00:00Z' },
          { id: '설렘', count: 1, firstSeen: '2026-03-03T00:00:00Z', lastSeen: '2026-03-12T00:00:00Z' },
        ],
        edges: [
          { source: '기쁨', target: '감사', type: 'transitionsTo', count: 2 },
        ],
        constellations: [
          {
            name: '도전의 별자리',
            description: '도전 앞에서 성장하는 패턴',
            emotions: ['기쁨', '감사', '설렘'],
            matched: ['기쁨', '감사', '설렘'],
            progress: 1,
            complete: true,
          },
        ],
        meta: { uniqueEmotions: 3 },
      },
    });

    const graph = await importFresh('../public/js/emotion-graph.js');
    const container = document.getElementById('constellationChart');

    await graph.loadEmotionGraph('7d');

    expect(deps.fetchWithAuth).toHaveBeenCalledWith('/api/stats/emotion-graph?period=7d');
    expect(container.children[0].textContent).toContain('별이 하나둘 모이고 있어요');
    expect(container.children.some((child) => child.tagName === 'SVG')).toBe(true);
    const infoPanel = container.children.find((child) => child.className === 'constellation-info');
    expect(infoPanel).toBeDefined();
    expect(infoPanel.children[1].innerHTML).toContain('도전의 별자리');
    expect(deps.track).toHaveBeenCalledWith('constellation_viewed', {
      period: '7d',
      unique_emotions: 3,
    });
  });

  it('renders the empty constellation state when there are no nodes', async () => {
    mockEmotionGraphDeps({
      response: {
        nodes: [],
        edges: [],
        constellations: [],
        meta: { uniqueEmotions: 0 },
      },
    });

    const graph = await importFresh('../public/js/emotion-graph.js');
    const container = document.getElementById('constellationChart');

    await graph.loadEmotionGraph();

    expect(container.children[0].className).toBe('constellation-empty');
    expect(container.children[0].innerHTML).toContain('일기를 쓰면 별이 하나씩 떠올라요');
  });

  it('shows a fallback message when the graph fetch fails', async () => {
    mockEmotionGraphDeps({ reject: true });

    const graph = await importFresh('../public/js/emotion-graph.js');
    const container = document.getElementById('constellationChart');

    await graph.loadEmotionGraph();

    expect(container.innerHTML).toContain('별자리를 불러오지 못했어요');
  });
});
