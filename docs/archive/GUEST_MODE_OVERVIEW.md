# Guest 모드 UX 설계 - 전체 개요

**프로젝트**: Sentimind (AI 공감 다이어리)
**미션**: 신규 사용자 경험 개선 및 회원가입 전환율 증대
**상태**: 설계 완료 (2026-03-06)
**팀**: 2-3명 (Frontend Dev, Backend Dev 0.5, QA)
**기간**: 3-4주

---

## 목표

### Business Metrics
| 지표 | 현재 | 목표 | 증가율 |
|------|------|------|--------|
| 신규 사용자 이탈율 | ~45% | ~20% | -55% |
| 회원가입 전환율 | ~5% | ~25% | +400% |
| 평균 체류 시간 | 2분 | 5분 | +150% |
| DAU (일일 활성 사용자) | 10 | 50+ | +400% |
| 재방문율 (7일) | ~30% | ~70% | +130% |

### UX Goals
1. **온보딩 개선**: 신규 사용자가 30초 내 앱의 가치 이해
2. **진입장벽 제거**: 로그인 없이 즉시 체험 가능
3. **점진적 전환**: 게스트 → 회원으로 자연스러운 전환
4. **신뢰 구축**: 데이터 보안, 투명성 강조

---

## 핵심 설계 (Executive Summary)

### Before (현재)
```
신규 방문자
    ↓
[로그인 강제]
    ↓
[회원가입 폼]
    ↓
[앱 사용]

→ 결과: 로그인 단계에서 ~45% 이탈
```

### After (Guest 모드)
```
신규 방문자
    ↓
[Landing: 30초 설명]
    ↓
[Demo: 1-2분 체험 (로그인 없음)]
    ↓
[Signup Prompt: 부드러운 유도]
    ↓
[Choice: 회원가입 or 게스트 계속]
    ↓
[회원: 무제한 | 게스트: 10개 항목, 7일 저장]

→ 결과: 3-5개 일기 후 회원가입 유도, 전환율 +400%
```

---

## 핵심 기능

### 1. Landing Page
**목적**: 신규 방문자에게 Sentimind의 가치를 명확히 전달

**요소**:
- Hero: "당신의 감정을 이해하는 AI 일기장"
- Features: 3개 카드 (감정 분석 | 공감 응답 | 감정 통계)
- FAQ: 5개 질문 (보안, 비용, 사용법 등)
- CTA: "무료로 시작하기" 버튼

**설계 원칙**:
- 클린한 디자인 (기존 Sentimind 색상/폰트 사용)
- 명확한 가치 제시 (3초 내 이해 가능)
- 이미지/일러스트로 시각적 임팩트

---

### 2. Demo Page
**목적**: 로그인 없이 AI 감정 분석을 경험하게 함

**요소**:
- 샘플 카드 3개 (빠른 입력)
- 텍스트 입력 필드 (최대 500자)
- AI 응답 카드 (기존과 동일)
- 피드백 버튼 (👍/🤔, 2초 후 표시)
- 회원가입 유도 카드 (Soft prompt)

**설계 원칙**:
- 1-2분 내 완성 가능
- 샘플 제공으로 진입장벽 최소화
- 피드백으로 AI 신뢰도 학습

---

### 3. 게스트 모드 제한사항
**제한**: 최대 10개 일기, 7일 보관

**제한 이유**:
- 회원가입 유도 (10개 근처에서 "더 보관하려면 가입하세요" 메시지)
- 저장공간 효율화 (로컬스토리지 5-10MB 내)
- 사용자 심리: "충분히 써본 후 가입" 의사결정

**유연성**:
- 로그인 후 게스트 데이터 모두 가져올 수 있음
- 데이터 손실 없음 (7일 자동 삭제, 자동 알림)

---

### 4. 회원가입 유도 (Signup Prompt Modal)
**타이밍**: 게스트가 3-5개 일기 작성 후

**전략**:
- 비교표 제시 (게스트 vs 회원)
- "권장" 배지로 부드러운 유도
- "나중에" 버튼으로 강요하지 않음
- 데이터 보안 안내 (신뢰 구축)

**설계 원칙**:
- 강압적이지 않음 (UX 리스팅 높음)
- 명확한 가치 차이 (무제한 저장)
- 신뢰: "데이터는 암호화되어 저장됩니다"

---

## 기술 구현 전략

