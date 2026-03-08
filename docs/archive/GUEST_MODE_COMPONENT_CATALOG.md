# Guest 모드 - UI 컴포넌트 카탈로그

**작성일**: 2026-03-06
**용도**: 디자이너 & 개발자 간 명확한 컴포넌트 스펙 제시

---

## 목차

1. [새로운 컴포넌트](#새로운-컴포넌트)
2. [수정된 기존 컴포넌트](#수정된-기존-컴포넌트)
3. [레이아웃 패턴](#레이아웃-패턴)
4. [애니메이션 & 이벤트](#애니메이션--이벤트)
5. [색상 & 타이포그래피](#색상--타이포그래피)

---

## 새로운 컴포넌트

### 1. 게스트 배지 (Guest Badge)

**목적**: 현재 게스트 모드임을 사용자에게 시각적으로 표시

**적용 위치**:
- 입력 필드 라벨 우측 (Demo Page)
- 프로필 영역 (앱 메인, 로그인 전)

**HTML**
```html
<span class="guest-badge" role="status" aria-label="게스트 모드">
  게스트
</span>
```

**CSS**
```css
.guest-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary-hover);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  vertical-align: middle;
  animation: slideInDown 300ms ease;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**상태**:
- 기본: 보이기
- 로그인 후: 숨기기 (display: none)

**접근성**:
- role="status": 스크린 리더가 "게스트 모드 배지" 읽음

---

### 2. 샘플 카드 (Sample Card)

**목적**: 사용자가 빠르게 일기 입력을 시작하도록 함. 예시 제공.

**적용 위치**: Demo Page > 입력 섹션 상단

**HTML**
```html
<div class="demo-samples">
  <button
    class="sample-card"
    data-sample="샘플1"
    aria-label="예시 선택: 오늘은 회의 발표가 있어서 긴장했다"
  >
    <span class="sample-emoji">😰</span>
    <span class="sample-text">오늘은 회의 발표가 있어서 긴장했다</span>
  </button>

  <button class="sample-card" data-sample="샘플2" aria-label="예시 선택: 근데 생각보다 잘 됐어">
    <span class="sample-emoji">😊</span>
    <span class="sample-text">근데 생각보다 잘 됐어</span>
  </button>

  <button class="sample-card" data-sample="샘플3" aria-label="예시 선택: 새 프로젝트 시작인데 설레네">
    <span class="sample-emoji">🤔</span>
    <span class="sample-text">새 프로젝트 시작인데 설레네</span>
  </button>
</div>
```

**CSS**
```css
.demo-samples {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.sample-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  text-align: left;
}

/* Hover 상태 */
.sample-card:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-warm);
  transform: translateX(6px);
  box-shadow: var(--shadow-md);
}

/* Active 상태 (클릭) */
.sample-card:active {
  transform: scale(0.98);
}

/* Focus 상태 (키보드 네비게이션) */
.sample-card:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}

.sample-emoji {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
}

.sample-text {
  font-size: 0.95rem;
  color: var(--color-text);
  line-height: 1.4;
  flex: 1;
}

@media (max-width: 640px) {
  .sample-card {
    padding: 1.25rem;
    gap: 0.75rem;
  }

  .sample-emoji {
    font-size: 1.5rem;
    width: 2rem;
    height: 2rem;
  }

  .sample-text {
    font-size: 0.9rem;
  }
}
```

**JavaScript**
```javascript
document.querySelectorAll('.sample-card').forEach(card => {
  card.addEventListener('click', () => {
    const text = card.querySelector('.sample-text').textContent;
    const textarea = document.querySelector('#diary-input');

    // 텍스트 입력
    textarea.value = text;

    // 포커스 이동
    textarea.focus();

    // 선택 효과
    textarea.select();
    setTimeout(() => {
      textarea.setSelectionRange(text.length, text.length);
    }, 100);

    // 시각적 피드백
    card.style.backgroundColor = 'var(--color-surface-warm)';
  });
});
```

**상태**:
- 기본: border 흐릿함
- Hover: border 강해짐, 배경 따뜻함
- Active: 축소 효과
- Focus: 아웃라인

---

### 3. 저장 상태 인디케이터 (Save Status Indicator)

**목적**: 게스트/회원의 일기 저장 상태를 실시간으로 표시

**적용 위치**: 우상단 고정 (position: fixed)

**HTML**
```html
<div class="save-status" id="save-status" hidden>
  <span class="save-status-icon" aria-hidden="true"></span>
  <span class="save-status-text"></span>
</div>
```

**CSS**
```css
.save-status {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 1000;
  animation: slideInDown 300ms ease forwards;
}

.save-status[hidden] {
  display: none;
}

/* 상태: 저장 중 */
.save-status.saving {
  color: var(--color-text-light);
}

.save-status.saving .save-status-icon {
  animation: spin 1s linear infinite;
}

/* 상태: 저장 완료 */
.save-status.saved {
  color: var(--color-success);
}

/* 상태: 저장 실패 */
.save-status.error {
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 모바일 */
@media (max-width: 640px) {
  .save-status {
    top: auto;
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
    justify-content: center;
  }
}
```

**JavaScript**
```javascript
class SaveStatusIndicator {
  constructor(containerId = 'save-status') {
    this.el = document.getElementById(containerId);
    this.hideTimer = null;
  }

  show(status, message) {
    clearTimeout(this.hideTimer);

    const iconMap = {
      saving: '⏳',
      saved: '✓',
      error: '❌',
    };

    this.el.querySelector('.save-status-icon').textContent = iconMap[status];
    this.el.querySelector('.save-status-text').textContent = message;
    this.el.className = `save-status ${status}`;
    this.el.hidden = false;

    // 성공 상태는 2초 후 자동 숨김
    if (status === 'saved') {
      this.hideTimer = setTimeout(() => this.hide(), 2000);
    }
  }

  hide() {
    this.el.hidden = true;
  }
}

const saveStatus = new SaveStatusIndicator();

// 사용 예시
async function saveDiary(entry) {
  saveStatus.show('saving', '저장 중...');

  try {
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!response.ok) throw new Error('Save failed');
    saveStatus.show('saved', '저장 완료');
  } catch (err) {
    saveStatus.show('error', '저장 실패. 재시도하세요.');
  }
}
```

**상태**:
- `saving`: ⏳ 아이콘 + 회전 애니메이션
- `saved`: ✓ 아이콘 + 초록색 + 2초 후 자동 숨김
- `error`: ❌ 아이콘 + 빨강색 + 수동 닫기

---

### 4. 피드백 버튼 (Feedback Buttons)

**목적**: 사용자가 AI 감정 분석의 정확도를 평가하고, 앱 학습에 기여하게 함

**적용 위치**: 응답 카드 하단 (2초 후 표시)

**HTML**
```html
<div class="response-feedback" id="feedback-section" hidden>
  <p class="feedback-question">이 분석이 도움이 됐나요?</p>

  <div class="feedback-buttons">
    <button
      class="btn btn-secondary feedback-btn"
      id="btn-feedback-yes"
      data-feedback="yes"
      aria-label="도움이 됐어요. 이 감정 분석이 정확합니다."
    >
      👍 도움이 됐어요
    </button>

    <button
      class="btn btn-secondary feedback-btn"
      id="btn-feedback-no"
      data-feedback="no"
      aria-label="다른 감정이 맞는데요. 감정 수정 모달을 열기."
    >
      🤔 다른 감정이 맞는데요?
    </button>
  </div>
</div>
```

**CSS**
```css
.response-feedback {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-divider);
  text-align: center;
  animation: fadeInUp 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: 200ms;
}

.feedback-question {
  font-size: 0.95rem;
  color: var(--color-text);
  margin-bottom: 1.25rem;
  font-weight: 500;
}

.feedback-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.feedback-btn {
  flex: 1;
  max-width: 180px;
  font-size: 0.9rem;
  padding: 0.75rem 1.25rem;
}

.feedback-btn:hover {
  background-color: var(--color-surface-warm);
}

.feedback-btn:active {
  transform: scale(0.95);
}

@media (max-width: 640px) {
  .feedback-buttons {
    flex-direction: column;
    gap: 0.75rem;
  }

  .feedback-btn {
    max-width: 100%;
    width: 100%;
  }

  .feedback-question {
    font-size: 0.9rem;
  }
}
```

**JavaScript**
```javascript
document.querySelectorAll('.feedback-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const feedback = e.target.dataset.feedback;

    // 피드백 저장 (백엔드)
    saveFeedback(feedback);

    // 시각적 피드백
    btn.style.opacity = '0.5';
    btn.disabled = true;

    // 확인 메시지
    const msg = feedback === 'yes' ? '감사합니다! 😊' : '알겠습니다. 더 개선하겠습니다.';
    setTimeout(() => {
      alert(msg);
    }, 200);
  });
});

