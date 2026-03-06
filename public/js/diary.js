import { state, DOMAIN_EMOJI } from './state.js';
import { escapeHtml, getEmotionGroup, emotionColor, showError, showSkeleton, hideSkeleton } from './utils.js';
import { analyzeEmotion, saveEntry } from './api.js';

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
  document.documentElement.removeAttribute('data-emotion-theme');
  document.getElementById('similarEntries').hidden = true;
  const aiSection = responseCard.closest('.ai-response');
  if (aiSection) aiSection.setAttribute('aria-busy', 'true');
  showSkeleton('analyze');

  try {
    const result = await analyzeEmotion(text);
    showResponse(result);
    await saveEntry(text, result);

    diaryText.value = '';
    diaryText.style.height = 'auto';
    charCount.textContent = '';
    await deps.loadEntries();
  } catch (err) {
    showError(err.userMessage || '알 수 없는 오류가 발생했습니다.');
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

  if (matches.length >= 3) {
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
