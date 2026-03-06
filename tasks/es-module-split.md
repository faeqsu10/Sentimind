# ES Module 파일 분리 작업 기록

## 작업 일시
2026-03-06

## 목적
단일 `public/index.html` (7,393줄, CSS/JS 인라인)의 유지보수성 개선을 위해
프레임워크 도입 없이 ES Module `<script type="module">`로 파일 분리.

## 변경 전
```
public/
├── index.html  (7,393줄 — CSS 3,234줄 + HTML 869줄 + JS 3,262줄)
└── sw.js       (sentimind-v3)
```

## 변경 후
```
public/
├── index.html          (902줄, HTML 마크업만)
├── css/
│   ├── base.css        (69줄 — CSS 변수, 리셋, 애니메이션)
│   ├── layout.css      (149줄 — 그리드, 사이드바, 탭)
│   ├── components.css  (2,244줄 — UI 컴포넌트 + 다크 모드)
│   └── landing.css     (774줄 — 랜딩 페이지)
├── js/
│   ├── app.js          (650줄 — 진입점, 화면 전환, 초기화)
│   ├── state.js        (61줄 — 공유 상태 + 상수)
│   ├── utils.js        (236줄 — escapeHtml, toast, focus trap 등)
│   ├── api.js          (144줄 — fetchWithAuth, API 래퍼)
│   ├── auth.js         (322줄 — 로그인/회원가입/비밀번호 리셋)
│   ├── guest.js        (223줄 — 게스트 데모 모드)
│   ├── diary.js        (191줄 — 일기 작성/분석)
│   ├── history.js      (224줄 — 히스토리 관리)
│   ├── calendar.js     (170줄 — 감정 달력)
│   ├── stats.js        (251줄 — 통계 대시보드)
│   ├── profile.js      (283줄 — 프로필/설정)
│   └── sidebar.js      (295줄 — 사이드바, 스트릭, 인사이트)
└── sw.js               (sentimind-v4, 16개 정적 파일 캐시)
```

## 아키텍처 결정

### 순환 의존성 방지: Dependency Injection 패턴
- 각 모듈은 `setup*(deps)` 함수를 export하여 cross-module 콜백을 주입받음
- 예: `setupAuth({ showApp, showAuthScreen, showOnboarding, ... })`
- 콜백은 사용 시점(클릭 등)에 실행되므로 모듈 로드 시점의 순환 참조 없음

### 공유 상태: state.js
- mutable 객체 `state`를 export하여 모든 모듈이 import
- 전역 변수 20개+ → 모듈 스코프의 단일 객체로 통합

### CSS 다크 모드
- 별도 파일 분리 대신 components.css에 인라인으로 유지
- 이유: 다크 모드 규칙이 컴포넌트와 1:1 대응하므로 함께 관리가 효율적

## 버그 수정 (분리 과정에서 발견)
- `guest.js`: `demoForm` submit → `demoAnalyzeBtn` click으로 변경 (HTML에 form 없음)
- `guest.js`: `.sample-card` → `.demo-sample-card` (올바른 CSS 클래스명)
- `guest.js`: `data-text` → `data-sample` (올바른 data attribute)
- `guest.js`: `demoBackBtn` 제거 (HTML에 없는 요소), `demoLoginBtn` 핸들러 추가

## 검증 결과
- [x] 12개 JS 모듈 구문 검사 통과 (`node --input-type=module --check`)
- [x] 16개 정적 파일 200 OK + 올바른 Content-Type 확인
- [x] HTML DOM ID 일치 확인 (6개 스크린 컨테이너)
- [x] SW 캐시 버전 v3 → v4 업데이트

## 관련 문서 업데이트
- CLAUDE.md: Architecture 섹션 업데이트
- MEMORY.md: 프로젝트 구조 반영
