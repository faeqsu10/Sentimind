# 온톨로지 UX 프로토타입 - 코드 예제

> 실제 구현 가능한 HTML/CSS/JavaScript 코드 스니펫

---

## 1. Phase 1: 백그라운드 감정 분석 개선

### 1.1 온톨로지 데이터 구조 (data/emotionOntology.json)

```json
{
  "emotions": {
    "joy": {
      "korean": "기쁨",
      "emoji": "😊",
      "subcategories": [
        {
          "name": "만족감",
          "emoji": "😌",
          "keywords": ["완성", "달성", "성공"],
          "contexts": ["project_completion", "goal_achievement"]
        },
        {
          "name": "설렘",
          "emoji": "🤭",
          "keywords": ["기대", "새로운", "설레다"],
          "contexts": ["interview", "first_date", "new_opportunity"]
        },
        {
          "name": "희망",
          "emoji": "✨",
          "keywords": ["미래", "가능성", "꿈"],
          "contexts": ["planning", "recovery", "new_start"]
        }
      ],
      "correlations": [
        { "with": "anxiety", "probability": 0.65 },
        { "with": "contentment", "probability": 0.45 }
      ]
    },
    "anxiety": {
      "korean": "불안",
      "emoji": "😰",
      "subcategories": [
        {
          "name": "긴장",
          "emoji": "😐",
          "intensity": "moderate",
          "keywords": ["떨린다", "긴장되다", "집중"],
          "contexts": ["interview", "presentation", "test"]
        },
        {
          "name": "걱정",
          "emoji": "😟",
          "intensity": "mild",
          "keywords": ["혹시", "문제", "실수"],
          "contexts": ["waiting", "unknown_outcome"]
        }
      ],
      "correlations": [
        { "with": "hope", "probability": 0.77 },
        { "with": "excitement", "probability": 0.70 }
      ]
    }
    // 추가 감정들...
  },
  "contextMappings": {
    "interview": {
      "likely_emotions": ["anxiety", "hope", "excitement"],
      "typical_sequences": ["anxiety → hope", "anxiety → excitement"],
      "success_correlations": ["hope", "confidence"]
    },
    "project_completion": {
      "likely_emotions": ["joy", "relief", "pride"],
      "typical_sequences": ["anxiety → relief → joy"],
      "success_correlations": ["pride", "satisfaction"]
    },
    "failure": {
      "likely_emotions": ["disappointment", "sadness", "learning"],
      "typical_sequences": ["disappointment → learning → growth"],
      "success_correlations": ["resilience", "growth_mindset"]
    }
  }
}
```

### 1.2 온톨로지 엔진 (lib/ontology/OntologyEngine.js)

```javascript
class OntologyEngine {
  constructor(ontologyData) {
    this.ontology = ontologyData;
  }

  /**
   * 기본 감정을 세부 감정으로 매핑
   * "불안" → ["긴장", "걱정", "두려움"] 중 선택
   */
  enrichEmotion(primaryEmotion, text, context = {}) {
    const emotionNode = this.ontology.emotions[this.getOntologyKey(primaryEmotion)];
    if (!emotionNode) return null;

    // 텍스트에서 키워드 매칭
    const keywords = this.extractKeywords(text);
    let bestMatch = emotionNode.subcategories[0];
    let bestScore = 0;

    for (const sub of emotionNode.subcategories) {
      const score = sub.keywords.filter(kw =>
        keywords.some(k => k.includes(kw) || kw.includes(k))
      ).length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = sub;
      }
    }

    return {
      primary: primaryEmotion,
      detailed: bestMatch.name,
      emoji: bestMatch.emoji,
      intensity: bestMatch.intensity || "moderate"
    };
  }

  /**
   * 문맥 기반 관련 감정 추천
   * "면접" + "긴장" → 추가로 "희망", "설렘" 가능성
   */
  suggestRelatedEmotions(primaryEmotion, context) {
    const emotionNode = this.ontology.emotions[this.getOntologyKey(primaryEmotion)];
    if (!emotionNode) return [];

    // 상관관계 기반 추천
    return emotionNode.correlations
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 2)
      .map(corr => ({
        emotion: corr.with,
        probability: corr.probability,
        korean: this.ontology.emotions[corr.with].korean
      }));
  }

  /**
   * 사용자의 감정 패턴 매칭
   * 과거 기록과 비교하여 신뢰도 조정
   */
  adjustByUserProfile(enrichedEmotion, userProfile) {
    if (!userProfile || !userProfile.emotionPatterns) {
      return enrichedEmotion;
    }

    const pattern = userProfile.emotionPatterns[enrichedEmotion.detailed];
    if (!pattern) return enrichedEmotion;

    return {
      ...enrichedEmotion,
      confidence: Math.min(0.95, pattern.frequency * 0.1 + 0.7),
      fromProfile: true
    };
  }

  extractKeywords(text) {
    // 간단한 키워드 추출 (실제로는 NLP 라이브러리 사용)
    return text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  }

  getOntologyKey(korean) {
    // 한국어 감정을 온톨로지 키로 변환
    const keyMap = {
      "불안": "anxiety",
      "긴장": "anxiety",
      "기쁨": "joy",
      "설렘": "joy",
      "기대감": "joy",
      "슬픔": "sadness",
      "분노": "anger"
    };
    return keyMap[korean] || "unknown";
  }
}

module.exports = OntologyEngine;
```

