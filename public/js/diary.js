import { state, DOMAIN_EMOJI } from './state.js';
import { escapeHtml, getEmotionGroup, emotionColor, showError, showSkeleton, hideSkeleton, showToast } from './utils.js';
import { analyzeEmotion, saveEntry, submitFeedback, fetchFollowup } from './api.js';
import { track } from './analytics.js';

// Dependencies injected from app.js
let deps = {};
export function setupDiary(d) { deps = d; }

// Prompt chip event handling
const promptChips = document.getElementById('promptChips');
if (promptChips) {
  promptChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.prompt-chip');
    if (!chip) return;
    promptChips.querySelectorAll('.prompt-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const input = document.getElementById('diary-text');
    input.placeholder = chip.dataset.prompt;
    input.focus();
    track('prompt_select', { prompt_type: chip.textContent.trim() });
  });
}

// Structured Reflection Prompt Library
const PROMPT_LIBRARY = {
  gratitude: [
    { label: '오늘의 감사', prompt: '오늘 감사했던 세 가지를 적어보세요' },
    { label: '사람에게 감사', prompt: '최근 고마웠던 사람과 그 이유를 적어보세요' },
    { label: '작은 것의 감사', prompt: '당연하게 여겼지만 사실 감사한 것을 적어보세요' },
    { label: '과거의 감사', prompt: '지나고 보니 감사했던 경험을 적어보세요' },
    { label: '나에게 감사', prompt: '오늘 나 자신에게 감사한 점을 적어보세요' },
  ],
  cbt: [
    { label: '생각 기록', prompt: '지금 떠오르는 부정적 생각과 그 근거를 적어보세요' },
    { label: '균형 잡기', prompt: '걱정되는 상황의 최악, 최선, 가장 현실적인 결과를 적어보세요' },
    { label: '인지 왜곡 찾기', prompt: '오늘 나를 힘들게 한 생각이 혹시 과장되지 않았나 살펴보세요' },
    { label: '다른 관점', prompt: '같은 상황을 친한 친구가 겪었다면 뭐라고 말해줄까요?' },
    { label: '증거 점검', prompt: '지금 걱정이 실제로 일어난 적이 있었나요? 반대 증거도 있나요?' },
  ],
  mindfulness: [
    { label: '지금 이 순간', prompt: '지금 보이는 것, 들리는 것, 느껴지는 것을 적어보세요' },
    { label: '몸의 신호', prompt: '지금 몸에서 느껴지는 감각과 긴장을 적어보세요' },
    { label: '감정 관찰', prompt: '지금 느끼는 감정을 판단 없이 있는 그대로 적어보세요' },
    { label: '호흡 일기', prompt: '깊은 숨을 세 번 쉬고, 마음의 변화를 적어보세요' },
    { label: '흘려보내기', prompt: '오늘 놓아주고 싶은 것을 적어보세요' },
  ],
  growth: [
    { label: '배운 점', prompt: '오늘 새로 배운 것이나 깨달은 것을 적어보세요' },
    { label: '도전 기록', prompt: '최근 용기를 낸 일이나 도전한 경험을 적어보세요' },
    { label: '강점 발견', prompt: '오늘 발휘한 나의 강점을 적어보세요' },
    { label: '미래의 나', prompt: '한 달 뒤의 나에게 하고 싶은 말을 적어보세요' },
    { label: '실패에서 성장', prompt: '최근 실패에서 얻은 교훈을 적어보세요' },
  ],
  relationship: [
    { label: '소중한 사람', prompt: '오늘 만난 사람 중 마음이 따뜻해진 순간을 적어보세요' },
    { label: '표현 못한 말', prompt: '누군가에게 하고 싶었지만 못한 말을 적어보세요' },
    { label: '갈등 돌아보기', prompt: '최근 갈등에서 상대의 입장을 상상해보세요' },
    { label: '함께한 기억', prompt: '소중한 사람과의 좋은 기억을 적어보세요' },
    { label: '내 관계 패턴', prompt: '관계에서 반복되는 나의 패턴을 발견했나요?' },
  ],
};

