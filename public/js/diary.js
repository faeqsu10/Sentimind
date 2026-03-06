import { state, DOMAIN_EMOJI } from './state.js';
import { escapeHtml, getEmotionGroup, emotionColor, showError, showSkeleton, hideSkeleton, showToast } from './utils.js';
import { analyzeEmotion, saveEntry, submitFeedback } from './api.js';

// Dependencies injected from app.js
let deps = {};
export function setupDiary(d) { deps = d; }

export async function handleSubmit(e) {
  e.preventDefault();
  const diaryText = document.getElementById('diary-text');
  const submitBtn = document.getElementById('submitBtn');
  const responseCard = document.getElementById('responseCard');
  const charCount = document.getElementById('charCount');

  const text = diaryText.value.trim();
  if (!text) return;

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
    if (!state.guestMode) {
      savedEntry = await saveEntry(text, result);
    }

    diaryText.value = '';
    diaryText.style.height = 'auto';
    charCount.textContent = '';
    await deps.loadEntries();

    // Show feedback section (authenticated users only)
    showFeedbackSection(savedEntry);

    // Show retention card
    showRetentionCard();
  } catch (err) {
    showError(err.userMessage || '지금 감정을 분석하기 어려운 상황이에요. 잠시 후 다시 시도해주세요.');
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
  const ontologySection = document.getElementById('ontologySection');
  const confidenceBadge = document.getElementById('confidenceBadge');

  responseEmoji.textContent = result.emoji;
  responseEmotion.textContent = '감정: ' + result.emotion;
  responseMessage.textContent = result.message;
  responseAdvice.textContent = result.advice;

  if (result.ontology) {
    renderOntologyInsights(result.ontology);
    ontologySection.hidden = false;

    if (result.ontology.confidence !== undefined) {
      renderConfidenceBadge(result.ontology.confidence);
      confidenceBadge.hidden = false;
    } else {
      confidenceBadge.hidden = true;
    }
  } else {
    ontologySection.hidden = true;
    confidenceBadge.hidden = true;
  }

  responseCard.hidden = false;
  responseCard.style.animation = 'none';
  requestAnimationFrame(() => { responseCard.style.animation = ''; });

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

  setTimeout(() => { responseCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);

  // Similar entries
  const similarSection = document.getElementById('similarEntries');
  const similarList = document.getElementById('similarEntriesList');
  const emotion = result.emotion;
  const matches = (state.allEntries || [])
    .filter(e => e.emotion === emotion)
    .slice(0, 3);

  if (matches.length >= 1) {
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
    feedbackButtons.hidden = true;
    feedbackThanks.hidden = false;
  } catch (err) {
    showToast(err.userMessage || '피드백 저장에 실패했습니다.', 'error');
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
  retentionText.innerHTML = message.text;
  retentionCard.hidden = false;
  retentionCard.style.animation = 'none';
  requestAnimationFrame(() => { retentionCard.style.animation = ''; });
}

function getRetentionMessage() {
  const totalEntries = (state.allEntries || []).length;

  // Guest mode: encourage signup
  if (state.guestMode) {
    return {
      icon: '🔒',
      text: '회원가입하면 모든 기록이 영구 보관돼요',
    };
  }

  // Milestone celebration (10, 25, 50, 100, 200, 500, 1000)
  const milestones = [10, 25, 50, 100, 200, 500, 1000];
  if (milestones.includes(totalEntries)) {
    return {
      icon: '🎉',
      text: '총 ' + totalEntries + '번째 일기를 기록했어요!',
    };
  }

  // Streak reinforcement
  const streak = state.userProfile?.current_streak || 0;
  if (streak >= 2) {
    return {
      icon: '🔥',
      text: '연속 ' + streak + '일째 기록 중이에요. 내일도 기록하면 ' + (streak + 1) + '일!',
    };
  }

  // Insight preview (less than 7 entries)
  if (totalEntries > 0 && totalEntries < 7) {
    const remaining = 7 - totalEntries;
    return {
      icon: '📊',
      text: '일기가 ' + remaining + '개 더 쌓이면 주간 AI 리포트를 받을 수 있어요',
    };
  }

  // Stats encouragement (7+ entries)
  if (totalEntries >= 7) {
    return {
      icon: '📈',
      text: '이번 주 감정 흐름이 궁금하다면? <a href="#" class="retention-link" onclick="document.getElementById(\'tab-stats\')?.click(); return false;">통계 보기</a>',
    };
  }

  return null;
}
