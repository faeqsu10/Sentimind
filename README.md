# Sentimind - AI 공감 다이어리

당신의 감정을 AI가 이해해주는 하루 한 줄 다이어리 앱

**Live**: https://sentimind-delta.vercel.app | **GitHub**: https://github.com/faeqsu10/Sentimind

## 🎯 개요

**Sentimind**는 Google Gemini 2.5 Flash를 활용하여 사용자의 감정을 분석하고 공감/위로 메시지를 제공하는 AI 다이어리 애플리케이션입니다.

- 👋 한 줄 일기 작성 (2000자 이내)
- 🧠 AI가 당신의 감정을 분석
- 💬 따뜻한 위로 메시지 받기
- 📊 감정 통계 및 트렌드 추적
- 🔍 일기 검색 및 필터링
- 👤 게스트 모드 (회원가입 없이 10회 체험)

## 🛠 기술 스택

### 백엔드
- **Runtime**: Node.js 20+
- **Framework**: Express.js 5.x
- **AI API**: Google Gemini 2.5 Flash
- **데이터베이스**: Supabase PostgreSQL (클라우드 기반 RLS 정책)
- **인증**: Supabase Auth (JWT 기반)
- **배포**: Vercel (Serverless)

### 프론트엔드
- **구조**: 단일 HTML 파일 (public/index.html, ~7400줄)
- **스타일**: CSS Grid/Flexbox (반응형, 다크모드 지원)
- **폰트**: Google Fonts (Gowun Batang 일기, Gowun Dodum UI)
- **상태 관리**: 서버 기반 (localStorage 미사용)
- **PWA**: Service Worker (오프라인 큐잉, 설치 가능)

### 온톨로지
- **감정 분류**: 3단계 계층 (30개 세부 감정)
- **상황 분석**: 5개 도메인 (17개 컨텍스트)
- **신뢰도 계산**: Gemini 모델 기반 확률

## 📁 프로젝트 구조

```
Sentimind/
├── server-v2.js                 # Express 서버 코어 (미들웨어, 설정, 유틸)
├── routes/
│   ├── auth.js                 # 인증 (회원가입/로그인/탈퇴)
│   ├── entries.js              # 일기 CRUD + 북마크 + 내보내기
│   ├── analyze.js              # AI 감정 분석
│   ├── profile.js              # 프로필 관리
│   ├── stats.js                # 통계 조회 (기간 필터)
│   ├── report.js               # AI 리포트 생성
│   ├── migrate.js              # 게스트→회원 데이터 마이그레이션
│   ├── analytics.js            # 이벤트 트래킹 수집
│   └── emotion-graph.js        # 감정 별자리 그래프 API
├── config/
│   ├── llm-config.js           # Gemini API 설정 (모델, 프롬프트)
│   └── supabase-config.js      # Supabase 클라이언트 & 설정
├── lib/
│   ├── auth-middleware.js      # JWT 인증 미들웨어
│   └── validators.js           # 입력 검증 유틸리티
├── migrations/                 # Supabase 마이그레이션 (001~010)
├── public/
│   ├── index.html              # 단일 프론트엔드 (CSS/JS 인라인)
│   ├── sw.js                   # Service Worker (오프라인 동기화)
│   └── manifest.json           # PWA 매니페스트
├── data/
│   ├── emotion-ontology.json   # 감정 분류 체계
│   └── situation-ontology.json # 상황 분석 도메인
├── docs/                       # 기술 문서
│   ├── ARCHITECTURE.md         # 시스템 아키텍처
│   ├── DATABASE.md             # Supabase 스키마 & RLS
│   ├── API.md                  # API 엔드포인트 참조
│   └── DEPLOYMENT.md           # 배포 가이드
├── guides/                     # 개발 가이드
│   ├── SETUP.md                # 로컬 환경 설정
│   ├── TEAM_WORKFLOW.md        # 팀 협업 프로세스
│   ├── TROUBLESHOOTING.md      # 문제 해결
│   └── COMMIT_CONVENTION.md    # 커밋 메시지 규칙
├── plans/                      # 프로젝트 계획
│   ├── PHASE5.md               # Phase 5 완료 내역
│   └── ROADMAP.md              # 전체 로드맵
├── logs/                       # 서버 로그 (자동 생성)
├── package.json                # 의존성
├── vercel.json                 # Vercel 배포 설정
├── .env.example                # 환경변수 템플릿
├── CLAUDE.md                   # 개발 원칙 & 기술 결정사항
└── README.md                   # 본 파일
```

