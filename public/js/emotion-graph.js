// 마음의 별자리 — 감정 그래프 시각화 모듈
// 외부 라이브러리 없이 SVG + 간단한 힘 기반 레이아웃으로 구현

import { state } from './state.js';
import { emotionColor } from './utils.js';
import { fetchWithAuth } from './api.js';
import { track } from './analytics.js';

// SVG 네임스페이스 상수
const SVG_NS = 'http://www.w3.org/2000/svg';

// 감정별 이모지 맵 (stats.js와 동일)
const EMOTION_EMOJI = {
  '기쁨': '😊', '행복': '😄', '감사': '🙏', '사랑': '❤️', '설렘': '💓',
  '평온': '😌', '안도': '😮‍💨', '희망': '🌱', '자신감': '💪', '뿌듯함': '🌟',
  '슬픔': '😢', '외로움': '🫂', '우울': '😞', '그리움': '💭', '허무함': '🌫️',
  '불안': '😰', '걱정': '😟', '두려움': '😨', '긴장': '😬', '당혹': '😳',
  '분노': '😤', '짜증': '😣', '억울함': '😡', '실망': '😔', '후회': '😩',
  '피곤함': '😴', '지침': '🥱', '무기력': '😶', '유쾌함': '😆', '놀라움': '😲',
  '부끄러움': '😊', '당황': '😳', '죄책감': '😔',
};

function emotionEmoji(emotion) {
  return EMOTION_EMOJI[emotion] || '✨';
}

// ─────────────────────────────────────────────
// 1. 데이터 로딩
// ─────────────────────────────────────────────

export async function loadEmotionGraph(period = '30d') {
  const container = document.getElementById('constellationChart');
  if (!container) return;

  // 로딩 상태 표시
  container.innerHTML = '<p class="constellation-loading">별자리를 그리고 있어요...</p>';

  try {
    const res = await fetchWithAuth('/api/stats/emotion-graph?period=' + period);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    renderConstellation(container, data);
    track('constellation_viewed', {
      period,
      unique_emotions: data.meta?.uniqueEmotions || 0,
    });
  } catch {
    container.innerHTML = '<p class="constellation-empty">별자리를 불러오지 못했어요</p>';
  }
}

// ─────────────────────────────────────────────
// 2. 간단한 힘 기반 레이아웃 (Force Layout)
// ─────────────────────────────────────────────

class SimpleForceLayout {
  constructor(nodes, edges, width, height) {
    // 노드 초기 위치: 중심 근처에 무작위 배치
    this.nodes = nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.6,
      y: height / 2 + (Math.random() - 0.5) * height * 0.6,
      vx: 0,
      vy: 0,
    }));
    this.edges = edges;
    this.width = width;
    this.height = height;
  }

  run(iterations = 150) {
    for (let iter = 0; iter < iterations; iter++) {
      // 온도(alpha): 반복이 진행될수록 힘이 약해짐
      const alpha = 1 - iter / iterations;
      this._applyRepulsion(alpha);
      this._applyAttraction(alpha);
      this._applyCenter(alpha);
      this._updatePositions();
      this._constrainBounds();
    }
    return this.nodes;
  }

  // 쿨롱 반발력: 모든 노드 쌍 사이
  _applyRepulsion(alpha) {
    const K = 3000; // 반발 강도
    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distSq = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(distSq);
        const force = (K / distSq) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }
  }

  // 훅 인력: 연결된 노드 쌍 사이
  _applyAttraction(alpha) {
    const REST = 90;  // 목표 거리
    const K = 0.05;   // 인력 강도
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    this.edges.forEach(edge => {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) return;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - REST) * K * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });
  }

  // 중심 인력: 모든 노드가 캔버스 중앙으로 끌림
  _applyCenter(alpha) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const K = 0.02;

    this.nodes.forEach(n => {
      n.vx += (cx - n.x) * K * alpha;
      n.vy += (cy - n.y) * K * alpha;
    });
  }

  // 감속(damping)과 함께 속도 적용
  _updatePositions() {
    const DAMPING = 0.85;
    this.nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
    });
  }

  // 노드가 경계를 벗어나지 않도록 제한
  _constrainBounds() {
    const PAD = 40;
    this.nodes.forEach(n => {
      n.x = Math.max(PAD, Math.min(this.width - PAD, n.x));
      n.y = Math.max(PAD, Math.min(this.height - PAD, n.y));
    });
  }
}

// ─────────────────────────────────────────────
// 3. 마음이 메시지
// ─────────────────────────────────────────────

