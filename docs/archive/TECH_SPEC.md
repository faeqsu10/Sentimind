# 기술 스펙 문서
## Sentimind: Landing + Guest Mode

**작성일**: 2026-03-06
**대상**: 개발팀 (FE, BE)
**난이도**: 중간

---

## 1. 구현 범위

### In Scope (개발 대상)
- ✅ Landing Page (public/index.html에 새 섹션)
- ✅ Guest Mode (guestMode 상태 + localStorage)
- ✅ POST /api/entries/import (마이그레이션)
- ✅ 오프라인 알림 개선 (UI)
- ✅ CTA 모달 (회원가입 유도)

### Out of Scope (미포함)
- ❌ 프리미엄 기능
- ❌ 소셜 로그인 (Google, GitHub)
- ❌ 다국어 지원 (한국어만)
- ❌ 앱 버전 (웹만)
- ❌ Supabase 스키마 변경

---

## 2. Frontend 기술 스펙

### 2.1 상태 관리

```javascript
// 전역 상태 (기존)
let isLoggedIn = false;        // 로그인 여부
let currentUser = null;        // 사용자 정보

// 신규 상태
let isGuestMode = false;       // 게스트 모드 활성화
let guestEntries = [];         // 게스트 일기 (localStorage)
let isSaving = false;          // 저장 중 상태
let savingStatus = null;       // 'saving' | 'success' | 'error'
```

### 2.2 Landing Page 구조

#### HTML 섹션 (guestLanding)
```html
<section id="guestLanding" class="landing" hidden>
  <!-- Hero Section -->
  <div class="landing-hero">
    <h1>당신의 감정을 이해하는 AI 일기장</h1>
    <p>한 줄 일기 → AI 감정 분석 → 공감 응답</p>
    <div class="cta-buttons">
      <button id="demoBtn" class="btn-primary">무료로 시작하기</button>
      <button id="learnMoreBtn" class="btn-secondary">더 알아보기</button>
    </div>
  </div>

  <!-- Features Section -->
  <section class="features">
    <div class="feature-card">
      <h3>🧠 감정 분석</h3>
      <p>AI가 당신의 감정을 정확히 읽습니다</p>
    </div>
    <!-- 3개 카드 -->
  </section>

  <!-- Screenshots/Video -->
  <section class="showcase">
    <!-- 스크린샷 3개 또는 GIF -->
  </section>

  <!-- FAQ -->
  <section class="faq">
    <details>
      <summary>로그인 없이 사용할 수 있나요?</summary>
      <p>네, Demo 모드로 3분 체험 가능합니다...</p>
    </details>
    <!-- 4개 more -->
  </section>

  <!-- Footer -->
  <footer class="landing-footer">
    <!-- 링크 -->
  </footer>
</section>
```

#### CSS (기존 변수 사용)
```css
.landing {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: var(--font-default);
}

.landing-hero {
  text-align: center;
  padding: 4rem 0;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  color: white;
  border-radius: 1rem;
  margin-bottom: 2rem;
}

.landing-hero h1 {
  font-size: clamp(1.5rem, 5vw, 3rem);
  margin-bottom: 1rem;
  font-weight: bold;
}

.landing-hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* 반응형 */
@media (max-width: 768px) {
  .landing-hero {
    padding: 2rem 1rem;
  }

  .landing-hero h1 {
    font-size: 1.5rem;
  }

  .cta-buttons {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
```

### 2.3 Guest Mode UI

#### 상태 분기
```javascript
function initApp() {
  if (isGuestMode) {
    showGuestUI();
  } else if (isLoggedIn) {
    showMemberUI();
  } else {
    showLandingUI();
  }
}

function showLandingUI() {
  document.getElementById('guestLanding').hidden = false;
  document.getElementById('guestApp').hidden = true;
  document.getElementById('authScreen').hidden = true;
  document.getElementById('app').hidden = true;
}

function showGuestUI() {
  document.getElementById('guestLanding').hidden = true;
  document.getElementById('guestApp').hidden = false;
  document.getElementById('authScreen').hidden = true;
  document.getElementById('app').hidden = true;
}

function showMemberUI() {
  document.getElementById('guestLanding').hidden = true;
  document.getElementById('guestApp').hidden = true;
  document.getElementById('authScreen').hidden = true;
  document.getElementById('app').hidden = false;
}
```

