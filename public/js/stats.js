import { state, PERIOD_MAP } from './state.js';
import { escapeHtml, emotionColor, emotionScore, showSkeleton } from './utils.js';
import { fetchWithAuth } from './api.js';

// 대시보드 캐시: 같은 기간+같은 항목 수면 API 재호출 스킵
let _lastDashboardKey = null;

export async function loadDashboard(period, forceReload = false) {
  if (period !== undefined) state.activePeriod = period;
  const entryCount = (state.allEntries || []).length;
  const cacheKey = `${state.activePeriod}_${entryCount}`;

  if (!forceReload && _lastDashboardKey === cacheKey) return;

  const queryParam = state.activePeriod !== 'all' ? '?period=' + state.activePeriod : '';
  const dashEl = document.getElementById('dashboardContent');
  if (dashEl) dashEl.setAttribute('aria-busy', 'true');
  showSkeleton('stats');
  try {
    const response = await fetchWithAuth('/api/stats' + queryParam);
    if (!response.ok) throw new Error();
    const stats = await response.json();
    renderDashboard(stats);
    _lastDashboardKey = cacheKey;
  } catch {
    const summaryEl = document.getElementById('dashboardSummary');
    if (summaryEl) summaryEl.innerHTML = '<p class="dashboard-empty">마음의 흐름을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>';
  } finally {
    if (dashEl) dashEl.removeAttribute('aria-busy');
  }
}

