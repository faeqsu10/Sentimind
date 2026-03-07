import { state, PAGE_SIZE } from './state.js';
import { escapeHtml, emotionColor, getEmotionGroup, debounce, openModalFocus, closeModalFocus } from './utils.js';
import { toggleBookmarkAPI, deleteEntryAPI } from './api.js';

// Dependencies injected from app.js
let deps = {};
export function setupHistory(d) { deps = d; }

// 이벤트 위임: historyList에 한 번만 리스너 등록 (renderHistoryList 호출 시마다 등록 방지)
let _historyListenerAttached = false;
function ensureHistoryListListener() {
  if (_historyListenerAttached) return;
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  historyList.addEventListener('click', async (e) => {
    // 북마크 버튼
    const bookmarkBtn = e.target.closest('.btn-bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      const id = bookmarkBtn.dataset.id;
      const entry = state.filteredEntries.find(en => en.id === id);
      if (!entry) return;
      try {
        const newState = !entry.is_bookmarked;
        await toggleBookmarkAPI(entry.id, newState);
        entry.is_bookmarked = newState;
        // state.allEntries의 원본도 동기화
        const original = state.allEntries.find(en => en.id === id);
        if (original) original.is_bookmarked = newState;
        bookmarkBtn.classList.toggle('active', newState);
        bookmarkBtn.textContent = newState ? '★' : '☆';
      } catch {
        const { showError } = await import('./utils.js');
        showError('즐겨찾기 변경에 실패했습니다.');
      }
      return;
    }

    // 히스토리 항목 내부 버튼
    const itemInner = e.target.closest('.history-item-inner');
    if (itemInner) {
      const idx = parseInt(itemInner.dataset.idx);
      showHistoryDetail(state.filteredEntries[idx]);
    }
  });

  _historyListenerAttached = true;
}

export function renderHistory(entries) {
  state.allEntries = entries;
  state.currentPage = 1;
  state.filteredEntries = entries;
  buildFilterChips(entries);
  applyFilters();
}

function buildFilterChips(entries) {
  const filterChips = document.getElementById('filterChips');
  const emotions = new Set();
  entries.forEach(e => { if (e.emotion) emotions.add(e.emotion); });

  filterChips.innerHTML = '';
  const sorted = [...emotions].sort();
  sorted.forEach(emotion => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-pressed', state.activeFilters.has(emotion) ? 'true' : 'false');
    btn.textContent = emotion;
    btn.addEventListener('click', () => {
      if (state.activeFilters.has(emotion)) {
        state.activeFilters.delete(emotion);
        btn.setAttribute('aria-pressed', 'false');
      } else {
        state.activeFilters.add(emotion);
        btn.setAttribute('aria-pressed', 'true');
      }
      applyFilters();
    });
    filterChips.appendChild(btn);
  });
}

export function applyFilters() {
  state.currentPage = 1;
  const historySearch = document.getElementById('historySearch');
  const filterResultCount = document.getElementById('filterResultCount');

  const query = historySearch.value.trim().toLowerCase();
  let filtered = state.allEntries;

  if (query) {
    filtered = filtered.filter(e => e.text.toLowerCase().includes(query));
  }

  if (state.activeFilters.size > 0) {
    filtered = filtered.filter(e => state.activeFilters.has(e.emotion));
  }

  state.filteredEntries = filtered;
  renderHistoryList(filtered);

  const isFiltering = query || state.activeFilters.size > 0;
  if (isFiltering) {
    filterResultCount.textContent = filtered.length + '건의 이야기를 찾았어요.';
    filterResultCount.hidden = false;
  } else {
    filterResultCount.hidden = true;
  }
}