### 1.3 개선된 server.js 엔드포인트

```javascript
// === 수정된 부분: POST /api/analyze (온톨로지 강화) ===

const OntologyEngine = require('./lib/ontology/OntologyEngine');
const ontologyData = require('./data/emotionOntology.json');
const ontologyEngine = new OntologyEngine(ontologyData);

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 500) {
    return res.status(400).json({ error: 'Invalid text length' });
  }

  try {
    // [Step 1] Gemini로 기본 감정 분석
    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n일기: "${trimmed}"` }]
          }
        ],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
      })
    });

    const geminiData = await geminiResponse.json();
    const basicAnalysis = parseGeminiResponse(
      geminiData.candidates[0].content.parts[0].text
    );

    // [Step 2] 온톨로지로 감정 세분화
    const enrichedEmotion = ontologyEngine.enrichEmotion(
      basicAnalysis.emotion,
      trimmed
    );

    // [Step 3] 관련 감정 추천
    const relatedEmotions = ontologyEngine.suggestRelatedEmotions(
      basicAnalysis.emotion,
      { type: 'unknown' }
    );

    // [Step 4] 개인화 조정 (추후 사용자 프로필 로드 시)
    // const userProfile = await loadUserProfile(userId);
    // const adjusted = ontologyEngine.adjustByUserProfile(enrichedEmotion, userProfile);

    // [Step 5] 개선된 응답 생성
    const responseData = {
      emotion: enrichedEmotion.detailed || basicAnalysis.emotion,
      emoji: enrichedEmotion.emoji || basicAnalysis.emoji,
      message: basicAnalysis.message,
      advice: basicAnalysis.advice,

      // 온톨로지 추가 정보 (프론트엔드에서 활용)
      ontologyData: {
        primaryEmotion: basicAnalysis.emotion,
        detailedEmotion: enrichedEmotion.detailed,
        confidence: enrichedEmotion.intensity === 'intense' ? 0.95 : 0.85,
        relatedEmotions: relatedEmotions.map(e => ({
          name: e.korean,
          probability: e.probability
        }))
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('Error analyzing emotion:', error);
    res.status(500).json({ error: 'Failed to analyze emotion' });
  }
});
```

---

## 2. Phase 2: 피드백 루프 UI

### 2.1 HTML 구조 (index.html 확장)

```html
<!-- AI 응답 카드 - 피드백 포함 -->
<section class="ai-response">
  <div class="response-card" id="response-card">
    <span class="emotion-emoji" id="emotion-emoji">😊</span>

    <div class="emotion-label">
      <span id="emotion-name">감정 이름</span>
      <span class="confidence-indicator" id="confidence"></span>
    </div>

    <p class="empathy-message" id="empathy-message"></p>

    <div class="advice-section">
      <p class="advice-label">행동 제안</p>
      <p class="advice-text" id="advice-text"></p>
    </div>

    <!-- NEW: 피드백 버튼 (조용한 위치) -->
    <div class="feedback-section">
      <p class="feedback-question">이 감정이 맞으셨나요?</p>
      <div class="feedback-buttons">
        <button class="btn-feedback btn-accept" data-feedback="yes" aria-label="네, 맞아요">
          👍
        </button>
        <button class="btn-feedback btn-reject" data-feedback="no" aria-label="아니에요, 다른 감정">
          🤔
        </button>
      </div>
      <p class="feedback-hint">피드백하면 AI가 더 학습합니다</p>
    </div>
  </div>

  <!-- NEW: 피드백 모달 (감정 수정) -->
  <div class="feedback-modal" id="feedback-modal" hidden>
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <h3>당신의 감정은 무엇이었나요?</h3>
      <p class="modal-hint">
        기존 감정: <strong id="modal-existing-emotion"></strong>
      </p>

      <div class="emotion-options">
        <label class="emotion-option">
          <input type="radio" name="emotion" value="희망" />
          <span class="option-emoji">✨</span>
          <span class="option-name">희망</span>
        </label>

        <label class="emotion-option">
          <input type="radio" name="emotion" value="기대감" />
          <span class="option-emoji">🤭</span>
          <span class="option-name">기대감</span>
        </label>

        <label class="emotion-option">
          <input type="radio" name="emotion" value="설렘" />
          <span class="option-emoji">💫</span>
          <span class="option-name">설렘</span>
        </label>

        <label class="emotion-option">
          <input type="radio" name="emotion" value="다른감정" />
          <span class="option-emoji">📝</span>
          <input type="text" placeholder="감정을 입력하세요" class="emotion-input" />
        </label>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-feedback-cancel">
          취소
        </button>
        <button class="btn btn-primary" id="btn-feedback-submit">
          제출
        </button>
      </div>
    </div>
  </div>
