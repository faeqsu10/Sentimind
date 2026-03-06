import { state, STREAK_MILESTONES } from './state.js';
import { escapeHtml, emotionColor, getEmotionGroup, showToast } from './utils.js';

export function updateSidebar() {
  updateSidebarLatest();
  updateSidebarToday();
  updateSidebarStreak();
  updateSidebarWeeklyChart();
  renderInsightCards();
  updateMobileStreakBanner();
}

function renderSidebarLatestCard(emoji, emotion, message, timeLabel) {
  return '<div class="sidebar-latest">' +
    '<div class="sidebar-latest-emoji" aria-hidden="true">' + escapeHtml(emoji || '') + '</div>' +
    '<p class="sidebar-latest-emotion">' + escapeHtml(emotion || '') + '</p>' +
    '<p class="sidebar-latest-message">' + escapeHtml(message || '') + '</p>' +
    (timeLabel ? '<p class="sidebar-latest-time">' + escapeHtml(timeLabel) + '</p>' : '') +
  '</div>';
}

function updateSidebarLatest() {
  const container = document.getElementById('sidebarLatestContent');
  if (!container) return;

  if (state.latestAnalysisResult) {
    const r = state.latestAnalysisResult;
    const timeStr = r._time ? new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(r._time)) : '';
    container.innerHTML = renderSidebarLatestCard(r.emoji, r.emotion, r.message, timeStr);
  } else if (state.allEntries && state.allEntries.length > 0) {
    const latest = state.allEntries[0];
    const dateStr = latest.date ? new Intl.DateTimeFormat('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(latest.date)) : '';
    container.innerHTML = renderSidebarLatestCard(latest.emoji, latest.emotion, latest.message, dateStr);
  } else {
    container.innerHTML = '<p class="sidebar-empty">첫 일기를 쓰면 AI가 감정을 읽어드려요</p>';
  }
}

function updateSidebarToday() {
  const container = document.getElementById('sidebarTodayContent');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = (state.allEntries || []).filter(e => {
    if (!e.date) return false;
    return e.date.startsWith(todayStr);
  });

  if (todayEntries.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">오늘의 감정을 한 줄로 기록해볼까요?</p>';
    return;
  }

  const listItems = todayEntries.slice(0, 5).map(e =>
    '<li class="sidebar-today-item">' +
      '<span class="sidebar-today-item-emoji">' + escapeHtml(e.emoji || '') + '</span>' +
      '<span class="sidebar-today-item-text">' + escapeHtml(e.text || '') + '</span>' +
    '</li>'
  ).join('');
  container.innerHTML = '<ul class="sidebar-today-list">' + listItems + '</ul>';
}

function updateSidebarStreak() {
  const streakCountEl = document.getElementById('streakCount');
  const streakSubEl = document.getElementById('streakSub');
  const streakDotsEl = document.getElementById('streakDots');
  if (!streakCountEl) return;

  const entries = state.allEntries || [];
  const dateSet = new Set();
  entries.forEach(e => { if (e.date) dateSet.add(e.date.split('T')[0]); });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);

  const todayStr = checkDate.toISOString().split('T')[0];
  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const ds = checkDate.toISOString().split('T')[0];
    if (dateSet.has(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const hasTodayEntry = dateSet.has(todayStr);
  streakCountEl.textContent = streak;
  if (streakSubEl) {
    streakSubEl.textContent = hasTodayEntry ? '오늘도 기록 완료!' : '오늘 일기를 작성해보세요';
  }

  if (streakDotsEl) {
    const dots = [];
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const active = dateSet.has(ds);
      const isToday = i === 0;
      const cls = 'streak-dot' + (active ? ' active' : '') + (isToday ? ' today' : '');
      dots.push('<div class="' + cls + '" title="' + dayLabels[d.getDay()] + '"></div>');
    }
    streakDotsEl.innerHTML = dots.join('');
  }

  checkStreakMilestone(streak);
}

function checkStreakMilestone(streak) {
  const milestone = STREAK_MILESTONES.find(m => m.days === streak);
  if (!milestone) return;
  const key = 'streak_celebrated_' + milestone.days;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');

  showToast(milestone.badge + ' ' + milestone.label + ' 달성! ' + milestone.desc, 'success');
  const streakCard = document.getElementById('sidebarStreak');
  if (streakCard) {
    streakCard.classList.add('milestone-glow');
    setTimeout(() => streakCard.classList.remove('milestone-glow'), 2000);
  }
}

export function renderProfileBadges() {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;
  const entries = state.allEntries || [];
  const dateSet = new Set();
  entries.forEach(e => { if (e.date) dateSet.add(e.date.split('T')[0]); });
  const sortedDates = [...dateSet].sort();
  let maxStreak = 0, tempStreak = sortedDates.length > 0 ? 1 : 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) { tempStreak++; } else { maxStreak = Math.max(maxStreak, tempStreak); tempStreak = 1; }
  }
  maxStreak = Math.max(maxStreak, tempStreak);
  const streakEl = document.getElementById('streakCount');
  const currentStreak = parseInt(streakEl?.textContent || '0');
  maxStreak = Math.max(maxStreak, currentStreak);

  grid.innerHTML = STREAK_MILESTONES.map(m => {
    const achieved = maxStreak >= m.days;
    return '<div class="badge-item' + (achieved ? ' achieved' : '') + '">' +
      '<span class="badge-icon">' + m.badge + '</span>' +
      '<span class="badge-label">' + m.label + '</span>' +
    '</div>';
  }).join('');
}

