# Guest 모드 구현 체크리스트

**작성일**: 2026-03-06
**상태**: 설계 완료, 개발 시작 전 체크리스트
**추정 기간**: 3-4주 (5-6명 팀)

---

## Phase A: 기초 구조 (1주)

### 1. HTML 구조 & 스크린 전환

- [ ] Landing Page HTML 마크업
  - [ ] Hero 섹션 (제목 + 서브 + CTA)
  - [ ] Features 섹션 (3 cards)
  - [ ] FAQ 섹션 (Accordion)
  - [ ] Footer

- [ ] Demo Page HTML 마크업
  - [ ] 샘플 카드 (3개)
  - [ ] "또는" 구분선
  - [ ] 입력 필드 + 게스트 배지
  - [ ] 응답 카드 컨테이너
  - [ ] 피드백 섹션 (hidden)
  - [ ] 회원가입 유도 카드 (hidden)

- [ ] Screen Manager JavaScript
  - [ ] `showScreen(name)` 함수
  - [ ] 화면 전환 이벤트 리스너
  - [ ] 스크롤 위치 초기화

- [ ] 사용자 상태 결정 로직
  - [ ] `determineUserState()`: guest | member | demo
  - [ ] localStorage 읽기 (auth_token, guest_mode)
  - [ ] 진입 화면 자동 선택

### 2. CSS 초안

- [ ] 모든 신규 CSS 변수 정의
  - [ ] `--color-guest-*`
  - [ ] `--color-save-*`
  - [ ] `--gradient-hero`

- [ ] Landing Page 스타일
  - [ ] Hero (배경, 타이포그래피)
  - [ ] Feature cards (그리드, 카드 스타일)
  - [ ] FAQ accordion (스타일)
  - [ ] Footer

- [ ] Demo Page 스타일
  - [ ] 샘플 카드 (Hover, Active)
  - [ ] 입력 필드 (Focus)
  - [ ] 응답 카드 컨테이너

- [ ] 반응형 (모바일 640px 이하)
  - [ ] Landing: 1열 레이아웃
  - [ ] Demo: 텍스트 입력 전체폭
  - [ ] 버튼: 세로 스택

### 3. 기본 인터랙션

- [ ] 샘플 카드 클릭 → 입력 필드 채우기
- [ ] "분석하기" 버튼 로직 (기존 /api/analyze 사용)
- [ ] 로딩 상태 표시 (3점 점프 애니메이션)
- [ ] 문자 카운트 업데이트 (0/500)
- [ ] 빈 입력 시 버튼 비활성화

**예상 소요 시간**: 35-40시간

---

## Phase B: 통합 & 고급 기능 (1-2주)

### 1. 게스트 모드 저장소 관리

- [ ] localStorage 설계
  ```javascript
  {
    guest_mode: true,
    guest_entries: [
      { id, text, analysis, timestamp },
      ...
    ],
    last_signup_prompt: timestamp,
  }
  ```

- [ ] 게스트 일기 제한 로직
  - [ ] 10개 한계 도달 시 "더 이상 추가 불가" 메시지
  - [ ] 7일 자동 삭제 로직 (서버 또는 클라이언트)

- [ ] 로그인 후 데이터 마이그레이션
  - [ ] 게스트 일기 → 서버로 전송
  - [ ] 로컬 스토리지 정리

### 2. 저장 상태 인디케이터

- [ ] `SaveStatusIndicator` 클래스
  - [ ] show(status, message)
  - [ ] hide()
  - [ ] 자동 숨김 (2초 후, saved 상태만)

- [ ] 3가지 상태 CSS
  - [ ] saving: ⏳ 회전 애니메이션
  - [ ] saved: ✓ 초록색
  - [ ] error: ❌ 빨강색 + 클릭 가능

- [ ] API 호출 통합
  - [ ] POST /api/entries (성공/실패)
  - [ ] 에러 메시지 개선

### 3. 피드백 버튼 & 모달

- [ ] 피드백 버튼 2초 후 표시
  - [ ] 👍 "도움이 됐어요"
  - [ ] 🤔 "다른 감정이 맞는데요?"

- [ ] 피드백 저장 API
  - [ ] POST /api/feedback (entryId, feedback type)
  - [ ] 저장 상태 인디케이터 표시