async function saveFeedback(feedback) {
  const currentEntry = getCurrentEntry();
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: currentEntry.id,
        feedback,
      }),
    });
  } catch (err) {
    console.error('Feedback save failed:', err);
  }
}
```

**상태**:
- 기본: 활성화, 클릭 가능
- Hover: 배경 따뜻함
- Active: 축소 + disabled

---

### 5. 회원가입 유도 모달 (Signup Prompt Modal)

**목적**: 게스트 사용자가 3-5개 일기 작성 후 영구 저장의 이점을 강조하며 회원가입 유도

**적용 위치**: 모달 (overlay)

**HTML**
```html
<div class="modal" id="modal-signup-prompt" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
  <div class="modal-overlay"></div>

  <div class="modal-content">
    <button class="modal-close" id="modal-close" aria-label="닫기">
      ✕
    </button>

    <div class="modal-header">
      <h2 id="modal-title" class="modal-title">이 일기를 저장하고 싶으신가요?</h2>
      <p class="modal-subtitle">
        게스트 모드로는 최대 10개 일기를 7일 동안 임시 저장할 수 있습니다.
      </p>
    </div>

    <div class="modal-body">
      <!-- 비교표 -->
      <table class="comparison-table">
        <thead>
          <tr>
            <th>기능</th>
            <th>게스트 모드</th>
            <th class="highlighted">회원 모드</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>일기 쓰기</td>
            <td><span class="checkmark">✓</span> 최대 10개</td>
            <td><span class="checkmark">✓</span> 무제한</td>
          </tr>
          <tr>
            <td>감정 분석</td>
            <td><span class="checkmark">✓</span> 임시 저장</td>
            <td><span class="checkmark">✓</span> 영구 저장</td>
          </tr>
          <tr>
            <td>감정 통계</td>
            <td><span class="checkmark">✓</span> 기본</td>
            <td><span class="checkmark">✓</span> 심화 분석</td>
          </tr>
          <tr>
            <td>데이터 보관</td>
            <td>7일</td>
            <td class="highlighted">영구 (암호화)</td>
          </tr>
          <tr>
            <td>비용</td>
            <td>무료</td>
            <td class="highlighted">무료</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-footer">
      <button class="btn btn-primary btn-large" id="btn-signup-modal">
        회원가입하기
      </button>
      <button class="btn btn-secondary" id="btn-skip-modal">
        나중에
      </button>
    </div>

    <div class="modal-note">
      💡 게스트 데이터는 암호화되어 저장되며, 언제든 로그인하면 가져올 수 있습니다.
    </div>
  </div>
