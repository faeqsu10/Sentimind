# Guest 모드 도입 - 전체 UX 설계 (v2.0)

**작성일**: 2026-03-06
**설계자**: Claude Code (UX Designer Agent)
**목표**: 신규 사용자의 첫 진입 경험을 개선하고, 로그인 전 체험을 통해 회원가입 전환율 증대

---

## 목차

1. [설계 원칙](#설계-원칙)
2. [정보 아키텍처 (IA)](#정보-아키텍처-ia)
3. [페이지 구조 및 와이어프레임](#페이지-구조-및-와이어프레임)
4. [상세 화면 설계](#상세-화면-설계)
5. [UI 컴포넌트 명세](#ui-컴포넌트-명세)
6. [사용자 여정 맵](#사용자-여정-맵)
7. [프로토타입 구현 가이드](#프로토타입-구현-가이드)
8. [접근성 & 모바일 대응](#접근성--모바일-대응)

---

## 설계 원칙

### P1: 마찰 최소화 (Zero-Friction Entry)
- **현재**: 로그인 강제 → 신규 사용자 이탈
- **변경**: "로그인 없이 즉시 체험" 옵션 제공
- **목표**: 3초 내 첫 일기 입력 가능

### P2: 점진적 전환 (Progressive Commitment)
- Phase 1: 무로그인 데모 (1-2분)
- Phase 2: 게스트 모드 (최대 10개 일기, 7일 저장)
- Phase 3: 회원가입 유도 (데이터 영구 보관 시점)

### P3: 신뢰 구축 (Trust & Transparency)
- "일기는 5일 후 삭제됩니다" 명시
- "데이터가 암호화되어 저장됩니다" 안내
- "언제든 로그인하고 데이터를 가져갈 수 있습니다" 옵션

### P4: 일관된 디자인 (Design System Consistency)
- 모든 페이지는 기존 Sentimind 컬러/타이포그래피 유지
- 새로운 컴포넌트도 동일한 변수 사용

---

## 정보 아키텍처 (IA)

### 현재 구조
```
/
├── /index.html [로그인 강제]
    ├── [로그인 폼]
    ├── [회원가입 폼]
    └── [앱 메인 (로그인 후)]
```

### 제안 구조 (Single HTML 유지)
```
/ [index.html - 모든 화면을 포함]
├─ Screen 1: Landing Page
│  ├─ Hero Section
│  ├─ Features (3 Cards)
│  ├─ CTA: "무료로 시작하기" (Demo 진입)
│  ├─ FAQ (5개 질문)
│  └─ Footer
│
├─ Screen 2: Demo Page
│  ├─ Title: "로그인 없이 체험해보세요"
│  ├─ 3개 샘플 선택지
│  ├─ 또는 "나만의 일기 쓰기" 입력
│  ├─ "분석하기" 버튼
│  └─ AI 응답 + "회원가입 유도 CTA"
│
├─ Screen 3: 회원가입 유도 모달
│  ├─ 비교표 (게스트 vs 회원)
│  ├─ "회원가입하기" (강 CTA)
│  └─ "나중에" (약 CTA)
│
├─ Screen 4: 회원가입/로그인 (기존 유지)
│  ├─ 탭: [회원가입] [로그인]
│  └─ 폼
│
└─ Screen 5: 앱 메인 (로그인 후)
   ├─ 일기 입력
   ├─ 응답 카드
   ├─ 히스토리
   ├─ 통계 (데스크톱)
   └─ 프로필/로그아웃
```

### 기술 구현 전략 (Single HTML 유지)
```javascript
// 각 화면은 <section hidden> 블록으로 관리
// JavaScript에서 .hidden 토글로 화면 전환

const screens = {
  landing: document.querySelector('[data-screen="landing"]'),
  demo: document.querySelector('[data-screen="demo"]'),
  auth: document.querySelector('[data-screen="auth"]'),
  app: document.querySelector('[data-screen="app"]'),
  signupPrompt: document.querySelector('[data-screen="signup-prompt"]'),
};

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.hidden = true);
  screens[screenName].hidden = false;
}

// 사용자 상태에 따라 진입점 결정
window.addEventListener('load', () => {
  const userState = determineUserState(); // guest | member | demo
  if (userState === 'demo') showScreen('landing');
  else if (userState === 'guest') showScreen('app');
  else showScreen('app'); // member
});
```

---

## 페이지 구조 및 와이어프레임

### 1. Landing Page (신규 방문자 진입점)

```
┌─────────────────────────────────────────────────────────────┐
│ Header (Sticky)                                             │
│ ┌──────────────────────────────────────────────────────────┐
│ │ Sentimind Logo                    [로그인] [체험해보기]   │
│ └──────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Hero Section (클릭 유도)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│         당신의 감정을 이해하는 AI 일기장 🧠💭               │
│                                                              │
│    하루 한 줄 감정 기록, AI가 공감해드려요                    │
│                                                              │
│  [우측: 응답 카드 스크린샷 또는 이모지 일러스트]             │
│                                                              │
│         [무료로 시작하기] (큰 버튼, 프라이머리 컬러)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Features Section (3 Cards)                                   │
├──────────────────┬──────────────────┬──────────────────────┤
│ 🧠 감정 분석      │ 💬 공감 응답      │ 📊 감정 통계         │
│                  │                  │                     │
│ Gemini AI가      │ 따뜻한 위로와    │ 일주일/월별 패턴을  │
│ 감정을 읽어요     │ 조언이 돌아와요  │ 시각화해요          │
│                  │                  │                     │
│ (짧은 설명)      │ (짧은 설명)      │ (짧은 설명)          │
└──────────────────┴──────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FAQ Section (Accordion)                                      │
├─────────────────────────────────────────────────────────────┤
│ Q1: 데이터는 안전한가요?                      [▼]           │
│ A: 일기는 암호화되어 저장되며, 개인 정보 수집 안 함         │
│                                                              │
│ Q2: AI는 내 일기를 학습에 사용하나요?         [▶]           │
│ A: 아니요. 당신의 일기는 순수하게 당신을 위해서만 사용됩니다│
│                                                              │
│ Q3: 로그인 없어도 써볼 수 있나요?             [▶]           │
│ A: 네. 최대 10개 일기를 7일 동안 무료로 시험해볼 수 있습니다│
│                                                              │
│ Q4: 처음 써보는데 쉬울까요?                  [▶]           │
│ A: 아주 간단합니다. 일기를 입력하고 분석 버튼만 누르세요    │
│                                                              │
│ Q5: 비용이 있나요?                          [▶]           │
│ A: 회원가입은 무료입니다. AI 분석도 무료 제공합니다         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CTA Section (다시 한 번)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│           [무료로 시작하기]                                   │
│                                                              │
│    이미 계정이 있으신가요? [로그인하기]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Footer                                                       │
├─────────────────────────────────────────────────────────────┤
│ About  |  Privacy  |  Terms  |  GitHub  |  © 2026 Sentimind│
└─────────────────────────────────────────────────────────────┘
```

**설계 의도**:
- Hero가 즉시 주의를 끔 (시선 집중)
- Features는 "뭘 할 수 있나"를 3초 내 이해 가능하게 함
- FAQ는 저항 심리(신뢰, 비용, 보안) 선제적 제거
- 모바일: 1열 레이아웃 (모든 섹션이 세로 스택)

---

### 2. Demo Page (로그인 전 체험)

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                      │
│ [Sentimind Logo] [뒤로 가기] [로그인]                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Title Section                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  로그인 없이 체험해보세요                                      │
│                                                              │
│  아래 예시를 선택하거나 직접 작성해보세요                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Sample Selection (Interactive Cards)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Card 1]                                                   │
│  "오늘은 회의 발표가 있어서 긴장했다 😰"                    │
│  → 클릭하면 이 텍스트가 입력 필드에 채워짐                   │
│                                                              │
│  [Card 2]                                                   │
│  "근데 생각보다 잘 됐어 😊"                                 │
│                                                              │
│  [Card 3]                                                   │
│  "새 프로젝트 시작인데 설레네 🤔"                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Divider (시각적 구분)                                        │
│           ━━━ 또는 ━━━                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Diary Input Section (현재 앱과 동일)                         │
├─────────────────────────────────────────────────────────────┤
│ [텍스트 입력 필드]                                            │
│ 최대 500자 | 현재 0/500                                     │
│                                                              │
│ [분석하기 버튼] (활성화/비활성화)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

[사용자가 분석 버튼을 누르면]
     ↓
┌─────────────────────────────────────────────────────────────┐
│ Loading State (3점 점프 애니메이션)                          │
│                                                              │
│        감정을 분석하는 중입니다... ●  ●  ●               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

[2-3초 후]
     ↓
┌─────────────────────────────────────────────────────────────┐
│ AI Response Card (기존 디자인 유지)                          │
├─────────────────────────────────────────────────────────────┤
│ 😰 → 😊 [신뢰도: 85% ████████░]                             │
│                                                              │
│ 주요 감정: 긴장                                               │
│ └─ 중분류: 불안감                                            │
│    └─ 세부: 수행불안                                         │
│                                                              │
│ 💼 업무/성취 관련 상황으로 분석되었어요                      │
│                                                              │
│ 공감 메시지:                                                 │
│ "회의 발표 앞의 긴장감, 정말 자연스러워요. 그리고 그런       │
│  당신이 생각보다 잘해내셨다는 것도요. 당신의 노력이          │
│  빛난 순간이었을 거예요."                                    │
│                                                              │
│ 💡 제안: 다음에는 발표 전에 깊게 숨을 쉬며 신체를           │
│         이완해 보세요. 효과적인 불안 완화법입니다.          │
│                                                              │
│ [👍 도움이 됐어요] [🤔 다른 감정이 맞는데요?]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

[하단: 회원가입 유도]
     ↓
┌─────────────────────────────────────────────────────────────┐
│ Signup Prompt Card (Soft Prompt)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  멋진데요? 이 일기를 저장하고 싶으신가요?                     │
│                                                              │
│  [회원가입하기] [나중에]                                     │
│                                                              │
│  * 게스트 모드로는 최대 10개 일기를 7일 동안 임시 저장할 수 │
│    있습니다. 영구 보관을 원하시면 회원가입해주세요.         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**설계 의도**:
- 샘플 카드: 입력의 진입장벽을 낮춤
- 또는 구분선: 사용자의 선택권 강조 (자유도)
- 응답 후 피드백: 사용자가 "이 앱이 나한테 좋다"는 확신 주기
- 회원가입 유도: Soft하되, 명확한 가치 제시

---

### 3. 회원가입 유도 모달 (Decision Point)

```
┌─────────────────────────────────────────────────────────────┐
│ Modal Overlay                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  이 일기를 저장하시겠어요?                              │  │
│  │                                                        │  │
│  │  ┌──────────────────┬──────────────────────────────┐ │  │
│  │  │  게스트 모드     │  회원 모드 (권장)           │ │  │
│  │  ├──────────────────┼──────────────────────────────┤ │  │
│  │  │ 일기 쓰기   ✓   │ 일기 쓰기                ✓  │ │  │
│  │  │ (최대 10개)      │ (무제한)                     │ │  │
│  │  ├──────────────────┼──────────────────────────────┤ │  │
│  │  │ 감정 분석   ✓   │ 감정 분석                ✓  │ │  │
│  │  │ (임시 저장)      │ (영구 저장)                  │ │  │
│  │  ├──────────────────┼──────────────────────────────┤ │  │
│  │  │ 통계     ✓      │ 통계                     ✓  │ │  │
│  │  │ (기본)           │ (심화 분석)                  │ │  │
│  │  ├──────────────────┼──────────────────────────────┤ │  │
│  │  │ 데이터 보관      │                              │ │  │
│  │  │ 7일               │ 영구 (암호화)                │ │  │
│  │  │                  │                              │ │  │
│  │  │ 비용: 무료        │ 비용: 무료                    │ │  │
│  │  └──────────────────┴──────────────────────────────┘ │  │
│  │                                                        │  │
│  │  [회원가입하기 (강 CTA)]                               │  │
│  │  [나중에 (약 CTA)]                                     │  │
│  │                                                        │  │
│  │  * 게스트 데이터는 암호화되어 저장됩니다.                │  │
│  │  * 언제든 로그인하면 게스트 데이터를 가져올 수 있습니다. │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**설계 의도**:
- 비교표로 두 가지 선택지의 차이를 명확히 함
- "권장" 뱃지로 유도하되, 강요하지 않음
- 하단 설명으로 신뢰 구축 (데이터 보안, 유연성)
- 모바일: 모달 대신 풀스크린 시트로 표시

---

## 상세 화면 설계

### Screen A: Landing Page - 상세 스펙

**목표**: 신규 방문자가 Sentimind의 가치를 30초 내 이해하고 "체험해보기" CTA를 클릭

#### A1. Hero Section

```html
<section class="hero" data-screen="landing">
  <div class="hero-content">
    <h1 class="hero-title">당신의 감정을 이해하는 AI 일기장</h1>
    <p class="hero-subtitle">하루 한 줄 감정 기록, AI가 공감해드려요</p>

    <!-- 우측: 일러스트레이션 또는 스크린샷 -->
    <div class="hero-visual">
      <img src="/assets/hero-illustration.svg" alt="AI가 감정을 분석하는 스크린샷">
    </div>

    <button class="btn btn-primary btn-large" id="cta-demo">
      무료로 시작하기
    </button>
  </div>
</section>
```

**CSS 변수**:
```css
--hero-bg: linear-gradient(135deg, #FFF8F0 0%, #FEF3E2 100%);
--hero-title-size: clamp(1.8rem, 1.5rem + 2vw, 2.5rem);
--hero-subtitle-size: clamp(1rem, 0.9rem + 0.5vw, 1.2rem);
```

**레이아웃**:
- 데스크톱: 좌측 텍스트 (50%) + 우측 이미지 (50%)
- 모바일: 전체 텍스트 + 이미지 (100% 너비, 세로 스택)

---

#### A2. Features Section

```html
<section class="features" data-screen="landing">
  <h2 class="section-title">Sentimind의 특징</h2>

  <div class="feature-cards">
    <article class="feature-card">
      <div class="feature-icon">🧠</div>
      <h3 class="feature-title">감정 분석</h3>
      <p class="feature-desc">
        Gemini AI가 당신의 일기를 읽고 감정을 5단계로 분석해요
      </p>
    </article>

    <article class="feature-card">
      <div class="feature-icon">💬</div>
      <h3 class="feature-title">공감 응답</h3>
      <p class="feature-desc">
        따뜻한 위로와 구체적인 행동 제안이 돌아와요
      </p>
    </article>

    <article class="feature-card">
      <div class="feature-icon">📊</div>
      <h3 class="feature-title">감정 통계</h3>
      <p class="feature-desc">
        일주일/월별 패턴을 시각화해서 자신을 더 잘 알게 돼요
      </p>
    </article>
  </div>
</section>
```

**CSS 그리드**:
```css
.feature-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 2rem 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: all 300ms ease;
}

.feature-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}
```

---

#### A3. FAQ Section (Accordion)

```html
<section class="faq" data-screen="landing">
  <h2 class="section-title">자주 묻는 질문</h2>

  <div class="accordion">
    <details class="accordion-item" open>
      <summary class="accordion-header">
        <span>데이터는 안전한가요?</span>
        <span class="accordion-icon">▼</span>
      </summary>
      <div class="accordion-content">
        <p>당신의 일기는 끝단 암호화되어 저장되며, 개인 정보 수집 또는 판매는 절대 없습니다.
        자세히는 <a href="/privacy">개인정보처리방침</a>을 참고해주세요.</p>
      </div>
    </details>

    <!-- 더 많은 FAQ... -->
  </div>
</section>
```

**Accordion 애니메이션**:
```css
.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 300ms ease;
  opacity: 0;
}

.accordion-item[open] .accordion-content {
  max-height: 500px;
  opacity: 1;
}
```

---

### Screen B: Demo Page - 상세 스펙

**목표**: 사용자가 1-2분 내 첫 일기를 입력하고 AI 응답을 받으며, "이거 괜찮은데?" 신호를 느낌

#### B1. Sample Cards (Interactive Selection)

```html
<div class="demo-samples">
  <button class="sample-card" data-sample="긴장">
    <span class="sample-emoji">😰</span>
    <span class="sample-text">오늘은 회의 발표가 있어서 긴장했다</span>
  </button>

  <button class="sample-card" data-sample="기쁨">
    <span class="sample-emoji">😊</span>
    <span class="sample-text">근데 생각보다 잘 됐어</span>
  </button>

  <button class="sample-card" data-sample="설렘">
    <span class="sample-emoji">🤔</span>
    <span class="sample-text">새 프로젝트 시작인데 설레네</span>
  </button>
</div>

<script>
document.querySelectorAll('.sample-card').forEach(card => {
  card.addEventListener('click', () => {
    const text = card.querySelector('.sample-text').textContent;
    document.querySelector('#diary-input').value = text;
    document.querySelector('#diary-input').focus();
  });
});
</script>
```

**CSS**:
```css
.sample-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 200ms ease;
}

.sample-card:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-warm);
}

.sample-emoji {
  font-size: 1.8rem;
  line-height: 1;
}

.sample-text {
  text-align: left;
  font-size: 0.95rem;
  color: var(--color-text);
}
```

---

#### B2. 입력 필드 (현재와 동일하되, 게스트 배지 추가)

```html
<div class="demo-input-section">
  <div class="input-header">
    <label for="diary-input">
      <span>오늘 하루를 한 줄로 정리해보세요</span>
      <span class="guest-badge">게스트 모드</span>
    </label>
  </div>

  <textarea
    id="diary-input"
    class="diary-textarea"
    placeholder="예: 오늘은 정말 피곤했는데, 친구를 만나서 기분이 좋아졌다"
    maxlength="500"
  ></textarea>

  <div class="input-footer">
    <span class="char-count">0 / 500</span>
    <button id="btn-analyze" class="btn btn-primary" disabled>
      분석하기
    </button>
  </div>
</div>

<style>
.guest-badge {
  display: inline-block;
  font-size: 0.75rem;
  background: var(--color-primary-hover);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  font-weight: 500;
}
</style>
```

---

#### B3. AI 응답 카드 (기존 + 피드백 버튼)

```html
<div class="response-card" id="response-container" hidden>
  <!-- 감정 분석 (기존) -->
  <div class="emotion-analysis">
    <!-- ... 기존 응답 카드 내용 ... -->
  </div>

  <!-- 새로 추가: 피드백 버튼 (2초 후 나타남) -->
  <div class="response-feedback" id="feedback-section" hidden>
    <p class="feedback-question">이 분석이 도움이 됐나요?</p>
    <div class="feedback-buttons">
      <button class="btn btn-secondary" id="btn-feedback-yes" aria-label="도움이 됐어요">
        👍 도움이 됐어요
      </button>
      <button class="btn btn-secondary" id="btn-feedback-no" aria-label="다른 감정이 맞아요">
        🤔 다른 감정이 맞는데요?
      </button>
    </div>
  </div>
</div>

<script>
// 응답 표시 2초 후 피드백 버튼 표시
async function showResponse(response) {
  const container = document.querySelector('#response-container');
  // ... 응답 렌더링 ...
  container.hidden = false;

  setTimeout(() => {
    document.querySelector('#feedback-section').hidden = false;
  }, 2000);
}
</script>
```

---

#### B4. 회원가입 유도 (Soft CTA)

```html
<div class="signup-prompt" id="signup-prompt" hidden>
  <div class="signup-prompt-card">
    <h3>멋진데요? 이 일기를 저장하고 싶으신가요?</h3>
    <p class="signup-prompt-note">
      게스트 모드로는 최대 10개 일기를 7일 동안 임시 저장할 수 있습니다.
      <br>
      영구 보관을 원하시면 회원가입해주세요.
    </p>

    <div class="signup-prompt-buttons">
      <button class="btn btn-primary" id="btn-signup">
        회원가입하기
      </button>
      <button class="btn btn-secondary" id="btn-skip">
        나중에
      </button>
    </div>
  </div>
</div>

<style>
.signup-prompt {
  margin-top: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #FEF3E2 0%, #FCE4D6 50%, #F5DEB3 100%);
  border-radius: var(--radius-lg);
  text-align: center;
}

.signup-prompt-card h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.signup-prompt-note {
  font-size: 0.9rem;
  color: var(--color-text-light);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.signup-prompt-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

@media (max-width: 640px) {
  .signup-prompt-buttons {
    flex-direction: column;
  }
}
</style>
```

---

## UI 컴포넌트 명세

### 1. 새로운 컴포넌트

#### 1.1 게스트 배지
```css
.guest-badge {
  display: inline-block;
  font-size: 0.75rem;
  background: var(--color-primary-hover);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 500;
  margin-left: 0.5rem;
}
```

#### 1.2 샘플 카드
```css
.sample-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 200ms ease;
}

.sample-card:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-warm);
  transform: translateX(4px);
}