- [ ] 회원가입 유도 모달
  - [ ] Overlay 배경
  - [ ] 비교표 (게스트 vs 회원)
  - [ ] 닫기 버튼 (X, 배경 클릭, ESC)
  - [ ] 포커스 트랩

### 4. 게스트 배지

- [ ] 조건부 표시
  - [ ] Demo Page: 입력 필드 라벨 옆 표시
  - [ ] 로그인 후: 숨기기

- [ ] 스타일
  - [ ] 배경: primary-hover
  - [ ] 텍스트: white
  - [ ] slideInDown 애니메이션

### 5. 헤더 업데이트

- [ ] Landing Page 헤더
  - [ ] Logo (클릭 → Landing 유지)
  - [ ] [로그인] 버튼 (Auth 화면)
  - [ ] [체험해보기] 버튼 (Demo 화면)

- [ ] Demo Page 헤더
  - [ ] [뒤로 가기] 버튼 (Landing)
  - [ ] Logo (중앙)
  - [ ] [로그인] 버튼

**예상 소요 시간**: 40-50시간

---

## Phase C: 개선 & 테스트 (1주)

### 1. 접근성 (WCAG 2.1 AA)

- [ ] 모든 버튼에 aria-label
- [ ] 색상 + 아이콘 (색상만으로 상태 표시 안 함)
- [ ] 모달 포커스 트랩
- [ ] 키보드 네비게이션 (Tab, Enter, Escape)
- [ ] 화면 리더 테스트
  - [ ] NVDA (Windows)
  - [ ] VoiceOver (macOS/iOS)

- [ ] 색상 대비 검증
  - [ ] Contrast Checker 도구
  - [ ] WCAG AA 이상 (4.5:1)

### 2. 모바일 반응형

- [ ] 640px 이하 테스트
  - [ ] iPhone 12/13/14 (390px)
  - [ ] Galaxy S21 (360px)
  - [ ] iPad Mini (768px)

- [ ] 각 화면별 검증
  - [ ] Landing: 텍스트 가독성, 버튼 터치 가능 (44x44px)
  - [ ] Demo: 텍스트 입력 (16px 이상 폰트 크기)
  - [ ] 모달: 바텀 시트 형식 (모바일)

### 3. 성능 최적화

- [ ] CSS 파일 크기
  - [ ] 신규 CSS 총량 < 20KB
  - [ ] Critical CSS 인라인 (폰트, 레이아웃)

- [ ] JavaScript 번들
  - [ ] 신규 JS < 30KB (minified)
  - [ ] 이벤트 리스너 정리 (메모리 누수 방지)

- [ ] 이미지 최적화
  - [ ] Hero illustration: < 50KB (WebP)
  - [ ] 아이콘: SVG 사용

### 4. 크로스 브라우저 테스트

- [ ] Chrome (최신)
- [ ] Firefox (최신)
- [ ] Safari (최신)
- [ ] Edge (최신)
- [ ] Mobile Safari (iOS 14+)
- [ ] Chrome Mobile (Android 8+)

**체크**:
- [ ] 버튼 호버 효과
- [ ] 모달 오버레이
- [ ] Accordion 애니메이션
- [ ] 입력 필드 포커스
- [ ] 로딩 스피너

### 5. 사용성 테스트

- [ ] 5명의 신규 사용자 (비기술자)
  - [ ] Landing 페이지: 가치 이해 (30초 내)
  - [ ] Demo 진입: CTA 클릭율
  - [ ] 샘플 카드: 입력 용이성
  - [ ] 응답: 만족도 평가

- [ ] 조사 항목
  - [ ] 앱의 목적 이해 (0-5점)
  - [ ] UI 직관성 (0-5점)
  - [ ] 회원가입 의도 (Yes/No)

### 6. QA & 버그 수정

- [ ] 기능 테스트
  - [ ] 게스트 → 회원 데이터 마이그레이션
  - [ ] 7일 자동 삭제
  - [ ] 저장 상태 표시
  - [ ] 피드백 저장

- [ ] 엣지 케이스
  - [ ] 긴 일기 텍스트 (500자 한계)
  - [ ] 빠른 연속 클릭 (중복 제출 방지)
  - [ ] 네트워크 오류 (오프라인)
  - [ ] 브라우저 뒤로 가기
  - [ ] 새로고침 후 상태 유지