#### Guest App 구조
```html
<section id="guestApp" class="guest-app" hidden>
  <!-- Guest Banner -->
  <div class="guest-banner">
    👤 게스트 모드 | 최대 10개 일기 저장 가능
    <button id="guestLoginBtn" class="btn-text">로그인</button>
    <button id="guestSignupBtn" class="btn-text">회원가입</button>
  </div>

  <!-- App Content (기존 구조와 동일, localStorage만 사용) -->
  <div class="entry-input">
    <textarea id="entryText" placeholder="오늘 하루는 어땠어요?"></textarea>
    <button id="analyzeBtn" class="btn-primary">감정 분석</button>
  </div>

  <div id="responseCard" class="response-card" hidden>
    <!-- AI 응답 -->
  </div>

  <!-- Tabs: 통계, 히스토리 (localStorage 기반) -->
  <div id="tabs">
    <button class="tab-btn active" data-tab="stats">통계</button>
    <button class="tab-btn" data-tab="history">히스토리</button>
  </div>

  <div id="statsTab" class="tab-content"><!-- 통계 --></div>
  <div id="historyTab" class="tab-content" hidden><!-- 히스토리 --></div>
</section>
```

### 2.4 localStorage 스키마

```javascript
// 게스트 모드 플래그
{
  'sentimind-guest-mode': {
    isGuest: true,
    enteredAt: '2026-03-06T10:00:00Z'
  }
}

// 게스트 일기 (최대 10개)
{
  'sentimind-guest-entries': [
    {
      id: 'guest_1',                  // UUID 또는 uuid()
      text: '오늘 발표 성공했다!',
      emotion: {
        primary: '기쁨',
        secondary: '자신감',
        tertiary: '충만함'
      },
      situation: {
        domain: '일',
        category: '업무'
      },
      confidence: 0.92,
      empathy: '당신의 노고가 빛났네요!',
      createdAt: '2026-03-06T10:30:00Z',
      updatedAt: '2026-03-06T10:30:00Z'
    }
  ]
}
```

### 2.5 API 호출 (게스트 vs 멤버)

```javascript
// 게스트: 로컬만
async function saveGuestEntry(entry) {
  const entries = JSON.parse(localStorage.getItem('sentimind-guest-entries') || '[]');

  if (entries.length >= 10) {
    showModal({
      title: '더 많은 일기를 저장하시겠어요?',
      content: '게스트 모드에선 최대 10개까지만 저장됩니다. 회원가입하면 무제한 저장 가능합니다.',
      buttons: [
        { text: '회원가입하기', action: () => showSignupForm() },
        { text: '나중에', action: () => {} }
      ]
    });
    return;
  }

  entries.push(entry);
  localStorage.setItem('sentimind-guest-entries', JSON.stringify(entries));
  showToast('일기가 저장되었습니다.', 'success');
}

// 멤버: API + 자동 재시도
async function saveMemberEntry(entry) {
  showSavingUI('저장 중...');

  for (let retry = 0; retry < 3; retry++) {
    try {
      await fetchWithAuth('/api/entries', {
        method: 'POST',
        body: JSON.stringify(entry)
      });
      showSavingUI('저장 완료', 'success');
      setTimeout(() => clearSavingUI(), 2000);
      return;
    } catch (err) {
      if (retry < 2) {
        showSavingUI(`저장 실패 - 재시도 중... (${retry + 1}/3)`, 'warning');
        await sleep(Math.pow(2, retry) * 1000); // 지수 백오프
      }
    }
  }

  showSavingUI('저장 실패. [수동 재시도] 버튼을 클릭해주세요.', 'error');
}
```

### 2.6 오프라인 알림 개선

