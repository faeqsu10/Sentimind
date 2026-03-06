import { state, STREAK_MILESTONES } from './state.js';
import { escapeHtml, emotionColor, getEmotionGroup, showToast } from './utils.js';

export function updateSidebar() {
  updateSidebarLatest();
  updateSidebarToday();
  updateSidebarStreak();
  updateSidebarWeeklyChart();
  renderInsightCards();
  updateMobileStreakBanner();
  updateAnniversaryCard();
  updateEmotionVocab();
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
    container.innerHTML = '<p class="sidebar-empty">첫 이야기를 들려주시면 마음을 읽어드릴게요</p>';
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
    container.innerHTML = '<p class="sidebar-empty">오늘의 마음을 한 줄로 꺼내볼까요?</p>';
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
    streakSubEl.textContent = hasTodayEntry ? '오늘도 마음을 돌봤어요!' : '오늘의 마음을 기록해보세요';
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

  const group = getEmotionGroup(emotion);
  const positiveGroups = ['joy', 'love', 'peace'];
  const neutralGroups = ['default'];

  // Neutral emotions: no particles, only emotion theme color applies
  if (neutralGroups.includes(group)) return;

  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  const color = emotionColor(emotion);

  if (positiveGroups.includes(group)) {
    // Positive emotions: celebratory confetti (original behavior)
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
  } else {
    // Negative emotions (sadness, anger, anxiety, tired): gentle floating particles
    const count = 8;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'gentle-particle';
      particle.style.left = (10 + Math.random() * 80) + '%';
      particle.style.bottom = '-10px';
      particle.style.background = color;
      particle.style.animationDelay = (Math.random() * 1.5) + 's';
      particle.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      const size = 4 + Math.random() * 6;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      container.appendChild(particle);
    }
  }

  setTimeout(() => container.remove(), 4000);
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
        title: '이번 주 가장 많이 찾아온 마음',
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
      title: '마음을 가장 많이 꺼낸 요일',
      body: dayNames[busiestDay] + ' (' + dayMap[busiestDay] + '회)' + (topDayEmotion ? ' — 주로 느낀 마음: ' + topDayEmotion[0] : '')
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
  textEl.textContent = streak > 0 ? streak + '일 연속' : '첫 기록을 남겨보세요';

  // Today's emotion emoji
  const hasTodayEntry = dateSet.has(todayStr);
  if (hasTodayEntry) {
    const todayEntry = entries.find(e => e.date && e.date.startsWith(todayStr));
    todayEl.textContent = todayEntry && todayEntry.emoji ? todayEntry.emoji : '마음 전달 완료';
  } else {
    todayEl.textContent = '오늘의 이야기를 기다려요';
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
    container.innerHTML = '<p class="sidebar-empty">이번 주 첫 이야기를 들려주세요</p>';
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

// ---------------------------------------------------------------------------
// AI Relationship Anniversary
// ---------------------------------------------------------------------------

const ANNIVERSARY_MILESTONES = [
  { days: 7, icon: '🌱', title: '함께 한지 7일', template: '일주일 동안 {count}번의 마음을 나누었어요' },
  { days: 30, icon: '🌿', title: '함께 한지 30일', template: '한 달 동안 {count}번의 마음을 나누었네요' },
  { days: 100, icon: '🌳', title: '함께 한지 100일', template: '100일 동안 {count}번의 마음을 함께 했어요. 고마워요' },
];

function updateAnniversaryCard() {
  const card = document.getElementById('sidebarAnniversary');
  if (!card) return;

  const entries = state.allEntries || [];
  if (entries.length === 0 || state.guestMode) {
    card.hidden = true;
    return;
  }

  // Find the earliest entry date
  const dates = entries
    .map(e => e.date || e.created_at)
    .filter(Boolean)
    .map(d => new Date(d).getTime())
    .filter(t => !isNaN(t));

  if (dates.length === 0) {
    card.hidden = true;
    return;
  }

  const firstDate = new Date(Math.min(...dates));
  const daysSinceFirst = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  // Find the matching milestone (show the highest achieved)
  const milestone = ANNIVERSARY_MILESTONES
    .filter(m => daysSinceFirst >= m.days)
    .pop();

  if (!milestone) {
    card.hidden = true;
    return;
  }

  // Only show each milestone once per session to avoid fatigue
  const sessionKey = 'anniversary_shown_' + milestone.days;
  if (card.dataset.shownMilestone === String(milestone.days)) {
    // Already showing this milestone, keep it visible
    return;
  }

  const iconEl = document.getElementById('anniversaryIcon');
  const titleEl = document.getElementById('anniversaryTitle');
  const messageEl = document.getElementById('anniversaryMessage');

  iconEl.textContent = milestone.icon;
  titleEl.textContent = milestone.title;
  messageEl.textContent = milestone.template.replace('{count}', entries.length);

  card.dataset.shownMilestone = String(milestone.days);
  card.hidden = false;
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = ''; });
}

// ---------------------------------------------------------------------------
// Emotion Vocabulary Growth Tracker
// ---------------------------------------------------------------------------

const VOCAB_MESSAGES = [
  { min: 1, max: 2, msg: '마음을 표현하기 시작했어요' },
  { min: 3, max: 4, msg: '감정의 언어가 넓어지고 있어요' },
  { min: 5, max: 7, msg: '다양한 마음을 인식하는 힘이 생겼어요' },
  { min: 8, max: 12, msg: '풍부한 감정 어휘를 가진 사람이에요' },
  { min: 13, max: 999, msg: '마음의 전문가! 섬세한 감정 인식 능력이에요' },
];

function updateEmotionVocab() {
  const card = document.getElementById('sidebarEmotionVocab');
  if (!card) return;

  const entries = state.allEntries || [];
  if (entries.length < 2 || state.guestMode) {
    card.hidden = true;
    return;
  }

  // Count unique emotions
  const emotionMap = {};
  entries.forEach(e => {
    if (e.emotion) {
      emotionMap[e.emotion] = (emotionMap[e.emotion] || 0) + 1;
    }
  });

  const uniqueEmotions = Object.keys(emotionMap);
  const count = uniqueEmotions.length;
  if (count < 2) {
    card.hidden = true;
    return;
  }

  // Number
  document.getElementById('emotionVocabCount').textContent = count;

  // Dot visualization — sorted by frequency
  const bar = document.getElementById('emotionVocabBar');
  const sorted = Object.entries(emotionMap).sort((a, b) => b[1] - a[1]);
  bar.innerHTML = sorted.map(([emotion, freq]) => {
    const color = emotionColor(emotion);
    return '<div class="emotion-vocab-dot" style="background:' + color + '" title="' +
      escapeHtml(emotion) + ' (' + freq + '회)"></div>';
  }).join('');

  // Message
  const msgObj = VOCAB_MESSAGES.find(m => count >= m.min && count <= m.max);
  document.getElementById('emotionVocabMessage').textContent = msgObj ? msgObj.msg : '';

  card.hidden = false;
}