let _activeLibTab = 'gratitude';

function initPromptLibrary() {
  const libraryBtn = document.getElementById('promptLibraryBtn');
  const overlay = document.getElementById('promptLibrary');
  const closeBtn = document.getElementById('promptLibraryClose');
  const tabs = document.getElementById('promptLibraryTabs');
  const list = document.getElementById('promptLibraryList');

  if (!libraryBtn || !overlay) return;

  function renderList(category) {
    const prompts = PROMPT_LIBRARY[category] || [];
    list.innerHTML = prompts.map(p =>
      '<li class="prompt-library-item" data-prompt="' + p.prompt.replace(/"/g, '&quot;') + '">' +
        '<span class="prompt-library-item-label">' + p.label + '</span>' +
        '<span class="prompt-library-item-text">' + p.prompt + '</span>' +
      '</li>'
    ).join('');
  }

  libraryBtn.addEventListener('click', () => {
    overlay.hidden = false;
    renderList(_activeLibTab);
    track('prompt_library_opened', {});
  });

  closeBtn.addEventListener('click', () => { overlay.hidden = true; });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.prompt-lib-tab');
    if (!tab) return;
    tabs.querySelectorAll('.prompt-lib-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _activeLibTab = tab.dataset.tab;
    renderList(_activeLibTab);
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.prompt-library-item');
    if (!item) return;
    const input = document.getElementById('diary-text');
    input.placeholder = item.dataset.prompt;
    input.focus();
    overlay.hidden = true;

    // Deactivate basic chips
    if (promptChips) {
      promptChips.querySelectorAll('.prompt-chip').forEach(c => c.classList.remove('active'));
    }
    track('prompt_select', { prompt_type: item.querySelector('.prompt-library-item-label').textContent, source: 'library' });
  });
}

initPromptLibrary();

// Activity tag selection
const activityTagsEl = document.getElementById('activityTags');
if (activityTagsEl) {
  activityTagsEl.addEventListener('click', (e) => {
    const tag = e.target.closest('.activity-tag');
    if (!tag) return;
    tag.classList.toggle('active');
  });
}

function getSelectedActivityTags() {
  const tags = [];
  if (activityTagsEl) {
    activityTagsEl.querySelectorAll('.activity-tag.active').forEach(t => {
      tags.push(t.dataset.tag);
    });
  }
  return tags;
}

function clearActivityTags() {
  if (activityTagsEl) {
    activityTagsEl.querySelectorAll('.activity-tag.active').forEach(t => t.classList.remove('active'));
  }
}