</div>
```

**CSS**
```css
.modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal[hidden] {
  display: none;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  animation: fadeIn 300ms ease;
}

.modal-content {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color 200ms ease;
  border-radius: 4px;
  z-index: 1;
}

.modal-close:hover {
  color: var(--color-text);
  background: var(--color-divider);
}

.modal-header {
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid var(--color-divider);
}

.modal-title {
  font-size: 1.3rem;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.modal-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-light);
  line-height: 1.5;
}

.modal-body {
  padding: 2rem;
}

/* 비교표 */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.comparison-table thead {
  background: var(--color-surface-warm);
}

.comparison-table th {
  text-align: left;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  font-weight: 600;
  color: var(--color-text);
}

.comparison-table th.highlighted {
  background: linear-gradient(135deg, #FEF3E2 0%, #FCE4D6 100%);
}

.comparison-table td {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.comparison-table tr:nth-child(even) td {
  background: var(--color-surface-warm);
}

.comparison-table .checkmark {
  color: var(--color-success);
  font-weight: 700;
  margin-right: 0.25rem;
}

.comparison-table .highlighted {
  background: var(--color-success-bg);
  font-weight: 600;
  color: var(--color-success);
}

.modal-footer {
  padding: 2rem;
  border-top: 1px solid var(--color-divider);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1rem;
}

.modal-note {
  padding: 0 2rem 2rem;
  font-size: 0.85rem;
  color: var(--color-text-light);
  text-align: center;
  line-height: 1.5;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 모바일 */
@media (max-width: 640px) {
  .modal {
    align-items: flex-end;
    padding: 0;
  }

  .modal-content {
    width: 100%;
    max-height: 90vh;
    border-radius: 20px 20px 0 0;
  }

  .modal-header {
    padding: 1.5rem 1.5rem 1rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    padding: 1.5rem;
  }

  .modal-title {
    font-size: 1.1rem;
  }

  .modal-close {
    top: 1rem;
    right: 1rem;
    width: 1.75rem;
    height: 1.75rem;
  }

  .comparison-table {
    font-size: 0.8rem;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 0.5rem;
  }

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
  }
}
```

**JavaScript**
```javascript
class SignupPromptModal {
  constructor(modalId = 'modal-signup-prompt') {
    this.modal = document.getElementById(modalId);
    this.setupListeners();
  }

  setupListeners() {
    document.getElementById('modal-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-signup-modal')?.addEventListener('click', () => this.handleSignup());
    document.getElementById('btn-skip-modal')?.addEventListener('click', () => this.close());

    // Overlay 클릭으로 닫기
    this.modal?.querySelector('.modal-overlay')?.addEventListener('click', () => this.close());

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.hidden) {
        this.close();
      }
    });
  }

  show() {
    this.modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.hidden = true;
    document.body.style.overflow = 'auto';
  }

  handleSignup() {
    // 회원가입 화면으로 이동
    showScreen('auth');
    this.close();
  }
}