export function renderHistoryList(entries) {
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');

  if (!entries || entries.length === 0) {
    historyList.innerHTML = '';
    emptyState.hidden = false;
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  emptyState.hidden = true;
  const paginated = entries.slice(0, state.currentPage * PAGE_SIZE);
  const hasMore = entries.length > paginated.length;

  historyList.innerHTML = paginated.map((entry, idx) => {
    const emotionGroup = getEmotionGroup(entry.emotion);
    const date = entry.date
      ? new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(entry.date))
      : '';
    const time = entry.date
      ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.date))
      : '';
    const color = emotionColor(entry.emotion);
    const bookmarked = entry.is_bookmarked;

    return '<li class="history-item" data-emotion-group="' + emotionGroup + '" style="animation-delay:' + (idx * 30) + 'ms">' +
      '<button class="history-item-inner" aria-label="' + escapeHtml(entry.text) + ' 상세보기" data-idx="' + idx + '">' +
        '<div class="history-emoji" aria-hidden="true">' + escapeHtml(entry.emoji || '') + '</div>' +
        '<div class="history-content">' +
          '<p class="history-text">' + escapeHtml(entry.text) + '</p>' +
          '<div class="history-meta">' +
            '<span class="history-emotion">' + escapeHtml(entry.emotion || '') + '</span>' +
            '<span class="history-date">' + date + ' ' + time + '</span>' +
          '</div>' +
        '</div>' +
      '</button>' +
      '<span class="btn-bookmark' + (bookmarked ? ' active' : '') + '" role="button" tabindex="0" data-id="' + entry.id + '" aria-label="즐겨찾기" title="즐겨찾기">' +
        (bookmarked ? '★' : '☆') +
      '</span>' +
    '</li>';
  }).join('');

  // Load more button
  let loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!loadMoreBtn) {
    loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'loadMoreBtn';
    loadMoreBtn.className = 'btn-load-more';
    loadMoreBtn.textContent = '더 보기';
    historyList.parentNode.appendChild(loadMoreBtn);
  }
  loadMoreBtn.hidden = !hasMore;
  loadMoreBtn.onclick = () => {
    state.currentPage++;
    renderHistoryList(state.filteredEntries);
  };

  // 이벤트 위임 리스너 (최초 1회만 등록)
  ensureHistoryListListener();
}

export function showHistoryDetail(entry) {
  const historyDetail = document.getElementById('historyDetail');
  if (!entry) return;

  historyDetail.dataset.activeId = entry.id;

  const dateStr = entry.date
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.date))
    : '';

  document.getElementById('detailDate').textContent = dateStr;
  document.getElementById('detailEmoji').textContent = entry.emoji || '';
  document.getElementById('detailEmotion').textContent = entry.emotion || '';
  document.getElementById('detailText').textContent = entry.text || '';
  document.getElementById('detailMessage').textContent = entry.message || '';
  document.getElementById('detailAdvice').textContent = entry.advice || '';

  historyDetail.hidden = false;
  const modal = historyDetail.querySelector('.history-detail-content');
  openModalFocus(historyDetail, modal);

  // Close button
  const closeBtn = document.getElementById('detailClose');
  closeBtn.onclick = () => {
    historyDetail.hidden = true;
    closeModalFocus(historyDetail, modal);
  };

  // Overlay click to close
  historyDetail.onclick = (e) => {
    if (e.target === historyDetail) {
      historyDetail.hidden = true;
      closeModalFocus(historyDetail, modal);
    }
  };

  // Delete button
  const deleteBtn = document.getElementById('detailDelete');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm('이 이야기를 지울까요?')) return;
      try {
        await deleteEntryAPI(entry.id);
        const historyList = document.getElementById('historyList');
        const item = historyList.querySelector(`[data-id="${entry.id}"]`)?.closest('.history-item');
        if (item) {
          item.classList.add('deleting');
          await new Promise(r => setTimeout(r, 300));
        }
        await deps.loadEntries();
        historyDetail.hidden = true;
        closeModalFocus(historyDetail, modal);
      } catch {
        const { showError } = await import('./utils.js');
        showError('삭제에 실패했습니다.');
      }
    };
  }
}

export function initHistoryEventListeners() {
  const historySearch = document.getElementById('historySearch');
  historySearch.addEventListener('input', debounce(applyFilters, 300));
}