export async function handleSubmit(e) {
  e.preventDefault();
  const diaryText = document.getElementById('diary-text');
  const submitBtn = document.getElementById('submitBtn');
  const responseCard = document.getElementById('responseCard');
  const charCount = document.getElementById('charCount');

  const text = diaryText.value.trim();
  if (!text) return;

  // E-11: diary_submitted
  const now = new Date();
  const isFirstDiary = (state.allEntries || []).length === 0;
  track('diary_submitted', {
    text_length: text.length,
    entry_hour: now.getHours(),
    entry_day_of_week: now.getDay(),
    is_guest: state.guestMode,
    total_entries_count: (state.allEntries || []).length,
  });

  const submitStartTime = Date.now();
  submitBtn.disabled = true;
  responseCard.hidden = true;
  document.getElementById('feedbackSection').hidden = true;
  document.getElementById('retentionCard').hidden = true;
  document.documentElement.removeAttribute('data-emotion-theme');
  document.getElementById('similarEntries').hidden = true;
  const aiSection = responseCard.closest('.ai-response');
  if (aiSection) aiSection.setAttribute('aria-busy', 'true');
  showSkeleton('analyze');

  try {
    const result = await analyzeEmotion(text);
    showResponse(result);

    let savedEntry = null;
    const activityTags = getSelectedActivityTags();
    if (!state.guestMode) {
      savedEntry = await saveEntry(text, result, activityTags);
    }

    // E-10: first_diary_submitted
    if (isFirstDiary) {
      track('first_diary_submitted', {
        text_length: text.length,
        entry_hour: now.getHours(),
        is_guest: state.guestMode,
      });
    }

    state._lastDiaryText = text;
    diaryText.value = '';
    diaryText.style.height = 'auto';
    charCount.textContent = '';
    clearActivityTags();
    await deps.loadEntries();

    // Show feedback section (authenticated users only)
    showFeedbackSection(savedEntry);

    // Show retention card
    showRetentionCard();
  } catch (err) {
    // E-24: ai_analysis_failed
    track('ai_analysis_failed', {
      error_message: (err.userMessage || 'unknown').slice(0, 200),
      text_length: text.length,
      is_guest: state.guestMode,
    });
    showError(err.userMessage || '지금 마음을 읽기 어려운 상황이에요. 잠시 후 다시 이야기해주세요.');
  } finally {
    hideSkeleton('analyze');
    if (aiSection) aiSection.removeAttribute('aria-busy');
    submitBtn.disabled = diaryText.value.trim().length === 0;
  }
}

export function showResponse(result) {
  const responseCard = document.getElementById('responseCard');
  const responseEmoji = document.getElementById('responseEmoji');
  const responseEmotion = document.getElementById('responseEmotion');
  const responseMessage = document.getElementById('responseMessage');
  const responseAdvice = document.getElementById('responseAdvice');
  const analysisDetails = document.getElementById('analysisDetails');
  const confidenceBadge = document.getElementById('confidenceBadge');

  responseEmoji.textContent = result.emoji;
  responseEmotion.textContent = '지금 느끼고 있는 ' + result.emotion;
  responseMessage.textContent = result.message;
  responseAdvice.textContent = result.advice;

  if (result.ontology) {
    renderOntologyInsights(result.ontology);

    if (result.ontology.confidence !== undefined) {
      renderConfidenceBadge(result.ontology.confidence);
      confidenceBadge.hidden = false;
    } else {
      confidenceBadge.hidden = true;
    }

    analysisDetails.hidden = false;
    analysisDetails.removeAttribute('open');
  } else {
    analysisDetails.hidden = true;
  }

  responseCard.hidden = false;
  responseCard.style.animation = 'none';
  requestAnimationFrame(() => { responseCard.style.animation = ''; });

  // E-12: ai_response_received
  track('ai_response_received', {
    emotion: result.emotion,
    emotion_level1: result.ontology?.emotion_hierarchy?.level1 || null,
    confidence_score: result.ontology?.confidence || 0,
    has_ontology: !!result.ontology,
    situation_domains: (result.ontology?.situation_context || []).map(c => c.domain),
  });

  const emotionGroup = getEmotionGroup(result.emotion);
  document.documentElement.setAttribute('data-emotion-theme', emotionGroup);

  deps.createConfetti(result.emotion);

  responseCard.classList.remove('pulse-bg');
  requestAnimationFrame(() => { responseCard.classList.add('pulse-bg'); });
  setTimeout(() => responseCard.classList.remove('pulse-bg'), 1500);

  responseEmoji.classList.remove('pop');
  requestAnimationFrame(() => { responseEmoji.classList.add('pop'); });

  state.latestAnalysisResult = Object.assign({}, result, { _time: new Date().toISOString() });
  deps.updateSidebar();

  // Crisis detection — show safety modal
  if (result.crisis_detected) {
    showCrisisModal();
    track('crisis_detected', { emotion: result.emotion });
  }

  setTimeout(() => { responseCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);

  // Similar entries
  const similarSection = document.getElementById('similarEntries');
  const similarList = document.getElementById('similarEntriesList');
  const similarTitle = document.getElementById('similarEntriesTitle');
  const emotion = result.emotion;
  const matches = (state.allEntries || [])
    .filter(e => e.emotion === emotion)
    .slice(0, 3);

  if (matches.length >= 1) {
    // AI "remembering" framing — contextual title
    if (similarTitle) {
      const oldestMatch = matches.reduce((oldest, e) => {
        if (!e.date) return oldest;
        if (!oldest) return e;
        return new Date(e.date) < new Date(oldest.date) ? e : oldest;
      }, null);

      if (oldestMatch && oldestMatch.date) {
        const daysDiff = Math.floor((Date.now() - new Date(oldestMatch.date).getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 30) {
          similarTitle.textContent = '지난 기록을 살펴보니, ' + daysDiff + '일 전에도 비슷한 마음이 있었어요';
        } else if (daysDiff >= 7) {
          similarTitle.textContent = daysDiff + '일 전에도 같은 마음이었어요';
        } else if (matches.length > 1) {
          similarTitle.textContent = '당신의 이 마음, 기억하고 있어요';
        } else {
          similarTitle.textContent = '비슷한 마음의 기록이 있어요';
        }
      } else {
        similarTitle.textContent = '비슷한 마음의 기록이 있어요';
      }
    }

    similarList.innerHTML = matches.map(e => {
      const dateStr = e.date
        ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(e.date))
        : '';
      return `<li class="similar-entry-item" tabindex="0" role="button" aria-label="${escapeHtml(e.text)}">
        <span class="similar-entry-emoji" aria-hidden="true">${escapeHtml(e.emoji || '')}</span>
        <div class="similar-entry-body">
          <p class="similar-entry-text">${escapeHtml(e.text)}</p>
          <p class="similar-entry-date">${escapeHtml(dateStr)}</p>
        </div>
      </li>`;
    }).join('');

    similarList.querySelectorAll('.similar-entry-item').forEach((item, idx) => {
      const entry = matches[idx];
      item.addEventListener('click', () => deps.showHistoryDetail(entry));
      item.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); deps.showHistoryDetail(entry); }
      });
    });

    similarSection.hidden = false;
  } else {
    similarSection.hidden = true;
  }

  // Initialize follow-up conversation (use the original text stored before clearing)
  initFollowupConversation(result.emotion, state._lastDiaryText || '');
}

