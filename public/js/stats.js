import { state, PERIOD_MAP } from './state.js';
import { escapeHtml, safeEmoji, emotionColor, emotionScore, showSkeleton, hideSkeleton, toLocalDateStr, showToast } from './utils.js';
import { fetchWithAuth } from './api.js';
import { track } from './analytics.js';
import { loadEmotionGraph } from './emotion-graph.js';

// 대시보드 캐시: 같은 기간+같은 항목 수면 API 재호출 스킵
let _lastDashboardKey = null;

export async function loadDashboard(period, forceReload = false) {
  if (period !== undefined) state.activePeriod = period;
  const entryCount = (state.allEntries || []).length;
  const cacheKey = `${state.activePeriod}_${entryCount}`;

  if (!forceReload && _lastDashboardKey === cacheKey) return;

  const tzOffset = new Date().getTimezoneOffset();
  const params = new URLSearchParams();
  if (state.activePeriod !== 'all') params.set('period', state.activePeriod);
  params.set('tz_offset', tzOffset);
  const queryParam = '?' + params.toString();
  const dashEl = document.getElementById('dashboardContent');
  if (dashEl) dashEl.setAttribute('aria-busy', 'true');
  showSkeleton('stats');
  try {
    const response = await fetchWithAuth('/api/stats' + queryParam);
    if (!response.ok) throw new Error();
    const stats = await response.json();
    renderDashboard(stats);
    // E-15: stats_dashboard_viewed
    track('stats_dashboard_viewed', {
      period: state.activePeriod,
      total_entries_in_period: stats.total_entries || 0,
    });
    _lastDashboardKey = cacheKey;
  } catch {
    hideSkeleton('stats');
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
          '<span class="recent-entry-emoji">' + safeEmoji(e.emoji) + '</span>' +
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

  // Emotion growth graph
  renderEmotionGrowth(state.allEntries);

  // Emotion-Activity correlation
  renderActivityCorrelation(state.allEntries);

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
  const POSITIVE_EMOTIONS = ['기쁨', '행복', '감사', '설렘', '희망', '평온', '만족', '사랑', '안도', '뿌듯'];

  // 1. 요일 패턴: 각 요일별 가장 빈번한 감정
  const byDay = Array.from({ length: 7 }, () => ({}));
  entries.forEach(e => {
    const d = new Date(e.date || e.created_at || '');
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
      priority: 3,
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
      priority: 4,
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
      priority: 7,
      emoji: emotionEmoji(topEmotion[0]),
      text: '기록 전반에서 \'' + topEmotion[0] + '\'이(가) 가장 자주 찾아왔어요',
      label: '전체 패턴',
    });
  }

  // 4. 감정 다양성: 고유 감정 5개 이상
  const uniqueEmotions = Object.keys(totalCounts);
  if (uniqueEmotions.length >= 5) {
    insights.push({
      priority: 5,
      emoji: '🌈',
      text: uniqueEmotions.length + '가지 다양한 감정을 기록했어요',
      label: '감정 다양성',
    });
  }

  // 5. 감정 추세: 최근 10개 vs 이전 엔트리 긍정 비율 비교 (20개 이상일 때)
  if (entries.length >= 20) {
    const sortedForTrend = entries.slice().sort((a, b) => {
      const da = new Date(a.date || a.created_at || '');
      const db = new Date(b.date || b.created_at || '');
      return da - db;
    });
    const recentTrend = sortedForTrend.slice(-10);
    const olderTrend = sortedForTrend.slice(0, sortedForTrend.length - 10);
    const posRatio = arr => arr.filter(e => POSITIVE_EMOTIONS.includes(e.emotion)).length / arr.length;
    const recentRatio = posRatio(recentTrend);
    const olderRatio = posRatio(olderTrend);
    if (recentRatio > olderRatio + 0.1) {
      insights.push({
        priority: 1,
        emoji: '📈',
        text: '최근 긍정적인 마음이 늘어나고 있어요',
        label: '감정 추세',
      });
    } else if (recentRatio < olderRatio - 0.1) {
      insights.push({
        priority: 1,
        emoji: '📉',
        text: '마음이 조금 무거운 시기인 것 같아요',
        label: '감정 추세',
      });
    }
  }

  // 6. 연속 패턴: 같은 감정이 3일 이상 연속
  const sortedForStreak = entries.slice().sort((a, b) => {
    const da = new Date(a.date || a.created_at || '');
    const db = new Date(b.date || b.created_at || '');
    return da - db;
  });
  let streak = 1, streakEmotion = sortedForStreak[0]?.emotion || '';
  let maxStreak = 1, maxStreakEmotion = streakEmotion;
  for (let i = 1; i < sortedForStreak.length; i++) {
    const cur = sortedForStreak[i].emotion;
    const prevDate = new Date(sortedForStreak[i - 1].date || sortedForStreak[i - 1].created_at || '');
    const curDate = new Date(sortedForStreak[i].date || sortedForStreak[i].created_at || '');
    const dayDiff = Math.round((curDate - prevDate) / 86400000);
    if (cur === sortedForStreak[i - 1].emotion && dayDiff <= 1) {
      streak++;
    } else {
      streak = 1;
    }
    if (streak > maxStreak) {
      maxStreak = streak;
      maxStreakEmotion = cur;
    }
  }
  if (maxStreak >= 3) {
    insights.push({
      priority: 2,
      emoji: emotionEmoji(maxStreakEmotion),
      text: '\'' + maxStreakEmotion + '\'이(가) ' + maxStreak + '일 연속 찾아왔어요',
      label: '연속 패턴',
    });
  }

  // 7. 기록 습관: 가장 활발하게 기록한 시간대 (40% 이상)
  const slotCounts = TIME_SLOTS.map(() => 0);
  let slotTotal = 0;
  entries.forEach(e => {
    const raw = e.date || e.created_at || '';
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return;
    const hour = dt.getHours();
    const idx = TIME_SLOTS.findIndex(s => hour >= s.start && hour < s.end);
    if (idx < 0) return;
    slotCounts[idx]++;
    slotTotal++;
  });
  if (slotTotal > 0) {
    const topSlotIdx = slotCounts.indexOf(Math.max(...slotCounts));
    const topSlotRatio = slotCounts[topSlotIdx] / slotTotal;
    if (topSlotRatio >= 0.4) {
      insights.push({
        priority: 6,
        emoji: '✍️',
        text: '주로 ' + TIME_SLOTS[topSlotIdx].label + '에 마음을 꺼내시네요',
        label: '기록 습관',
      });
    }
  }

  insights.sort((a, b) => a.priority - b.priority);
  const shown = insights.slice(0, 5);
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

  // R9. Better empty state
  if (!entries || entries.length < 5) {
    const grayPetals = Array.from({ length: 5 }, (_, i) => {
      const angle = -Math.PI / 2 + i * (2 * Math.PI / 5);
      const r = 48, cr = 20, pw = 0.38;
      const bAL = angle - pw, bAR = angle + pw;
      const bx1 = 60 + cr * Math.cos(bAL), by1 = 60 + cr * Math.sin(bAL);
      const bx2 = 60 + cr * Math.cos(bAR), by2 = 60 + cr * Math.sin(bAR);
      const tx = 60 + r * Math.cos(angle), ty = 60 + r * Math.sin(angle);
      const mr = r * 0.65;
      const cp1x = 60 + mr * Math.cos(bAL), cp1y = 60 + mr * Math.sin(bAL);
      const cp2x = 60 + mr * Math.cos(bAR), cp2y = 60 + mr * Math.sin(bAR);
      return `<path d="M ${bx1.toFixed(1)},${by1.toFixed(1)} Q ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)} Z" fill="#aaa"/>`;
    }).join('');
    container.innerHTML = `<div class="flower-empty-state"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${grayPetals}<circle cx="60" cy="60" r="20" fill="#ccc"/></svg><p>5개 이상 이야기를 나누면<br>마음의 꽃잎이 피어나요</p></div>`;
    return;
  }

  // Aggregate emotion counts
  const counts = {};
  entries.forEach(e => {
    if (e.emotion) counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  });

  const allSorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (allSorted.length === 0) {
    container.innerHTML = `<div class="flower-empty-state"><p>아직 감정 데이터가 없어요</p></div>`;
    return;
  }

  // R2. Cap at max 8 petals
  const MAX_PETALS = 8;
  const sorted = allSorted.slice(0, MAX_PETALS);
  const hiddenCount = allSorted.length - sorted.length;

  const maxCount = sorted[0][1];
  const totalClassified = Object.values(counts).reduce((s, c) => s + c, 0);
  const total = totalClassified;
  const topEmotion = sorted[0][0];
  const topEmoji = EMOTION_EMOJI_MAP[topEmotion] || '💭';

  const CX = 150, CY = 150;
  const MAX_R = 100;
  const MIN_R = 20;
  const CENTER_R = 32; // R3. increased from 28
  const PETAL_W = 0.38;

  const n = sorted.length;
  const angleStep = (2 * Math.PI) / n;

  let defs = '';
  let petals = '';
  let veins = '';
  let inlineLabels = '';
  let emojiLabels = '';

  sorted.forEach(([emotion, count], i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = MIN_R + (count / maxCount) * (MAX_R - MIN_R);
    const color = emotionColor(emotion);
    const emoji = EMOTION_EMOJI_MAP[emotion] || '💭';
    const pct = Math.round((count / total) * 100);

    const baseAngleL = angle - PETAL_W;
    const baseAngleR = angle + PETAL_W;

    const bx1 = CX + CENTER_R * Math.cos(baseAngleL);
    const by1 = CY + CENTER_R * Math.sin(baseAngleL);
    const bx2 = CX + CENTER_R * Math.cos(baseAngleR);
    const by2 = CY + CENTER_R * Math.sin(baseAngleR);

    const tipX = CX + r * Math.cos(angle);
    const tipY = CY + r * Math.sin(angle);

    const midR = r * 0.65;
    const cp1x = CX + midR * Math.cos(baseAngleL);
    const cp1y = CY + midR * Math.sin(baseAngleL);
    const cp2x = CX + midR * Math.cos(baseAngleR);
    const cp2y = CY + midR * Math.sin(baseAngleR);

    const safeEmotion = escapeHtml(emotion);

    // R5. Petal gradient
    const gradId = `pg_${i}`;
    const gx1 = CX + CENTER_R * Math.cos(angle);
    const gy1 = CY + CENTER_R * Math.sin(angle);
    defs += `<linearGradient id="${gradId}" x1="${gx1.toFixed(1)}" y1="${gy1.toFixed(1)}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${color}" stop-opacity="0.55"/><stop offset="100%" stop-color="${color}" stop-opacity="0.90"/></linearGradient>`;

    // R10. Better aria-label per petal
    petals += `<path class="flower-petal" d="M ${bx1.toFixed(1)},${by1.toFixed(1)} Q ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} Q ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)} Z" fill="url(#${gradId})" data-emotion="${safeEmotion}" data-count="${count}" data-pct="${pct}" aria-label="${safeEmotion} ${count}회, 전체의 ${pct}%"/>`;

    // R6. Petal vein line
    const veinEndR = r * 0.72;
    const veinStartX = CX + CENTER_R * Math.cos(angle);
    const veinStartY = CY + CENTER_R * Math.sin(angle);
    const veinEndX = CX + veinEndR * Math.cos(angle);
    const veinEndY = CY + veinEndR * Math.sin(angle);
    veins += `<line x1="${veinStartX.toFixed(1)}" y1="${veinStartY.toFixed(1)}" x2="${veinEndX.toFixed(1)}" y2="${veinEndY.toFixed(1)}" stroke="${color}" stroke-width="1" stroke-opacity="0.45" style="pointer-events:none"/>`;

    // R4. Text labels on petals (only if petal long enough)
    if (r > CENTER_R + 24) {
      const labelFrac = 0.62;
      const labelR = CENTER_R + (r - CENTER_R) * labelFrac;
      const lx = CX + labelR * Math.cos(angle);
      const ly = CY + labelR * Math.sin(angle);
      // Convert angle to degrees for SVG rotate
      let deg = angle * (180 / Math.PI);
      // Flip text if it would be upside-down
      let flip = false;
      const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (normAngle > Math.PI / 2 && normAngle < 3 * Math.PI / 2) {
        flip = true;
        deg += 180;
      }
      const fontSize = i < 3 ? 9.5 : 8.5;
      inlineLabels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" class="flower-petal-label" opacity="0.85" transform="rotate(${(deg + 90).toFixed(1)},${lx.toFixed(1)},${ly.toFixed(1)})" style="pointer-events:none;user-select:none">${safeEmotion}</text>`;
    }

    // Emoji at petal tip (only if petal long enough to avoid center overlap)
    if (r > CENTER_R + 20) {
      const emojiR = r + 14;
      const ex = CX + emojiR * Math.cos(angle);
      const ey = CY + emojiR * Math.sin(angle);
      emojiLabels += `<text x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="13" style="pointer-events:none;user-select:none">${emoji}</text>`;
    }
  });

  // R7. Legend strip (top 5)
  const legendItems = sorted.slice(0, 5).map(([emotion, count]) => {
    const color = emotionColor(emotion);
    const pct = Math.round((count / total) * 100);
    const safeEmotion = escapeHtml(emotion);
    return `<div class="flower-legend-item">
      <span class="flower-legend-dot" style="background:${color}"></span>
      <span class="flower-legend-name">${safeEmotion}</span>
      <span class="flower-legend-bar"><span class="flower-legend-fill" style="width:${pct}%;background:${color}"></span></span>
      <span class="flower-legend-count">${count}회</span>
      <span class="flower-legend-pct">${pct}%</span>
    </div>`;
  }).join('');

  const hiddenNote = hiddenCount > 0 ? ` <span class="flower-legend-hidden">그 외 ${hiddenCount}개</span>` : '';

  // R10. Better SVG aria-label
  const svgAriaLabel = `감정 꽃잎 차트: 총 ${total}개 기록, 가장 많은 감정은 ${escapeHtml(topEmotion)} (${maxCount}회)`;

  const tooltipId = 'flowerTooltip';

  // R1. Subtitle, R3. Center shows dominant emotion
  container.innerHTML = `<p class="flower-subtitle">꽃잎이 클수록 자주 느낀 감정이에요</p>
  <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-label="${svgAriaLabel}">
    <defs>${defs}</defs>
    ${petals}
    ${veins}
    <circle cx="${CX}" cy="${CY}" r="${CENTER_R}" fill="var(--color-surface)" stroke="var(--color-border)" stroke-width="1.5"/>
    <text x="${CX}" y="${CY - 9}" text-anchor="middle" dominant-baseline="middle" font-size="18" style="pointer-events:none;user-select:none">${topEmoji}</text>
    <text x="${CX}" y="${CY + 11}" text-anchor="middle" dominant-baseline="middle" font-size="8" class="flower-center-label" opacity="0.75">${escapeHtml(topEmotion)}</text>
    ${inlineLabels}
    ${emojiLabels}
  </svg>
  <div class="flower-tooltip" id="${tooltipId}"></div>
  <div class="flower-legend">${legendItems}${hiddenNote}</div>`;

  // R8. Enhanced tooltip with percentage
  const tooltip = document.getElementById(tooltipId);
  container.querySelectorAll('.flower-petal').forEach(petal => {
    function showTip(x, y) {
      const pct = petal.dataset.pct;
      tooltip.textContent = petal.dataset.emotion + ' · ' + petal.dataset.count + '회 (' + pct + '%)';
      tooltip.style.display = 'block';
      const maxLeft = window.innerWidth - (tooltip.offsetWidth || 120) - 8;
      tooltip.style.left = Math.min(Math.max(8, x + 14), maxLeft) + 'px';
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
    const d = new Date(e.date || e.created_at || '');
    return d >= cutoff && d <= now;
  });

  if (filtered.length < 7) {
    container.innerHTML = '<p class="trend-chart-empty">7일 이상 이야기를 나누면 마음의 흐름이 보여요</p>';
    return;
  }

  const byDate = {};
  filtered.forEach(e => {
    const d = toLocalDateStr(e.date || e.created_at || '');
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
    // 생성된 리포트로 자동 스크롤
    setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    // E-16: report_generated
    track('report_generated', { period });
    // Load report history after generating
    loadReportHistory();
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

async function loadReportHistory() {
  const historyEl = document.getElementById('reportHistory');
  const listEl = document.getElementById('reportHistoryList');
  const toggleEl = document.getElementById('reportHistoryToggle');
  if (!historyEl || !listEl) return;

  try {
    const res = await fetchWithAuth('/api/reports?limit=10');
    if (!res.ok) { historyEl.hidden = true; return; }
    const reports = await res.json();

    if (!Array.isArray(reports) || reports.length === 0) {
      historyEl.hidden = true;
      return;
    }

    listEl.innerHTML = reports.map(r => {
      const periodLabel = r.period === 'weekly' ? '주간' : '월간';
      const dateStr = r.periodStart
        ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(r.periodStart))
        : '';
      return '<li class="report-history-item" data-report-id="' + escapeHtml(String(r.id)) + '">' +
        '<div class="report-history-item-header">' +
          '<span class="report-history-period">' + periodLabel + ' 리포트</span>' +
          '<div class="report-history-item-actions">' +
            '<span class="report-history-date">' + escapeHtml(dateStr) + '</span>' +
            '<button class="report-history-delete-btn" aria-label="리포트 삭제" data-report-id="' + escapeHtml(String(r.id)) + '">✕</button>' +
          '</div>' +
        '</div>' +
        '<p class="report-history-summary">' + escapeHtml(r.summary || '') + '</p>' +
        '<div class="report-history-detail" hidden>' +
          '<div class="report-history-detail-section">' +
            '<span class="report-history-detail-label">마음의 변화</span>' +
            '<p class="report-history-detail-text">' + escapeHtml(r.emotionTrend || '') + '</p>' +
          '</div>' +
          '<div class="report-history-detail-section">' +
            '<span class="report-history-detail-label">마음의 패턴</span>' +
            '<p class="report-history-detail-text">' + escapeHtml(r.insight || '') + '</p>' +
          '</div>' +
          '<div class="report-history-detail-section">' +
            '<span class="report-history-detail-label">따뜻한 한마디</span>' +
            '<p class="report-history-detail-text">' + escapeHtml(r.encouragement || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</li>';
    }).join('');

    historyEl.hidden = false;

    // Accordion: click item (not delete button) to toggle detail
    if (!listEl._clickBound) {
      listEl._clickBound = true;
      listEl.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.report-history-delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          const reportId = deleteBtn.dataset.reportId;
          if (!confirm('이 리포트를 삭제할까요?')) return;
          try {
            const res = await fetchWithAuth('/api/reports/' + reportId, { method: 'DELETE' });
            if (res.ok || res.status === 204) {
              const li = listEl.querySelector('[data-report-id="' + reportId + '"]');
              if (li) li.remove();
              showToast('리포트가 삭제되었어요', 'success');
              if (listEl.children.length === 0) historyEl.hidden = true;
            } else {
              showToast('삭제에 실패했어요. 다시 시도해주세요.', 'error');
            }
          } catch {
            showToast('삭제 중 문제가 생겼어요.', 'error');
          }
          return;
        }

        const item = e.target.closest('.report-history-item');
        if (!item) return;
        const detail = item.querySelector('.report-history-detail');
        if (!detail) return;
        detail.hidden = !detail.hidden;
        item.classList.toggle('report-history-item--expanded', !detail.hidden);
      });
    }

    // Toggle accordion
    if (toggleEl && !toggleEl._bound) {
      toggleEl._bound = true;
      toggleEl.addEventListener('click', () => {
        const isExpanded = !listEl.hidden;
        listEl.hidden = isExpanded;
        toggleEl.classList.toggle('expanded', !isExpanded);
      });
    }
  } catch {
    // Silently fail — history is supplementary
  }
}

export function setupStats() {
  document.getElementById('periodFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.period-chip');
    if (!chip) return;
    document.querySelectorAll('#periodFilter .period-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const days = chip.dataset.days || '0';
    const period = PERIOD_MAP[days] || 'all';
    loadDashboard(period, true);
    loadEmotionGraph(period);
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

// Emotion Growth Graph — weekly metrics over time
function renderEmotionGrowth(entries) {
  const container = document.getElementById('emotionGrowthChart');
  if (!container) return;

  if (!entries || entries.length < 14) {
    container.innerHTML = '<p class="growth-empty">2주 이상 기록하면 마음 돌봄 성장 그래프가 나타나요</p>';
    return;
  }

  // Group entries by ISO week
  const weekMap = {};
  entries.forEach(e => {
    const d = new Date(e.date || e.created_at || '');
    if (isNaN(d.getTime())) return;
    // Week key: start of week (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = toLocalDateStr(monday);
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(e);
  });

  const weeks = Object.keys(weekMap).sort();
  if (weeks.length < 2) {
    container.innerHTML = '<p class="growth-empty">2주 이상 기록하면 성장 그래프가 나타나요</p>';
    return;
  }

  // Calculate metrics per week
  const metrics = weeks.map(w => {
    const es = weekMap[w];
    const uniqueEmotions = new Set(es.map(e => e.emotion).filter(Boolean)).size;
    const positiveCount = es.filter(e => emotionScore(e.emotion) > 0).length;
    const positiveRatio = es.length > 0 ? positiveCount / es.length : 0;
    return {
      week: w,
      count: es.length,
      diversity: uniqueEmotions,
      positiveRatio,
    };
  });

  // SVG multi-line chart
  const W = 600, H = 180;
  const PAD = { top: 24, right: 20, bottom: 32, left: 42 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxCount = Math.max(...metrics.map(m => m.count), 1);
  const maxDiv = Math.max(...metrics.map(m => m.diversity), 1);
  const n = metrics.length;

  function x(i) { return PAD.left + (i / Math.max(n - 1, 1)) * innerW; }
  function yCount(v) { return PAD.top + innerH * (1 - v / maxCount); }
  function yDiv(v) { return PAD.top + innerH * (1 - v / maxDiv); }
  function yRatio(v) { return PAD.top + innerH * (1 - v); }

  // Grid lines
  let svg = '';
  [0, 0.5, 1].forEach(frac => {
    const yy = (PAD.top + innerH * (1 - frac)).toFixed(1);
    svg += '<line x1="' + PAD.left + '" y1="' + yy + '" x2="' + (W - PAD.right) + '" y2="' + yy + '" stroke="var(--color-divider)" stroke-dasharray="4,3"/>';
  });

  // Lines
  const lines = [
    { data: metrics.map(m => m.count), yFn: yCount, color: 'var(--color-primary)', label: '기록 수' },
    { data: metrics.map(m => m.diversity), yFn: yDiv, color: '#82E0AA', label: '감정 다양성' },
    { data: metrics.map(m => m.positiveRatio), yFn: yRatio, color: '#F4D03F', label: '긍정 비율' },
  ];

  lines.forEach(line => {
    const points = line.data.map((v, i) => x(i).toFixed(1) + ',' + line.yFn(v).toFixed(1)).join(' ');
    svg += '<polyline points="' + points + '" fill="none" stroke="' + line.color + '" stroke-width="2" stroke-linejoin="round" opacity="0.8"/>';
    // Dots
    line.data.forEach((v, i) => {
      svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + line.yFn(v).toFixed(1) + '" r="3" fill="' + line.color + '"/>';
    });
  });

  // X-axis labels (first, mid, last)
  function fmtWeek(w) {
    const [, m, d] = w.split('-');
    return parseInt(m) + '/' + parseInt(d);
  }
  const xIdxs = [0, Math.floor(n / 2), n - 1];
  xIdxs.forEach(i => {
    svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - PAD.bottom + 16) + '" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">' + fmtWeek(metrics[i].week) + '</text>';
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="마음 돌봄 성장 그래프">' + svg + '</svg>' +
    '<div class="growth-legend">' +
      '<span class="growth-legend-item"><span class="growth-legend-dot" style="background:var(--color-primary)"></span>기록 수</span>' +
      '<span class="growth-legend-item"><span class="growth-legend-dot" style="background:#82E0AA"></span>감정 다양성</span>' +
      '<span class="growth-legend-item"><span class="growth-legend-dot" style="background:#F4D03F"></span>긍정 비율</span>' +
    '</div>';
}

// Emotion-Activity correlation chart
function renderActivityCorrelation(entries) {
  const container = document.getElementById('activityCorrelationChart');
  if (!container) return;

  const valid = (entries || []).filter(e =>
    e.emotion && Array.isArray(e.activity_tags) && e.activity_tags.length > 0
  );

  if (valid.length < 5) {
    container.innerHTML = '<p class="correlation-empty">활동 태그가 5개 이상 쌓이면 감정-활동 패턴이 보여요</p>';
    return;
  }

  // Build activity → emotion score map
  const activityData = {};
  valid.forEach(e => {
    const score = emotionScore(e.emotion);
    e.activity_tags.forEach(tag => {
      if (!activityData[tag]) activityData[tag] = { total: 0, sum: 0, positive: 0, negative: 0 };
      activityData[tag].total++;
      activityData[tag].sum += score;
      if (score > 0) activityData[tag].positive++;
      else if (score < 0) activityData[tag].negative++;
    });
  });

  // Sort by frequency, take top 8
  const sorted = Object.entries(activityData)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = '<p class="correlation-empty">활동 태그 데이터가 아직 없어요</p>';
    return;
  }

  const maxTotal = Math.max(...sorted.map(([, d]) => d.total), 1);

  let html = '<div class="correlation-bars">';
  sorted.forEach(([tag, data]) => {
    const avg = data.sum / data.total;
    const pct = data.total / maxTotal * 100;
    let mood;
    if (avg > 0.3) mood = 'positive';
    else if (avg < -0.3) mood = 'negative';
    else mood = 'neutral';

    const moodLabel = mood === 'positive' ? '긍정적' : mood === 'negative' ? '부정적' : '보통';

    html += '<div class="correlation-row">' +
      '<span class="correlation-label">' + escapeHtml(tag) + '</span>' +
      '<div class="correlation-track">' +
        '<div class="correlation-fill correlation-fill--' + mood + '" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<span class="correlation-meta">' + data.total + '회 · ' + moodLabel + '</span>' +
    '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
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
    const raw = e.date || e.created_at || '';
    if (!raw) return;
    const d = new Date(raw);
    if (d.getFullYear() !== _pixelsYear) return;
    // Keep the last entry per day (local date)
    dateMap[toLocalDateStr(d)] = e.emotion;
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
    const dateStr = toLocalDateStr(date);
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
