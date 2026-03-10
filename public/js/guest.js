import { state, GUEST_STORAGE_KEY, GUEST_MAX_ENTRIES, GUEST_MAX_DAYS, DOMAIN_EMOJI } from './state.js';
import { escapeHtml, showError, getEmotionGroup, openModalFocus, closeModalFocus } from './utils.js';
import { fetchWithAuth, analyzeEmotion, fetchFollowup } from './api.js';
import { track } from './analytics.js';

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

  // Reset followup
  const followup = document.getElementById('demoFollowup');
  if (followup) followup.hidden = true;
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

  // Hide previous followup
  const followupEl = document.getElementById('demoFollowup');
  if (followupEl) followupEl.hidden = true;

  try {
    const result = await analyzeEmotion(text);
    document.getElementById('demoResponseEmoji').textContent = result.emoji;
    document.getElementById('demoResponseEmotion').textContent = '지금 느끼고 있는 ' + result.emotion;
    document.getElementById('demoResponseMessage').textContent = result.message;
    document.getElementById('demoResponseAdvice').textContent = result.advice;
    response.hidden = false;

    // Ontology details
    renderDemoOntology(result);

    // Emotion theme + visual effects
    const emotionGroup = getEmotionGroup(result.emotion);
    document.documentElement.setAttribute('data-emotion-theme', emotionGroup);
    if (deps.createConfetti) deps.createConfetti(result.emotion);

    // Scroll to response
    setTimeout(() => response.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

    // Save entry
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

    // Start followup conversation
    initDemoFollowup(result.emotion, text);

    // Check if should show nudge (5회로 변경 — 가치 충분히 체험 후)
    const used = GUEST_MAX_ENTRIES - getGuestRemaining();
    if (used === 5) {
      setTimeout(() => showSignupModal('nudge'), 2000);
    }
  } catch (err) {
    showError(err.userMessage || '마음을 읽는 중에 문제가 생겼어요. 잠시 후 다시 이야기해주세요.');
  } finally {
    skeleton.hidden = true;
    const textarea = document.getElementById('demoTextarea');
    analyzeBtn.disabled = textarea.value.trim().length === 0;
  }
}

// ---------------------------------------------------------------------------
// Demo Ontology Rendering
// ---------------------------------------------------------------------------

function renderDemoOntology(result) {
  const details = document.getElementById('demoAnalysisDetails');
  if (!details || !result.ontology) {
    if (details) details.hidden = true;
    return;
  }

  // Emotion hierarchy
  const hierarchy = document.getElementById('demoEmotionHierarchy');
  if (hierarchy && result.ontology.emotion_hierarchy) {
    const h = result.ontology.emotion_hierarchy;
    const levels = [h.level1, h.level2, h.level3].filter(Boolean);
    hierarchy.innerHTML = levels.map((level, idx) =>
      (idx > 0 ? '<span class="hierarchy-arrow" aria-hidden="true">\u2193</span>' : '') +
      '<span class="hierarchy-level">' + escapeHtml(level) + '</span>'
    ).join('');
  }

  // Situation tags
  const sitTags = document.getElementById('demoSituationTags');
  if (sitTags && result.ontology.situation_context) {
    sitTags.innerHTML = result.ontology.situation_context.map(ctx => {
      const emoji = DOMAIN_EMOJI[ctx.domain] || DOMAIN_EMOJI['\uAE30\uD0C0'] || '📌';
      return '<span class="situation-tag">' +
        '<span class="situation-tag-emoji" aria-hidden="true">' + emoji + '</span>' +
        escapeHtml(ctx.domain + ' / ' + ctx.context) +
      '</span>';
    }).join('');
  }

  // Confidence badge
  const confBadge = document.getElementById('demoConfidenceBadge');
  if (confBadge && result.ontology.confidence !== undefined) {
    const pct = result.ontology.confidence || 0;
    document.getElementById('demoConfidencePercent').textContent = pct + '%';
    const fill = document.getElementById('demoConfidenceFill');
    fill.style.width = '0%';
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
    let level = 'mid';
    if (pct >= 70) level = 'high';
    else if (pct < 40) level = 'low';
    fill.setAttribute('data-level', level);
    confBadge.hidden = false;
  }

  details.hidden = false;
  details.removeAttribute('open');
}

// ---------------------------------------------------------------------------
// Demo Follow-up Conversation (탐색→통찰→행동 3단계)
// ---------------------------------------------------------------------------

const FOLLOWUP_STAGES = ['explore', 'insight', 'action'];
const FOLLOWUP_LABELS = { explore: '탐색', insight: '통찰', action: '행동' };

let _demoFollowupState = null;

function initDemoFollowup(emotion, originalText) {
  const section = document.getElementById('demoFollowup');
  const messages = document.getElementById('demoFollowupMessages');
  if (!section || !messages) return;

  _demoFollowupState = {
    emotion,
    originalText,
    currentStageIdx: 0,
    context: [],
    completed: false,
  };

  messages.innerHTML = '';
  const input = document.getElementById('demoFollowupInput');
  const sendBtn = document.getElementById('demoFollowupSend');
  if (input) input.value = '';
  if (sendBtn) sendBtn.disabled = true;
  const inputRow = document.getElementById('demoFollowupInputRow');
  if (inputRow) inputRow.hidden = false;

  section.hidden = false;
  updateDemoFollowupStages();
  requestDemoFollowup();
}