function renderConfidenceBadge(confidence) {
  const confidenceBadgeFill = document.getElementById('confidenceBadgeFill');
  const confidenceBadgePercent = document.getElementById('confidenceBadgePercent');

  const pct = confidence || 0;
  confidenceBadgePercent.textContent = pct + '%';
  confidenceBadgeFill.style.width = '0%';
  requestAnimationFrame(() => { confidenceBadgeFill.style.width = pct + '%'; });

  let level = 'mid';
  if (pct >= 70) level = 'high';
  else if (pct < 40) level = 'low';
  confidenceBadgeFill.setAttribute('data-level', level);
}

function renderOntologyInsights(ontology) {
  const emotionHierarchy = document.getElementById('emotionHierarchy');
  const situationTags = document.getElementById('situationTags');
  const confidenceMeter = document.getElementById('confidenceMeter');

  emotionHierarchy.innerHTML = '';
  if (ontology.emotion_hierarchy) {
    const h = ontology.emotion_hierarchy;
    const levels = [h.level1, h.level2, h.level3].filter(Boolean);
    levels.forEach((level, idx) => {
      if (idx > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'hierarchy-arrow';
        arrow.textContent = '\u2193';
        arrow.setAttribute('aria-hidden', 'true');
        emotionHierarchy.appendChild(arrow);
      }
      const span = document.createElement('span');
      span.className = 'hierarchy-level';
      span.textContent = level;
      emotionHierarchy.appendChild(span);
    });
  }

  situationTags.innerHTML = '';
  if (ontology.situation_context && Array.isArray(ontology.situation_context)) {
    ontology.situation_context.forEach(ctx => {
      const tag = document.createElement('span');
      tag.className = 'situation-tag';

      const emoji = DOMAIN_EMOJI[ctx.domain] || DOMAIN_EMOJI['\uAE30\uD0C0'];
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'situation-tag-emoji';
      emojiSpan.setAttribute('aria-hidden', 'true');
      emojiSpan.textContent = emoji;
      tag.appendChild(emojiSpan);

      const textNode = document.createTextNode(ctx.domain + ' / ' + ctx.context);
      tag.appendChild(textNode);

      situationTags.appendChild(tag);
    });
  }

  confidenceMeter.innerHTML = '';
}