```javascript
// 네트워크 상태 감지
window.addEventListener('online', () => {
  if (!isGuestMode) {
    showToast('📡 인터넷 복구됨. 데이터 동기화 중...', 'info');
    syncPendingEntries();
  }
});

window.addEventListener('offline', () => {
  if (!isGuestMode && !isLocalOnly) {
    showBanner('📡 인터넷 연결이 끊겼습니다. 오프라인 모드로 전환됩니다.');
  }
});

// 저장 상태 표시
function showSavingUI(message, status = 'info') {
  const banner = document.getElementById('savingBanner');
  banner.textContent = message;
  banner.className = `saving-banner ${status}`;
  banner.hidden = false;
}

function clearSavingUI() {
  document.getElementById('savingBanner').hidden = true;
}
```

### 2.7 회원가입 유도 모달

```html
<div id="signupPromptModal" class="modal" hidden>
  <div class="modal-content">
    <h2>이 일기를 저장할래요?</h2>
    <p>게스트 모드에선 로컬에만 저장돼요.</p>
    <p>회원가입하면 클라우드에 저장하고 어디서나 접근할 수 있습니다.</p>

    <div class="modal-buttons">
      <button id="signupPromptSignup" class="btn-primary">회원가입하기</button>
      <button id="signupPromptLater" class="btn-secondary">나중에</button>
      <button id="signupPromptLocal" class="btn-text">계속 로컬로</button>
    </div>
  </div>
</div>
```

```javascript
// 저장 시도 → 모달 표시
async function handleSaveEntry() {
  if (isGuestMode && localStorage.getItem('sentimind-guest-entries').length >= 8) {
    // 10개 가까우면 모달
    showSignupPrompt();
  } else {
    saveGuestEntry(entry);
  }
}

function showSignupPrompt() {
  const modal = document.getElementById('signupPromptModal');
  modal.hidden = false;

  document.getElementById('signupPromptSignup').onclick = () => {
    modal.hidden = true;
    showAuthCard('signup');
  };

  document.getElementById('signupPromptLater').onclick = () => {
    modal.hidden = true;
  };

  document.getElementById('signupPromptLocal').onclick = () => {
    modal.hidden = true;
  };
}
```

---

## 3. Backend 기술 스펙

### 3.1 신규 엔드포인트: POST /api/entries/import

```javascript
/**
 * 게스트 일기를 멤버 계정으로 마이그레이션
 *
 * Method: POST
 * Path: /api/entries/import
 * Authentication: Bearer <token> (필수)
 *
 * Request Body:
 * {
 *   "entries": [
 *     {
 *       "id": "guest_1",
 *       "text": "...",
 *       "emotion": {...},
 *       "situation": {...},
 *       "confidence": 0.92,
 *       "empathy": "...",
 *       "createdAt": "2026-03-06T10:30:00Z",
 *       "updatedAt": "2026-03-06T10:30:00Z"
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "imported": 5,
 *   "failed": 0,
 *   "message": "5개의 일기가 저장되었습니다."
 * }
 *
 * Error Response:
 * {
 *   "error": "마이그레이션 실패",
 *   "details": "...",
 *   "code": "IMPORT_FAILED"
 * }
 */

app.post('/api/entries/import', authMiddleware, async (req, res) => {
  try {
    const { entries } = req.body;
    const userId = req.user.id;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: '유효한 entries 배열이 필요합니다.' });
    }

    if (entries.length === 0) {
      return res.status(200).json({ success: true, imported: 0, failed: 0 });
    }

    // Supabase에 일괄 삽입
    const entriesToInsert = entries.map(entry => ({
      id: entry.id || generateUUID(),
      user_id: userId,
      text: entry.text,
      emotion: entry.emotion,
      situation: entry.situation,
      confidence: entry.confidence,
      empathy: entry.empathy,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      // 추가 필드는 자동으로 처리
    }));

    const { data, error } = await supabase
      .from('entries')
      .insert(entriesToInsert);

    if (error) {
      return res.status(400).json({
        error: '마이그레이션 실패',
        details: error.message,
        code: 'IMPORT_FAILED'
      });
    }

    logger.info('entries:import', {
      userId,
      count: entriesToInsert.length,
      success: true
    });

    res.json({
      success: true,
      imported: entriesToInsert.length,
      failed: 0,
      message: `${entriesToInsert.length}개의 일기가 저장되었습니다.`
    });

  } catch (err) {
    logger.error('entries:import', { error: err.message });
    res.status(500).json({
      error: '서버 오류',
      code: 'SERVER_ERROR'
    });
  }
});
```