## 🚀 시작하기

### 사전 요구사항
- Node.js 20+
- Google Gemini API 키 (https://console.cloud.google.com)
- Supabase 계정 (선택, 게스트 모드는 지원됨)

### 로컬 설치

1. **저장소 클론**
   ```bash
   git clone https://github.com/faeqsu10/Sentimind.git
   cd Sentimind
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정**
   ```bash
   cp .env.example .env
   ```

   `.env` 파일에 다음을 추가합니다:
   ```
   # 필수
   GOOGLE_API_KEY=your_gemini_api_key_here

   # Supabase (회원 기능 사용 시)
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # 선택사항
   PORT=3000
   CORS_ORIGINS=http://localhost:3000,https://sentimind-delta.vercel.app
   ```

4. **서버 실행**
   ```bash
   npm start
   ```

   또는 개발 모드 (자동 재시작):
   ```bash
   npm run dev
   ```

5. **브라우저에서 접속**
   ```
   http://localhost:3000
   ```

## 📖 주요 기능

### 1. 감정 분석
- Gemini AI가 한 줄 일기에서 주요 감정을 추출
- 3단계 감정 계층 표시 (예: 긍정 → 기쁨 → 설렘)
- 신뢰도 배지 (70%+ 초록, 40-70% 주황, <40% 빨강)

### 2. 공감 메시지
- 자동 생성된 따뜻한 위로 메시지 (2-3문장)
- 간단한 행동 제안 (1문장)
- 사용자의 감정을 있는 그대로 인정

### 3. 상황 인식
- 5가지 생활 도메인 자동 감지
  - 🏠 대인관계 (가족, 연애, 친구)
  - 💼 직장 (프로젝트, 회의, 경력)
  - 📚 학업 (시험, 숙제, 성적)
  - 🏥 건강 (질병, 운동, 수면)
  - 🪞 자기반성 (목표, 성장, 가치관)

### 4. 게스트 모드
- 회원가입 없이 AI 분석 10회 체험
- 게스트 일기는 서버에 저장 (세션 기반)
- 회원 가입 시 자동으로 마이그레이션

### 5. 통계 대시보드
- 📊 감정 분포 (상위 5개)
- 📈 기간별 필터 (1주/1개월/3개월/전체)
- 🕐 시간대별 감정 분석
- 📊 상황별 빈도
- 🎯 스트릭 뱃지 및 캘린더 히트맵
- ⭐ 마음의 별자리 — 감정 그래프 시각화 (SVG, 힘 기반 레이아웃)

### 6. 검색 및 필터
- 🔎 텍스트 검색 (일기 내용)
- 💭 감정별 다중 필터
- ⭐ 즐겨찾기 (북마크)
- 📋 실시간 결과 업데이트

### 7. PWA & 오프라인 지원
- 📱 PWA 설치 가능 (홈 화면 추가)
- 📴 오프라인 일기 작성 (큐잉, 온라인 복귀 시 자동 동기화)
- ⌨️ 키보드 단축키
  - `Ctrl+Enter`: 일기 전송
  - `Ctrl+1~4`: 탭 전환
  - `Ctrl+D`: 다크모드 토글

### 8. 보안
- 🔐 Supabase Auth (JWT 인증, RLS 정책)
- 🛡️ CSP 보안 헤더 (Helmet)
- 🔒 에러 메시지에서 내부 정보 제거
- ⏱️ Rate limiting (회원가입, 로그인, 분석 API별 분리)

### 9. 데이터 관리
- 📤 CSV/JSON 내보내기
- 🔄 게스트→회원 데이터 마이그레이션
- 🗑️ Soft delete (복구 가능)
- 🎯 신규 사용자 온보딩 플로우
- 📊 이벤트 트래킹 (10개 핵심 이벤트, 배치 전송, sendBeacon)

## 🔌 API 엔드포인트

### 인증 (선택 항목, 게스트 모드 지원)

```bash
# 회원가입
POST /api/auth/signup
{"email": "user@example.com", "password": "password123"}

# 로그인
POST /api/auth/login
{"email": "user@example.com", "password": "password123"}

# 로그아웃
POST /api/auth/logout
Authorization: Bearer {token}

# 토큰 갱신
POST /api/auth/refresh
{"refreshToken": "token"}

# 현재 사용자 정보
GET /api/auth/me
Authorization: Bearer {token}

# 비밀번호 변경
POST /api/auth/change-password
Authorization: Bearer {token}
{"currentPassword": "old", "newPassword": "new"}

# 계정 삭제
DELETE /api/auth/delete-account
Authorization: Bearer {token}
```

### 감정 분석 (게스트 지원)

```bash
POST /api/analyze
Content-Type: application/json

{"text": "오늘 회의 발표 성공했어!"}

응답:
{
  "emotion": "설렘",
  "emoji": "🤭",
  "message": "좋은 결과가 있어서 설레이는 마음이 잘 느껴져요...",
  "advice": "이런 성취감을 기억하고 다음 도전에도 자신감을 가져보세요.",
  "ontology": {
    "emotion_hierarchy": {...},
    "situation_context": [...],
    "confidence": 80,
    "related_emotions": [...]
  }
}
```

### 일기 관리 (인증 필수)

```bash
# 일기 조회
GET /api/entries?limit=20&offset=0&sort=newest
Authorization: Bearer {token}

# 일기 작성
POST /api/entries
Authorization: Bearer {token}
{
  "text": "오늘 회의 발표 성공했어!",
  "emotion": "설렘",
  "emoji": "🤭",
  "message": "...",
  "advice": "..."
}

# 일기 삭제
DELETE /api/entries/:id
Authorization: Bearer {token}

# 즐겨찾기 (북마크)
PATCH /api/entries/:id/bookmark
Authorization: Bearer {token}
{"isBookmarked": true}
```

### 통계 (인증 필수)

```bash
GET /api/stats?period=30d
Authorization: Bearer {token}

응답:
{
  "total_entries": 42,
  "avg_confidence": 75,
  "emotion_distribution": {...},
  "top_emotions": [...],
  "top_situations": [...],
  "period": "30d",
  "streak": 7
}
```

### 리포트 (인증 필수)

```bash
GET /api/report?type=weekly
Authorization: Bearer {token}

응답:
{
  "type": "weekly",
  "summary": "이번 주 감정 요약...",
  "insights": [...],
  "recommendations": [...]
}
```

### 프로필 (인증 필수)

```bash
GET /api/profile
Authorization: Bearer {token}

PATCH /api/profile
Authorization: Bearer {token}
{"nickname": "새닉", "bio": "공감하는 일상", "theme": "dark"}
```

### 데이터 내보내기 (인증 필수)

```bash
GET /api/export?format=csv
Authorization: Bearer {token}

# 또는 format=json
```

### 게스트→회원 마이그레이션 (인증 필수)

```bash
POST /api/migrate/from-guest
Authorization: Bearer {token}
{"guestToken": "guest_token_here"}
```

### 이벤트 트래킹 (인증 불필요)

```bash
POST /api/analytics
Content-Type: application/json
{"events": [{"event": "landing_viewed", "session_id": "uuid", ...}]}
# 응답: {"accepted": 1}
```

## 📊 개발 진행 상황

| Phase | 이름 | 상태 | 완료일 |
|-------|------|------|--------|
| 1-3 | 온톨로지 백엔드 통합 | ✅ 완료 | 2026-02-28 |
| 4 | UI/UX 개선 | ✅ 완료 | 2026-03-04 |
| 5 | Supabase 마이그레이션 | ✅ 완료 | 2026-03-05 |
| 6 | 인증 & 사용자 시스템 | ✅ 완료 | 2026-03-06 |
| 5A | 게스트 모드 & UX 개선 | ✅ 완료 | 2026-03-06 |

## 📝 환경 변수

### 필수
- `GOOGLE_API_KEY`: Google Gemini API 키

### Supabase (인증/회원 기능)
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase 익명 키 (클라이언트용)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 서비스 역할 키 (서버용, .env에만)

### 선택사항
- `PORT`: 서버 포트 (기본값: 3000)
- `CORS_ORIGINS`: CORS 허용 도메인 (쉼표 구분)
- `NODE_ENV`: 실행 환경 (development/production)

**주의**: `.env` 파일은 git에 포함되지 않습니다. 자신의 API 키를 직접 추가해야 합니다.

## 🧪 테스트

### 기본 헬스 체크
```bash
curl -s http://localhost:3000/api/health
```

### 감정 분석 테스트 (게스트 가능)
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "오늘 정말 좋은 날씨네!"}'
```

### 일기 조회 (회원 필수)
```bash
# 먼저 로그인하여 토큰 획득
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')

# 일기 조회
curl http://localhost:3000/api/entries \
  -H "Authorization: Bearer $TOKEN"
```

## 🔐 보안 기능

### Rate Limiting
- **회원가입**: 5회/15분 (IP당)
- **로그인**: 10회/15분 (IP당)
- **분석 API**: 30회/1시간 (IP당)

### 입력 검증
- 이메일: RFC 5322 형식 검증
- 비밀번호: 최소 8자 (문자+숫자+특수문자)
- 일기: 최대 2000자
- 닉네임: 한글/영문/숫자, 1-20자

### XSS 방지
- HTML 이스케이프 (quote 포함)
- CSP 헤더 (Helmet)
- 인라인 스크립트 금지

### CSRF 방지
- SameSite 쿠키 정책
- CORS 제한

## 🐛 알려진 이슈

없음 (Phase 5A 완료)

## 🎯 성과

| 지표 | 목표 | 현황 |
|------|------|------|
| 기능 완성도 | 100% | ✅ 완료 |
| API 테스트 | 15/15 | ✅ 완료 |
| 온톨로지 통합 | 100% | ✅ 완료 |
| 인증 시스템 | 100% | ✅ 완료 |
| 게스트 모드 | 100% | ✅ 완료 |
| Vercel 배포 | 성공 | ✅ 완료 |

## 📈 다음 단계

### 계획 중 (Phase 7+)
- Next.js 마이그레이션 (TypeScript 타입 안정성)
- 실시간 알림 (Supabase Realtime)
- 모바일 앱 (React Native)
- 데이터 분석 대시보드 (고급 통계)

자세한 로드맵은 [plans/ROADMAP.md](./plans/ROADMAP.md) 참고.

## 📚 문서 링크

### 기술 문서
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 시스템 아키텍처 및 데이터 흐름
- [docs/DATABASE.md](./docs/DATABASE.md) - Supabase 스키마, RLS, 마이그레이션 전략
- [docs/API.md](./docs/API.md) - 모든 API 엔드포인트 참조 및 예시
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - 로컬/Vercel 배포 가이드

### 개발 가이드
- [guides/SETUP.md](./guides/SETUP.md) - 로컬 개발 환경 설정 (5분)
- [guides/TEAM_WORKFLOW.md](./guides/TEAM_WORKFLOW.md) - 팀 협업 프로세스 및 PR 규칙
- [guides/TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md) - 일반적인 문제 해결
- [guides/COMMIT_CONVENTION.md](./guides/COMMIT_CONVENTION.md) - 커밋 메시지 컨벤션

### 계획 & 로드맵
- [plans/PHASE5.md](./plans/PHASE5.md) - Phase 5 완료 내역
- [plans/ROADMAP.md](./plans/ROADMAP.md) - 전체 프로젝트 로드맵 (Phase 7+)
- [CLAUDE.md](./CLAUDE.md) - 개발 원칙 및 기술 결정사항

## 🔗 외부 링크

- **GitHub**: https://github.com/faeqsu10/Sentimind
- **Live Demo**: https://sentimind-delta.vercel.app
- **Supabase**: https://app.supabase.com
- **Google Gemini API**: https://ai.google.dev/

## 👥 기여

이 프로젝트는 개인 프로젝트입니다. 코드 리뷰 및 피드백은 언제든 환영합니다.

GitHub Issues에서 버그 리포트 및 기능 요청을 받습니다.

## 📄 라이센스

ISC License - [LICENSE](LICENSE) 파일 참고

---

**마지막 업데이트**: 2026-03-09
**현재 상태**: Phase 8 진행 중, Vercel 배포 중 ✅
