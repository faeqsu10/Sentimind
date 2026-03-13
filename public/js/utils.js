// Pure utilities — no dependencies on other app modules
import { state } from './state.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * DB에 텍스트로 저장된 이모지 값(예: "perplexed")을 안전하게 처리.
 * 실제 이모지/한글이 아닌 영문 텍스트면 폴백 이모지를 반환한다.
 */
export function safeEmoji(emoji, fallback = '\uD83D\uDCAD') {
  if (!emoji || typeof emoji !== 'string') return fallback;
  const trimmed = emoji.trim();
  if (!trimmed) return fallback;
  // 순수 ASCII 영문자로만 이뤄진 경우 (깨진 텍스트)
  if (/^[a-zA-Z_\s-]+$/.test(trimmed)) return fallback;
  return escapeHtml(trimmed);
}

export function emotionColor(emotion) {
  const e = (emotion || '').trim();
  const map = {
    '기쁨':'#F4A261','감사':'#E9C46A','설렘':'#FFB347','행복':'#F4A261',
    '만족감':'#E9C46A','만족':'#E9C46A','유쾌함':'#FFB347','유쾌':'#FFB347',
    '슬픔':'#7EB8DA','외로움':'#7EB8DA','그리움':'#7EB8DA','우울':'#7EB8DA',
    '분노':'#E76F51','짜증':'#E76F51','억울함':'#E76F51','화남':'#E76F51',
    '불안':'#9C89B8','걱정':'#9C89B8','두려움':'#9C89B8','긴장':'#9C89B8',
    '평온':'#A8DAAB','편안함':'#A8DAAB','안도':'#A8DAAB','여유':'#A8DAAB',
    '사랑':'#F2A0A0','애정':'#F2A0A0',
    '피곤':'#B0A89A','지침':'#B0A89A','무기력':'#B0A89A',
    '피로감':'#B0A89A','무기력함':'#B0A89A',
    '놀라움':'#70C1B3','신기함':'#70C1B3','당황':'#DDA0DD',
    '후회':'#8B9DC3','죄책감':'#8B9DC3','부끄러움':'#DDA0DD',
    '희망':'#87CEEB','기대':'#87CEEB',
  };
  return map[e] || 'var(--color-primary)';
}

export function emotionScore(emotion) {
  const e = (emotion || '').trim();
  const positive = [
    '기쁨','감사','사랑','설렘','행복','애정','만족감','유쾌함','즐거움',
    '성취감','자신감','희망','뿌듯함','흥분','열정','감동','몰입감','상쾌함',
    '활력','자부심','환희','반가움','든든함','벅찬','황홀','신남',
  ];
  const neutral = [
    '평온','편안함','안도','여유','고요','담담','무난','차분','놀라움',
    '호기심','궁금함','생각에 잠김','복합적',
  ];
  const negative = [
    '슬픔','분노','불안','두려움','외로움','우울','짜증','걱정','긴장',
    '억울함','화남','그리움','무기력','피곤','지침','후회','실망','좌절',
    '피로감','공허','질투','혐오','수치심','죄책감','답답함','서운함',
  ];
  if (positive.some(p => e.includes(p))) return 1;
  if (neutral.some(n => e.includes(n)))  return 0;
  if (negative.some(n => e.includes(n))) return -1;
  // 알 수 없는 감정은 중립으로 (기존: -1로 분류하여 왜곡 발생)
  return 0;
}

export function getEmotionGroup(emotion) {
  const e = (emotion || '').trim();
  const groups = {
    joy: ['기쁨','감사','설렘','행복','만족감','유쾌함','즐거움','성취감','뿌듯함','자신감','희망','몰입감','상쾌함','활력','자부심','감동','열정','흥분','신남','반가움','든든함','벅찬','환희','황홀'],
    sadness: ['슬픔','외로움','그리움','우울','공허','실망','좌절','서운함'],
    anger: ['분노','짜증','억울함','화남','답답함','혐오'],
    anxiety: ['불안','걱정','두려움','긴장','후회','수치심','죄책감'],
    peace: ['평온','편안함','안도','여유','고요','담담','차분'],
    love: ['사랑','애정'],
    tired: ['피곤','지침','무기력','피로감'],
  };
  for (const [group, keywords] of Object.entries(groups)) {
    if (keywords.some(k => e.includes(k))) return group;
  }
  return 'default';
}

