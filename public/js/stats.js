import { state, PERIOD_MAP } from './state.js';
import { escapeHtml, emotionColor, emotionScore, showSkeleton } from './utils.js';
import { fetchWithAuth } from './api.js';

export async function loadDashboard(period) {
  if (period !== undefined) state.activePeriod = period;
  const queryParam = state.activePeriod !== 'all' ? '?period=' + state.activePeriod : '';
  const dashEl = document.getElementById('dashboardContent');
  if (dashEl) dashEl.setAttribute('aria-busy', 'true');
  showSkeleton('stats');
  try {
    const response = await fetchWithAuth('/api/stats' + queryParam);
    if (!response.ok) throw new Error();
    const stats = await response.json();
    renderDashboard(stats);
  } catch {
    const summaryEl = document.getElementById('dashboardSummary');
    if (summaryEl) summaryEl.innerHTML = '<p class="dashboard-empty">통계를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>';
  } finally {
    if (dashEl) dashEl.removeAttribute('aria-busy');
  }
}

function renderDashboard(stats) {
  const summaryEl = document.getElementById('dashboardSummary');
  const emotionsChart = document.getElementById('topEmotionsChart');
  const situationsChart = document.getElementById('topSituationsChart');
  const recentList = document.getElementById('recentEntriesList');

  if (summaryEl) {
    summaryEl.innerHTML =
      '<div class="dashboard-summary-grid">' +
        '<div class="summary-card"><span class="summary-value">' + (stats.total_entries || 0) + '</span><span class="summary-label">전체 기록</span></div>' +
        '<div class="summary-card"><span class="summary-value">' + (stats.this_week || 0) + '</span><span class="summary-label">이번 주</span></div>' +
        '<div class="summary-card"><span class="summary-value">' + (stats.today || 0) + '</span><span class="summary-label">오늘</span></div>' +
      '</div>';
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

  if (recentList && stats.recent_entries) {
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
  }

  // Trend chart
  renderTrendChart(state.allEntries);
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
    container.innerHTML = '<p class="trend-chart-empty">7일 이상 기록하면 감정 흐름을 볼 수 있어요</p>';
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
  const PAD = { top: 18, right: 18, bottom: 28, left: 36 };
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
  const yLabels = [{ score:1, label:'+1' }, { score:0, label:'0' }, { score:-1, label:'-1' }];

  function fmtDate(d) {
    const [, m, day] = d.split('-');
    return `${parseInt(m)}/${parseInt(day)}`;
  }

  let svgDots = '';
  points.forEach(p => {
    const cx = xOf(p.date).toFixed(1);
    const cy = yOf(p.score).toFixed(1);
    const col = emotionColor(p.emotion);
    const emo = p.emotion.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
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

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="감정 트렌드 차트">
    ${yGrid}${xTicks}
    <polyline points="${coords}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linejoin="round" opacity="0.7"/>
    ${svgDots}
  </svg><div class="trend-tooltip" id="trendTooltip"></div>`;

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
    });
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
      const msg = data.error || '리포트 생성에 실패했습니다.';
      resultEl.innerHTML = '<p class="dashboard-empty">' + escapeHtml(msg) + '</p>';
      resultEl.hidden = false;
      return;
    }
    const periodLabel = period === 'weekly' ? '주간' : '월간';
    resultEl.innerHTML =
      '<div class="report-card">' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">' + periodLabel + ' 요약</span>' +
          '<p class="report-card-text">' + escapeHtml(data.summary) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">감정 변화</span>' +
          '<p class="report-card-text">' + escapeHtml(data.emotionTrend) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">패턴 인사이트</span>' +
          '<p class="report-card-text">' + escapeHtml(data.insight) + '</p>' +
        '</div>' +
        '<div class="report-card-section">' +
          '<span class="report-card-label">응원 메시지</span>' +
          '<p class="report-card-text">' + escapeHtml(data.encouragement) + '</p>' +
        '</div>' +
      '</div>';
    resultEl.hidden = false;
  } catch (err) {
    const msg = err.userMessage || '리포트 생성 중 오류가 발생했습니다.';
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
    loadDashboard(PERIOD_MAP[days] || 'all');
  });

  document.getElementById('btnWeeklyReport').addEventListener('click', () => fetchReport('weekly'));
  document.getElementById('btnMonthlyReport').addEventListener('click', () => fetchReport('monthly'));
}
