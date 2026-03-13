import { state, GUEST_STORAGE_KEY, GUEST_MAX_ENTRIES, GUEST_MAX_DAYS, DOMAIN_EMOJI } from './state.js';
import { escapeHtml, safeEmoji, safeEmojiHtml, showError, getEmotionGroup, emotionColor, calculateStreak, toLocalDateStr, openModalFocus, closeModalFocus } from './utils.js';
import { fetchWithAuth, analyzeEmotion, saveEntry, fetchFollowup } from './api.js';
import { track } from './analytics.js';

// Module-level entries cache (works for both DB and localStorage modes)
let _demoEntries = [];

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
  // Anonymous auth mode: use cached entries
  if (state.isAnonymous) {
    return Math.max(0, GUEST_MAX_ENTRIES - _demoEntries.length);
  }
  return Math.max(0, GUEST_MAX_ENTRIES - loadGuestEntries().length);
}

export async function initDemoScreen() {
  // Load entries from DB (anonymous auth) or localStorage (fallback)
  if (state.accessToken && state.isAnonymous) {
    try {
      const res = await fetchWithAuth('/api/entries');
      if (res.ok) {
        const dbEntries = await res.json();
        _demoEntries = dbEntries.map(e => ({
          id: e.id,
          text: e.text,
          emotion: e.emotion,
          emoji: e.emoji,
          message: e.message,
          timestamp: new Date(e.created_at || e.date).getTime(),
        }));
      } else {
        _demoEntries = loadGuestEntries();
      }
    } catch {
      _demoEntries = loadGuestEntries();
    }
  } else {
    _demoEntries = loadGuestEntries();
  }

  updateDemoCounter();
  renderDemoHistory(_demoEntries);
  document.getElementById('demoResponse').hidden = true;
  document.getElementById('demoSkeleton').hidden = true;
  const textarea = document.getElementById('demoTextarea');
  textarea.value = '';
  document.getElementById('demoCharCount').textContent = '';
  document.getElementById('demoAnalyzeBtn').disabled = true;

  // Reset followup
  const followup = document.getElementById('demoFollowup');
  if (followup) followup.hidden = true;

  // Reset feature preview
  _previewShown = false;
  const preview = document.getElementById('demoFeaturePreview');
  if (preview) preview.hidden = true;
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
      <span class="demo-history-emoji">${safeEmojiHtml(e.emoji, '📝')}</span>
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
    document.getElementById('demoResponseEmoji').textContent = safeEmoji(result.emoji);
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

    // Save entry to DB (anonymous auth) or localStorage (fallback)
    if (state.accessToken && state.isAnonymous) {
      try {
        await saveEntry(text, result, []);
        _demoEntries.push({
          text,
          emotion: result.emotion,
          emoji: result.emoji,
          message: result.message,
          timestamp: Date.now(),
        });
      } catch {
        // DB save failed — fallback to localStorage
        const entries = loadGuestEntries();
        entries.push({ text, emotion: result.emotion, emoji: result.emoji, message: result.message, timestamp: Date.now() });
        saveGuestEntries(entries);
        _demoEntries = entries;
      }
    } else {
      const entries = loadGuestEntries();
      entries.push({ text, emotion: result.emotion, emoji: result.emoji, message: result.message, timestamp: Date.now() });
      saveGuestEntries(entries);
      _demoEntries = entries;
    }
    renderDemoHistory(_demoEntries);
    updateDemoCounter();

    document.getElementById('demoTextarea').value = '';
    document.getElementById('demoCharCount').textContent = '';
    analyzeBtn.disabled = true;

    // Start followup conversation
    initDemoFollowup(result.emotion, text);

    // Show feature preview after first analysis (1.5s delay)
    showFeaturePreview(_demoEntries);

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
    const pct = result.ontology.confidence ?? 0;
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
let _isFollowupLoading = false;

function initDemoFollowup(emotion, originalText) {
  const section = document.getElementById('demoFollowup');
  const messages = document.getElementById('demoFollowupMessages');
  if (!section || !messages) return;

  _isFollowupLoading = false;
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
  if (!_demoFollowupState || _demoFollowupState.completed || _isFollowupLoading) return;

  _isFollowupLoading = true;
  const prevStageIdx = _demoFollowupState.currentStageIdx;
  const stage = FOLLOWUP_STAGES[_demoFollowupState.currentStageIdx];
  const messages = document.getElementById('demoFollowupMessages');
  const inputRow = document.getElementById('demoFollowupInputRow');
  const input = document.getElementById('demoFollowupInput');
  const sendBtn = document.getElementById('demoFollowupSend');

  // Disable input during request
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

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
  } catch (err) {
    loading.remove();
    // Rollback stage on failure
    _demoFollowupState.currentStageIdx = prevStageIdx;
    updateDemoFollowupStages();
    appendDemoFollowupMsg('ai', err.userMessage || '질문을 만들지 못했어요. 다시 시도해주세요.');
  } finally {
    _isFollowupLoading = false;
    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = !input || input.value.trim().length === 0;
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
// Feature Preview (mock UI + real streak)
// ---------------------------------------------------------------------------

const SAFE_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^var\(--[\w-]+\)$/;
function safeColor(emotion) {
  const c = emotionColor(emotion);
  return SAFE_COLOR_RE.test(c) ? c : 'var(--color-primary)';
}

let _previewShown = false;

function showFeaturePreview(entries) {
  const section = document.getElementById('demoFeaturePreview');
  if (!section) return;

  // Always update streak with latest entries
  updatePreviewStreak(entries);

  // Only animate the first time
  if (_previewShown) return;
  _previewShown = true;

  renderPreviewCalendar(entries);
  renderPreviewPetal(entries);
  renderPreviewConstellation();

  setTimeout(() => {
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 1500);
}

function renderPreviewCalendar(entries) {
  const container = document.getElementById('demoPreviewCalendar');
  if (!container) return;

  // Build a 5x7 mini calendar grid with some mock + real data
  const mockEmotions = ['기쁨', '슬픔', '평온', '불안', '감사', '피곤'];
  const today = new Date();
  let cells = '';

  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(d);

    // Check if guest has a real entry for this date
    const real = entries.find(e => {
      const ed = toLocalDateStr(new Date(e.timestamp));
      return ed === dateStr;
    });

    let bg = 'transparent';
    let opacity = '0';
    if (real) {
      bg = safeColor(real.emotion);
      opacity = '1';
    } else if (i < 30 && Math.random() > 0.55) {
      // Sparse mock data for past days
      bg = safeColor(mockEmotions[Math.floor(Math.random() * mockEmotions.length)]);
      opacity = '0.5';
    }

    cells += '<div style="background:' + bg + ';opacity:' + opacity +
      ';border-radius:3px;aspect-ratio:1/1;"></div>';
  }

  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:4px;">' + cells + '</div>';
}

function renderPreviewPetal(entries) {
  const container = document.getElementById('demoPreviewPetal');
  if (!container) return;

  // Collect real emotions from entries + fill with mock to show 5 petals
  const emotionCounts = {};
  entries.forEach(e => {
    if (e.emotion) emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
  });
  const mockFill = [
    ['기쁨', 4], ['슬픔', 3], ['평온', 2], ['불안', 2], ['감사', 1]
  ];
  mockFill.forEach(([em, cnt]) => {
    if (!emotionCounts[em]) emotionCounts[em] = cnt;
  });

  const sorted = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] || 1;

  // Build SVG petals
  const cx = 60, cy = 60;
  let petals = '';
  sorted.forEach(([em, cnt], i) => {
    const angle = (i * 72 - 90) * Math.PI / 180;
    const r = 18 + (cnt / max) * 22;
    const px = cx + Math.cos(angle) * r * 0.6;
    const py = cy + Math.sin(angle) * r * 0.6;
    const color = safeColor(em);
    petals += '<ellipse cx="' + px + '" cy="' + py +
      '" rx="' + (r * 0.45) + '" ry="' + (r * 0.7) +
      '" fill="' + color + '" opacity="0.7"' +
      ' transform="rotate(' + (i * 72) + ' ' + px + ' ' + py + ')"/>';
  });

  container.innerHTML = '<svg viewBox="0 0 120 120" width="100%" height="100%">' +
    petals +
    '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--color-primary)" opacity="0.5"/>' +
    '</svg>';
}

function renderPreviewConstellation() {
  const container = document.getElementById('demoPreviewConstellation');
  if (!container) return;

  // Static mock constellation — night sky theme
  const nodes = [
    { x: 30, y: 25, r: 5, c: '#F4A261' },
    { x: 70, y: 20, r: 4, c: '#7EB8DA' },
    { x: 50, y: 50, r: 6, c: '#A8DAAB' },
    { x: 20, y: 65, r: 3.5, c: '#9C89B8' },
    { x: 80, y: 60, r: 4.5, c: '#E76F51' },
    { x: 55, y: 80, r: 3, c: '#F2A0A0' },
    { x: 35, y: 45, r: 3, c: '#E9C46A' },
  ];
  const edges = [
    [0, 2], [1, 2], [2, 3], [2, 4], [4, 5], [0, 6], [3, 6]
  ];

  let svg = '<svg viewBox="0 0 100 100" width="100%" height="100%">' +
    '<rect width="100" height="100" fill="#1a1a2e" rx="8"/>';

  // Stars background
  for (let i = 0; i < 15; i++) {
    svg += '<circle cx="' + (Math.random() * 100) + '" cy="' + (Math.random() * 100) +
      '" r="0.5" fill="#fff" opacity="' + (0.2 + Math.random() * 0.4) + '"/>';
  }

  // Edges
  edges.forEach(([a, b]) => {
    svg += '<line x1="' + nodes[a].x + '" y1="' + nodes[a].y +
      '" x2="' + nodes[b].x + '" y2="' + nodes[b].y +
      '" stroke="#fff" stroke-opacity="0.2" stroke-width="0.5"/>';
  });

  // Nodes
  nodes.forEach(n => {
    svg += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + n.r +
      '" fill="' + n.c + '" opacity="0.8"/>';
    svg += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + (n.r + 2) +
      '" fill="' + n.c + '" opacity="0.15"/>';
  });

  svg += '</svg>';
  container.innerHTML = svg;
}

function updatePreviewStreak(entries) {
  const streakEl = document.getElementById('demoPreviewStreak');
  const textEl = document.getElementById('demoPreviewStreakText');
  if (!streakEl || !textEl) return;

  // Convert guest entries to date format for calculateStreak
  const dated = entries.map(e => ({ date: toLocalDateStr(new Date(e.timestamp)) }));
  const streak = calculateStreak(dated);

  if (streak > 0) {
    textEl.textContent = streak + '일 연속 기록 중이에요!';
    streakEl.hidden = false;
  } else {
    streakEl.hidden = true;
  }
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
      if (!_demoFollowupState || _demoFollowupState.completed || _isFollowupLoading) return;
      const reply = demoFollowupInput.value.trim();
      if (!reply) return;

      appendDemoFollowupMsg('user', reply);
      _demoFollowupState.context.push({ role: 'user', text: reply });
      demoFollowupInput.value = '';
      demoFollowupSend.disabled = true;

      const stage = FOLLOWUP_STAGES[_demoFollowupState.currentStageIdx];
      track('followup_replied', { stage, emotion: _demoFollowupState.emotion, is_guest: true });

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

  // Feature preview CTA
  const previewCta = document.getElementById('demoPreviewCta');
  if (previewCta) {
    previewCta.addEventListener('click', () => {
      track('preview_cta_clicked', { source: 'feature_preview' });
      deps.showAuthScreen();
      deps.showAuthCard('signup');
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
