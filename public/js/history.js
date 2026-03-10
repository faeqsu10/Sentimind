import { state, PAGE_SIZE } from './state.js';
import { escapeHtml, emotionColor, getEmotionGroup, debounce, openModalFocus, closeModalFocus, showToast } from './utils.js';
import { toggleBookmarkAPI, deleteEntryAPI } from './api.js';

// Dependencies injected from app.js
let deps = {};
export function setupHistory(d) { deps = d; }

// ===== Select Mode =====
const selectedIds = new Set();

// 이벤트 위임: historyList에 한 번만 리스너 등록 (renderHistoryList 호출 시마다 등록 방지)
let _historyListenerAttached = false;
function ensureHistoryListListener() {
  if (_historyListenerAttached) return;
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  // 키보드 접근성: role="button" 요소에 Enter/Space 지원
  historyList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = e.target.closest('.btn-bookmark, .history-item-inner');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });

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

    const isSelected = selectedIds.has(entry.id);
    return '<li class="history-item' + (isSelected ? ' selected' : '') + '" data-emotion-group="' + emotionGroup + '" data-entry-id="' + entry.id + '" style="animation-delay:' + (idx * 30) + 'ms">' +
      '<input type="checkbox" class="select-check" data-id="' + entry.id + '"' + (isSelected ? ' checked' : '') + ' aria-label="선택">' +
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
        const item = historyList.querySelector(`[data-id="${CSS.escape(entry.id)}"]`)?.closest('.history-item');
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

function updateSelectUI() {
  const count = selectedIds.size;
  document.getElementById('selectedCount').textContent = count + '개 선택';
  document.getElementById('selectDeleteBtn').disabled = count === 0;
  const visibleIds = state.filteredEntries.slice(0, state.currentPage * PAGE_SIZE).map(e => e.id);
  const allChecked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  document.getElementById('selectAllCheck').checked = allChecked;
}

function exitSelectMode() {
  selectedIds.clear();
  const historySection = document.querySelector('.diary-history');
  historySection.classList.remove('select-mode');
  document.getElementById('selectModeBtn').classList.remove('active');
  document.getElementById('selectToolbar').hidden = true;
  document.querySelectorAll('.history-item.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.select-check').forEach(el => { el.checked = false; });
}

export function initHistoryEventListeners() {
  const historySearch = document.getElementById('historySearch');
  historySearch.addEventListener('input', debounce(applyFilters, 300));

  // 선택 모드 (null 체크 — SW 캐시 전환 시 old HTML과의 호환)
  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectCancelBtn = document.getElementById('selectCancelBtn');
  const selectAllCheck = document.getElementById('selectAllCheck');
  const selectDeleteBtn = document.getElementById('selectDeleteBtn');
  const historyList = document.getElementById('historyList');

  if (!selectModeBtn || !selectCancelBtn || !selectAllCheck || !selectDeleteBtn) return;

  // 선택 모드 토글
  selectModeBtn.addEventListener('click', () => {
    const historySection = document.querySelector('.diary-history');
    const isActive = historySection.classList.toggle('select-mode');
    selectModeBtn.classList.toggle('active', isActive);
    document.getElementById('selectToolbar').hidden = !isActive;
    if (!isActive) exitSelectMode();
  });

  // 취소 버튼
  selectCancelBtn.addEventListener('click', exitSelectMode);

  // 전체 선택
  selectAllCheck.addEventListener('change', (e) => {
    const visibleIds = state.filteredEntries.slice(0, state.currentPage * PAGE_SIZE).map(en => en.id);
    if (e.target.checked) {
      visibleIds.forEach(id => selectedIds.add(id));
    } else {
      visibleIds.forEach(id => selectedIds.delete(id));
    }
    document.querySelectorAll('.select-check').forEach(cb => { cb.checked = e.target.checked; });
    document.querySelectorAll('.history-item').forEach(el => {
      el.classList.toggle('selected', e.target.checked);
    });
    updateSelectUI();
  });

  // 개별 체크박스 (이벤트 위임)
  historyList.addEventListener('change', (e) => {
    const cb = e.target.closest('.select-check');
    if (!cb) return;
    const id = cb.dataset.id;
    const item = cb.closest('.history-item');
    if (cb.checked) {
      selectedIds.add(id);
      item.classList.add('selected');
    } else {
      selectedIds.delete(id);
      item.classList.remove('selected');
    }
    updateSelectUI();
  });

  // 선택 삭제
  selectDeleteBtn.addEventListener('click', async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(count + '개의 이야기를 삭제할까요?')) return;
    const btn = document.getElementById('selectDeleteBtn');
    btn.disabled = true;
    btn.textContent = '삭제 중...';
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map(id => deleteEntryAPI(id)));
      showToast(count + '개의 이야기가 삭제되었어요.');
      exitSelectMode();
      await deps.loadEntries();
    } catch {
      showToast('일부 삭제에 실패했습니다. 다시 시도해주세요.', 'error');
      await deps.loadEntries();
      exitSelectMode();
    } finally {
      btn.textContent = '삭제';
    }
  });
}