.sample-card:active {
  transform: scale(0.98);
}

.sample-emoji {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.sample-text {
  text-align: left;
  font-size: 0.95rem;
  color: var(--color-text);
  flex: 1;
}
```

#### 1.3 회원가입 유도 카드
```css
.signup-prompt {
  margin-top: 2rem;
  padding: 2rem;
  background: var(--gradient-response);
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow-md);
  animation: fadeInUp 500ms cubic-bezier(0.25,0.46,0.45,0.94) both;
}

.signup-prompt-card h3 {
  font-size: 1.2rem;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.signup-prompt-note {
  font-size: 0.9rem;
  color: var(--color-text-light);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.signup-prompt-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}
```

#### 1.4 개선된 저장 상태 인디케이터
```css
/* 기존의 오프라인 배너를 대체 */

.save-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: 0.85rem;
  z-index: 1000;
  opacity: 0;
  animation: fadeIn 300ms ease forwards;
}

.save-status.saving {
  color: var(--color-text-light);
}

.save-status.saved {
  color: var(--color-success);
}

.save-status.error {
  color: var(--color-error);
}

.save-status-icon {
  font-size: 1rem;
}

.save-status.saving .save-status-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

#### 1.5 피드백 버튼
```css
.response-feedback {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-divider);
  text-align: center;
}

.feedback-question {
  font-size: 0.95rem;
  color: var(--color-text);
  margin-bottom: 1rem;
  font-weight: 500;
}

.feedback-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.feedback-buttons .btn {
  flex: 1;
  max-width: 200px;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .feedback-buttons {
    flex-direction: column;
  }

  .feedback-buttons .btn {
    max-width: 100%;
  }
}
```