export function createConfetti(emotion) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  const color = emotionColor(emotion);
  const colors = [color, '#F4A261', '#7EB8DA', '#A8DAAB', '#9C89B8'];
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 10 : 20;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = (1 + Math.random()) + 's';
    const size = 6 + Math.random() * 8;
    piece.style.width = size + 'px';
    piece.style.height = size + 'px';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 3000);
}

export function generateInsights(entries) {
  if (!entries || entries.length < 3) return [];
  const insights = [];
  const now = new Date();
  const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

  const thisWeek = entries.filter(e => new Date(e.date || e.created_at) >= oneWeekAgo);
  const lastWeek = entries.filter(e => {
    const d = new Date(e.date || e.created_at);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  });

  if (thisWeek.length >= 2) {
    const twCount = {};
    thisWeek.forEach(e => { twCount[e.emotion] = (twCount[e.emotion] || 0) + 1; });
    const topEmotion = Object.entries(twCount).sort((a, b) => b[1] - a[1])[0];
    if (topEmotion) {
      const lwCount = {};
      lastWeek.forEach(e => { lwCount[e.emotion] = (lwCount[e.emotion] || 0) + 1; });
      const lastWeekSame = lwCount[topEmotion[0]] || 0;
      const diff = topEmotion[1] - lastWeekSame;
      const diffText = diff > 0 ? '+' + diff : diff === 0 ? '동일' : String(diff);
      insights.push({
        icon: '📊',
        title: '이번 주 주요 감정',
        body: topEmotion[0] + ' (' + topEmotion[1] + '회, 지난주 대비 ' + diffText + ')'
      });
    }
  }

  const dayMap = [0, 0, 0, 0, 0, 0, 0];
  const dayEmotions = [{}, {}, {}, {}, {}, {}, {}];
  entries.forEach(e => {
    if (!e.date) return;
    const day = new Date(e.date || e.created_at).getDay();
    dayMap[day]++;
    dayEmotions[day][e.emotion] = (dayEmotions[day][e.emotion] || 0) + 1;
  });
  const busiestDay = dayMap.indexOf(Math.max(...dayMap));
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  if (dayMap[busiestDay] >= 2) {
    const topDayEmotion = Object.entries(dayEmotions[busiestDay]).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      icon: '📅',
      title: '가장 활발한 요일',
      body: dayNames[busiestDay] + ' (' + dayMap[busiestDay] + '회)' + (topDayEmotion ? ' — 주요 감정: ' + topDayEmotion[0] : '')
    });
  }

  return insights.slice(0, 3);
}

function renderInsightCards() {
  const container = document.getElementById('sidebarInsights');
  if (!container) return;
  const insights = generateInsights(state.allEntries);
  if (insights.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = insights.map(ins =>
    '<div class="insight-card">' +
      '<span class="insight-icon">' + ins.icon + '</span>' +
      '<div class="insight-body">' +
        '<div class="insight-title">' + escapeHtml(ins.title) + '</div>' +
        '<div class="insight-text">' + escapeHtml(ins.body) + '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

function updateMobileStreakBanner() {
  const banner = document.getElementById('mobileStreakBanner');
  const dotsEl = document.getElementById('mobileStreakDots');
  const textEl = document.getElementById('mobileStreakText');
  const todayEl = document.getElementById('mobileStreakToday');
  if (!banner || !dotsEl || !textEl || !todayEl) return;

  const entries = state.allEntries || [];
  const dateSet = new Set();
  entries.forEach(e => { if (e.date) dateSet.add(e.date.split('T')[0]); });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Calculate streak (same logic as updateSidebarStreak)
  let streak = 0;
  let checkDate = new Date(today);
  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (true) {
    const ds = checkDate.toISOString().split('T')[0];
    if (dateSet.has(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Render 7-day dots
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const active = dateSet.has(ds);
    const isToday = i === 0;
    const cls = 'streak-dot' + (active ? ' active' : '') + (isToday ? ' today' : '');
    dots.push('<div class="' + cls + '"></div>');
  }
  dotsEl.innerHTML = dots.join('');

  // Streak text
  textEl.textContent = streak > 0 ? streak + '일 연속' : '시작해보세요';

  // Today's emotion emoji
  const hasTodayEntry = dateSet.has(todayStr);
  if (hasTodayEntry) {
    const todayEntry = entries.find(e => e.date && e.date.startsWith(todayStr));
    todayEl.textContent = todayEntry && todayEntry.emoji ? todayEntry.emoji : '기록 완료';
  } else {
    todayEl.textContent = '오늘 미작성';
  }
}

export function updateSidebarWeeklyChart() {
  const container = document.getElementById('sidebarWeeklyChart');
  if (!container) return;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const dayData = [];
  let maxCount = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const count = (state.allEntries || []).filter(e => (e.date || '').startsWith(ds)).length;
    dayData.push({ label: dayLabels[d.getDay()], count, isToday: i === 0 });
    maxCount = Math.max(maxCount, count);
  }

  if (maxCount === 0) {
    container.innerHTML = '<p class="sidebar-empty">이번 주 첫 기록을 남겨보세요</p>';
    return;
  }

  container.innerHTML = '<div class="mini-chart">' + dayData.map(dd =>
    '<div class="mini-chart-bar-wrap">' +
      '<span class="mini-chart-count">' + (dd.count || '') + '</span>' +
      '<div class="mini-chart-bar">' +
        '<div class="mini-chart-bar-fill' + (dd.isToday ? ' today-bar' : '') + '" style="height:' + (dd.count / maxCount * 100) + '%"></div>' +
      '</div>' +
      '<span class="mini-chart-label">' + dd.label + '</span>' +
    '</div>'
  ).join('') + '</div>';
}
