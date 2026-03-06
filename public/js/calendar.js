import { state } from './state.js';
import { emotionColor, escapeHtml } from './utils.js';

function buildCalEntryMap() {
  const entryMap = {};
  (state.allEntries || []).forEach(e => {
    const d = (e.date || e.created_at || '').slice(0, 10);
    if (!entryMap[d]) entryMap[d] = [];
    entryMap[d].push(e);
  });
  return entryMap;
}

export function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const titleEl = document.getElementById('calMonthTitle');
  const entriesDiv = document.getElementById('calDayEntries');
  const todayBtn = document.getElementById('calToday');
  entriesDiv.innerHTML = '';

  titleEl.textContent = `${state.calYear}년 ${state.calMonth + 1}월`;

  const now = new Date();
  const isCurrentMonth = state.calYear === now.getFullYear() && state.calMonth === now.getMonth();
  todayBtn.style.display = isCurrentMonth ? 'none' : 'inline-flex';

  const entryMap = buildCalEntryMap();

  const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  let html = weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entries = entryMap[dateStr];
    const isToday = dateStr === todayStr;
    const hasEntry = entries && entries.length > 0;
    const isSelected = dateStr === state.calSelectedDate;
    const classes = ['cal-day', 'clickable',
      isToday ? 'today' : '',
      hasEntry ? 'has-entry' : '',
      isSelected ? 'selected' : ''
    ].filter(Boolean).join(' ');

    const ariaLabel = hasEntry
      ? `${dateStr} 이야기 ${entries.length}건`
      : `${dateStr} 아직 이야기 없음`;

    html += `<div class="${classes}" data-date="${dateStr}" tabindex="0" role="button" aria-label="${ariaLabel}">
      <span>${d}</span>
      ${hasEntry ? '<span class="cal-dots">' + entries.slice(0, 3).map(en => '<span class="cal-dot" style="background:' + emotionColor(en.emotion) + '"></span>').join('') + '</span>' : ''}
    </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day.clickable').forEach(el => {
    const handler = () => {
      state.calSelectedDate = el.dataset.date;
      grid.querySelectorAll('.cal-day.selected').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      const dayEntries = entryMap[el.dataset.date] || [];
      showCalDayEntries(el.dataset.date, dayEntries);
    };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });

  renderMonthlySummary(entryMap, daysInMonth);

  if (state.calSelectedDate) {
    const selParts = state.calSelectedDate.split('-');
    if (parseInt(selParts[0]) === state.calYear && parseInt(selParts[1]) - 1 === state.calMonth) {
      const dayEntries = entryMap[state.calSelectedDate] || [];
      showCalDayEntries(state.calSelectedDate, dayEntries);
    } else {
      state.calSelectedDate = null;
    }
  }
}

function showCalDayEntries(dateStr, entries) {
  const div = document.getElementById('calDayEntries');
  const dateLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(dateStr + 'T00:00:00'));

  if (!entries || entries.length === 0) {
    div.innerHTML = `<div class="cal-day-entries">
      <div class="cal-day-entries-header">${dateLabel}</div>
      <p class="cal-no-entry">이 날의 마음을 적어보세요</p>
    </div>`;
    return;
  }

  div.innerHTML = '<div class="cal-day-entries">' +
    '<div class="cal-day-entries-header">' + dateLabel + ' <span class="cal-day-count">' + entries.length + '건</span></div>' +
    entries.map(e =>
      '<div class="cal-entry-card">' +
        '<p class="cal-entry-text">' + escapeHtml(e.text) + '</p>' +
        '<div class="cal-entry-meta">' +
          '<span>' + escapeHtml(e.emoji || '') + '</span>' +
          '<span class="cal-entry-emotion">' + escapeHtml(e.emotion || '') + '</span>' +
        '</div>' +
        (e.message ? '<p class="cal-entry-message">' + escapeHtml(e.message) + '</p>' : '') +
      '</div>'
    ).join('') +
  '</div>';
}

function renderMonthlySummary(entryMap, daysInMonth) {
  const container = document.getElementById('calMonthlySummary');
  if (!container) return;

  let totalEntries = 0;
  let daysWithEntries = 0;
  const emotionCount = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entries = entryMap[dateStr];
    if (entries && entries.length > 0) {
      daysWithEntries++;
      totalEntries += entries.length;
      entries.forEach(e => {
        if (e.emotion) emotionCount[e.emotion] = (emotionCount[e.emotion] || 0) + 1;
      });
    }
  }

  if (totalEntries === 0) {
    container.innerHTML = '<p class="sidebar-empty">이 달의 첫 이야기를 들려주세요</p>';
    return;
  }

  const topEmotion = Object.entries(emotionCount).sort((a, b) => b[1] - a[1])[0];
  container.innerHTML =
    '<div class="cal-summary-stats">' +
      '<div class="cal-summary-stat"><span class="cal-summary-num">' + totalEntries + '</span><span class="cal-summary-label">나눈 이야기</span></div>' +
      '<div class="cal-summary-stat"><span class="cal-summary-num">' + daysWithEntries + '</span><span class="cal-summary-label">마음을 꺼낸 날</span></div>' +
      (topEmotion ? '<div class="cal-summary-stat"><span class="cal-summary-num">' + escapeHtml(topEmotion[0]) + '</span><span class="cal-summary-label">가장 많이 찾아온 마음</span></div>' : '') +
    '</div>';
}

export function setupCalendar() {
  document.getElementById('calPrev').addEventListener('click', () => {
    state.calMonth--;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    state.calSelectedDate = null;
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    state.calMonth++;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    state.calSelectedDate = null;
    renderCalendar();
  });
  document.getElementById('calToday').addEventListener('click', () => {
    const now = new Date();
    state.calYear = now.getFullYear();
    state.calMonth = now.getMonth();
    state.calSelectedDate = now.toISOString().slice(0, 10);
    renderCalendar();
  });
}