export function debounce(fn, ms) {
  let timer;
  return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordStrength(password) {
  if (!password) return '';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return 'weak';
  if (score <= 2) return 'fair';
  if (score <= 3) return 'good';
  return 'strong';
}

// ===== Local Date Helpers (timezone-safe) =====
/**
 * UTC ISO 문자열을 사용자 로컬 타임존 기준 YYYY-MM-DD로 변환.
 * `.split('T')[0]`은 UTC 날짜를 반환하므로 KST 등 UTC+ 시간대에서
 * 자정 전후 기록이 전날로 잡히는 문제를 해결한다.
 */
export function toLocalDateStr(dateOrStr) {
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function todayLocalStr() {
  return toLocalDateStr(new Date());
}

// ===== Toast Notification System =====
const toastContainer = document.getElementById('toastContainer');

export function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  toastContainer.appendChild(toast);

  const dismissTimer = setTimeout(() => dismissToast(toast), 3000);

  toast.addEventListener('click', () => {
    clearTimeout(dismissTimer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('toast-dismissing');
  toast.addEventListener('animationend', () => {
    toast.remove();
  }, { once: true });
}

export function showError(msg) {
  showToast(msg, 'error');
}

// ===== Focus Trap Utility =====
export function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]):not([hidden]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.closest('[hidden]') && el.offsetParent !== null);
}

export function trapFocus(container) {
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  function handleTrapKeydown(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container._trapHandler = handleTrapKeydown;
  container.addEventListener('keydown', handleTrapKeydown);
}

export function releaseFocusTrap(container) {
  if (container._trapHandler) {
    container.removeEventListener('keydown', container._trapHandler);
    delete container._trapHandler;
  }
}

export function openModalFocus(modalOverlay, modalContent) {
  state.lastFocusedElement = document.activeElement;
  document.body.classList.add('focus-trap-active');

  trapFocus(modalContent || modalOverlay);

  requestAnimationFrame(() => {
    const focusables = getFocusableElements(modalContent || modalOverlay);
    if (focusables.length > 0) focusables[0].focus();
  });
}

export function closeModalFocus(modalOverlay, modalContent) {
  releaseFocusTrap(modalContent || modalOverlay);
  document.body.classList.remove('focus-trap-active');

  if (state.lastFocusedElement && state.lastFocusedElement.focus) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

// ===== Skeleton UI =====
export function showSkeleton(type) {
  if (type === 'analyze') {
    const el = document.getElementById('analyzeSkeleton');
    if (el) {
      el.hidden = false;
      document.getElementById('responseLoading').hidden = true;
    }
  } else if (type === 'entries') {
    const entrySkeletonHTML = Array(3).fill(0).map((_, i) =>
      '<li class="history-item" style="animation-delay:' + (i * 80) + 'ms">' +
        '<div class="skeleton-entry">' +
          '<div class="skeleton skeleton-avatar"></div>' +
          '<div class="skeleton-body">' +
            '<div class="skeleton skeleton-body-line"></div>' +
            '<div class="skeleton skeleton-body-line"></div>' +
          '</div>' +
        '</div>' +
      '</li>'
    ).join('');
    document.getElementById('historyList').innerHTML = entrySkeletonHTML;
  } else if (type === 'stats') {
    const summaryEl = document.getElementById('dashboardSummary');
    const emotionsChart = document.getElementById('topEmotionsChart');
    const situationsChart = document.getElementById('topSituationsChart');
    const recentList = document.getElementById('recentEntriesList');

    if (summaryEl) {
      summaryEl.innerHTML =
        '<div class="skeleton-stats-grid">' +
          '<div class="skeleton-stats-card"><div class="skeleton skeleton-value"></div><div class="skeleton skeleton-label"></div></div>' +
          '<div class="skeleton-stats-card"><div class="skeleton skeleton-value"></div><div class="skeleton skeleton-label"></div></div>' +
          '<div class="skeleton-stats-card"><div class="skeleton skeleton-value"></div><div class="skeleton skeleton-label"></div></div>' +
        '</div>';
    }
    var barSkeleton =
      '<div class="skeleton-bar-group">' +
        '<div class="skeleton-bar-row"><div class="skeleton skeleton-bar-label"></div><div class="skeleton skeleton-bar-track"></div></div>' +
        '<div class="skeleton-bar-row"><div class="skeleton skeleton-bar-label"></div><div class="skeleton skeleton-bar-track"></div></div>' +
        '<div class="skeleton-bar-row"><div class="skeleton skeleton-bar-label"></div><div class="skeleton skeleton-bar-track"></div></div>' +
        '<div class="skeleton-bar-row"><div class="skeleton skeleton-bar-label"></div><div class="skeleton skeleton-bar-track"></div></div>' +
      '</div>';
    if (emotionsChart) emotionsChart.innerHTML = barSkeleton;
    if (situationsChart) situationsChart.innerHTML = barSkeleton;
    if (recentList) {
      recentList.innerHTML = Array(3).fill(
        '<div class="skeleton-entry" style="margin-bottom:0.5rem;">' +
          '<div class="skeleton skeleton-avatar"></div>' +
          '<div class="skeleton-body">' +
            '<div class="skeleton skeleton-body-line"></div>' +
            '<div class="skeleton skeleton-body-line"></div>' +
          '</div>' +
        '</div>'
      ).join('');
    }
  }
}

// ===== Streak Calculator =====
/**
 * 주어진 entries 배열로 현재 연속 기록(스트릭) 일수를 계산한다.
 * 오늘 기록이 없으면 어제부터 거슬러 올라간다.
 * @param {Array} entries - { date: string } 형태의 항목 배열
 * @returns {number} 연속 기록 일수
 */
export function calculateStreak(entries) {
  const dateSet = new Set();
  (entries || []).forEach(e => { if (e.date) dateSet.add(toLocalDateStr(e.date)); });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);

  const todayStr = toLocalDateStr(checkDate);
  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const ds = toLocalDateStr(checkDate);
    if (dateSet.has(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function hideSkeleton(type) {
  if (type === 'analyze') {
    const el = document.getElementById('analyzeSkeleton');
    if (el) el.hidden = true;
    document.getElementById('responseLoading').hidden = true;
  } else if (type === 'stats') {
    // Clear skeleton placeholders from stats elements
    const ids = ['topEmotionsChart', 'topSituationsChart', 'recentEntriesList'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.querySelector('.skeleton')) el.innerHTML = '';
    });
  }
}