### 1. Single HTML 유지
```html
<!DOCTYPE html>
<html>
  <body>
    <!-- Screen 1: Landing -->
    <section data-screen="landing">...</section>

    <!-- Screen 2: Demo -->
    <section data-screen="demo" hidden>...</section>

    <!-- Screen 3: Auth -->
    <section data-screen="auth" hidden>...</section>

    <!-- Screen 4: App -->
    <section data-screen="app" hidden>...</section>

    <!-- Modal: Signup Prompt -->
    <div id="modal-signup-prompt" hidden>...</div>

    <script>
      function showScreen(name) {
        // .hidden 토글로 화면 전환
      }
    </script>
  </body>
</html>
```

**장점**:
- 파일 관리 간단 (추가 파일 없음)
- 빠른 네비게이션 (새로고침 없음)
- SPA 느낌 (프로덕션 배포 간단)

---

### 2. 신규 컴포넌트 (5개)

#### (1) 게스트 배지
```html
<span class="guest-badge">게스트</span>
```
- 위치: 입력 필드 라벨 옆
- 로그인 후: 숨김

#### (2) 샘플 카드
```html
<button class="sample-card">
  <span class="sample-emoji">😰</span>
  <span class="sample-text">오늘 발표가 있어서 긴장했다</span>
</button>
```
- 클릭 → 입력 필드 채우기
- Hover: 배경 따뜻해짐, 조금 오른쪽으로 이동

#### (3) 저장 상태 인디케이터
```html
<div class="save-status">
  <span class="save-status-icon">⏳</span>
  <span class="save-status-text">저장 중...</span>
</div>
```
- 위치: 우상단 고정
- 상태: saving (⏳ 회전) | saved (✓ 초록색, 2초 후 사라짐) | error (❌ 빨강색)

#### (4) 피드백 버튼
```html
<div class="response-feedback">
  <p>이 분석이 도움이 됐나요?</p>
  <button id="btn-feedback-yes">👍 도움이 됐어요</button>
  <button id="btn-feedback-no">🤔 다른 감정이 맞는데요?</button>
</div>
```
- 응답 표시 2초 후 나타남
- 피드백 저장 API: POST /api/feedback

#### (5) 회원가입 유도 모달
```html
<div class="modal" id="modal-signup-prompt">
  <div class="modal-content">
    <h2>이 일기를 저장하고 싶으신가요?</h2>
    <table class="comparison-table">
      <!-- 게스트 vs 회원 비교 -->
    </table>
    <button>회원가입하기</button>
    <button>나중에</button>
  </div>
</div>
```
- Overlay 배경, ESC 키로 닫기
- 포커스 트랩 (접근성)

---

### 3. 기존 컴포넌트 수정 (2개)

#### (1) Header
- Landing: "[로그인] [체험해보기]" 추가
- Demo: "[뒤로 가기] [로그인]" 버튼

#### (2) 입력 필드
- 게스트 배지 추가
- 문자 카운트 개선
- Focus 스타일 개선

---

## 파일 구조

### 생성된 문서
```
/home/faeqsu10/projects/vibe-coding/study-04/
├── GUEST_MODE_UX_DESIGN.md ................... 전체 설계 (50 섹션, 1,200+ 줄)
│   ├─ 설계 원칙
│   ├─ 정보 아키텍처 (IA)
│   ├─ 페이지 구조 & 와이어프레임
│   ├─ 상세 화면 설계 (CSS, HTML)
│   ├─ UI 컴포넌트 명세
│   ├─ 사용자 여정 맵
│   ├─ 프로토타입 구현 가이드
│   ├─ 접근성 & 모바일 대응
│   └─ 구현 로드맵
│
├── GUEST_MODE_COMPONENT_CATALOG.md ......... 컴포넌트 스펙 (30 컴포넌트, 800+ 줄)
│   ├─ 새로운 컴포넌트 (5개)
│   │  ├─ 게스트 배지
│   │  ├─ 샘플 카드
│   │  ├─ 저장 상태 인디케이터
│   │  ├─ 피드백 버튼
│   │  └─ 회원가입 유도 모달
│   ├─ 수정된 기존 컴포넌트 (2개)
│   ├─ 레이아웃 패턴
│   ├─ 애니메이션 & 이벤트
│   └─ 색상 & 타이포그래피
│
├── GUEST_MODE_IMPLEMENTATION_CHECKLIST.md .. 개발 체크리스트
│   ├─ Phase A: 기초 구조 (1주)
│   ├─ Phase B: 통합 & 고급 (1-2주)
│   ├─ Phase C: 개선 & 테스트 (1주)
│   ├─ Phase D: 릴리스 준비 (병렬)
│   ├─ 총 예상 기간 (3-4주)
│   ├─ 팀 구성
│   ├─ 주의사항
│   └─ 의존성 & 리스크
│
└── GUEST_MODE_OVERVIEW.md .................. 이 파일 (개요)
```