</section>
```

### 2.2 CSS 스타일 (피드백 UI)

```css
/* 피드백 섹션 */
.feedback-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(93, 78, 55, 0.1);
  text-align: center;
}

.feedback-question {
  font-size: 0.875rem;
  color: var(--color-text-light);
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.feedback-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.btn-feedback {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-feedback:hover {
  border-color: var(--color-primary);
  background: rgba(232, 168, 124, 0.1);
  transform: scale(1.1);
}

.btn-feedback:active {
  transform: scale(0.95);
}

.btn-feedback.btn-accept:focus,
.btn-feedback.btn-reject:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.feedback-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

/* 피드백 모달 */
.feedback-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.feedback-modal[hidden] {
  display: none;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  animation: fadeIn 200ms ease;
}

.modal-content {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 1.5rem;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.modal-content h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.modal-hint {
  font-size: 0.875rem;
  color: var(--color-text-light);
  margin-bottom: 1.5rem;
}

.emotion-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.emotion-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 200ms ease;
}

.emotion-option input[type="radio"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.emotion-option input[type="radio"]:checked + .option-emoji,
.emotion-option input[type="radio"]:checked + .option-emoji + .option-name {
  color: var(--color-primary);
}

.emotion-option:has(input[type="radio"]:checked) {
  border-color: var(--color-primary);
  background: rgba(232, 168, 124, 0.1);
}

.option-emoji {
  font-size: 1.75rem;
  transition: color 200ms ease;
}

.option-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  transition: color 200ms ease;
}

.emotion-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### 2.3 JavaScript 이벤트 핸들링 (피드백 로직)

```javascript
// 피드백 버튼 클릭
document.addEventListener('click', (e) => {
  const feedbackBtn = e.target.closest('.btn-feedback');
  if (!feedbackBtn) return;

  const feedback = feedbackBtn.dataset.feedback;
  const entryId = document.body.dataset.currentEntryId;

  if (feedback === 'yes') {
    // 긍정 피드백 - 바로 저장
    saveFeedback(entryId, 'accepted', null);
    showFeedbackConfirm('감정이 기록되었습니다!');
  } else if (feedback === 'no') {
    // 부정 피드백 - 모달 열기
    const currentEmotion = document.getElementById('emotion-name').textContent;
    document.getElementById('modal-existing-emotion').textContent = currentEmotion;
    document.getElementById('feedback-modal').removeAttribute('hidden');
  }
});

// 모달 닫기
document.getElementById('btn-feedback-cancel').addEventListener('click', () => {
  document.getElementById('feedback-modal').setAttribute('hidden', '');
});

// 모달 제출
document.getElementById('btn-feedback-submit').addEventListener('click', async () => {
  const selected = document.querySelector('input[name="emotion"]:checked');
  if (!selected) {
    alert('감정을 선택해주세요');
    return;
  }

  let emotion = selected.value;
  if (emotion === '다른감정') {
    emotion = document.querySelector('.emotion-input').value.trim();
    if (!emotion) {
      alert('감정을 입력해주세요');
      return;
    }
  }

  const entryId = document.body.dataset.currentEntryId;
  await saveFeedback(entryId, 'rejected', emotion);

  document.getElementById('feedback-modal').setAttribute('hidden', '');
  showFeedbackConfirm('감정이 수정되었습니다! 감사합니다.');
});

/**
 * 피드백을 서버에 저장
 */
async function saveFeedback(entryId, status, correctedEmotion) {
  try {
    const response = await fetch(`/api/entries/${entryId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: status,
        correctedEmotion: correctedEmotion
      })
    });

    if (!response.ok) throw new Error('Failed to save feedback');

    // 피드백 버튼 비활성화 (중복 제출 방지)
    document.querySelectorAll('.btn-feedback').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });

    return await response.json();
  } catch (error) {
    console.error('Error saving feedback:', error);
  }
}