// ---------------------------------------------------------------------------
// AI Feedback (Thumbs Up/Down)
// ---------------------------------------------------------------------------

function showFeedbackSection(savedEntry) {
  const feedbackSection = document.getElementById('feedbackSection');
  const feedbackThanks = document.getElementById('feedbackThanks');
  const feedbackButtons = feedbackSection.querySelector('.feedback-buttons');
  const feedbackHelpful = document.getElementById('feedbackHelpful');
  const feedbackNotHelpful = document.getElementById('feedbackNotHelpful');

  // Guest mode: hide feedback
  if (state.guestMode || !savedEntry || !savedEntry.id) {
    feedbackSection.hidden = true;
    return;
  }

  // Reset state
  feedbackThanks.hidden = true;
  feedbackButtons.hidden = false;
  feedbackHelpful.disabled = false;
  feedbackNotHelpful.disabled = false;
  feedbackHelpful.classList.remove('active');
  feedbackNotHelpful.classList.remove('active');
  feedbackSection.dataset.entryId = savedEntry.id;
  feedbackSection.hidden = false;

  // Clone buttons to remove old listeners
  const newHelpful = feedbackHelpful.cloneNode(true);
  const newNotHelpful = feedbackNotHelpful.cloneNode(true);
  feedbackHelpful.replaceWith(newHelpful);
  feedbackNotHelpful.replaceWith(newNotHelpful);

  newHelpful.addEventListener('click', () => handleFeedbackClick('helpful'));
  newNotHelpful.addEventListener('click', () => handleFeedbackClick('not_helpful'));
}

async function handleFeedbackClick(rating) {
  const feedbackSection = document.getElementById('feedbackSection');
  const feedbackThanks = document.getElementById('feedbackThanks');
  const feedbackButtons = feedbackSection.querySelector('.feedback-buttons');
  const entryId = feedbackSection.dataset.entryId;

  if (!entryId) return;

  // Disable buttons immediately
  const buttons = feedbackButtons.querySelectorAll('.feedback-btn');
  buttons.forEach(btn => { btn.disabled = true; });

  // Highlight the selected button
  const selected = feedbackSection.querySelector('[data-rating="' + rating + '"]');
  if (selected) selected.classList.add('active');

  try {
    await submitFeedback(entryId, rating);
    // E-13: ai_feedback_submitted
    track('ai_feedback_submitted', {
      rating,
      emotion: state.latestAnalysisResult?.emotion || '',
      confidence_score: state.latestAnalysisResult?.ontology?.confidence || 0,
    });
    feedbackButtons.hidden = true;
    feedbackThanks.hidden = false;
  } catch (err) {
    showToast(err.userMessage || '의견을 전달하지 못했어요. 다시 시도해주세요.', 'error');
    buttons.forEach(btn => { btn.disabled = false; });
    if (selected) selected.classList.remove('active');
  }
}

// ---------------------------------------------------------------------------
// Retention Card
// ---------------------------------------------------------------------------

function showRetentionCard() {
  const retentionCard = document.getElementById('retentionCard');
  const retentionIcon = document.getElementById('retentionIcon');
  const retentionText = document.getElementById('retentionText');

  const message = getRetentionMessage();
  if (!message) {
    retentionCard.hidden = true;
    return;
  }

  retentionIcon.textContent = message.icon;
  retentionText.textContent = message.text;
  retentionCard.hidden = false;
  retentionCard.style.animation = 'none';
  requestAnimationFrame(() => { retentionCard.style.animation = ''; });
}

