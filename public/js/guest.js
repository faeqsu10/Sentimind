import { state, GUEST_STORAGE_KEY, GUEST_MAX_ENTRIES, GUEST_MAX_DAYS } from './state.js';
import { escapeHtml, showError } from './utils.js';
import { fetchWithAuth, analyzeEmotion } from './api.js';

// Dependencies injected from app.js
let deps = {};
export function setupGuest(d) { deps = d; }

export function loadGuestEntries() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    const cutoff = Date.now() - GUEST_MAX_DAYS * 24 * 60 * 60 * 1000;
    return entries.filter(e => e.timestamp > cutoff);
  } catch { return []; }
}

export function saveGuestEntries(entries) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(entries.slice(0, GUEST_MAX_ENTRIES)));
  } catch { /* quota exceeded */ }
}

export function clearGuestData() {
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

export function getGuestRemaining() {
  return Math.max(0, GUEST_MAX_ENTRIES - loadGuestEntries().length);
}

export function initDemoScreen() {
  const entries = loadGuestEntries();
  updateDemoCounter();
  renderDemoHistory(entries);
  document.getElementById('demoResponse').hidden = true;
  document.getElementById('demoSkeleton').hidden = true;
  const textarea = document.getElementById('demoTextarea');
  textarea.value = '';
  document.getElementById('demoCharCount').textContent = '';
  document.getElementById('demoAnalyzeBtn').disabled = true;
}

function updateDemoCounter() {
  const remaining = getGuestRemaining();
  document.getElementById('demoCounterNum').textContent = remaining;
}

function renderDemoHistory(entries) {
  const container = document.getElementById('demoHistory');
  const list = document.getElementById('demoHistoryList');
  if (!entries.length) { container.hidden = true; return; }
  container.hidden = false;
  list.innerHTML = entries.map(e => {
    const dateStr = new Date(e.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    return `<li class="demo-history-item">
      <span class="demo-history-emoji">${escapeHtml(e.emoji || '📝')}</span>
      <span class="demo-history-text">${escapeHtml(e.text)}</span>
      <span class="demo-history-date">${dateStr}</span>
    </li>`;
  }).reverse().join('');
}

async function analyzeDemo(text) {
  const remaining = getGuestRemaining();
  if (remaining <= 0) {
    showSignupModal('limit');
    return;
  }

  const analyzeBtn = document.getElementById('demoAnalyzeBtn');
  const skeleton = document.getElementById('demoSkeleton');
  const response = document.getElementById('demoResponse');

  analyzeBtn.disabled = true;
  response.hidden = true;
  skeleton.hidden = false;

  try {
    const result = await analyzeEmotion(text);
    document.getElementById('demoResponseEmoji').textContent = result.emoji;
    document.getElementById('demoResponseEmotion').textContent = result.emotion;
    document.getElementById('demoResponseMessage').textContent = result.message;
    document.getElementById('demoResponseAdvice').textContent = result.advice;
    response.hidden = false;

    const entries = loadGuestEntries();
    entries.push({
      text,
      emotion: result.emotion,
      emoji: result.emoji,
      message: result.message,
      timestamp: Date.now(),
    });
    saveGuestEntries(entries);
    renderDemoHistory(entries);
    updateDemoCounter();

    document.getElementById('demoTextarea').value = '';
    document.getElementById('demoCharCount').textContent = '';
    analyzeBtn.disabled = true;

    // Check if should show nudge
    const used = GUEST_MAX_ENTRIES - getGuestRemaining();
    if (used === 3) {
      setTimeout(() => showSignupModal('nudge'), 1500);
    }
  } catch (err) {
    showError(err.userMessage || '분석 중 오류가 발생했습니다.');
  } finally {
    skeleton.hidden = true;
    const textarea = document.getElementById('demoTextarea');
    analyzeBtn.disabled = textarea.value.trim().length === 0;
  }
}

export function showSignupModal(reason) {
  const overlay = document.getElementById('signupModalOverlay');
  const title = document.getElementById('signupModalTitle');
  const desc = document.getElementById('signupModalDesc');
  if (reason === 'limit') {
    title.textContent = '체험 횟수를 모두 사용했어요';
    desc.innerHTML = '무료 회원가입을 하면 일기를 무제한으로 쓰고,<br>감정 통계와 리포트까지 받아볼 수 있어요.';
  } else {
    title.textContent = '체험이 마음에 드셨나요?';
    desc.innerHTML = '회원가입하면 일기를 무제한으로 저장하고,<br>감정 통계와 리포트까지 받아볼 수 있어요.';
  }
  overlay.hidden = false;
  document.getElementById('signupModalSignupBtn').focus();
}

function hideSignupModal() {
  document.getElementById('signupModalOverlay').hidden = true;
}

export async function migrateGuestData() {
  const entries = loadGuestEntries();
  if (!entries.length) return;
  try {
    const res = await fetchWithAuth('/api/migrate/from-guest', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    });
    if (res.ok) {
      const result = await res.json();
      clearGuestData();
      if (result.imported > 0) {
        showError(`체험 일기 ${result.imported}건이 저장되었습니다.`);
      }
    }
  } catch {
    // Migration failed silently
  }
}

export function initDemoEventListeners() {
  // Demo textarea input
  const textarea = document.getElementById('demoTextarea');
  const analyzeBtn = document.getElementById('demoAnalyzeBtn');

  textarea.addEventListener('input', () => {
    analyzeBtn.disabled = textarea.value.trim().length === 0;
    const len = textarea.value.length;
    const max = parseInt(textarea.getAttribute('maxlength'), 10);
    const counter = document.getElementById('demoCharCount');
    counter.textContent = len > 0 ? len + '/' + max : '';
    counter.className = 'char-count' + (len >= max - 20 ? ' warn' : '');
  });

  // Demo analyze button (no form, direct click)
  analyzeBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (text) analyzeDemo(text);
  });

  // Signup modal events
  document.getElementById('signupModalClose').addEventListener('click', hideSignupModal);
  document.getElementById('signupModalLaterBtn').addEventListener('click', hideSignupModal);
  document.getElementById('signupModalSignupBtn').addEventListener('click', () => {
    hideSignupModal();
    deps.showAuthScreen();
    deps.showAuthCard('signup');
  });
  document.getElementById('signupModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideSignupModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('signupModalOverlay').hidden) {
      hideSignupModal();
    }
  });

  // Sample card clicks (demo-sample-card class, data-sample attribute)
  document.querySelectorAll('.demo-sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const text = card.dataset.sample;
      if (text) {
        textarea.value = text;
        analyzeBtn.disabled = false;
        textarea.focus();
      }
    });
  });

  // Demo signup CTA
  const demoSignupBtn = document.getElementById('demoSignupBtn');
  if (demoSignupBtn) {
    demoSignupBtn.addEventListener('click', () => {
      deps.showAuthScreen();
      deps.showAuthCard('signup');
    });
  }

  // Demo login button
  const demoLoginBtn = document.getElementById('demoLoginBtn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', () => {
      deps.showAuthScreen();
      deps.showAuthCard('login');
    });
  }
}
