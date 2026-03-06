# Sentimind 사용자 행동 측정 이벤트 트래킹 설계서

**작성일**: 2026-03-06
**작성자**: Growth Data Analyst (AI)
**대상**: Sentimind v2 (Node.js/Express + Supabase + Gemini)
**현황**: 분석 도구 전무. 서버 로그(logger)만 존재. 프론트엔드 계측 0%.

---

## 목차

1. [Measurement Audit — 현재 측정 현황](#1-measurement-audit)
2. [North Star Metric](#2-north-star-metric)
3. [AARRR 퍼널 매핑](#3-aarrr-퍼널-매핑)
4. [이벤트 트래킹 설계 (25개)](#4-이벤트-트래킹-설계)
5. [핵심 대시보드 설계](#5-핵심-대시보드-설계)
6. [첫 번째 A/B 테스트 3개 제안](#6-ab-테스트-제안)
7. [구현 로드맵](#7-구현-로드맵)

---

## 1. Measurement Audit

### 현재 측정 중인 것 (서버 로그)

| 항목 | 위치 | 형태 |
|------|------|------|
| API 요청/응답 (requestId, duration) | server-v2.js, routes/*.js | 구조화 JSON 로그 |
| 로그인 성공/실패 | routes/auth.js | 보안 이벤트 로그 |
| 회원가입 성공/실패 | routes/auth.js | 보안 이벤트 로그 |
| 일기 저장 (entryId, duration) | routes/entries.js | INFO 로그 |
| 감정 분석 완료 (emotion, confidence, token cost) | routes/analyze.js | INFO 로그 |
| Gemini API 토큰/비용 | server-v2.js callGeminiAPI() | INFO 로그 |
| 피드백 저장 (rating) | routes/entries.js | INFO 로그 |
| 리포트 생성 | routes/report.js | INFO 로그 |

### 현재 측정하지 못하는 것 (치명적 공백)

| 공백 영역 | 비즈니스 영향 |
|-----------|--------------|
| 랜딩 페이지 방문자 수 | Acquisition 전환율 계산 불가 |
| 게스트 모드 퍼널 (체험 횟수, 이탈 지점) | 게스트->가입 전환 개선 불가 |
| 회원가입 폼 이탈 (어떤 단계에서?) | Activation 병목 파악 불가 |
| 탭 전환 패턴 (어떤 기능을 쓰는가?) | 기능 채택율 측정 불가 |
| 온보딩 완료율 및 이탈 단계 | 신규 유저 경험 개선 불가 |
| D1/D7/D30 리텐션 | 리텐션 곡선 측정 불가 |
| AI 응답 체류 시간 | AI 품질 만족도 간접 측정 불가 |
| 데이터 내보내기 사용률 | 파워 유저 식별 불가 |
| 다크 모드 사용률 | UX 최적화 우선순위 불가 |

**결론**: 서버 로그는 존재하나 프론트엔드 행동 데이터가 전무하고, 서버 로그도 분석 가능한 형태로 집계되지 않음. 분석 인프라 전면 구축 필요.

---

## 2. North Star Metric

### NSM: WAU 중 일기를 2회 이상 작성한 사용자 비율 (Weekly Active Writers, WAW)

```
WAW = (해당 주에 일기를 2회 이상 작성한 인증 사용자) / WAU
목표 기준치: WAW >= 40%
```

### 선정 이유

Sentimind의 핵심 가치는 "감정 습관의 형성"이다. 단순한 방문이나 1회 체험은 가치를 증명하지 않는다. 주 2회 이상 일기를 작성하는 사용자는:

1. **제품 가치를 경험한 사용자**: AI 응답을 2회 이상 받아 개인화된 인사이트가 축적되기 시작함
2. **리텐션과 상관관계가 높음**: 주 2회 이상 작성자는 D30 리텐션이 주 1회 이하 대비 유의미하게 높을 것으로 가설 설정 (검증 필요)
3. **수익화 가능 사용자**: 습관이 형성된 사용자가 향후 프리미엄 전환의 핵심 모수
4. **단순 DAU/MAU의 한계 극복**: DAU는 랜딩 리디렉션 트래픽 등 노이즈 포함. WAW는 실질 가치 제공 측정

### Leading Indicator (선행 지표)
- 첫 일기 작성 후 48시간 내 2번째 일기 작성율 (Activation 품질)
- 게스트 -> 회원 전환율 (Acquisition 품질)

### Lagging Indicator (후행 지표)
- D30 리텐션율
- 월간 AI 리포트 생성 횟수 (고관여 사용자 지표)

---

## 3. AARRR 퍼널 매핑

### 현재 코드 기반 퍼널 분석

```
[랜딩 페이지]
  app.js: showLanding()
  - 히어로 섹션, 기능 카드 3개, FAQ 아코디언
  - CTA 버튼: "시작하기"(→ 회원가입), "체험해보기"(→ 게스트 데모)
        |
        |--[게스트 경로]---> [데모 화면 (demoScreen)]
        |                     guest.js: initDemoScreen()
        |                     - localStorage 기반, 최대 10회, 7일 보관
        |                     - 3회 사용 후 넛지 모달 (showSignupModal('nudge'))
        |                     - 10회 사용 후 한도 모달 (showSignupModal('limit'))
        |                             |
        |                             v
        |--[가입 경로]-----> [인증 화면 (authScreen)]
                              auth.js: initAuthForms()
                              - 로그인 / 회원가입 / 비밀번호 재설정
                                      |
                                      v
                            [온보딩 (onboardingScreen)]
                              app.js: showOnboarding()
                              - 3단계: 소개 -> 기능 -> 알림 시간 설정
                                      |
                                      v
                            [메인 앱 (appContainer)]
                              app.js: initApp()
                              - 탭: 일기/달력/통계/프로필
                              - 일기 작성 -> AI 분석 -> 응답 카드
                              - 피드백 (thumbs up/down)
                              - 리텐션 카드 표시
```

### Acquisition (획득)

| 단계 | 코드 위치 | 현재 측정 | 목표 전환율 |
|------|----------|----------|-----------|
| 랜딩 방문 | app.js:showLanding() | X | - |
| "체험" 클릭 | app.js:landingDemoBtn | X | 30% |
| "가입" 클릭 (랜딩) | app.js:landingStartBtn, landingSignupBtn | X | 15% |
| 게스트 -> 가입 전환 | guest.js:signupModalSignupBtn | X | 25% |

**추정 현재 퍼널**: 랜딩 방문 -> 게스트 체험 -> 가입. 각 단계 전환율 완전 미측정.

### Activation (활성화)

| 단계 | 코드 위치 | 정의 |
|------|----------|------|
| 첫 일기 분석 완료 | diary.js:handleSubmit() -> showResponse() | AI 응답 수신 성공 |
| 온보딩 완료 | app.js:completeOnboarding() | onboarding_completed=true |
| 48시간 내 2번째 일기 | - (미구현) | Activation 임계점 |

**Activation 기준**: 첫 일기 작성 + AI 응답 수신 = "Aha Moment"

### Retention (리텐션)

| 구분 | 코드 위치 | 측정 방법 |
|------|----------|----------|
| 스트릭 | sidebar.js:updateSidebarStreak() | 연속 작성일 계산 (프론트) + updateStreak() (서버) |
| 스트릭 마일스톤 알림 | sidebar.js:checkStreakMilestone() | 3, 7, 14, 30일 |
| 리텐션 카드 | diary.js:showRetentionCard() | 작성 후 넛지 메시지 |
| D1/D7/D30 | - (미구현) | 코호트 분석 필요 |

### Revenue (수익)

현재 수익화 없음. 향후 프리미엄 전환 모델 시 측정 포인트:
- AI 리포트 사용 횟수 (premium feature candidate)
- 데이터 내보내기 사용 (power user signal)
- 스트릭 30일 이상 달성 사용자 (충성 사용자)

### Referral (추천)

현재 공유 기능 없음. 향후 측정 포인트:
- 감정 카드 공유 (SNS)
- 친구 초대 링크

---

## 4. 이벤트 트래킹 설계

### 이벤트 네이밍 컨벤션

```
{객체}_{동작}  ->  snake_case
예: landing_viewed, diary_submitted, guest_converted
```

### 공통 프로퍼티 (모든 이벤트에 포함)

```javascript
{
  user_id: string | null,     // 인증 사용자 ID (게스트는 null)
  session_id: string,         // 세션별 UUID (탭 단위)
  is_guest: boolean,          // 게스트 모드 여부
  timestamp: ISO8601,         // 클라이언트 시각
  platform: 'web',
  theme: 'light' | 'dark',
  device_type: 'mobile' | 'desktop'  // window.innerWidth < 768
}
```

---

### 이벤트 목록 (총 25개)

#### A. Acquisition 이벤트 (4개)

---

**[E-01] `landing_viewed`**

- 트리거 위치: `app.js:showLanding()` — setScreen('landing') 직후
- 목적: 랜딩 페이지 방문자 수 측정. Acquisition 퍼널의 최상단. 향후 SEO/광고 효과 측정 기준.
- 프로퍼티:
  ```
  referrer: string           // document.referrer
  utm_source: string | null  // URLSearchParams('utm_source')
  utm_medium: string | null
  utm_campaign: string | null
  is_returning: boolean      // localStorage에 'sb-access-token' 존재 여부
  ```

---

**[E-02] `landing_cta_clicked`**

- 트리거 위치: `app.js` — landingStartBtn, landingSignupBtn, landingDemoBtn 클릭 핸들러
- 목적: 어떤 CTA가 실제 전환으로 이어지는지 측정. 랜딩 CTA 배치 최적화.
- 프로퍼티:
  ```
  cta_type: 'signup' | 'demo' | 'hero_start'
  cta_position: 'hero' | 'footer' | 'nav'
  ```

---

**[E-03] `guest_demo_started`**

- 트리거 위치: `app.js:showDemo()` — initDemoScreen() 호출 직전
- 목적: 게스트 데모 진입율 측정. 랜딩 -> 데모 전환율 계산.
- 프로퍼티:
  ```
  entry_point: 'landing_btn' | 'modal' | 'direct'
  previous_screen: 'landing' | 'auth'
  ```

---

**[E-04] `signup_modal_shown`**

- 트리거 위치: `guest.js:showSignupModal()` — overlay.hidden = false 직전
- 목적: 게스트 전환 넛지 발동율과 전환율 측정. reason별 전환율 비교.
- 프로퍼티:
  ```
  reason: 'nudge' | 'limit'    // 3회 넛지 vs 10회 한도 초과
  guest_usage_count: number    // 현재까지 사용한 횟수
  ```

---

#### B. Activation 이벤트 (6개)

---

**[E-05] `auth_form_started`**

- 트리거 위치: `app.js:showAuthScreen()` — setScreen('auth') 직후
- 목적: 회원가입/로그인 폼 진입율. 이후 완료율과의 갭 = 이탈율.
- 프로퍼티:
  ```
  form_type: 'login' | 'signup' | 'reset'
  entry_source: 'landing_cta' | 'guest_modal' | 'direct'
  ```

---

**[E-06] `signup_completed`**

- 트리거 위치: `auth.js:initAuthForms()` — 회원가입 성공 후 (result.data.session 존재 시)
- 목적: 실질 회원가입 완료수. E-05 대비 완료율 = 가입 폼 전환율.
- 프로퍼티:
  ```
  has_nickname: boolean          // nicknameInput.value.trim().length > 0
  had_guest_data: boolean        // loadGuestEntries().length > 0
  email_verification_required: boolean  // !result.data.session
  ```

---

**[E-07] `login_completed`**

- 트리거 위치: `auth.js:initAuthForms()` — 로그인 성공 후
- 목적: 재방문 사용자 로그인 성공율. 실패율 급등 시 UX 문제 신호.
- 프로퍼티:
  ```
  had_guest_data: boolean        // 게스트 데이터 마이그레이션 대상 여부
  days_since_last_login: number | null  // localStorage 토큰 age 기반 추정
  ```

---

**[E-08] `onboarding_step_viewed`**

- 트리거 위치: `app.js:updateOnboardingUI()` — 각 스텝 표시 시
- 목적: 온보딩 각 단계 이탈율 측정. Step1->2->3 전환율 비교.
- 프로퍼티:
  ```
  step: 1 | 2 | 3
  previous_step: number | null
  time_on_previous_step_sec: number
  ```

---

**[E-09] `onboarding_completed`**

- 트리거 위치: `app.js:completeOnboarding()` — fetchWithAuth('/api/profile') 성공 후
- 목적: 온보딩 완료율. 미완료 시 첫 일기 작성율과 비교.
- 프로퍼티:
  ```
  notification_set: boolean      // state.selectedNotificationTime 존재 여부
  notification_time: string | null  // '08:00' 등
  skipped_last_step: boolean     // onboardingSkip3 버튼 클릭 여부
  total_onboarding_sec: number   // 온보딩 시작부터 완료까지 경과 시간
  ```

---

**[E-10] `first_diary_submitted`**

- 트리거 위치: `diary.js:handleSubmit()` — 최초 제출 성공 후 (state.allEntries.length === 0 체크)
- 목적: "Aha Moment" 달성율. 가입 후 첫 일기 작성까지의 시간 분포.
- 프로퍼티:
  ```
  minutes_since_signup: number   // 가입 timestamp와의 차이
  text_length: number            // 일기 글자수
  entry_hour: number             // 0-23 (작성 시각)
  is_guest_converted: boolean    // 게스트 데이터 마이그레이션 후 첫 작성 여부
  ```

---

#### C. 핵심 기능 이벤트 (9개)

---

**[E-11] `diary_submitted`**

- 트리거 위치: `diary.js:handleSubmit()` — analyzeEmotion() 호출 직전
- 목적: 일기 제출 총량 및 패턴 측정. North Star Metric(WAW) 계산의 기반 데이터.
- 프로퍼티:
  ```
  text_length: number
  entry_hour: number             // 0-23
  entry_day_of_week: number      // 0(일)-6(토)
  is_guest: boolean
  total_entries_count: number    // 사용자의 누적 일기 수 (이번 것 제외)
  used_keyboard_shortcut: boolean  // Cmd/Ctrl+Enter 사용 여부
  ```

---

**[E-12] `ai_response_received`**

- 트리거 위치: `diary.js:showResponse()` — responseCard.hidden = false 직전
- 목적: AI 분석 성공율 및 감정 분포 측정. 어떤 감정이 가장 많이 감지되는가.
- 프로퍼티:
  ```
  emotion: string                // 감지된 감정
  emotion_level1: string | null  // ontology 계층1
  confidence_score: number       // 0-100
  has_ontology: boolean          // 온톨로지 enrichment 성공 여부
  response_time_ms: number       // 제출부터 응답까지
  situation_domains: string[]    // 감지된 상황 도메인 목록
  ```

---

**[E-13] `ai_feedback_submitted`**

- 트리거 위치: `diary.js:handleFeedbackClick()` — submitFeedback() 호출 후
- 목적: AI 응답 품질 평가. helpful 비율 = AI 만족도 지표. 감정별 만족도 분포 분석 가능.
- 프로퍼티:
  ```
  rating: 'helpful' | 'not_helpful'
  emotion: string                // 해당 일기의 감정
  confidence_score: number
  response_time_ms: number       // AI 응답 후 피드백까지 걸린 시간
  ```

---

**[E-14] `tab_switched`**

- 트리거 위치: `app.js:switchTab()` — 탭 전환 시
- 목적: 기능별 사용율 측정. 어떤 탭이 가장 많이 쓰이는가. 통계/달력/프로필 탭 채택율.
- 프로퍼티:
  ```
  from_tab: 'diary' | 'calendar' | 'dashboard' | 'profile' | null
  to_tab: 'diary' | 'calendar' | 'dashboard' | 'profile'
  trigger: 'click' | 'keyboard_shortcut'
  time_on_previous_tab_sec: number
  ```

---

**[E-15] `stats_dashboard_viewed`**

- 트리거 위치: `stats.js:loadDashboard()` — fetchWithAuth('/api/stats') 성공 후
- 목적: 통계 기능 채택율. 기간 필터 사용 패턴 측정.
- 프로퍼티:
  ```
  period: '7d' | '30d' | '90d' | 'all'
  total_entries_in_period: number
  load_time_ms: number
  ```

---

**[E-16] `report_generated`**

- 트리거 위치: `stats.js:fetchReport()` — resultEl.hidden = false (성공 시)
- 목적: AI 리포트 기능 채택율. 주간/월간 선호도. 향후 프리미엄 기능 수요 측정.
- 프로퍼티:
  ```
  period: 'weekly' | 'monthly'
  entry_count: number            // 리포트에 사용된 일기 수
  load_time_ms: number
  ```

---

**[E-17] `calendar_viewed`**

- 트리거 위치: `app.js:switchTab()` — tabCalendar 활성화 시 renderCalendar() 호출 직전
- 목적: 달력 기능 채택율. 과거 기록 탐색 행동 측정.
- 프로퍼티:
  ```
  total_entries: number
  entries_this_month: number
  ```

---

**[E-18] `data_exported`**

- 트리거 위치: `routes/entries.js:GET /export` — 응답 직전 (서버 사이드)
- 목적: 데이터 내보내기 사용율 = 파워 유저 및 이탈 위험 신호 감지.
- 프로퍼티:
  ```
  format: 'csv' | 'json'
  entry_count: number
  user_tenure_days: number       // 가입 후 경과일
  ```

---

**[E-19] `streak_milestone_achieved`**

- 트리거 위치: `sidebar.js:checkStreakMilestone()` — showToast() 호출 직전
- 목적: 마일스톤 달성 분포 측정. 어떤 마일스톤에서 많이 달성/이탈하는가.
- 프로퍼티:
  ```
  streak_days: number            // 3, 7, 14, 30, 60, 100
  milestone_label: string        // '3일 연속', '7일 연속' 등
  total_entries: number
  days_since_signup: number
  ```

---

#### D. Retention 이벤트 (3개)

---

**[E-20] `app_session_started`**

- 트리거 위치: `app.js:showApp()` — initApp() 호출 직전
- 목적: DAU/WAU/MAU 측정 기반. 세션 시작 = 앱 진입 (인증 완료 상태).
- 프로퍼티:
  ```
  days_since_last_session: number | null  // localStorage 'last_session_date' 기반
  total_entries: number
  current_streak: number
  is_today_completed: boolean    // 오늘 이미 일기 작성했는지
  onboarding_completed: boolean
  ```

---

**[E-21] `retention_card_shown`**

- 트리거 위치: `diary.js:showRetentionCard()` — retentionCard.hidden = false 직전
- 목적: 리텐션 넛지 노출 빈도와 메시지 유형 분포 측정.
- 프로퍼티:
  ```
  message_type: 'guest_cta' | 'milestone' | 'streak' | 'insight_preview' | 'stats_encouragement'
  current_streak: number
  total_entries: number
  ```

---

**[E-22] `guest_data_migrated`**

- 트리거 위치: `guest.js:migrateGuestData()` — res.ok && result.imported > 0 시
- 목적: 게스트 -> 회원 전환 시 데이터 이전 성공율. 이전 성공이 초기 리텐션에 미치는 영향.
- 프로퍼티:
  ```
  imported_count: number
  skipped_count: number
  guest_usage_days: number       // 첫 게스트 entry timestamp 기반
  ```

---

#### E. 이탈/오류 이벤트 (3개)

---

**[E-23] `auth_error_shown`**

- 트리거 위치: `auth.js:initAuthForms()` — loginMessage/signupMessage 표시 시
- 목적: 인증 단계 오류 분포 측정. 어떤 오류 메시지가 가장 많이 발생하는가.
- 프로퍼티:
  ```
  form_type: 'login' | 'signup' | 'reset'
  error_code: string             // result.error (서버 응답 에러 메시지)
  attempt_number: number         // 해당 세션에서 몇 번째 시도인지
  ```

---

**[E-24] `ai_analysis_failed`**

- 트리거 위치: `diary.js:handleSubmit()` — catch 블록 (showError 호출 시)
- 목적: AI 분석 실패율 측정. 사용자가 경험하는 오류 빈도 모니터링.
- 프로퍼티:
  ```
  error_message: string
  text_length: number
  is_guest: boolean
  retry_attempted: boolean       // 이전에 같은 세션에서 실패 이력
  ```

---

**[E-25] `offline_sync_completed`**

- 트리거 위치: `app.js` — navigator.serviceWorker 'OFFLINE_SYNC_COMPLETE' 메시지 수신 시
- 목적: 오프라인 사용 패턴 측정. SW 큐 기능 실효성 확인.
- 프로퍼티:
  ```
  synced_count: number           // e.data.count
  estimated_offline_duration_min: number
  ```

---

### 이벤트 우선순위 (ICE 스코어)

| 이벤트 | Impact | Confidence | Ease | ICE | 1차 구현 |
|--------|--------|-----------|------|-----|---------|
| E-11 diary_submitted | 10 | 10 | 9 | 9.7 | Y |
| E-12 ai_response_received | 10 | 10 | 9 | 9.7 | Y |
| E-20 app_session_started | 10 | 9 | 9 | 9.3 | Y |
| E-06 signup_completed | 9 | 9 | 9 | 9.0 | Y |
| E-01 landing_viewed | 9 | 9 | 8 | 8.7 | Y |
| E-10 first_diary_submitted | 9 | 9 | 8 | 8.7 | Y |
| E-13 ai_feedback_submitted | 8 | 9 | 9 | 8.7 | Y |
| E-04 signup_modal_shown | 8 | 8 | 9 | 8.3 | Y |
| E-14 tab_switched | 7 | 9 | 9 | 8.3 | Y |
| E-08 onboarding_step_viewed | 8 | 8 | 7 | 7.7 | Y |

---

## 5. 핵심 대시보드 설계

### 5-1. 일간 대시보드 (Daily Operations)

**목적**: 서비스 이상 징후 조기 발견, 당일 사용자 행동 파악

| 메트릭 | 계산 방법 | 경보 임계값 |
|--------|----------|-----------|
| DAU | app_session_started 고유 user_id 수 | 전일 대비 -30% |
| 신규 가입 수 | signup_completed 이벤트 수 | 전일 대비 -50% |
| 일기 작성 수 | diary_submitted 이벤트 수 | 전일 대비 -40% |
| AI 분석 성공율 | ai_response_received / diary_submitted | 90% 미만 |
| AI 평균 응답 시간 | ai_response_received.response_time_ms 평균 | 5,000ms 초과 |
| helpful 피드백 비율 | rating='helpful' / total feedback | 60% 미만 |
| 게스트 -> 회원 전환 수 | signup_completed where entry_source='guest_modal' | - |

**핵심 시각화**:
- 시간별 일기 작성 히트맵 (0-23시) — 언제 쓰는가
- 감정 분포 도넛 차트 (오늘)
- 퍼널 바: 랜딩 방문 -> 데모 -> 가입 폼 -> 가입 완료

---

### 5-2. 주간 대시보드 (Growth Review)

**목적**: NSM 추적, 퍼널 전환율 분석, 기능 채택율

| 메트릭 | 계산 방법 | 목표 |
|--------|----------|------|
| WAU | app_session_started 고유 user_id / 주 | - |
| WAW (North Star) | diary_submitted >= 2회인 user / WAU | >= 40% |
| D1 리텐션 | 가입 후 다음날 app_session_started 비율 | >= 40% |
| D7 리텐션 | 가입 7일 후 활성 비율 | >= 20% |
| 온보딩 완료율 | onboarding_completed / signup_completed | >= 80% |
| 첫 일기 작성율 | first_diary_submitted / signup_completed | >= 70% |
| 게스트 -> 가입 전환율 | signup via guest_modal / guest_demo_started | >= 20% |
| AI 리포트 생성율 | report_generated 사용자 / WAU | - |

**핵심 시각화**:
- 코호트 리텐션 테이블 (가입 주차별 D1/D7/D14/D30)
- 주간 WAW 트렌드 라인 차트
- 기능별 탭 사용율 파이 차트 (tab_switched to_tab 분포)
- 게스트 퍼널 바: 데모 시작 -> 3회 사용 -> 넛지 -> 가입 클릭

---

### 5-3. 월간 대시보드 (Strategic Review)

**목적**: 성장 트렌드, LTV 모델, 기능 전략 의사결정

| 메트릭 | 계산 방법 | 목표 |
|--------|----------|------|
| MAU | app_session_started 고유 user_id / 월 | - |
| Stickiness (DAU/MAU) | DAU 평균 / MAU | >= 20% |
| D30 리텐션 | 가입 30일 후 활성 비율 | >= 15% |
| 월간 AI 리포트 요청율 | report_generated / MAU | - |
| 스트릭 7일 이상 달성 비율 | streak_milestone >= 7 / MAU | - |
| 데이터 내보내기 사용율 | data_exported 사용자 / MAU | - |
| 평균 일기 작성 간격 | diary_submitted 이벤트 간 시간 중앙값 | - |
| 가입 채널별 D30 리텐션 | entry_source별 분류 | - |

**핵심 시각화**:
- MAU/WAU/DAU 트렌드 (3개 라인)
- 코호트 히트맵 (월별 가입 코호트 x D1/D7/D30)
- 감정 분포 변화 트렌드 (월별)
- 스트릭 마일스톤 달성 분포 히스토그램

---

## 6. A/B 테스트 제안

### [Test-01] 게스트 모드 넛지 타이밍 최적화

**가설**: 게스트 체험 3회 후가 아닌 1회 성공 직후 회원가입 유도 모달을 표시하면, 게스트->가입 전환율이 20% 이상 향상될 것이다.

**배경**: 현재 코드(guest.js:analyzeDemo)에서 3회 사용 후 넛지(showSignupModal('nudge'))를 표시한다. 그러나 AI 응답을 처음 받은 순간이 제품 가치를 가장 강하게 경험하는 "Aha Moment"일 가능성이 높다.

**실험 설계**:
- Control (A): 현재 — 3회 사용 후 넛지 모달
- Variant (B): 1회 사용 성공 직후 즉시 넛지 모달 (reason='first_success')

**변수**: 넛지 표시 타이밍 (1회 vs 3회)

**측정 지표**:
- Primary: 게스트 -> 가입 전환율 (signup_completed where entry_source='guest_modal')
- Secondary: 가입 후 D7 리텐션 (품질 확인), 넛지 모달 dismissal율

**예상 효과**: 전환율 +15~25% (단, 모달 피로도 상승 가능성 고려)

**샘플 사이즈**: 각 그룹 200명 이상, 유의수준 p<0.05

**구현 위치**: `guest.js:analyzeDemo()` — used === 3 조건을 1로 변경 (Variant)

**ICE**: Impact=8, Confidence=7, Ease=9 → ICE=8.0

---

### [Test-02] 온보딩 3단계 vs 1단계 간소화

**가설**: 현재 3단계 온보딩(소개->기능->알림설정)을 알림 설정만 남긴 1단계로 줄이면, 온보딩 완료율이 20%p 향상되고 첫 일기 작성까지의 시간이 단축될 것이다.

**배경**: 3단계 온보딩은 이탈 지점이 3개다. 소개와 기능 설명 스텝은 실제 앱을 쓰면서 배울 수 있는 내용이다. onboarding_step_viewed 이벤트 구현 후 스텝별 이탈율 데이터로 검증 가능.

**실험 설계**:
- Control (A): 현재 3단계 온보딩 (Step1: 소개, Step2: 기능, Step3: 알림)
- Variant (B): 1단계 온보딩 (알림 시간 설정만 + "바로 시작하기" 버튼)

**변수**: 온보딩 단계 수 (3단계 vs 1단계)

**측정 지표**:
- Primary: 온보딩 완료율 (onboarding_completed / signup_completed)
- Secondary: 가입 후 24시간 내 첫 일기 작성율(first_diary_submitted), D7 리텐션

**예상 효과**: 온보딩 완료율 +20%p, 첫 일기 작성 평균 시간 -30%

**샘플 사이즈**: 각 그룹 150명, 유의수준 p<0.05

**구현 위치**: `app.js:updateOnboardingUI()` — onboardingStep2 스텝 숨김 처리 (Variant)

**ICE**: Impact=8, Confidence=6, Ease=8 → ICE=7.3

**주의**: 온보딩 단축이 장기 리텐션에 부정적 영향을 미칠 수 있으므로 D30 리텐션까지 모니터링 필요.

---

### [Test-03] AI 응답 카드 후 즉시 저장 vs 검토 후 저장 플로우

**가설**: AI 응답을 받은 직후 "이 일기를 저장할까요?" 확인 단계를 추가하면, 저장된 일기의 AI 피드백(helpful) 비율이 높아지고 D7 리텐션이 5%p 향상될 것이다.

**배경**: 현재 플로우(diary.js:handleSubmit)는 AI 분석 성공 즉시 자동으로 saveEntry()를 호출한다. 사용자는 응답을 검토할 여유 없이 저장된다. 저장 결정권을 사용자에게 주면 의도적 기록 행위가 강화되어 습관 형성에 기여할 수 있다.

**실험 설계**:
- Control (A): 현재 — AI 분석 완료 즉시 자동 저장
- Variant (B): AI 응답 카드 하단에 "저장하기" / "다시 작성" 버튼 표시. 클릭 시 저장.

**변수**: 저장 트리거 (자동 vs 사용자 명시적 액션)

**측정 지표**:
- Primary: D7 리텐션 (가입 7일 후 app_session_started 비율)
- Secondary: AI 피드백 helpful 비율 (ai_feedback_submitted.rating='helpful'), 저장 완료율(Variant에서 "저장하기" 클릭 비율), 이탈율(다시 작성 선택 비율)

**예상 효과**: D7 리텐션 +5%p, helpful 피드백 비율 +10%p. 단, 저장 완료율이 70% 미만으로 떨어질 경우 일기 총량 감소 위험.

**샘플 사이즈**: 각 그룹 200명, 유의수준 p<0.05, 최소 2주 관찰

**구현 위치**: `diary.js:handleSubmit()` — saveEntry() 호출을 분리하여 별도 버튼 이벤트로 이동 (Variant)

**ICE**: Impact=7, Confidence=5, Ease=7 → ICE=6.3

---

## 7. 구현 로드맵

### Phase 1 — 분석 인프라 구축 (1주)

```
목표: 10개 핵심 이벤트 수집 시작 (E-01, E-04, E-06, E-08~14, E-20)

구현:
1. analytics.js 모듈 신설 (public/js/analytics.js)
   - track(eventName, properties) 함수
   - 공통 프로퍼티 자동 주입
   - 초기에는 console.log + /api/analytics POST (간이 수집)

2. /api/analytics POST 엔드포인트 신설 (routes/analytics.js)
   - 이벤트를 Supabase analytics_events 테이블에 저장
   - 또는 외부 서비스(Amplitude, Mixpanel, PostHog) 연동

3. Supabase analytics_events 테이블
   CREATE TABLE analytics_events (
     id uuid DEFAULT gen_random_uuid(),
     event_name text NOT NULL,
     user_id uuid REFERENCES auth.users(id),
     session_id text NOT NULL,
     properties jsonb,
     created_at timestamptz DEFAULT now()
   );
```

### Phase 2 — 전체 이벤트 계측 (2주)

```
목표: 25개 전체 이벤트 구현 완료

우선순위: ICE 8.0 이상 이벤트 먼저
- E-11, E-12: diary.js:handleSubmit() 수정
- E-20: app.js:showApp() 수정
- E-01, E-02: app.js:showLanding(), 버튼 핸들러 수정
```

### Phase 3 — 대시보드 및 A/B 테스트 (3~4주)

```
목표: 주간 리뷰 대시보드 운영, Test-01 시작

구현:
1. Retool 또는 Supabase Dashboard로 일간/주간 메트릭 시각화
2. Test-01 (게스트 넛지 타이밍) 코드 구현 및 런칭
3. 코호트 리텐션 쿼리 작성
```

### 권장 외부 도구 (Zero-cost 우선)

| 용도 | 추천 도구 | 이유 |
|------|----------|------|
| 이벤트 수집/분석 | PostHog (OSS) | 자체 호스팅 가능, 무료 플랜 100만 이벤트/월 |
| 대시보드 | PostHog Insights | 코호트, 퍼널, 리텐션 내장 |
| A/B 테스트 | PostHog Feature Flags | 같은 플랫폼에서 관리 가능 |
| 대안 | Mixpanel Free | 월 1000 사용자까지 무료 |

---

## 부록: 이벤트 구현 코드 예시

```javascript
// public/js/analytics.js
const SESSION_ID = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

export function track(eventName, properties = {}) {
  const common = {
    user_id: state.currentUser?.id || null,
    session_id: SESSION_ID,
    is_guest: state.guestMode,
    timestamp: new Date().toISOString(),
    platform: 'web',
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
  };

  const payload = { event: eventName, ...common, ...properties };

  // 개발 환경: 콘솔 출력
  if (location.hostname === 'localhost') {
    console.log('[Analytics]', eventName, payload);
    return;
  }

  // 프로덕션: 서버로 전송 (fire-and-forget)
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,  // 페이지 언로드 시에도 전송
  }).catch(() => {});
}
```

```javascript
// 사용 예: diary.js:handleSubmit() 내부
import { track } from './analytics.js';

// 제출 직전
track('diary_submitted', {
  text_length: text.length,
  entry_hour: new Date().getHours(),
  entry_day_of_week: new Date().getDay(),
  is_guest: state.guestMode,
  total_entries_count: (state.allEntries || []).length,
  used_keyboard_shortcut: e.type === 'submit' && e.isTrusted === false,
});

// AI 응답 수신 후 (showResponse 내)
track('ai_response_received', {
  emotion: result.emotion,
  emotion_level1: result.ontology?.emotion_hierarchy?.level1 || null,
  confidence_score: result.ontology?.confidence || 0,
  has_ontology: !!result.ontology,
  response_time_ms: Date.now() - startTime,
  situation_domains: (result.ontology?.situation_context || []).map(s => s.domain),
});
```

---

*이 설계서는 코드 정적 분석 기반으로 작성되었습니다. 실제 이벤트 수집 시작 후 데이터 기반으로 지속적으로 업데이트해야 합니다.*