### 3.2 인증 미들웨어

```javascript
// 기존 authMiddleware 사용 (no changes)
// POST /api/entries/import는 필수로 토큰 검증
```

### 3.3 로깅 추가

```javascript
// POST /api/entries/import에서 logger 사용
logger.info('entries:import', {
  userId: req.user.id,
  entryCount: entries.length,
  timestamp: new Date().toISOString()
});
```

### 3.4 에러 처리

```javascript
// 가능한 에러 시나리오
1. 토큰 없음: 401 Unauthorized
2. 유효하지 않은 토큰: 401 Unauthorized
3. entries 배열이 아님: 400 Bad Request
4. Supabase 에러: 400 Bad Request (with details)
5. 서버 에러: 500 Internal Server Error
```

---

## 4. 통합 시나리오

### 4.1 Guest → Member 전환

```
[Guest]
1. Landing 페이지 표시 (guestLanding hidden=false)
2. "무료로 시작하기" 클릭
   - isGuestMode = true
   - guestApp 표시
3. 일기 작성 + AI 분석
   - localStorage에 저장
4. 10개 일기 근처
   - 모달: "회원가입하시겠어요?"

[Signup]
5. "회원가입하기" 클릭
   - authScreen 표시
   - signupForm 표시
6. 이메일/비밀번호/닉네임 입력
7. "가입하기" 클릭

[Migration]
8. 서버: 토큰 발급
9. FE: localStorage 데이터 읽기
10. FE: POST /api/entries/import
11. 서버: Supabase 저장 (user_id 설정)
12. FE: localStorage 정리
13. FE: app 화면 표시 (히스토리 탭)
```

### 4.2 Member 사용 (개선)

```
[로그인]
1. 토큰 있음 → app 표시
2. guestLanding, guestApp 숨김

[일기 작성]
3. 텍스트 입력 + "분석하기"
4. POST /api/analyze (기존)
5. 응답 카드 표시

[저장]
6. "저장" 버튼 클릭
7. showSavingUI('저장 중...')
8. POST /api/entries (기존, 인증 헤더 포함)
9. ✅ 저장 완료 (2초 후 자동 사라짐)
10. 에러 시: 자동 재시도 (최대 3회)
11. 3회 실패: "수동 재시도" 버튼

[오프라인]
12. 인터넷 끊김 → showBanner('📡 인터넷 연결...')
13. 온라인 복구 → 자동 재시도 or 수동
```

---

## 5. 테스트 케이스 (개발자용)

### 5.1 단위 테스트 (localStorage)

```javascript
describe('Guest Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    isGuestMode = false;
  });

  test('localStorage에 일기 저장', () => {
    isGuestMode = true;
    const entry = { id: 'test_1', text: 'Test' };
    saveGuestEntry(entry);

    const stored = JSON.parse(localStorage.getItem('sentimind-guest-entries'));
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Test');
  });

  test('최대 10개 제한', () => {
    isGuestMode = true;
    for (let i = 0; i < 11; i++) {
      try {
        saveGuestEntry({ id: `test_${i}`, text: `Entry ${i}` });
      } catch (err) {
        expect(err.message).toContain('최대 10개');
      }
    }
  });
});
```

### 5.2 통합 테스트 (API)

```javascript
describe('POST /api/entries/import', () => {
  test('게스트 일기 마이그레이션', async () => {
    const token = await loginUser();
    const entries = [
      { id: 'g1', text: 'Test 1', emotion: {...} },
      { id: 'g2', text: 'Test 2', emotion: {...} }
    ];

    const res = await fetch('/api/entries/import', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entries })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(2);
  });

  test('토큰 없음 → 401', async () => {
    const res = await fetch('/api/entries/import', {
      method: 'POST',
      body: JSON.stringify({ entries: [] })
    });

    expect(res.status).toBe(401);
  });
});
```

### 5.3 E2E 테스트 (Selenium)