function getConstellationMessage(data) {
  if (!data.nodes || data.nodes.length === 0) {
    return '아직 별이 없는 밤하늘이에요. 첫 일기를 쓰면 별이 떠올라요.';
  }
  if (data.nodes.length <= 3) {
    return '별이 하나둘 모이고 있어요. 더 많은 이야기를 들려주세요.';
  }
  const completed = (data.constellations || []).filter(c => c.complete);
  if (completed.length > 0) {
    return `'${completed[0].name}'이(가) 빛나고 있어요! 당신만의 감정 패턴이에요.`;
  }
  if ((data.meta?.uniqueEmotions || 0) >= 8) {
    return '다양한 별들이 모여 은하를 이루고 있어요.';
  }
  return '별들이 조금씩 연결되고 있어요. 당신의 이야기가 별자리가 돼요.';
}

// ─────────────────────────────────────────────
// 4. SVG 엘리먼트 생성 헬퍼
// ─────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function escSvg(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────
// 5. 별자리 SVG 렌더링
// ─────────────────────────────────────────────

function renderConstellation(container, data) {
  container.innerHTML = '';

  const nodes = (data.nodes || []).slice(0, 50); // 최대 50개 노드
  const edges = data.edges || [];
  const constellations = data.constellations || [];

  // 빈 상태 처리
  if (nodes.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'constellation-empty';
    emptyDiv.innerHTML =
      '<p class="constellation-empty-icon">✨</p>' +
      '<p class="constellation-empty-text">일기를 쓰면 별이 하나씩 떠올라요</p>' +
      '<p class="constellation-empty-sub">마음이가 당신만의 별자리를 그려줄 거예요</p>';
    container.appendChild(emptyDiv);
    return;
  }

  // 마음이 메시지 영역
  const msgEl = document.createElement('p');
  msgEl.className = 'constellation-message';
  msgEl.textContent = getConstellationMessage(data);
  container.appendChild(msgEl);

  // 반응형 뷰박스 크기
  const W = 480;
  const H = 360;

  // 힘 기반 레이아웃 계산
  const layout = new SimpleForceLayout(nodes, edges, W, H);
  const positionedNodes = layout.run(150);
  const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));

  // SVG 생성
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'constellation-svg',
    xmlns: SVG_NS,
    role: 'img',
    'aria-label': '마음의 별자리 그래프',
  });

  // ── 배경 그라디언트 정의 (밤하늘) ──
  const defs = svgEl('defs');

  // 별자리 배경용 방사형 그라디언트
  const bgGrad = svgEl('radialGradient', {
    id: 'constellation-bg-grad',
    cx: '50%', cy: '50%', r: '70%',
  });
  const bgStop1 = svgEl('stop', { offset: '0%', 'stop-color': '#1a1f3a', 'stop-opacity': '1' });
  const bgStop2 = svgEl('stop', { offset: '100%', 'stop-color': '#0a0d1f', 'stop-opacity': '1' });
  bgGrad.appendChild(bgStop1);
  bgGrad.appendChild(bgStop2);

  // "나" 중심 글로우 그라디언트
  const glowGrad = svgEl('radialGradient', {
    id: 'constellation-center-glow',
    cx: '50%', cy: '50%', r: '50%',
  });
  const glowStop1 = svgEl('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.3' });
  const glowStop2 = svgEl('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' });
  glowGrad.appendChild(glowStop1);
  glowGrad.appendChild(glowStop2);

  defs.appendChild(bgGrad);
  defs.appendChild(glowGrad);
  svg.appendChild(defs);

  // ── 밤하늘 배경 ──
  const bg = svgEl('rect', {
    x: 0, y: 0, width: W, height: H,
    rx: 12,
    class: 'constellation-background',
    fill: 'url(#constellation-bg-grad)',
  });
  svg.appendChild(bg);

  // ── 배경 작은 별(고정 장식) ──
  const starPositions = [
    [22, 18], [85, 42], [140, 12], [210, 28], [290, 15], [360, 35], [430, 20],
    [55, 120], [170, 80], [320, 70], [430, 95], [460, 150], [10, 200],
    [75, 280], [190, 310], [340, 300], [450, 270], [25, 340], [460, 340],
  ];
  starPositions.forEach(([sx, sy]) => {
    const dot = svgEl('circle', {
      cx: sx, cy: sy,
      r: Math.random() * 1.2 + 0.4,
      fill: 'white',
      opacity: (Math.random() * 0.4 + 0.1).toFixed(2),
      class: 'constellation-bg-star',
    });
    svg.appendChild(dot);
  });

  // ── 중심 글로우 ("나") ──
  const centerGlow = svgEl('circle', {
    cx: W / 2, cy: H / 2, r: 40,
    fill: 'url(#constellation-center-glow)',
  });
  svg.appendChild(centerGlow);

  const centerCircle = svgEl('circle', {
    cx: W / 2, cy: H / 2, r: 10,
    class: 'constellation-center',
    fill: 'rgba(255,255,255,0.15)',
    stroke: 'rgba(255,255,255,0.4)',
    'stroke-width': 1.5,
  });
  svg.appendChild(centerCircle);

  const centerLabel = svgEl('text', {
    x: W / 2, y: H / 2,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': 9,
    fill: 'rgba(255,255,255,0.6)',
    class: 'constellation-center-text',
    style: 'pointer-events:none;user-select:none',
  });
  centerLabel.textContent = '나';
  svg.appendChild(centerLabel);

  // ── 엣지(별자리 선) ──
  edges.forEach(edge => {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) return;

    const strokeW = Math.max(1, Math.min(3, (edge.count || 1) * 0.5));
    const isDashed = edge.type === 'transitionsTo';

    const lineAttrs = {
      x1: a.x.toFixed(1), y1: a.y.toFixed(1),
      x2: b.x.toFixed(1), y2: b.y.toFixed(1),
      stroke: 'rgba(255,255,255,0.15)',
      'stroke-width': strokeW,
      class: 'constellation-line',
    };
    if (isDashed) lineAttrs['stroke-dasharray'] = '4,4';

    svg.appendChild(svgEl('line', lineAttrs));
  });

  // ── 완성된 별자리 이름 레이블 ──
  constellations.forEach(c => {
    if (!c.complete || !Array.isArray(c.matched)) return;
    // 해당 별자리에 속한 노드들의 무게중심 계산
    const members = c.matched.map(id => nodeMap.get(id)).filter(Boolean);
    if (members.length < 2) return;
    const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
    const cy = members.reduce((s, n) => s + n.y, 0) / members.length;

    const label = svgEl('text', {
      x: cx.toFixed(1),
      y: (cy - 24).toFixed(1),
      'text-anchor': 'middle',
      'font-size': 9,
      fill: 'rgba(255,255,255,0.5)',
      class: 'constellation-name-label',
      style: 'pointer-events:none;user-select:none',
    });
    label.textContent = c.name;
    svg.appendChild(label);
  });

  // ── 노드(별) + 레이블 ──
  const isMobile = window.innerWidth < 480;

  positionedNodes.forEach((node, idx) => {
    const minR = isMobile ? 16 : 6;
    const r = Math.max(minR, Math.min(20, 4 + (node.count || 1) * 2));
    const color = emotionColor(node.id || node.emotion || '');
    const emoji = emotionEmoji(node.id || node.emotion || '');
    const delay = (idx * 0.3).toFixed(1);

    // 별 원
    const circle = svgEl('circle', {
      cx: node.x.toFixed(1),
      cy: node.y.toFixed(1),
      r,
      fill: color,
      class: 'constellation-star',
      style: `animation-delay:${delay}s`,
      'data-id': escSvg(node.id || ''),
      'data-emotion': escSvg(node.emotion || node.id || ''),
      'data-count': node.count || 0,
      'data-first': escSvg(node.firstSeen || ''),
      'data-last': escSvg(node.lastSeen || ''),
      'aria-label': escSvg((node.emotion || node.id || '') + ' ' + (node.count || 0) + '회'),
    });
    svg.appendChild(circle);

    // 감정 레이블 (데스크탑: 항상 표시 / 모바일: 탭 시 표시)
    if (!isMobile) {
      const labelEl = svgEl('text', {
        x: (node.x + r + 4).toFixed(1),
        y: node.y.toFixed(1),
        'dominant-baseline': 'middle',
        'font-size': 11,
        fill: 'rgba(255,255,255,0.8)',
        class: 'constellation-star-label',
        style: 'pointer-events:none;user-select:none',
      });
      labelEl.textContent = emoji + ' ' + (node.emotion || node.id || '');
      svg.appendChild(labelEl);
    }
  });

  container.appendChild(svg);

  // ── 툴팁 엘리먼트 ──
  const tooltip = document.createElement('div');
  tooltip.className = 'constellation-tooltip';
  tooltip.style.display = 'none';
  container.appendChild(tooltip);

  // 툴팁 내용 생성
  function buildTooltipContent(el) {
    const emotion = el.getAttribute('data-emotion') || '';
    const count = el.getAttribute('data-count') || '0';
    const first = el.getAttribute('data-first') || '';
    const last = el.getAttribute('data-last') || '';
    const emoji = emotionEmoji(emotion);

    let html = `<span class="constellation-tooltip-emotion">${escSvg(emoji)} ${escSvg(emotion)}</span>`;
    html += `<span class="constellation-tooltip-count">${escSvg(count)}회</span>`;
    if (first) {
      const fd = new Date(first);
      if (!isNaN(fd.getTime())) {
        html += `<span class="constellation-tooltip-date">첫 기록: ${fd.getMonth() + 1}/${fd.getDate()}</span>`;
      }
    }
    if (last && last !== first) {
      const ld = new Date(last);
      if (!isNaN(ld.getTime())) {
        html += `<span class="constellation-tooltip-date">최근: ${ld.getMonth() + 1}/${ld.getDate()}</span>`;
      }
    }
    return html;
  }

  // 툴팁 위치 계산 (컨테이너 경계 안쪽으로 클램프)
  function positionTooltip(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const tW = tooltip.offsetWidth || 120;
    const tH = tooltip.offsetHeight || 60;

    let left = clientX - rect.left + 12;
    let top = clientY - rect.top - tH - 8;

    // 오른쪽 경계 초과 방지
    if (left + tW > rect.width - 8) left = clientX - rect.left - tW - 12;
    // 위쪽 경계 초과 방지
    if (top < 8) top = clientY - rect.top + 14;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  // 마우스 이벤트 (데스크탑)
  svg.querySelectorAll('.constellation-star').forEach(star => {
    star.addEventListener('mouseenter', e => {
      tooltip.innerHTML = buildTooltipContent(star);
      tooltip.style.display = 'flex';
      positionTooltip(e.clientX, e.clientY);
    });
    star.addEventListener('mousemove', e => {
      positionTooltip(e.clientX, e.clientY);
    });
    star.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });

  // 터치 이벤트 (모바일, passive 리스너)
  let activeStar = null;
  svg.querySelectorAll('.constellation-star').forEach(star => {
    star.addEventListener('touchstart', e => {
      // 다른 별 탭 시 기존 툴팁 교체
      if (activeStar && activeStar !== star) {
        activeStar.classList.remove('constellation-star--active');
      }
      activeStar = star;
      star.classList.add('constellation-star--active');
      tooltip.innerHTML = buildTooltipContent(star);
      tooltip.style.display = 'flex';
      const t = e.touches[0];
      positionTooltip(t.clientX, t.clientY);
    }, { passive: true });
  });

  // 빈 영역 탭 → 툴팁 닫기
  svg.addEventListener('touchstart', e => {
    const target = e.target;
    if (!target.classList.contains('constellation-star')) {
      tooltip.style.display = 'none';
      if (activeStar) {
        activeStar.classList.remove('constellation-star--active');
        activeStar = null;
      }
    }
  }, { passive: true });

  // ── 별자리 정보 패널 ──
  renderConstellationInfo(container, constellations);
}