function getRetentionMessage() {
  const entries = state.allEntries || [];
  const totalEntries = entries.length;

  // Guest mode: encourage signup
  if (state.guestMode) {
    return {
      icon: '🔒',
      text: '나의 이야기를 영원히 간직하고 싶다면, 일기장을 만들어보세요',
    };
  }

  // Milestone celebration (10, 25, 50, 100, 200, 500, 1000)
  const milestones = [10, 25, 50, 100, 200, 500, 1000];
  if (milestones.includes(totalEntries)) {
    return {
      icon: '🎉',
      text: totalEntries + '번째 이야기를 들려주셨네요!',
    };
  }

  // Emotion diversity message (5+ unique emotions)
  const uniqueEmotions = new Set(entries.map(e => e.emotion).filter(Boolean));
  if (uniqueEmotions.size >= 5) {
    return {
      icon: '🌈',
      text: uniqueEmotions.size + '가지 마음을 나눠주셨어요. 마음의 스펙트럼이 넓어지고 있어요',
    };
  }

  // Streak reinforcement
  const streak = state.userProfile?.current_streak || 0;
  if (streak >= 2) {
    return {
      icon: '🔥',
      text: streak + '일째 매일 마음을 돌보고 있어요. 내일이면 ' + (streak + 1) + '일!',
    };
  }

  // Insight preview (less than 7 entries)
  if (totalEntries > 0 && totalEntries < 7) {
    const remaining = 7 - totalEntries;
    return {
      icon: '📊',
      text: '이야기가 ' + remaining + '개 더 모이면 주간 마음 리포트를 받아볼 수 있어요',
    };
  }

  // Stats encouragement (7+ entries)
  if (totalEntries >= 7) {
    return {
      icon: '📈',
      text: '이번 주 마음의 흐름이 궁금하다면? 통계 탭에서 마음 돌아보기',
    };
  }

  // Warm encouragement messages (shown between milestones)
  const warmMessages = [
    '오늘도 마음을 돌본 당신, 대단해요',
    '기록하는 것만으로 이미 큰 한 걸음이에요',
    '오늘의 마음을 잘 담아주셨어요',
    '꾸준히 마음을 들여다보는 당신이 멋져요',
    '이 한 줄이 내일의 당신에게 힘이 될 거예요',
  ];
  if (totalEntries > 0) {
    const idx = totalEntries % warmMessages.length;
    return {
      icon: '💛',
      text: warmMessages[idx],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Crisis Safety Modal
// ---------------------------------------------------------------------------

function showCrisisModal() {
  const overlay = document.getElementById('crisisModal');
  if (!overlay) return;
  overlay.hidden = false;
}

const crisisCloseBtn = document.getElementById('crisisModalClose');
if (crisisCloseBtn) {
  crisisCloseBtn.addEventListener('click', () => {
    document.getElementById('crisisModal').hidden = true;
  });
}
const crisisOverlay = document.getElementById('crisisModal');
if (crisisOverlay) {
  crisisOverlay.addEventListener('click', (e) => {
    if (e.target === crisisOverlay) crisisOverlay.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// AI Follow-up Conversation (탐색→통찰→행동 3단계)
// ---------------------------------------------------------------------------

const FOLLOWUP_STAGE_ORDER = ['explore', 'insight', 'action'];
const FOLLOWUP_STAGE_LABELS = { explore: '탐색', insight: '통찰', action: '행동' };

let _followupState = null;

function initFollowupConversation(emotion, originalText) {
  const section = document.getElementById('followupSection');
  const messages = document.getElementById('followupMessages');
  const input = document.getElementById('followupInput');
  const sendBtn = document.getElementById('followupSend');

  if (!section || !messages) return;

  // Reset
  _followupState = {
    emotion,
    originalText,
    currentStageIdx: 0,
    context: [],
    completed: false,
  };

  messages.innerHTML = '';
  input.value = '';
  sendBtn.disabled = true;
  section.hidden = false;

  updateFollowupStageUI();

  // Start with explore stage
  requestFollowup();
}

function updateFollowupStageUI() {
  if (!_followupState) return;
  const stage = FOLLOWUP_STAGE_ORDER[_followupState.currentStageIdx];
  const label = document.getElementById('followupStageLabel');
  if (label) label.textContent = FOLLOWUP_STAGE_LABELS[stage] || '';

  document.querySelectorAll('.followup-stage-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i <= _followupState.currentStageIdx);
    dot.classList.toggle('completed', i < _followupState.currentStageIdx);
  });
}

async function requestFollowup(userReply) {
  if (!_followupState || _followupState.completed) return;

  const stage = FOLLOWUP_STAGE_ORDER[_followupState.currentStageIdx];
  const messages = document.getElementById('followupMessages');
  const inputRow = document.getElementById('followupInputRow');

  // Show loading
  const loadingEl = document.createElement('div');
  loadingEl.className = 'followup-msg followup-msg--ai followup-msg--loading';
  loadingEl.innerHTML = '<span class="followup-typing"><span></span><span></span><span></span></span>';
  messages.appendChild(loadingEl);
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await fetchFollowup(
      stage,
      _followupState.emotion,
      _followupState.originalText,
      userReply || null,
      _followupState.context
    );

    // Remove loading
    loadingEl.remove();

    // Build AI message text
    let aiText = '';
    if (data.empathy) aiText += data.empathy + '\n';
    if (data.question) aiText += data.question;
    if (data.insight) aiText += data.insight + '\n';
    if (data.action) aiText += data.action + '\n';
    if (data.closing) aiText += data.closing;
    aiText = aiText.trim();

    // Append AI message
    appendFollowupMessage('ai', aiText);
    _followupState.context.push({ role: 'ai', text: aiText });

    track('followup_received', { stage, emotion: _followupState.emotion });

    // If action stage, complete the conversation
    if (stage === 'action') {
      _followupState.completed = true;
      inputRow.hidden = true;

      const doneEl = document.createElement('p');
      doneEl.className = 'followup-done';
      doneEl.textContent = '마음 돌봄 대화가 끝났어요';
      messages.appendChild(doneEl);
      messages.scrollTop = messages.scrollHeight;
    }
  } catch (err) {
    loadingEl.remove();
    appendFollowupMessage('ai', err.userMessage || '질문을 만들지 못했어요. 다시 시도해주세요.');
  }
}

function appendFollowupMessage(role, text) {
  const messages = document.getElementById('followupMessages');
  const el = document.createElement('div');
  el.className = 'followup-msg followup-msg--' + role;
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

// Wire up follow-up input
const _followupInput = document.getElementById('followupInput');
const _followupSend = document.getElementById('followupSend');

if (_followupInput && _followupSend) {
  _followupInput.addEventListener('input', () => {
    _followupSend.disabled = _followupInput.value.trim().length === 0;
  });

  async function sendFollowupReply() {
    if (!_followupState || _followupState.completed) return;
    const reply = _followupInput.value.trim();
    if (!reply) return;

    appendFollowupMessage('user', reply);
    _followupState.context.push({ role: 'user', text: reply });
    _followupInput.value = '';
    _followupSend.disabled = true;

    track('followup_replied', {
      stage: FOLLOWUP_STAGE_ORDER[_followupState.currentStageIdx],
      text_length: reply.length,
    });

    // Advance stage
    if (_followupState.currentStageIdx < FOLLOWUP_STAGE_ORDER.length - 1) {
      _followupState.currentStageIdx++;
      updateFollowupStageUI();
    }

    await requestFollowup(reply);
  }

  _followupSend.addEventListener('click', sendFollowupReply);
  _followupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowupReply();
    }
  });
}