const signupModal = new SignupPromptModal();

// 회원가입 유도 타이밍
function shouldShowSignupPrompt() {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const entryCount = getGuestEntryCount();
  const lastPromptTime = localStorage.getItem('last_signup_prompt');
  const now = Date.now();

  // 게스트 + 3개 이상 + 마지막 프롬프트 이후 1시간 경과
  return (
    isGuest &&
    entryCount >= 3 &&
    (!lastPromptTime || now - parseInt(lastPromptTime) > 3600000)
  );
}

// 응답 표시 후 타이밍
async function showResponse(response) {
  const container = document.querySelector('#response-container');
  renderResponseCard(response, container);
  container.hidden = false;

  // 회원가입 유도 (조건 만족 시)
  setTimeout(() => {
    if (shouldShowSignupPrompt()) {
      signupModal.show();
      localStorage.setItem('last_signup_prompt', Date.now().toString());
    }
  }, 5000);
}
```

---

## 수정된 기존 컴포넌트

### 1. Header (상단 네비게이션)

**변경사항**:
- Landing Page에서 "[로그인] [체험해보기]" 버튼 추가
- Demo Page에서 "[뒤로 가기] [로그인]" 버튼

**HTML**
```html
<!-- Landing Page Header -->
<header class="header header-landing">
  <div class="header-container">
    <a href="#" class="logo" id="logo-landing">Sentimind</a>

    <nav class="header-nav">
      <button class="btn btn-secondary btn-small" id="btn-login-header">
        로그인
      </button>
      <button class="btn btn-primary btn-small" id="btn-demo-header">
        체험해보기
      </button>
    </nav>
  </div>
</header>

<!-- Demo Page Header -->
<header class="header header-demo" hidden>
  <div class="header-container">
    <button class="btn btn-secondary btn-icon" id="btn-back" aria-label="뒤로 가기">
      ←
    </button>
    <a href="#" class="logo">Sentimind</a>
    <button class="btn btn-secondary btn-small" id="btn-login-header-demo">
      로그인
    </button>
  </div>
</header>
```

**CSS**
```css
.header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-divider);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1rem 0;
}

.header-container {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-family: var(--font-diary);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}

.header-nav {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.btn-icon {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}
```

---

### 2. 입력 필드 (Enhanced Diary Input)

**변경사항**:
- 게스트 배지 추가
- 문자 카운트 개선
- 포커스 스타일 개선

**HTML**
```html
<div class="demo-input-section">
  <div class="input-header">
    <label for="diary-input">
      <span>오늘 하루를 한 줄로 정리해보세요</span>
      <span class="guest-badge" id="guest-badge">게스트</span>
    </label>

    <span class="char-count" aria-live="polite">
      <span id="char-current">0</span> / 500
    </span>
  </div>

  <textarea
    id="diary-input"
    class="diary-textarea"
    placeholder="예: 오늘 발표를 마쳤어. 많이 떨렸지만 끝낼 수 있어서 다행이야."
    maxlength="500"
    aria-describedby="char-count"
  ></textarea>

  <div class="input-footer">
    <button
      id="btn-analyze"
      class="btn btn-primary"
      disabled
      aria-label="입력한 일기를 분석하기"
    >
      분석하기
    </button>
  </div>
</div>
```

**CSS 개선**
```css
.input-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
}

.input-header label {
  font-weight: 500;
  color: var(--color-text);
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.char-count {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.diary-textarea {
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-diary);
  font-size: 0.95rem;
  color: var(--color-text);
  resize: vertical;
  transition: all 200ms ease;
}

.diary-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(232, 168, 124, 0.1);
}

.diary-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 모바일: 줌 방지를 위해 폰트 크기 ≥ 16px */
@media (max-width: 640px) {
  .diary-textarea {
    font-size: 16px;
  }
}
```

**JavaScript 개선**
```javascript
const textArea = document.querySelector('#diary-input');
const charCount = document.querySelector('#char-current');
const analyzeBtn = document.querySelector('#btn-analyze');