---

### 2. 개선된 기존 컴포넌트

#### 2.1 버튼 상태 확장
```css
/* 비활성화 상태 (게스트도 적용) */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 로딩 상태 */
.btn.loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn.loading::after {
  content: '';
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-left: 0.5em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
```

#### 2.2 입력 필드 개선
```css
.demo-input-section {
  margin-bottom: 2rem;
}

.input-header {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.input-header label {
  font-weight: 500;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.diary-textarea {
  width: 100%;
  min-height: 100px;
  padding: 1rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-diary);
  font-size: 0.95rem;
  color: var(--color-text);
  resize: vertical;
  transition: border-color 300ms ease;
}

.diary-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(232,168,124,0.1);
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
}

.char-count {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
```

---

## 사용자 여정 맵

### Journey 1: 신규 방문자 → 게스트 체험 → 회원가입

```
┌────────────────────────────────────────────────────────────┐
│ 1. 신규 방문자 랜딩                                           │
│    (Google 검색 또는 링크)                                   │
│    → Landing Page 표시                                      │
└─────────────────┬──────────────────────────────────────────┘
                  │ (2-3초 읽음)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 2. CTA 클릭: "무료로 시작하기"                               │
│    → Demo Page로 이동                                        │
└─────────────────┬──────────────────────────────────────────┘
                  │ (30초)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 샘플 선택 또는 직접 입력                                  │
│    (예: "오늘 회의 발표 잘 됐어")                            │
│    → "분석하기" 클릭                                         │
└─────────────────┬──────────────────────────────────────────┘
                  │ (2-3초 로딩)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 4. AI 응답 카드 표시                                         │
│    (감정 분석, 공감 메시지)                                  │
│    → 피드백 버튼 나타남 (2초 후)                             │
└─────────────────┬──────────────────────────────────────────┘
                  │ (3-5초 읽음)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 5. 결정: "좋은데? 저장하고 싶어"                             │
│    → 회원가입 유도 모달 표시                                 │
└─────────────────┬──────────────────────────────────────────┘
                  │
      ┌───────────┴──────────────┐
      ▼                          ▼
┌──────────────┐          ┌─────────────────┐
│ 회원가입 시작  │          │ "나중에" 클릭    │
│ (Auth Screen) │          │ (게스트 모드)   │
└──────────────┘          └─────────────────┘
      │                          │
      ▼                          ▼
[회원 가입 완료]          [게스트 모드 유지]
      │                          │
      ▼                          ▼
[모든 일기 저장]          [최대 10개, 7일 보관]
```