function updateDemoFollowupStages() {
  if (!_demoFollowupState) return;
  const stage = FOLLOWUP_STAGES[_demoFollowupState.currentStageIdx];
  const label = document.getElementById('demoFollowupStageLabel');
  if (label) label.textContent = FOLLOWUP_LABELS[stage] || '';

  document.querySelectorAll('#demoFollowup .followup-stage-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i <= _demoFollowupState.currentStageIdx);
    dot.classList.toggle('completed', i < _demoFollowupState.currentStageIdx);
  });
}

async function requestDemoFollowup(userReply) {
  if (!_demoFollowupState || _demoFollowupState.completed) return;

  const stage = FOLLOWUP_STAGES[_demoFollowupState.currentStageIdx];
  const messages = document.getElementById('demoFollowupMessages');
  const inputRow = document.getElementById('demoFollowupInputRow');

  // Show loading
  const loading = document.createElement('div');
  loading.className = 'followup-msg followup-msg--ai followup-msg--loading';
  loading.innerHTML = '<span class="followup-typing"><span></span><span></span><span></span></span>';
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await fetchFollowup(
      stage,
      _demoFollowupState.emotion,
      _demoFollowupState.originalText,
      userReply || null,
      _demoFollowupState.context
    );

    loading.remove();

    let aiText = '';
    if (data.empathy) aiText += data.empathy + '\n';
    if (data.question) aiText += data.question;
    if (data.insight) aiText += data.insight + '\n';
    if (data.action) aiText += data.action + '\n';
    if (data.closing) aiText += data.closing;
    aiText = aiText.trim();

    appendDemoFollowupMsg('ai', aiText);
    _demoFollowupState.context.push({ role: 'ai', text: aiText });

    track('followup_received', { stage, emotion: _demoFollowupState.emotion, is_guest: true });

    if (stage === 'action') {
      _demoFollowupState.completed = true;
      if (inputRow) inputRow.hidden = true;
      const done = document.createElement('p');
      done.className = 'followup-done';
      done.textContent = '마음 돌봄 대화가 끝났어요';
      messages.appendChild(done);
      messages.scrollTop = messages.scrollHeight;
    }
  } catch {
    loading.remove();
    appendDemoFollowupMsg('ai', '질문을 만들지 못했어요. 다시 시도해주세요.');
  }
}

function appendDemoFollowupMsg(role, text) {
  const messages = document.getElementById('demoFollowupMessages');
  if (!messages) return;
  const el = document.createElement('div');
  el.className = 'followup-msg followup-msg--' + role;
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

// ---------------------------------------------------------------------------
// Signup Modal
// ---------------------------------------------------------------------------

export function showSignupModal(reason) {
  const overlay = document.getElementById('signupModalOverlay');
  const title = document.getElementById('signupModalTitle');
  const desc = document.getElementById('signupModalDesc');
  if (reason === 'limit') {
    title.textContent = '체험으로 들려줄 수 있는 이야기를 다 나눴어요';
    desc.textContent = '나만의 일기장을 만들면 이야기를 무제한으로 남기고, 마음의 흐름과 리포트까지 받아볼 수 있어요.';
  } else {
    title.textContent = '마음 읽기가 도움이 되셨나요?';
    desc.textContent = '나만의 일기장을 만들면 이야기를 무제한으로 간직하고, 마음의 흐름과 리포트까지 받아볼 수 있어요.';
  }
  overlay.hidden = false;
  openModalFocus(overlay, overlay.querySelector('.signup-modal-content') || overlay.firstElementChild);
  // E-04: signup_modal_shown
  track('signup_modal_shown', {
    reason,
    guest_usage_count: GUEST_MAX_ENTRIES - getGuestRemaining(),
  });
}

function hideSignupModal() {
  const overlay = document.getElementById('signupModalOverlay');
  overlay.hidden = true;
  closeModalFocus(overlay, overlay.querySelector('.signup-modal-content') || overlay.firstElementChild);
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
      // E-22: guest_data_migrated
      track('guest_data_migrated', {
        imported_count: result.imported || 0,
        skipped_count: result.skipped || 0,
      });
      if (result.imported > 0) {
        showError(`체험에서 나눈 이야기 ${result.imported}건을 일기장에 옮겨왔어요.`);
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

  // Sample card clicks → auto analyze
  document.querySelectorAll('.demo-sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const text = card.dataset.sample;
      if (text) {
        textarea.value = text;
        analyzeBtn.disabled = true;
        analyzeDemo(text);
      }
    });
  });

  // Demo followup input
  const demoFollowupInput = document.getElementById('demoFollowupInput');
  const demoFollowupSend = document.getElementById('demoFollowupSend');
  if (demoFollowupInput && demoFollowupSend) {
    demoFollowupInput.addEventListener('input', () => {
      demoFollowupSend.disabled = demoFollowupInput.value.trim().length === 0;
    });

    async function sendDemoFollowupReply() {
      if (!_demoFollowupState || _demoFollowupState.completed) return;
      const reply = demoFollowupInput.value.trim();
      if (!reply) return;

      appendDemoFollowupMsg('user', reply);
      _demoFollowupState.context.push({ role: 'user', text: reply });
      demoFollowupInput.value = '';
      demoFollowupSend.disabled = true;

      if (_demoFollowupState.currentStageIdx < FOLLOWUP_STAGES.length - 1) {
        _demoFollowupState.currentStageIdx++;
        updateDemoFollowupStages();
      }

      await requestDemoFollowup(reply);
    }

    demoFollowupSend.addEventListener('click', sendDemoFollowupReply);
    demoFollowupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendDemoFollowupReply();
      }
    });
  }

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