textArea.addEventListener('input', () => {
  const count = textArea.value.length;
  charCount.textContent = count;

  // 1글자 이상 입력 시 버튼 활성화
  analyzeBtn.disabled = count === 0;

  // 접근성: ARIA live region 업데이트
  charCount.parentElement.setAttribute('aria-live', 'polite');
});

// 엔터+Ctrl/Cmd로 분석
textArea.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !analyzeBtn.disabled) {
    analyzeBtn.click();
  }
});
```

---

## 레이아웃 패턴

### 1. 2열 레이아웃 (데스크톱)

**적용 대상**: Landing Page, Demo Page

```css
@media (min-width: 768px) {
  .page-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 2rem;
    align-items: start;
  }

  .page-main {
    grid-column: 1;
  }

  .page-sidebar {
    grid-column: 2;
    position: sticky;
    top: 1rem;
  }
}
```

---

### 2. 스크린 전환 (Screen Navigation)

```javascript
class ScreenManager {
  constructor() {
    this.screens = {
      landing: document.querySelector('[data-screen="landing"]'),
      demo: document.querySelector('[data-screen="demo"]'),
      auth: document.querySelector('[data-screen="auth"]'),
      app: document.querySelector('[data-screen="app"]'),
    };

    this.currentScreen = null;
    this.setupTransitions();
  }

  setupTransitions() {
    // 모든 화면 전환 버튼 연결
    document.querySelector('#btn-demo-header')?.addEventListener('click', () => {
      this.show('demo');
    });

    document.querySelector('#btn-back')?.addEventListener('click', () => {
      this.show('landing');
    });

    document.querySelector('#btn-signup-modal')?.addEventListener('click', () => {
      this.show('auth');
    });

    // 회원가입 성공 후 앱으로
    document.querySelector('#btn-login-success')?.addEventListener('click', () => {
      this.show('app');
    });
  }

  show(screenName) {
    // 이전 화면 숨김
    if (this.currentScreen && this.screens[this.currentScreen]) {
      this.screens[this.currentScreen].hidden = true;
    }

    // 새 화면 표시 + 애니메이션
    const screen = this.screens[screenName];
    screen.hidden = false;
    screen.style.animation = 'fadeInUp 500ms ease';

    this.currentScreen = screenName;

    // 스크롤 위치 초기화
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const screenManager = new ScreenManager();
```

---

## 애니메이션 & 이벤트

### 1. 진입 애니메이션

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 요소별 적용 */
.hero { animation: fadeInUp 500ms ease 100ms both; }
.feature-cards { animation: fadeInUp 500ms ease 200ms both; }
.sample-card { animation: fadeInUp 500ms ease calc(100ms * var(--index)) both; }
```

### 2. Hover & 상호작용

```css
/* 버튼 */
.btn {
  transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.btn:hover {
  transform: translateY(-2px);
}

.btn:active {
  transform: scale(0.95);
}

/* 카드 */
.sample-card {
  transition: all 200ms ease;
}

.sample-card:hover {
  border-color: var(--color-primary);
  transform: translateX(6px);
}
```

---

## 색상 & 타이포그래피

### 1. 업데이트된 색상 팔레트

| 용도 | 변수명 | 값 | 용도 |
|------|--------|-----|------|
| 배경 | `--color-bg` | #FFF8F0 | 페이지 배경 |
| 표면 | `--color-surface` | #FFFFFF | 카드, 모달 |
| 따뜻한 표면 | `--color-surface-warm` | #FEF3E2 | Hover, Featured |
| Primary CTA | `--color-primary` | #E8A87C | 주 버튼 |
| Primary Hover | `--color-primary-hover` | #D4956A | 호버 상태 |
| 텍스트 | `--color-text` | #5D4E37 | 본문 |
| 텍스트 Muted | `--color-text-muted` | #7D6F5C | 부 텍스트 |
| 경계 | `--color-border` | #E8DDD0 | 구분선 |
| 성공 | `--color-success` | #2e7d32 | 저장 완료 |
| 오류 | `--color-error` | #c62828 | 오류 메시지 |

### 2. 타이포그래피

```css
/* 제목 */
.hero-title {
  font-family: var(--font-diary);
  font-size: clamp(1.8rem, 1.5rem + 2vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
}

/* 본문 */
.prose {
  font-family: var(--font-body);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text);
}

/* 라벨 */
.label {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
```

---

**문서 작성 완료**: 2026-03-06
**상태**: 컴포넌트 스펙 완성, 개발 준비 완료