**시간 투자**: 약 3-5분
**전환 지점**: 4번 (AI 응답 만족도) → 5번 (회원가입 유도)

---

### Journey 2: 게스트 모드 재방문자

```
┌────────────────────────────────────────────────────────────┐
│ 1. 앱 재방문 (localStorage에 guest_mode=true)               │
│    → Demo Page 직접 표시 (Landing 스킵)                     │
└─────────────────┬──────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 2. 일기 작성 + 분석 반복                                      │
│    (최대 10개까지 가능)                                      │
└─────────────────┬──────────────────────────────────────────┘
                  │ (3-4개 일기 작성 후)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 회원가입 유도 (더 자주 표시)                              │
│    "이제 10개 이상 저장하고 싶으신가요?"                     │
└─────────────────┬──────────────────────────────────────────┘
                  │
      ┌───────────┴──────────────┐
      ▼                          ▼
[회원가입]                  [게스트 유지]
```

---

## 프로토타입 구현 가이드

### 1. Single HTML 구조 (추천 방식)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <!-- 기존 메타 태그, 폰트, CSS 유지 -->
</head>
<body>
  <div class="app-container">

    <!-- Screen 1: Landing -->
    <section id="screen-landing" class="screen" data-screen="landing">
      <!-- Landing 콘텐츠 -->
    </section>

    <!-- Screen 2: Demo -->
    <section id="screen-demo" class="screen" data-screen="demo" hidden>
      <!-- Demo 콘텐츠 -->
    </section>

    <!-- Screen 3: Auth (기존) -->
    <section id="screen-auth" class="screen" data-screen="auth" hidden>
      <!-- 회원가입/로그인 폼 -->
    </section>

    <!-- Screen 4: App Main (기존) -->
    <section id="screen-app" class="screen" data-screen="app" hidden>
      <!-- 메인 앱 (로그인 후) -->
    </section>

    <!-- Screen 5: Signup Prompt (모달) -->
    <div id="modal-signup-prompt" class="modal" hidden>
      <!-- 회원가입 유도 모달 -->
    </div>

  </div>

  <script>
    // 사용자 상태 결정 로직
    function determineUserState() {
      const token = localStorage.getItem('auth_token');
      const guestMode = localStorage.getItem('guest_mode') === 'true';

      if (token) return 'member';
      if (guestMode) return 'guest';
      return 'demo';
    }

    // 화면 전환 함수
    function showScreen(screenName) {
      document.querySelectorAll('.screen').forEach(s => s.hidden = true);
      const target = document.querySelector(`#screen-${screenName}`);
      if (target) target.hidden = false;
    }

    // 초기 진입
    window.addEventListener('load', () => {
      const state = determineUserState();
      if (state === 'demo') showScreen('landing');
      else if (state === 'guest') showScreen('demo');
      else showScreen('app');
    });

    // 회원가입 버튼 클릭 처리
    document.querySelector('#btn-signup')?.addEventListener('click', () => {
      showScreen('auth');
      document.querySelector('#modal-signup-prompt').hidden = true;
    });
  </script>