// ─────────────────────────────────────────────
// 6. 별자리 정보 패널
// ─────────────────────────────────────────────

function renderConstellationInfo(container, constellations) {
  // 진행도 50% 이상인 별자리만 표시
  const visible = (constellations || []).filter(c => (c.progress || 0) >= 0.5);
  if (visible.length === 0) return;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'constellation-info';

  const title = document.createElement('h4');
  title.className = 'constellation-info-title';
  title.textContent = '발견한 별자리';
  infoDiv.appendChild(title);

  visible.forEach(c => {
    const pct = Math.round((c.progress || 0) * 100);
    const isComplete = c.complete;

    const card = document.createElement('div');
    card.className = 'constellation-card' + (isComplete ? ' constellation-card--complete' : '');

    // 별자리 감정 목록 (체크 표시 포함)
    const emotionTags = Array.isArray(c.emotions)
      ? c.emotions.map(e => {
          const matched = Array.isArray(c.matched) && c.matched.includes(e);
          return `<span class="constellation-emotion-tag${matched ? ' matched' : ''}">${escSvg(e)}${matched ? ' ✓' : ''}</span>`;
        }).join(' · ')
      : '';

    card.innerHTML =
      '<div class="constellation-card-header">' +
        '<span class="constellation-card-name">' + escSvg(c.name || '') + '</span>' +
        (isComplete ? '<span class="constellation-card-badge">완성</span>' : '') +
      '</div>' +
      (c.description ? '<span class="constellation-card-desc">' + escSvg(c.description) + '</span>' : '') +
      '<div class="constellation-progress">' +
        '<div class="constellation-progress-bar" style="width:' + pct + '%"></div>' +
      '</div>' +
      (emotionTags ? '<p class="constellation-card-emotions">' + emotionTags + '</p>' : '');

    infoDiv.appendChild(card);
  });

  container.appendChild(infoDiv);
}

// ─────────────────────────────────────────────
// 7. 공개 API
// ─────────────────────────────────────────────