**예상 소요 시간**: 30-40시간

---

## Phase D: 릴리스 준비 (병렬 진행)

### 1. 문서화

- [ ] 사용자 가이드
  - [ ] 게스트 모드 설명
  - [ ] 데이터 보안 정책
  - [ ] 회원가입 혜택

- [ ] 개발자 문서
  - [ ] 스크린 관리 방식
  - [ ] localStorage 스키마
  - [ ] API 엔드포인트 (feedback 추가)

- [ ] 마이그레이션 가이드
  - [ ] 기존 사용자 영향 없음
  - [ ] 배포 체크리스트

### 2. 분석 & 모니터링

- [ ] Google Analytics 추가
  - [ ] Landing 진입
  - [ ] Demo 클릭
  - [ ] 게스트 일기 작성 수
  - [ ] 회원가입 완료

- [ ] 에러 로깅
  - [ ] Sentry/ErrorBoundary 통합
  - [ ] API 실패 추적

### 3. 배포 계획

- [ ] 환경별 테스트
  - [ ] 로컬 (NODE_ENV=development)
  - [ ] 스테이징 (Vercel Preview)
  - [ ] 프로덕션 (Vercel Production)

- [ ] 롤백 계획
  - [ ] 기존 데이터 백업
  - [ ] 즉시 롤백 방법

**예상 소요 시간**: 15-20시간 (병렬)

---

## 총 예상 기간

| Phase | 시간 | 일 (1일 8시간) | 명 |
|-------|------|----------------|-----|
| A | 35-40 | 5-6 | 2-3 |
| B | 40-50 | 5-7 | 2-3 |
| C | 30-40 | 4-5 | 2-3 |
| D | 15-20 | 2-3 | 1-2 |
| **합계** | **120-150** | **16-21** | **2-3명 (3-4주)** |

---

## 팀 구성 (권장)

- **Frontend Developer (1명)**: A → B → C 주도
- **Backend Developer (0.5명)**: B-D 피드백 API, 마이그레이션
- **QA Engineer (1명)**: C (테스트) + D 모니터링
- **PM (0.5명)**: 병렬 진행, 릴리스 조율

---

## 주의사항

### 1. Single HTML 유지
- 새로운 파일 추가 금지
- 모든 화면을 `index.html` 내 섹션으로 관리
- CSS/JS는 `<style>`, `<script>` 블록에 인라인

### 2. 기존 기능 보존
- 로그인 사용자는 기존과 동일한 환경
- 기존 API 엔드포인트 변경 금지
- 온톨로지, 감정 분석은 게스트도 동일하게 제공

### 3. 데이터 보안
- 게스트 데이터도 암호화 저장 (선택사항)
- localStorage는 클라이언트에만 저장 (서버 미동기화)
- 개인정보 수집 최소화

### 4. 성능
- 신규 CSS < 20KB
- 신규 JS < 30KB
- 초기 로딩 시간 (현재 수준 유지)

---

## 의존성 & 리스크

### 낮음
- Landing Page 디자인 (기존 컬러/타이포 사용)
- 샘플 카드 인터랙션 (단순 DOM 조작)

### 중간
- localStorage 게스트 데이터 관리
- 회원가입 후 데이터 마이그레이션
- 크로스 브라우저 호환성

### 높음
- 단일 HTML 파일 크기 증가 (성능 영향)
  → 해결: 코드 최소화, 불필요한 주석 제거
- localStorage 한계 (용량: 5-10MB, 게스트 10개 일기는 무관)
  → 해결: 7일 자동 삭제로 적절한 크기 유지

---

## 다음 단계

1. **팀 회의**: 이 체크리스트 검토 및 확정
2. **Branching**: `feature/guest-mode` 브랜치 생성
3. **Sprint 계획**: Phase A ~ D를 스프린트로 분할
4. **CI/CD**: GitHub Actions (테스트 자동화)
5. **Preview**: Vercel Preview로 중간 검증

---

**작성자**: Claude Code (UX Designer Agent)
**리뷰 대기**: Backend Lead, QA Lead, PM