function renderDashboard(stats) {
  const summaryEl = document.getElementById('dashboardSummary');
  const emotionsChart = document.getElementById('topEmotionsChart');
  const situationsChart = document.getElementById('topSituationsChart');
  const recentList = document.getElementById('recentEntriesList');

  const total = stats.total_entries || 0;

  if (summaryEl) {
    if (total === 0) {
      summaryEl.innerHTML = '<p class="dashboard-empty">첫 이야기를 들려주세요</p>';
    } else if (total < 7) {
      const remaining = 7 - total;
      const pct = Math.round((total / 7) * 100);
      summaryEl.innerHTML =
        '<div class="dashboard-summary-grid">' +
          '<div class="summary-card"><span class="summary-value">' + total + '</span><span class="summary-label">나눈 이야기</span></div>' +
          '<div class="summary-card"><span class="summary-value">' + (stats.this_week || 0) + '</span><span class="summary-label">이번 주</span></div>' +
          '<div class="summary-card"><span class="summary-value">' + (stats.today || 0) + '</span><span class="summary-label">오늘</span></div>' +
        '</div>' +
        '<div class="dashboard-progress-nudge">' +
          '<p class="dashboard-progress-text">' + remaining + '개 더 나누면 주간 통계가 열려요</p>' +
          '<div class="dashboard-progress-bar"><div class="dashboard-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    } else {
      summaryEl.innerHTML =
        '<div class="dashboard-summary-grid">' +
          '<div class="summary-card"><span class="summary-value">' + total + '</span><span class="summary-label">나눈 이야기</span></div>' +
          '<div class="summary-card"><span class="summary-value">' + (stats.this_week || 0) + '</span><span class="summary-label">이번 주</span></div>' +
          '<div class="summary-card"><span class="summary-value">' + (stats.today || 0) + '</span><span class="summary-label">오늘</span></div>' +
        '</div>';
    }
  }

  if (emotionsChart && stats.top_emotions) {
    const maxCount = Math.max(...stats.top_emotions.map(e => e.count), 1);
    emotionsChart.innerHTML = stats.top_emotions.map(e =>
      '<div class="bar-row">' +
        '<span class="bar-label">' + escapeHtml(e.emotion) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + (e.count / maxCount * 100) + '%;background:' + emotionColor(e.emotion) + '"></div></div>' +
        '<span class="bar-count">' + e.count + '</span>' +
      '</div>'
    ).join('');
  }

  if (situationsChart && stats.top_situations) {
    const maxCount = Math.max(...stats.top_situations.map(s => s.count), 1);
    situationsChart.innerHTML = stats.top_situations.map((s, idx) =>
      '<div class="bar-row">' +
        '<span class="bar-label">' + escapeHtml(s.situation) + '</span>' +
        '<div class="bar-track"><div class="bar-fill situation-bar' + (idx % 2 === 1 ? ' alt' : '') + '" style="width:' + (s.count / maxCount * 100) + '%"></div></div>' +
        '<span class="bar-count">' + s.count + '</span>' +
      '</div>'
    ).join('');
  }

  if (recentList) {
    if (stats.recent_entries && stats.recent_entries.length > 0) {
      recentList.innerHTML = stats.recent_entries.map(e => {
        const dateStr = e.date
          ? new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(e.date))
          : '';
        return '<div class="recent-entry">' +
          '<span class="recent-entry-emoji">' + escapeHtml(e.emoji || '') + '</span>' +
          '<div class="recent-entry-body">' +
            '<p class="recent-entry-text">' + escapeHtml(e.text || '') + '</p>' +
            '<span class="recent-entry-date">' + dateStr + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      recentList.innerHTML = '<p class="dashboard-empty">아직 나눈 이야기가 없어요.</p>';
    }
  }

  // Trend chart
  renderTrendChart(state.allEntries);

  // Emotion flower chart
  renderEmotionFlower(state.allEntries);

  // Emotion × Situation heatmap
  renderEmotionSituationHeatmap(state.allEntries);

  // Year in Pixels heatmap
  renderYearPixels(state.allEntries);

  // Emotion pattern insights
  renderInsights(state.allEntries);
}

const EMOTION_EMOJI_MAP = {
  '기쁨': '😊', '행복': '😄', '감사': '🙏', '사랑': '❤️', '설렘': '💓',
  '평온': '😌', '안도': '😮‍💨', '희망': '🌱', '자신감': '💪', '뿌듯함': '🌟',
  '슬픔': '😢', '외로움': '🫂', '우울': '😞', '그리움': '💭', '허무함': '🌫️',
  '불안': '😰', '걱정': '😟', '두려움': '😨', '긴장': '😬', '당혹': '😳',
  '분노': '😤', '짜증': '😣', '억울함': '😡', '실망': '😔', '후회': '😩',
  '피곤함': '😴', '지침': '🥱', '무기력': '😶',
};
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const TIME_SLOTS = [
  { label: '오전', start: 6, end: 12 },
  { label: '오후', start: 12, end: 18 },
  { label: '저녁', start: 18, end: 24 },
  { label: '새벽', start: 0, end: 6 },
];

function emotionEmoji(emotion) {
  return EMOTION_EMOJI_MAP[emotion] || '💭';
}

function renderInsights(entries) {
  const container = document.getElementById('emotionInsightCards');
  if (!container) return;

  if (!entries || entries.length < 10) {
    container.innerHTML = '<p class="insight-empty">10개 이상 이야기를 나누면 감정 패턴이 보여요</p>';
    return;
  }

  const insights = [];

  // 1. 요일 패턴: 각 요일별 가장 빈번한 감정
  const byDay = Array.from({ length: 7 }, () => ({}));
  entries.forEach(e => {
    const d = new Date((e.date || e.created_at || '').slice(0, 10));
    if (isNaN(d.getTime())) return;
    const dow = d.getDay();
    const emo = e.emotion;
    if (!emo) return;
    byDay[dow][emo] = (byDay[dow][emo] || 0) + 1;
  });

  // Find the day+emotion with the highest single-day frequency
  let bestDayScore = 0, bestDay = -1, bestDayEmotion = '';
  byDay.forEach((counts, dow) => {
    Object.entries(counts).forEach(([emo, cnt]) => {
      if (cnt > bestDayScore) {
        bestDayScore = cnt;
        bestDay = dow;
        bestDayEmotion = emo;
      }
    });
  });
  if (bestDay >= 0 && bestDayScore >= 2) {
    insights.push({
      emoji: emotionEmoji(bestDayEmotion),
      text: DAY_NAMES[bestDay] + '요일에 \'' + bestDayEmotion + '\'을(를) 가장 많이 느끼시네요',
      label: '요일 패턴',
    });
  }

  // 2. 시간대 패턴: 시간대별 가장 빈번한 감정
  const bySlot = TIME_SLOTS.map(() => ({}));
  entries.forEach(e => {
    const raw = e.date || e.created_at || '';
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return;
    const hour = dt.getHours();
    const emo = e.emotion;
    if (!emo) return;
    const idx = TIME_SLOTS.findIndex(s => hour >= s.start && hour < s.end);
    if (idx < 0) return;
    bySlot[idx][emo] = (bySlot[idx][emo] || 0) + 1;
  });

  let bestSlotScore = 0, bestSlot = -1, bestSlotEmotion = '';
  bySlot.forEach((counts, si) => {
    Object.entries(counts).forEach(([emo, cnt]) => {
      if (cnt > bestSlotScore) {
        bestSlotScore = cnt;
        bestSlot = si;
        bestSlotEmotion = emo;
      }
    });
  });
  if (bestSlot >= 0 && bestSlotScore >= 2) {
    insights.push({
      emoji: emotionEmoji(bestSlotEmotion),
      text: TIME_SLOTS[bestSlot].label + '에 \'' + bestSlotEmotion + '\'을(를) 자주 느끼시네요',
      label: '시간대 패턴',
    });
  }

  // 3. 전체 최다 감정 (전체 빈도 기반)
  const totalCounts = {};
  entries.forEach(e => {
    if (e.emotion) totalCounts[e.emotion] = (totalCounts[e.emotion] || 0) + 1;
  });
  const topEmotion = Object.entries(totalCounts).sort((a, b) => b[1] - a[1])[0];
  if (topEmotion && topEmotion[1] >= 3) {
    insights.push({
      emoji: emotionEmoji(topEmotion[0]),
      text: '기록 전반에서 \'' + topEmotion[0] + '\'이(가) 가장 자주 찾아왔어요',
      label: '전체 패턴',
    });
  }

  const shown = insights.slice(0, 3);
  if (shown.length === 0) {
    container.innerHTML = '<p class="insight-empty">아직 패턴을 찾기에 데이터가 부족해요</p>';
    return;
  }

  container.innerHTML = shown.map(ins =>
    '<div class="insight-card">' +
      '<div class="insight-icon">' + ins.emoji + '</div>' +
      '<p class="insight-text">' + escapeHtml(ins.text) + '</p>' +
      '<span class="insight-label">' + escapeHtml(ins.label) + '</span>' +
    '</div>'
  ).join('');
}

function renderEmotionFlower(entries) {
  const container = document.getElementById('emotionFlowerChart');
  if (!container) return;

  if (!entries || entries.length < 5) {
    container.innerHTML = '<p class="flower-empty">5개 이상 이야기를 나누면 마음의 꽃잎이 피어나요</p>';
    return;
  }

  // Aggregate emotion counts
  const counts = {};
  entries.forEach(e => {
    if (e.emotion) counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    container.innerHTML = '<p class="flower-empty">아직 감정 데이터가 없어요</p>';
    return;
  }

  const maxCount = sorted[0][1];
  const total = entries.length;
  const CX = 150, CY = 150;
  const MAX_R = 100;   // max petal length (tip distance from center)
  const MIN_R = 20;    // min petal length when count > 0
  const CENTER_R = 28; // central circle radius
  const PETAL_W = 0.38; // half-angle for petal width in radians (~22 degrees)

  const n = sorted.length;
  const angleStep = (2 * Math.PI) / n;

  let petals = '';
  let labels = '';

  sorted.forEach(([emotion, count], i) => {
    const angle = -Math.PI / 2 + i * angleStep; // start from top
    const r = MIN_R + (count / maxCount) * (MAX_R - MIN_R);
    const color = emotionColor(emotion);
    const emoji = EMOTION_EMOJI_MAP[emotion] || '💭';

    // Petal: ellipse-like path using bezier curves
    // Base at center+CENTER_R, tip at center+r along angle
    const baseAngleL = angle - PETAL_W;
    const baseAngleR = angle + PETAL_W;

    const bx1 = CX + CENTER_R * Math.cos(baseAngleL);
    const by1 = CY + CENTER_R * Math.sin(baseAngleL);
    const bx2 = CX + CENTER_R * Math.cos(baseAngleR);
    const by2 = CY + CENTER_R * Math.sin(baseAngleR);

    const tipX = CX + r * Math.cos(angle);
    const tipY = CY + r * Math.sin(angle);

    // Control points for bezier — bulge the petal outward
    const midR = r * 0.65;
    const cp1x = CX + midR * Math.cos(baseAngleL);
    const cp1y = CY + midR * Math.sin(baseAngleL);
    const cp2x = CX + midR * Math.cos(baseAngleR);
    const cp2y = CY + midR * Math.sin(baseAngleR);

    const safeEmotion = emotion.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    petals += `<path class="flower-petal" d="M ${bx1.toFixed(1)},${by1.toFixed(1)} Q ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} Q ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)} Z" fill="${color}" fill-opacity="0.85" data-emotion="${safeEmotion}" data-count="${count}" aria-label="${safeEmotion} ${count}회"/>`;

    // Emoji at petal tip
    const emojiR = r + 14;
    const ex = CX + emojiR * Math.cos(angle);
    const ey = CY + emojiR * Math.sin(angle);
    labels += `<text x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="13" style="pointer-events:none;user-select:none">${emoji}</text>`;
  });

  // Tooltip element id
  const tooltipId = 'flowerTooltip';

  container.innerHTML = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-label="감정 꽃잎 차트">
    ${petals}
    <circle cx="${CX}" cy="${CY}" r="${CENTER_R}" fill="var(--color-surface)" stroke="var(--color-border)" stroke-width="1.5"/>
    <text x="${CX}" y="${CY - 7}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" class="flower-center-label">${total}</text>
    <text x="${CX}" y="${CY + 9}" text-anchor="middle" dominant-baseline="middle" font-size="9" class="flower-center-label" opacity="0.7">이야기</text>
    ${labels}
  </svg><div class="flower-tooltip" id="${tooltipId}"></div>`;

  const tooltip = document.getElementById(tooltipId);
  container.querySelectorAll('.flower-petal').forEach(petal => {
    function showTip(x, y) {
      tooltip.textContent = petal.dataset.emotion + ' · ' + petal.dataset.count + '회';
      tooltip.style.display = 'block';
      tooltip.style.left = (x + 14) + 'px';
      tooltip.style.top  = (y - 32) + 'px';
    }
    petal.addEventListener('mouseenter', e => showTip(e.clientX, e.clientY));
    petal.addEventListener('mousemove',  e => showTip(e.clientX, e.clientY));
    petal.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    petal.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      showTip(t.clientX, t.clientY);
    }, { passive: false });
    petal.addEventListener('touchend', () => { tooltip.style.display = 'none'; });
  });
}

function renderTrendChart(entries) {
  const container = document.getElementById('trendChartContent');
  if (!container) return;

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 29);
  cutoff.setHours(0, 0, 0, 0);

  const filtered = (entries || []).filter(e => {
    const d = new Date((e.date || e.created_at || '').slice(0, 10));
    return d >= cutoff && d <= now;
  });

  if (filtered.length < 7) {
    container.innerHTML = '<p class="trend-chart-empty">7일 이상 이야기를 나누면 마음의 흐름이 보여요</p>';
    return;
  }

  const byDate = {};
  filtered.forEach(e => {
    const d = (e.date || e.created_at || '').slice(0, 10);
    if (!byDate[d]) byDate[d] = { scores: [], emotions: [] };
    byDate[d].scores.push(emotionScore(e.emotion));
    byDate[d].emotions.push(e.emotion);
  });

  const points = Object.keys(byDate).sort().map(d => ({
    date: d,
    score: byDate[d].scores.reduce((a, b) => a + b, 0) / byDate[d].scores.length,
    emotion: byDate[d].emotions[byDate[d].emotions.length - 1]
  }));

  const W = 600, H = 140;
  const PAD = { top: 18, right: 18, bottom: 28, left: 42 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const startMs = cutoff.getTime();
  const endMs   = now.getTime();
  const spanMs  = endMs - startMs || 1;

  function xOf(dateStr) {
    return PAD.left + ((new Date(dateStr).getTime() - startMs) / spanMs) * innerW;
  }
  function yOf(score) {
    return PAD.top + innerH * (1 - (score + 1) / 2);
  }

  const coords = points.map(p => `${xOf(p.date).toFixed(1)},${yOf(p.score).toFixed(1)}`).join(' ');
  const yLabels = [{ score:1, label:'좋은' }, { score:0, label:'고요' }, { score:-1, label:'힘든' }];

  function fmtDate(d) {
    const [, m, day] = d.split('-');
    return `${parseInt(m)}/${parseInt(day)}`;
  }

  let svgDots = '';
  points.forEach(p => {
    const cx = xOf(p.date).toFixed(1);
    const cy = yOf(p.score).toFixed(1);
    const col = emotionColor(p.emotion);
    const emo = p.emotion.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    svgDots += `<circle class="trend-dot" cx="${cx}" cy="${cy}" r="5" fill="${col}" stroke="var(--color-surface)" stroke-width="2" data-date="${p.date}" data-emotion="${emo}" data-score="${p.score.toFixed(2)}" style="cursor:pointer"/>`;
  });

  let yGrid = '';
  yLabels.forEach(({ score, label }) => {
    const y = yOf(score).toFixed(1);
    yGrid += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="var(--color-divider)" stroke-dasharray="4,3"/>`;
    yGrid += `<text x="${PAD.left - 6}" y="${y}" dy="0.35em" text-anchor="end" font-size="10" fill="var(--color-text-muted)">${label}</text>`;
  });

  const xIdxs = [0, Math.floor(points.length / 2), points.length - 1];
  let xTicks = '';
  xIdxs.forEach(i => {
    const x = xOf(points[i].date).toFixed(1);
    xTicks += `<text x="${x}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">${fmtDate(points[i].date)}</text>`;
  });

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="마음의 흐름 차트">
    ${yGrid}${xTicks}
    <polyline points="${coords}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linejoin="round" opacity="0.7"/>
    ${svgDots}
  </svg><p class="trend-chart-legend">기쁨·감사·사랑은 <strong>좋은</strong>, 평온·안도는 <strong>고요</strong>, 슬픔·불안·분노 등은 <strong>힘든</strong> 마음이에요</p><div class="trend-tooltip" id="trendTooltip"></div>`;

  const tooltip = document.getElementById('trendTooltip');
  container.querySelectorAll('.trend-dot').forEach(dot => {
    function showTip(x, y) {
      const [, mo, dy] = dot.dataset.date.split('-');
      tooltip.textContent = `${parseInt(mo)}월 ${parseInt(dy)}일 · ${dot.dataset.emotion}`;
      tooltip.style.display = 'block';
      tooltip.style.left = (x + 12) + 'px';
      tooltip.style.top  = (y - 28) + 'px';
    }
    dot.addEventListener('mouseenter', e => showTip(e.clientX, e.clientY));
    dot.addEventListener('mousemove',  e => showTip(e.clientX, e.clientY));
    dot.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    dot.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      showTip(touch.clientX, touch.clientY);
    }, { passive: false });
  });
}

export async function fetchReport(period) {
  const loadingEl = document.getElementById('reportLoading');
  const resultEl  = document.getElementById('reportResult');
  const btnWeekly  = document.getElementById('btnWeeklyReport');
  const btnMonthly = document.getElementById('btnMonthlyReport');

  loadingEl.hidden = false;
  resultEl.hidden  = true;
  resultEl.innerHTML = '';
  btnWeekly.disabled  = true;
  btnMonthly.disabled = true;

  try {
    const res = await fetchWithAuth('/api/report?period=' + period);
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || '리포트를 만들지 못했어요.';
      resultEl.innerHTML = '<p class="dashboard-empty">' + escapeHtml(msg) + '</p>';
      resultEl.hidden = false;
      return;
    }
    const periodLabel = period === 'weekly' ? '주간' : '월간';
    resultEl.innerHTML =
      '<div class="report-card">' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">' + periodLabel + ' 마음 요약</span>' +
          '<p class="report-card-text">' + escapeHtml(data.summary) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">마음의 변화</span>' +
          '<p class="report-card-text">' + escapeHtml(data.emotionTrend) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">마음의 패턴</span>' +
          '<p class="report-card-text">' + escapeHtml(data.insight) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">따뜻한 한마디</span>' +
          '<p class="report-card-text">' + escapeHtml(data.encouragement) + '</p>' +
        '</div>' +
      '</div>';
    resultEl.hidden = false;
  } catch (err) {
    const msg = err.userMessage || '리포트를 만드는 중에 문제가 생겼어요.';
    resultEl.innerHTML = '<p class="dashboard-empty">' + escapeHtml(msg) + '</p>';
    resultEl.hidden = false;
  } finally {
    loadingEl.hidden   = true;
    btnWeekly.disabled  = false;
    btnMonthly.disabled = false;
  }
}

export function setupStats() {
  document.getElementById('periodFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.period-chip');
    if (!chip) return;
    document.querySelectorAll('#periodFilter .period-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const days = chip.dataset.days || '0';
    loadDashboard(PERIOD_MAP[days] || 'all', true);
  });

  document.getElementById('btnWeeklyReport').addEventListener('click', () => fetchReport('weekly'));
  document.getElementById('btnMonthlyReport').addEventListener('click', () => fetchReport('monthly'));

  // Year in Pixels navigation
  document.getElementById('pixelsPrevYear').addEventListener('click', () => {
    _pixelsYear--;
    renderYearPixels(state.allEntries);
  });
  document.getElementById('pixelsNextYear').addEventListener('click', () => {
    if (_pixelsYear < new Date().getFullYear()) {
      _pixelsYear++;
      renderYearPixels(state.allEntries);
    }
  });
}

// Year in Pixels state
let _pixelsYear = new Date().getFullYear();

function renderYearPixels(entries) {
  const container = document.getElementById('yearPixelsChart');
  const yearLabel = document.getElementById('pixelsYearLabel');
  if (!container || !yearLabel) return;

  yearLabel.textContent = _pixelsYear + '년';

  if (!entries || entries.length === 0) {
    container.innerHTML = '<p class="pixels-empty">이야기를 나누면 한 해의 마음이 색으로 피어나요</p>';
    return;
  }

  // Build date→emotion map for the selected year
  const dateMap = {};
  entries.forEach(e => {
    const raw = (e.date || e.created_at || '').slice(0, 10);
    if (!raw) return;
    const d = new Date(raw);
    if (d.getFullYear() !== _pixelsYear) return;
    // Keep the last entry per day
    dateMap[raw] = e.emotion;
  });

  // Generate all days of the year grouped by week (Sunday-start columns like GitHub)
  const jan1 = new Date(_pixelsYear, 0, 1);
  const dec31 = new Date(_pixelsYear, 11, 31);
  const startDay = jan1.getDay(); // 0=Sun
  const totalDays = Math.floor((dec31 - jan1) / 86400000) + 1;

  const CELL = 13, GAP = 2, ROWS = 7;
  const step = CELL + GAP;
  const weeks = Math.ceil((totalDays + startDay) / 7);
  const LABEL_LEFT = 28;
  const LABEL_TOP = 22;
  const W = LABEL_LEFT + weeks * step + 4;
  const H = LABEL_TOP + ROWS * step + 4;

  const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DAY_LABELS = ['일','','화','','목','','토'];

  let svg = '';

  // Day-of-week labels
  DAY_LABELS.forEach((label, i) => {
    if (!label) return;
    const y = LABEL_TOP + i * step + CELL / 2;
    svg += '<text x="' + (LABEL_LEFT - 6) + '" y="' + y + '" dy="0.35em" text-anchor="end" font-size="9" fill="var(--color-text-muted)">' + label + '</text>';
  });

  // Month labels
  let lastMonth = -1;
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(_pixelsYear, 0, 1 + d);
    const month = date.getMonth();
    const weekIdx = Math.floor((d + startDay) / 7);
    if (month !== lastMonth) {
      lastMonth = month;
      const x = LABEL_LEFT + weekIdx * step;
      svg += '<text x="' + x + '" y="' + (LABEL_TOP - 6) + '" text-anchor="start" font-size="9" fill="var(--color-text-muted)">' + MONTH_NAMES[month] + '</text>';
    }
  }

  // Cells
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < totalDays; d++) {
    const date = new Date(_pixelsYear, 0, 1 + d);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = (d + startDay) % 7;
    const weekIdx = Math.floor((d + startDay) / 7);
    const x = LABEL_LEFT + weekIdx * step;
    const y = LABEL_TOP + dayOfWeek * step;

    const emotion = dateMap[dateStr];
    let fill, opacity;

    if (emotion) {
      fill = emotionColor(emotion);
      opacity = '1';
    } else if (date <= today) {
      fill = 'var(--color-border)';
      opacity = '0.4';
    } else {
      fill = 'var(--color-border)';
      opacity = '0.15';
    }

    const safeEmotion = emotion ? emotion.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
    const fmtDate = (date.getMonth() + 1) + '월 ' + date.getDate() + '일';

    svg += '<rect class="pixel-cell" x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="' + fill + '" opacity="' + opacity + '" data-date="' + dateStr + '" data-emotion="' + safeEmotion + '" data-label="' + fmtDate + '"/>';
  }

  container.innerHTML =
    '<svg class="year-pixels-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + _pixelsYear + '년 감정 히트맵">' +
    svg + '</svg>' +
    '<div class="pixels-tooltip" id="pixelsTooltip"></div>' +
    '<div class="pixels-legend">' +
      '<span class="pixels-legend-label">기록 없음</span>' +
      '<span class="pixels-legend-box" style="background:var(--color-border);opacity:0.4"></span>' +
      '<span class="pixels-legend-box" style="background:#E8B4B8"></span>' +
      '<span class="pixels-legend-box" style="background:#F4D03F"></span>' +
      '<span class="pixels-legend-box" style="background:#82E0AA"></span>' +
      '<span class="pixels-legend-box" style="background:#85C1E9"></span>' +
      '<span class="pixels-legend-label">감정별 색상</span>' +
    '</div>';

  // Tooltip events
  const tooltip = document.getElementById('pixelsTooltip');
  container.querySelectorAll('.pixel-cell').forEach(cell => {
    function showTip(x, y) {
      const emo = cell.dataset.emotion;
      const label = cell.dataset.label;
      tooltip.textContent = label + (emo ? ' · ' + emo : '');
      tooltip.style.display = 'block';
      tooltip.style.left = (x + 12) + 'px';
      tooltip.style.top = (y - 28) + 'px';
    }
    cell.addEventListener('mouseenter', e => showTip(e.clientX, e.clientY));
    cell.addEventListener('mousemove', e => showTip(e.clientX, e.clientY));
    cell.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    cell.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      showTip(t.clientX, t.clientY);
    }, { passive: false });
    cell.addEventListener('touchend', () => { tooltip.style.display = 'none'; });
  });
}

function renderEmotionSituationHeatmap(entries) {
  const container = document.getElementById('emotionSituationHeatmap');
  if (!container) return;

  // Filter entries with both emotion and situation_context
  const valid = (entries || []).filter(e =>
    e.emotion && Array.isArray(e.situation_context) && e.situation_context.length > 0
  );

  if (valid.length < 10) {
    container.innerHTML = '<p class="heatmap-empty">감정과 상황 데이터가 10개 이상 쌓이면 패턴이 보여요</p>';
    return;
  }

  // Cross-tabulate emotion × situation
  const crossTab = {};
  const emotionCounts = {};
  const situationCounts = {};

  valid.forEach(e => {
    const emo = e.emotion;
    emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
    e.situation_context.forEach(ctx => {
      const sit = typeof ctx === 'string' ? ctx : (ctx.domain || '기타');
      situationCounts[sit] = (situationCounts[sit] || 0) + 1;
      const key = emo + '|' + sit;
      crossTab[key] = (crossTab[key] || 0) + 1;
    });
  });

  // Top 5 emotions and situations by frequency
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const topSituations = Object.entries(situationCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  if (topEmotions.length < 2 || topSituations.length < 2) {
    container.innerHTML = '<p class="heatmap-empty">다양한 감정과 상황이 기록되면 패턴이 보여요</p>';
    return;
  }

  // Find max count for color scaling
  let maxCount = 0;
  topEmotions.forEach(emo => {
    topSituations.forEach(sit => {
      const c = crossTab[emo + '|' + sit] || 0;
      if (c > maxCount) maxCount = c;
    });
  });
  if (maxCount === 0) maxCount = 1;

  // SVG dimensions
  const CELL_W = 56, CELL_H = 40;
  const LABEL_LEFT = 70, LABEL_TOP = 50;
  const W = LABEL_LEFT + topSituations.length * CELL_W + 10;
  const H = LABEL_TOP + topEmotions.length * CELL_H + 10;

  // Build SVG
  let cells = '';
  let labels = '';

  // Situation labels (top, rotated)
  topSituations.forEach((sit, ci) => {
    const x = LABEL_LEFT + ci * CELL_W + CELL_W / 2;
    labels += '<text x="' + x + '" y="' + (LABEL_TOP - 8) + '" text-anchor="middle" font-size="11" fill="var(--color-text-light)">' + escapeHtml(sit) + '</text>';
  });

  // Emotion labels (left) and cells
  topEmotions.forEach((emo, ri) => {
    const y = LABEL_TOP + ri * CELL_H;
    labels += '<text x="' + (LABEL_LEFT - 8) + '" y="' + (y + CELL_H / 2) + '" dy="0.35em" text-anchor="end" font-size="11" fill="var(--color-text-light)">' + escapeHtml(emo) + '</text>';

    topSituations.forEach((sit, ci) => {
      const x = LABEL_LEFT + ci * CELL_W;
      const count = crossTab[emo + '|' + sit] || 0;
      const opacity = count > 0 ? (0.15 + 0.85 * (count / maxCount)).toFixed(2) : '0.05';
      const emoEsc = escapeHtml(emo);
      const sitEsc = escapeHtml(sit);
      cells += '<rect class="heatmap-cell" x="' + x + '" y="' + y + '" width="' + (CELL_W - 2) + '" height="' + (CELL_H - 2) + '" rx="4" fill="var(--color-primary)" opacity="' + opacity + '" data-emotion="' + emoEsc + '" data-situation="' + sitEsc + '" data-count="' + count + '"/>';
      if (count > 0) {
        cells += '<text x="' + (x + CELL_W / 2 - 1) + '" y="' + (y + CELL_H / 2) + '" dy="0.35em" text-anchor="middle" font-size="11" fill="var(--color-text)" pointer-events="none">' + count + '</text>';
      }
    });
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="감정 상황 히트맵">' +
      labels + cells +
    '</svg>' +
    '<div class="heatmap-tooltip" id="heatmapTooltip"></div>';

  // Tooltip events
  const tooltip = document.getElementById('heatmapTooltip');
  container.querySelectorAll('.heatmap-cell').forEach(cell => {
    function showTip(x, y) {
      tooltip.textContent = cell.dataset.emotion + ' × ' + cell.dataset.situation + ': ' + cell.dataset.count + '회';
      tooltip.style.display = 'block';
      tooltip.style.left = (x + 12) + 'px';
      tooltip.style.top = (y - 28) + 'px';
    }
    cell.addEventListener('mouseenter', e => showTip(e.clientX, e.clientY));
    cell.addEventListener('mousemove', e => showTip(e.clientX, e.clientY));
    cell.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    cell.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      showTip(t.clientX, t.clientY);
    }, { passive: false });
  });
}