```javascript
describe('Guest → Member Journey', () => {
  test('완전한 전환 경로', async () => {
    // 1. Landing 방문
    await driver.get('http://localhost:3000');
    const hero = await driver.findElement(By.id('landingHero'));
    expect(hero.isDisplayed()).toBeTruthy();

    // 2. Demo 시작
    await driver.findElement(By.id('demoBtn')).click();
    const guestApp = await driver.findElement(By.id('guestApp'));
    expect(guestApp.isDisplayed()).toBeTruthy();

    // 3. 일기 작성
    const textarea = await driver.findElement(By.id('entryText'));
    await textarea.sendKeys('오늘 기분 좋아!');
    await driver.findElement(By.id('analyzeBtn')).click();

    // 4. AI 응답 표시
    await driver.wait(until.elementIsVisible(
      driver.findElement(By.id('responseCard'))
    ), 5000);

    // 5. 회원가입
    const signupBtn = await driver.findElement(By.id('guestSignupBtn'));
    await signupBtn.click();
    // ... 회원가입 폼 입력

    // 6. 마이그레이션 확인
    await driver.wait(until.titleIs('AI 공감 다이어리 - 앱'), 10000);
    const historyTab = await driver.findElement(By.id('historyTab'));
    expect(historyTab.isDisplayed()).toBeTruthy();
  });
});
```

---

## 6. 배포 체크리스트

### Before Deploy
- [ ] 회귀 테스트 100% 통과
- [ ] 코드 리뷰 완료
- [ ] Staging 배포 테스트
- [ ] 모바일 테스트 (iOS Safari, Android Chrome)
- [ ] 성능 측정 (Lighthouse > 85)
- [ ] SEO 점검 (title, meta, og:image)
- [ ] 에러 로깅 설정 (Sentry, etc.)

### After Deploy
- [ ] Production 모니터링 (첫 1시간)
- [ ] 에러 로그 확인
- [ ] 사용자 피드백 수집
- [ ] Analytics 확인 (Landing → Demo 전환율)

---

## 7. 파일 수정 목록

### FE (public/index.html)
- [ ] 신규 `<section id="guestLanding">` 추가 (~800줄)
- [ ] 신규 `<section id="guestApp">` 추가 (~300줄, 기존 구조 참조)
- [ ] CSS: `.landing`, `.guest-banner`, `.guest-app` 추가 (~200줄)
- [ ] JS: `isGuestMode`, `guestEntries`, 마이그레이션 로직 추가 (~300줄)
- [ ] 기존 `initApp()` 함수 수정 (상태 분기)
- [ ] 기존 `saveEntry()` 함수 수정 (게스트/멤버 분기)

**총 변경**: ~1700줄 추가 (현재 6000줄 → 7700줄)

### BE (server.js)
- [ ] 신규 `POST /api/entries/import` 엔드포인트 추가 (~50줄)
- [ ] authMiddleware 사용 (기존)
- [ ] Supabase insert 로직 (기존 패턴)

**총 변경**: ~50줄 추가 (현재 865줄 → 915줄)

---

## 8. 환경 변수 (추가 없음)

기존 환경 변수 그대로 사용:
- `GOOGLE_API_KEY` (Gemini)
- `SUPABASE_URL` (Supabase)
- `SUPABASE_ANON_KEY` (Supabase)
- `NODE_ENV` (dev/prod)

---

## 9. 성능 목표

| 지표 | 목표 | 현재 | 방법 |
|------|------|------|------|
| Landing 로드 | < 2초 | ? | 이미지 최적화 + 지연 로딩 |
| Guest Demo | < 3초 | ? | AI 캐시 또는 mock |
| 마이그레이션 | < 5초 | ? | 배치 API + 비동기 |
| Lighthouse | > 85 | ? | SEO + 성능 최적화 |

---

## 10. 다음 문서

- **요구사항**: [REQUIREMENTS.md](./REQUIREMENTS.md)
- **기획 요약**: [UX_IMPROVEMENT_PLAN.md](./UX_IMPROVEMENT_PLAN.md)
- **회귀 테스트**: [REQUIREMENTS.md 섹션 7](./REQUIREMENTS.md#7-회귀-테스트-체크리스트)