</body>
</html>
```

---

### 2. CSS 변수 추가

```css
:root {
  /* 기존 변수 유지 */

  /* Guest Mode 신규 */
  --color-demo-bg: #FEF3E2;
  --color-guest-badge: #D4956A;
  --color-save-status-saving: #7A6B59;
  --color-save-status-saved: #2e7d32;
  --color-save-status-error: #c62828;

  /* Landing Page 신규 */
  --hero-gradient: linear-gradient(135deg, #FFF8F0 0%, #FEF3E2 100%);
}
```

---

### 3. JavaScript 핵심 로직

#### 3.1 화면 전환
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
  }

  show(screenName) {
    // 이전 화면 숨김
    if (this.currentScreen) {
      this.screens[this.currentScreen].hidden = true;
    }

    // 새 화면 표시
    this.screens[screenName].hidden = false;
    this.currentScreen = screenName;

    // 진입 애니메이션
    this.screens[screenName].style.animation = 'fadeInUp 500ms ease';
  }
}

const screenManager = new ScreenManager();
```

#### 3.2 샘플 카드 선택
```javascript
document.querySelectorAll('.sample-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const text = card.querySelector('.sample-text').textContent;
    const textarea = document.querySelector('#diary-input');
    textarea.value = text;
    textarea.focus();

    // 입력 완료 효과
    textarea.select();
    setTimeout(() => {
      textarea.setSelectionRange(text.length, text.length);
    }, 100);
  });
});
```

#### 3.3 저장 상태 표시
```javascript
async function saveDiaryEntry(entry) {
  const saveStatus = createSaveStatusIndicator();

  try {
    saveStatus.show('saving', '⏳ 저장 중...');
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!response.ok) throw new Error('Save failed');

    saveStatus.show('saved', '✓ 저장 완료');
    setTimeout(() => saveStatus.hide(), 2000);

  } catch (err) {
    saveStatus.show('error', '❌ 저장 실패');
  }
}

function createSaveStatusIndicator() {
  const el = document.querySelector('.save-status') ||
    document.createElement('div');
  el.className = 'save-status';
  document.body.appendChild(el);

  return {
    show(status, message) {
      el.textContent = message;
      el.className = `save-status ${status}`;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    }
  };
}
```

#### 3.4 회원가입 유도 타이밍
```javascript
async function handleAnalyzeClick() {
  const text = document.querySelector('#diary-input').value;

  if (!text.trim()) {
    alert('일기를 입력해주세요.');
    return;
  }

  try {
    // API 호출
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    renderResponseCard(data);

    // 2초 후 피드백 버튼 표시
    setTimeout(() => {
      document.querySelector('#feedback-section').hidden = false;
    }, 2000);

    // 게스트 모드 && 3개 이상 일기 작성 후 회원가입 유도
    const entryCount = getGuestEntryCount();
    if (isGuestMode() && entryCount >= 3) {
      setTimeout(() => {
        showSignupPromptModal();
      }, 5000);
    }

  } catch (err) {
    console.error('Analysis failed:', err);
    alert('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}
```

---

## 접근성 & 모바일 대응

### 1. 접근성 체크리스트

#### AC1: 모든 버튼에 aria-label
```html
<!-- 예: 피드백 버튼 -->
<button
  class="btn btn-secondary"
  id="btn-feedback-yes"
  aria-label="도움이 됐어요. 이 감정 분석이 맞습니다."
>
  👍 도움이 됐어요
</button>
```

#### AC2: 색상 + 아이콘 (색상만으로 상태 구분 X)
```html
<!-- 저장 상태: 색상 + 아이콘 + 텍스트 -->
<div class="save-status saved">
  <span class="save-status-icon">✓</span>
  <span class="save-status-text">저장 완료</span>
</div>
```

#### AC3: 모달 포커스 트랩
```javascript
function createModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = content;

  // 포커스 트랩
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });

  return modal;
}
```

#### AC4: 키보드 네비게이션
```css
/* 포커스 스타일 개선 */
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

### 2. 모바일 대응 (Responsive Design)

#### M1: Landing Page (모바일)
```css
@media (max-width: 768px) {
  .hero {
    padding: 2rem 1rem;
  }

  .hero-content {
    text-align: center;
  }

  .hero-visual {
    width: 100%;
    margin: 2rem 0;
  }

  .feature-cards {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .feature-card {
    padding: 1.5rem 1rem;
  }
}
```

#### M2: Demo Page (모바일)
```css
@media (max-width: 640px) {
  .demo-samples {
    gap: 1rem;
  }

  .sample-card {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .sample-emoji {
    font-size: 1.5rem;
  }

  .sample-text {
    font-size: 0.9rem;
  }

  .diary-textarea {
    min-height: 120px;
    font-size: 16px; /* 줌 방지 */
  }

  .feedback-buttons {
    flex-direction: column;
  }

  .feedback-buttons .btn {
    max-width: 100%;
  }
}
```

#### M3: 모달 (모바일)
```css
@media (max-width: 640px) {
  .modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.4);
  }

  .modal-content {
    width: 100%;
    max-height: 90vh;
    border-radius: 16px 16px 0 0;
    overflow-y: auto;
  }
}
```

---

## 구현 로드맵

### Phase A (1주) - 기초 구조
- [ ] Landing Page HTML/CSS 작성
- [ ] Demo Page 초안
- [ ] Screen Manager 구현
- [ ] 샘플 카드 인터랙션

### Phase B (1주) - 통합 & 상호작용
- [ ] API 연결 (기존 /api/analyze 사용)
- [ ] 저장 상태 인디케이터
- [ ] 회원가입 유도 모달
- [ ] 모바일 반응형

### Phase C (1주) - 개선 & QA
- [ ] 접근성 검증 (WCAG 2.1 AA)
- [ ] 성능 최적화
- [ ] 테스트 & 버그 수정
- [ ] Analytics 추가 (선택)

---

## 예상 성과

| 지표 | 현재 | 개선 후 | 증가율 |
|------|------|--------|-------|
| 첫 진입 이탈율 | ~45% | ~20% | -55% |
| 회원가입 전환율 | ~5% | ~25% | +400% |
| 평균 체류 시간 | 2분 | 5분 | +150% |
| 데일리 활성 사용자 | 10 | 50+ | +400% |

---

## 부록: CSS 변수 전체 목록

```css
:root {
  /* 기존 변수 (유지) */
  --color-bg: #FFF8F0;
  --color-surface: #FFFFFF;
  --color-surface-warm: #FEF3E2;
  --color-primary: #E8A87C;
  --color-primary-hover: #D4956A;
  --color-secondary: #D4A574;
  --color-text: #5D4E37;
  --color-text-light: #7A6B59;
  --color-text-muted: #7D6F5C;
  --color-border: #E8DDD0;
  --color-divider: #F0E6D9;
  --color-error: #c62828;
  --color-error-bg: #fce4ec;
  --color-success: #2e7d32;
  --color-success-bg: #e8f5e9;

  /* Guest Mode 신규 */
  --color-guest-bg: #FEF3E2;
  --color-guest-badge: #D4956A;
  --color-guest-text: #7A6B59;

  /* 저장 상태 신규 */
  --color-save-saving: #7A6B59;
  --color-save-success: #2e7d32;
  --color-save-error: #c62828;

  /* 그래디언트 */
  --gradient-response: linear-gradient(135deg, #FEF3E2 0%, #FCE4D6 50%, #F5DEB3 100%);
  --gradient-hero: linear-gradient(135deg, #FFF8F0 0%, #FEF3E2 100%);

  /* 폰트 */
  --font-body: 'Gowun Dodum', sans-serif;
  --font-diary: 'Gowun Batang', serif;

  /* 보더 반지름 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* 음영 */
  --shadow-sm: 0 1px 3px rgba(93,78,55,0.06);
  --shadow-md: 0 4px 12px rgba(93,78,55,0.08);
  --shadow-lg: 0 8px 24px rgba(93,78,55,0.12);
  --shadow-glow: 0 0 20px rgba(232,168,124,0.15);
}
```

---

**문서 작성 완료**: 2026-03-06
**상태**: 설계 완료, 구현 준비 중