/**
 * 피드백 확인 메시지 표시
 */
function showFeedbackConfirm(message) {
  const confirm = document.createElement('div');
  confirm.className = 'feedback-confirm';
  confirm.textContent = message;
  confirm.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    animation: slideUp 300ms ease;
    z-index: 999;
  `;
  document.body.appendChild(confirm);

  setTimeout(() => confirm.remove(), 3000);
}
```

---

## 3. Phase 3: 개인화 통찰 섹션

### 3.1 새로운 페이지 라우트 (insights.html)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>당신의 감정 통찰 - AI 공감 다이어리</title>
  <!-- 기존 스타일 링크 -->
</head>
<body>
  <div class="app-container">
    <div class="app-header">
      <a href="/" class="btn-back">← 돌아가기</a>
      <h1>당신의 감정 통찰</h1>
      <p class="insights-date" id="insights-date"></p>
    </div>

    <!-- 로딩 상태 -->
    <div class="insights-loading" id="insights-loading">
      <div class="spinner"></div>
      <p>당신의 감정 패턴을 분석 중입니다...</p>
    </div>

    <!-- 통찰 콘텐츠 (로딩 후 표시) -->
    <div class="insights-content" id="insights-content" hidden>

      <!-- 1. 감정 분포 -->
      <section class="insight-section">
        <h2>📊 지난 30일 감정 분포</h2>
        <div class="emotion-chart" id="emotion-chart">
          <!-- 차트 생성됨 -->
        </div>
        <div class="emotion-list">
          <div class="emotion-item">
            <div class="emotion-dot" style="background: #E8A87C;"></div>
            <span class="emotion-label">불안</span>
            <span class="emotion-count">10회 (35%)</span>
          </div>
          <div class="emotion-item">
            <div class="emotion-dot" style="background: #D4A574;"></div>
            <span class="emotion-label">기대감</span>
            <span class="emotion-count">7회 (25%)</span>
          </div>
          <!-- 추가 항목 -->
        </div>
      </section>

      <!-- 2. 감정 연관성 -->
      <section class="insight-section">
        <h2>🔗 감정 연관성</h2>
        <div class="correlation-graph">
          <p class="correlation-text">
            <strong>"불안"</strong> 다음에는
            <strong>"기대감"</strong>이 나타났어요 (77% 확률)
          </p>
          <div class="correlation-visual">
            불안 <span class="arrow">→</span> 기대감
          </div>
        </div>
        <p class="correlation-insight">
          이는 당신이 도전 앞에서 자연스럽게 기대감을 갖는 성향을 보여줍니다.
        </p>
      </section>

      <!-- 3. 감정 성향 분석 -->
      <section class="insight-section">
        <h2>💡 당신의 감정 성향</h2>
        <div class="tendency-card">
          <h3 id="tendency-type">도전 지향형 (Challenge-Oriented)</h3>
          <p id="tendency-description">
            당신은 새로운 상황과 도전 앞에서 자연스럽게 긴장과 설렘을 함께 느낍니다.
            이는 성장 기회를 적극적으로 받아들이는 긍정적인 성향입니다.
          </p>

          <h4>당신의 강점</h4>
          <ul class="strength-list">
            <li>목표 달성 능력</li>
            <li>환경 적응력</li>
            <li>회복 탄력성</li>
          </ul>
        </div>
      </section>

      <!-- 4. 유사한 상황들 -->
      <section class="insight-section">
        <h2>✨ 유사한 상황의 경험들</h2>
        <p class="similar-situations-note">
          익명으로 보호된 다른 사용자들의 기록들입니다
        </p>

        <div class="similar-situation">
          <h4>"면접 준비"</h4>
          <p class="situation-count">총 15명의 기록</p>
          <div class="emotion-mini-chart">
            <div class="bar" style="width: 40%; background: #E8A87C;">불안 40%</div>
            <div class="bar" style="width: 40%; background: #D4A574;">설렘 40%</div>
            <div class="bar" style="width: 20%; background: #B8A99A;">기타 20%</div>
          </div>
          <button class="btn-read-stories">유사한 일기 읽기</button>
        </div>

        <div class="similar-situation">
          <h4>"면접 합격"</h4>
          <p class="situation-count">총 8명의 기록</p>
          <div class="emotion-mini-chart">
            <div class="bar" style="width: 75%; background: #E8A87C;">기쁨 75%</div>
            <div class="bar" style="width: 25%; background: #D4A574;">자부심 25%</div>
          </div>
          <button class="btn-read-stories">유사한 일기 읽기</button>
        </div>
      </section>

      <!-- 5. 추천 행동 -->
      <section class="insight-section">
        <h2>🎯 당신을 위한 제안</h2>
        <div class="recommendation-card">
          <p>
            당신은 도전 앞에서 기대감을 잘 느끼는 분이군요.
            <strong>다음 도전 앞에서는 "나는 잘 준비했다"는 자신감부터 느껴보세요.</strong>
          </p>
          <p>
            이런 성향을 가진 분들은 결과보다 <strong>과정을 즐기는</strong> 경향이 있습니다.
            성취보다 <strong>배움</strong>에 초점을 맞춰보는 것은 어떨까요?
          </p>
        </div>
      </section>

    </div>
  </div>

  <style>
    /* 기존 CSS 상속 */
    .insights-content {
      animation: fadeIn 400ms ease;
    }

    .insight-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--color-surface-warm);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .insight-section h2 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
      color: var(--color-text);
    }

    .emotion-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .emotion-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--color-surface);
      border-radius: var(--radius-md);
    }

    .emotion-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }

    .emotion-label {
      flex: 1;
      font-weight: 500;
    }

    .emotion-count {
      font-size: 0.875rem;
      color: var(--color-text-light);
    }

    .tendency-card {
      background: var(--color-surface);
      padding: 1rem;
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
    }

    .tendency-card h3 {
      margin-bottom: 0.5rem;
      color: var(--color-primary);
    }

    .strength-list {
      list-style: none;
      margin-top: 0.75rem;
      padding-left: 1rem;
    }

    .strength-list li {
      padding: 0.25rem 0;
      position: relative;
      padding-left: 1.5rem;
    }

    .strength-list li::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: var(--color-primary);
      font-weight: bold;
    }

    .similar-situation {
      background: var(--color-surface);
      padding: 1rem;
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
    }

    .similar-situation h4 {
      margin-bottom: 0.25rem;
    }

    .situation-count {
      font-size: 0.875rem;
      color: var(--color-text-light);
      margin-bottom: 0.75rem;
    }

    .emotion-mini-chart {
      display: flex;
      gap: 2px;
      margin-bottom: 0.75rem;
      border-radius: var(--radius-sm);
      overflow: hidden;
      height: 24px;
    }

    .emotion-mini-chart .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: white;
      font-weight: 500;
    }

    .btn-read-stories {
      width: 100%;
      padding: 0.5rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 200ms ease;
    }

    .btn-read-stories:hover {
      background: var(--color-primary-hover);
    }

    .recommendation-card {
      background: var(--color-surface);
      padding: 1rem;
      border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-md);
    }

    .recommendation-card p {
      line-height: 1.8;
      margin-bottom: 0.75rem;
    }

    .recommendation-card p:last-child {
      margin-bottom: 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>

  <script>
    // 통찰 데이터 로드
    async function loadInsights() {
      try {
        const response = await fetch('/api/insights');
        if (!response.ok) throw new Error('Failed to load insights');

        const data = await response.json();
        renderInsights(data);

        document.getElementById('insights-loading').setAttribute('hidden', '');
        document.getElementById('insights-content').removeAttribute('hidden');
      } catch (error) {
        console.error('Error loading insights:', error);
        document.getElementById('insights-loading').textContent = '통찰을 불러올 수 없습니다.';
      }
    }

    function renderInsights(data) {
      // 날짜 표시
      const now = new Date();
      document.getElementById('insights-date').textContent =
        `${now.getFullYear()}년 ${now.getMonth() + 1}월 분석`;

      // 감정 분포 차트는 실제로 Chart.js 라이브러리 사용 권장
      // 간단한 바 차트 예제:
      const emotionList = document.querySelector('.emotion-list');
      emotionList.innerHTML = data.emotionDistribution
        .map(emotion => `
          <div class="emotion-item">
            <div class="emotion-dot" style="background: ${emotion.color};"></div>
            <span class="emotion-label">${emotion.name}</span>
            <span class="emotion-count">${emotion.count}회 (${emotion.percentage}%)</span>
          </div>
        `).join('');

      // 감정 성향
      const tendency = data.emotionalTendency;
      document.getElementById('tendency-type').textContent = tendency.type;
      document.getElementById('tendency-description').textContent = tendency.description;
    }

    // 페이지 로드 시 통찰 데이터 가져오기
    document.addEventListener('DOMContentLoaded', loadInsights);
  </script>
</body>
</html>
```

### 3.2 백엔드 API 엔드포인트 (server.js 확장)

```javascript
// === 새로운 API: GET /api/insights ===

app.get('/api/insights', async (req, res) => {
  try {
    // 사용자 인증 (추후 구현)
    // const userId = req.user.id;
    const userId = 'anonymous'; // 임시

    const entries = await readEntries();

    // 필터: 지난 30일
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEntries = entries.filter(e =>
      new Date(e.timestamp) > thirtyDaysAgo
    );

    if (recentEntries.length < 3) {
      return res.json({
        message: '3개 이상의 일기가 필요합니다',
        entriesCount: recentEntries.length
      });
    }

    // 감정 분포 계산
    const emotionMap = {};
    recentEntries.forEach(entry => {
      const emotion = entry.ontologyData?.detailedEmotion || entry.emotion;
      emotionMap[emotion] = (emotionMap[emotion] || 0) + 1;
    });

    const emotionDistribution = Object.entries(emotionMap)
      .map(([emotion, count]) => ({
        name: emotion,
        count: count,
        percentage: Math.round((count / recentEntries.length) * 100),
        color: getEmotionColor(emotion)
      }))
      .sort((a, b) => b.count - a.count);

    // 감정 연관성 계산 (간단한 버전)
    const correlations = calculateEmotionCorrelations(recentEntries);

    // 감정 성향 판단
    const tendency = determineEmotionalTendency(emotionDistribution, correlations);

    res.json({
      entriesCount: recentEntries.length,
      emotionDistribution: emotionDistribution,
      emotionCorrelations: correlations,
      emotionalTendency: tendency,
      similarSituations: extractSimilarSituations(recentEntries)
    });

  } catch (error) {
    console.error('Error loading insights:', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

function getEmotionColor(emotion) {
  const colors = {
    "불안": "#E8A87C",
    "기대감": "#D4A574",
    "만족감": "#B8A99A",
    "기쁨": "#F5DEB3",
    "아쉬움": "#DEB887"
  };
  return colors[emotion] || "#C5A572";
}

function calculateEmotionCorrelations(entries) {
  // 연속된 감정들의 패턴 분석
  const correlations = {};

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i].emotion;
    const next = entries[i + 1].emotion;

    if (!correlations[current]) {
      correlations[current] = {};
    }

    correlations[current][next] = (correlations[current][next] || 0) + 1;
  }

  // 확률로 변환
  Object.keys(correlations).forEach(emotion => {
    const total = Object.values(correlations[emotion]).reduce((a, b) => a + b, 0);
    Object.keys(correlations[emotion]).forEach(nextEmotion => {
      correlations[emotion][nextEmotion] =
        correlations[emotion][nextEmotion] / total;
    });
  });

  return correlations;
}

function determineEmotionalTendency(distribution, correlations) {
  // 가장 빈번한 감정 분석
  const top = distribution[0];

  if (top.percentage > 40) {
    return {
      type: "한 가지 감정 중심형",
      description: `당신은 주로 "${top.name}"을(를) 느끼는 분입니다.`,
      strengths: ["일관성", "안정성"]
    };
  } else {
    return {
      type: "도전 지향형 (Challenge-Oriented)",
      description: "당신은 다양한 상황에서 여러 감정을 경험합니다. 특히 도전 앞에서 불안과 기대감을 함께 느끼는 성장 지향적 성향을 보여줍니다.",
      strengths: ["적응력", "회복 탄력성", "목표 달성 능력"]
    };
  }
}

function extractSimilarSituations(entries) {
  // 키워드별로 묶어서 유사 상황 추출
  const situationMap = {};

  entries.forEach(entry => {
    // 간단한 키워드 추출
    const keywords = extractKeywords(entry.text);
    keywords.forEach(keyword => {
      if (!situationMap[keyword]) {
        situationMap[keyword] = [];
      }
      situationMap[keyword].push(entry);
    });
  });

  return Object.entries(situationMap)
    .filter(([_, entries]) => entries.length >= 2)
    .map(([keyword, entries]) => ({
      keyword: keyword,
      count: entries.length,
      emotions: entries.map(e => e.emotion)
    }))
    .slice(0, 3); // 상위 3개만
}
```

---

## 4. 통합 구현 체크리스트

```
Phase 1 (온톨로지 강화):
  ✅ emotionOntology.json 작성
  ✅ OntologyEngine.js 구현
  ✅ POST /api/analyze 개선
  ✅ response 구조 확장 (ontologyData 추가)

Phase 2 (피드백 루프):
  ✅ 피드백 UI (HTML/CSS/JS)
  ✅ POST /api/entries/:id/feedback 엔드포인트
  ✅ profiles.json 스키마 설계
  ✅ FeedbackProcessor.js (선택)

Phase 3 (개인화 통찰):
  ✅ insights.html 페이지
  ✅ GET /api/insights 엔드포인트
  ✅ InsightGenerator.js
  ✅ 통계 시각화 (차트 라이브러리)

추가 권장사항:
  - [ ] 차트 라이브러리 추가 (Chart.js or Recharts)
  - [ ] 암호화 라이브러리 (bcrypt)
  - [ ] 피드백 동시성 처리 (writeLock 확장)
  - [ ] 테스트 작성 (Jest)
  - [ ] 배포 설정 (환경변수 관리)
```

이 프로토타입을 기반으로 실제 구현을 진행할 수 있습니다.