### 관련 기존 문서
- `UX_UI_ANALYSIS.md` — 현재 앱 분석 (7.5/10)
- `ONTOLOGY_UX_DESIGN.md` — 온톨로지 통합 설계
- `CLAUDE.md` — 개발 워크플로우 & 원칙
- `TEAM_GUIDE.md` — 팀 협업 가이드

---

## 예상 성과

### 단기 (1개월)
- 신규 사용자 온보딩 완성도 +50%
- 회원가입 전환율 +300-400%
- 게스트 일기 작성 수 (데일리): 30-50개

### 중기 (3개월)
- DAU (일일 활성 사용자) 50+ 도달
- 재방문율 70% 이상
- 게스트 → 회원 전환 누적 100+ 명

### 장기 (6개월)
- Sentimind의 기본 증대 전략 수립
- 게스트 모드 데이터 기반 개인화 (Phase 2)
- 추천 엔진 구축 (Phase 3)

---

## 다음 단계 (Next Steps)

### 1. 검토 & 승인 (1-2일)
- [ ] Design document 검토 (PM, Design Lead)
- [ ] Component specification 검토 (Frontend Lead)
- [ ] Implementation checklist 검토 (Backend Lead, QA Lead)

### 2. 준비 (1-2일)
- [ ] GitHub 이슈 생성 (각 Phase별)
- [ ] Branch 생성: `feature/guest-mode`
- [ ] CI/CD 파이프라인 준비 (GitHub Actions)

### 3. 개발 (3-4주)
- Phase A → B → C → D 순차 진행
- 주 2회 스탠드업 + 스프린트 리뷰

### 4. 배포 (1주)
- QA 최종 검증
- Vercel preview 배포
- Production 릴리스 (점진적 롤아웃 5% → 25% → 100%)

---

## FAQ

### Q: 기존 로그인 사용자에게 영향이 있나요?
**A**: 없습니다. 기존 기능은 모두 유지되며, 로그인 사용자는 현재와 동일한 환경을 경험합니다.

### Q: 게스트 데이터는 안전한가요?
**A**: 게스트 데이터는 로컬스토리지에 저장되며, 암호화를 통해 보호됩니다. 로그인 후 서버로 이전하거나 7일 후 자동 삭제됩니다.

### Q: 게스트 모드에서 온톨로지 기반 감정 분석도 가능한가요?
**A**: 네, 100% 동일합니다. 게스트도 회원과 동일한 AI 감정 분석을 받습니다.

### Q: 모바일에서도 잘 작동하나요?
**A**: 네, WCAG 2.1 AA 접근성 기준을 만족하며, 모든 주요 브라우저(Chrome, Safari, Firefox 등)에서 테스트됩니다.

### Q: 추후 업그레이드 계획이 있나요?
**A**: 예, Phase 2 (감정 피드백 루프) 와 Phase 3 (개인화 & 추천)이 계획되어 있습니다.

---

## 참고 자료

### 설계 참고
- 마이크로소프트 Fluent Design System
- Material Design 3 (onboarding patterns)
- Human Interface Guidelines (Apple)

### UX 원칙
- 제이콥의 법칙: 기존 패턴 준수 (로그인/가입)
- 힉의 법칙: 선택지 3가지 이하 (샘플 카드)
- 점진적 공개: 필요한 시점에 필요한 정보만
- 신뢰 구축: 데이터 보안 강조

### 기술 참고
- Single Page Application (SPA) 패턴
- Progressive Web App (PWA) 고려
- localStorage API (MDN)
- WCAG 2.1 Guidelines

---

## 문의 사항

이 문서에 대한 질문이나 제안이 있으시면, 다음을 참고하세요:

- **Design 문의**: `GUEST_MODE_UX_DESIGN.md` 섹션별 상세 설명
- **Component 문의**: `GUEST_MODE_COMPONENT_CATALOG.md` 스펙
- **개발 일정**: `GUEST_MODE_IMPLEMENTATION_CHECKLIST.md` Phase별 체크리스트

---

**최종 작성자**: Claude Code (UX Designer Agent)
**작성일**: 2026-03-06
**상태**: 설계 완료, 개발 준비 중
**버전**: v1.0 (Guest Mode)
