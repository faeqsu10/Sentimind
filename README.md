# Sentimind - AI 공감 다이어리

당신의 감정을 AI가 이해해주는 하루 한 줄 다이어리 앱

## 🎯 개요

**Sentimind**는 Google Gemini 2.5 Flash를 활용하여 사용자의 감정을 분석하고 공감/위로 메시지를 제공하는 AI 다이어리 애플리케이션입니다.

- 👋 한 줄 일기 작성 (500자 이내)
- 🧠 AI가 당신의 감정을 분석
- 💬 따뜻한 위로 메시지 받기
- 📊 감정 통계 및 트렌드 추적
- 🔍 일기 검색 및 필터링

## 🛠 기술 스택

### 백엔드
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **AI API**: Google Gemini 2.5 Flash
- **데이터베이스**:
  - Supabase PostgreSQL (클라우드)
  - JSON 파일 (로컬 폴백)
- **인증**: Supabase Auth (Phase 6+)

### 프론트엔드
- **구조**: 단일 HTML 파일 (CSS/JS 인라인)
- **스타일**: CSS Grid/Flexbox (반응형)
- **폰트**: Google Fonts (Gowun Batang, Gowun Dodum)
- **상태 관리**: 서버 기반 (localStorage 미사용)

### 배포
- **클라우드**: Vercel (Serverless)
- **데이터**: Supabase PostgreSQL
- **CI/CD**: GitHub (자동 배포)

### 온톨로지
- **감정 분류**: 3단계 계층 (30개 세부 감정)
- **상황 분석**: 5개 도메인 (17개 컨텍스트)
- **신뢰도 계산**: Gemini 모델 기반 확률

## 📁 프로젝트 구조

```
Sentimind/
├── server.js                    # Express 백엔드 + OntologyEngine
├── public/
│   └── index.html              # 단일 프론트엔드 (CSS/JS 인라인)
├── data/
│   ├── entries.json            # 일기 저장소
│   ├── emotion-ontology.json   # 감정 분류 체계
│   └── situation-ontology.json # 상황 분석 도메인
├── docs/                        # 기술 문서
│   ├── ARCHITECTURE.md         # 시스템 아키텍처
│   ├── DATABASE.md             # Supabase 스키마 & RLS
│   ├── API.md                  # API 엔드포인트 참조
│   └── DEPLOYMENT.md           # 배포 가이드
├── guides/                      # 개발 가이드
│   ├── SETUP.md                # 로컬 환경 설정
│   ├── TEAM_WORKFLOW.md        # 팀 협업 프로세스
│   ├── TROUBLESHOOTING.md      # 문제 해결
│   └── COMMIT_CONVENTION.md    # 커밋 메시지 규칙
├── plans/                       # 프로젝트 계획
│   ├── PHASE5.md               # Phase 5 상세 계획
│   └── ROADMAP.md              # 전체 프로젝트 로드맵
├── logs/                        # 서버 로그 (자동 생성)
├── package.json                # 의존성
├── vercel.json                 # Vercel 배포 설정
├── .env                        # API 키 (미포함, .env.example 참고)
└── README.md                   # 본 파일
```

## 🚀 시작하기

### 사전 요구사항
- Node.js 16+
- Google Gemini API 키 ([console.cloud.google.com](https://console.cloud.google.com))

### 설치

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
   # .env 파일에 GOOGLE_API_KEY 입력
   ```

4. **서버 실행**
   ```bash
   npm start
   # 또는 직접 실행
   node server.js
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

### 4. 통계 대시보드
- 📊 감정 분포 (상위 5개)
- 🕐 시간대별 감정 분석
- 📈 상황별 빈도
- 📝 최근 일기 리스트

### 5. 검색 및 필터
- 🔎 텍스트 검색 (일기 내용)
- 💭 감정별 다중 필터
- 📋 실시간 결과 업데이트

## 🔌 API 엔드포인트

### 감정 분석
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

### 일기 조회
```bash
GET /api/entries
응답: [entry1, entry2, ...]
```

### 일기 저장
```bash
POST /api/entries
Content-Type: application/json

{
  "text": "오늘 회의 발표 성공했어!",
  "emotion": "설렘",
  "emoji": "🤭",
  "message": "...",
  "advice": "..."
}
```

### 일기 삭제
```bash
DELETE /api/entries/:id
```

### 통계 조회
```bash
GET /api/stats
응답:
{
  "total_entries": 42,
  "avg_confidence": 75,
  "emotion_distribution": {...},
  "top_emotions": [...],
  "top_situations": [...],
  "hourly_distribution": {...},
  "latest_entries": [...]
}
```

## 📊 개발 진행 상황

| Phase | 이름 | 상태 | 기간 |
|-------|------|------|------|
| 1-3 | 온톨로지 백엔드 통합 | ✅ 완료 | 2026-02-28 |
| 4 | UI/UX 개선 | ✅ 완료 | 2026-03-04 |
| 5 | Supabase 마이그레이션 | 🔄 진행 예정 | 2026-03-05 ~ 03-26 |
| 6 | 인증 & 사용자 시스템 | ⏳ 예정 | 2026-03-26 ~ 04-09 |
| 7 | Next.js 마이그레이션 | ⏳ 예정 | 2026-04-09 ~ 04-23 |
| 8 | 모니터링 & 로깅 | ⏳ 예정 | 2026-04-23 ~ 04-30 |
| 9 | 배포 & CI/CD | ⏳ 예정 | 2026-04-30 ~ 05-14 |
| 10 | 마케팅 & 런칭 | ⏳ 예정 | 2026-05-14 ~ 05-28 |

## 🎯 Phase 5: Supabase Backend Migration

**기간**: 2026-03-05 ~ 2026-03-26 (2-3주)
**상태**: 🔄 진행 중

**완료 사항**
- ✅ Supabase 프로젝트 생성
- ✅ 프로젝트 문서화 완성 (DATABASE.md, ARCHITECTURE.md)
- ✅ 팀 가이드 작성 (SETUP.md, TEAM_WORKFLOW.md, TROUBLESHOOTING.md)

**진행 중**
- 🔄 데이터베이스 스키마 생성
- 🔄 RLS 정책 설정
- 🔄 Express API 업데이트
- 🔄 데이터 마이그레이션

자세한 내용: [plans/PHASE5.md](./plans/PHASE5.md)

## 📝 환경 변수

`.env` 파일 설정:
```
PORT=3000
GOOGLE_API_KEY=your_gemini_api_key_here
```

`.env` 파일은 git에 포함되지 않습니다. 자신의 API 키를 추가하세요.

## 🧪 테스트

```bash
# 서버 실행 후 테스트
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "오늘 정말 좋은 날씨네!"}'
```

## 🐛 알려진 이슈

- ✅ JSON 파일 동시성 관리 (쓰기 락으로 해결)
- 🔄 다중 사용자 지원 (Phase 5: Supabase로 해결)
- ⏳ 모바일 앱 (Phase 11+)

## 📈 성과

| 지표 | 목표 | 현황 |
|------|------|------|
| 기능 완성도 | 100% | ✅ 완료 |
| API 테스트 | 6/6 | ✅ 완료 |
| 온톨로지 통합 | 100% | ✅ 완료 |
| UI/UX 개선 | 3/3 단계 | ✅ 완료 |
| QA 테스트 | 14/14 기능 | ✅ 완료 |

## 👥 기여

이 프로젝트는 개인 프로젝트이며, 코드 리뷰 및 피드백은 언제든 환영합니다.

## 📄 라이센스

MIT License - [LICENSE](LICENSE) 파일 참고

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
- [plans/PHASE5.md](./plans/PHASE5.md) - Phase 5 상세 개발 계획 (2-3주)
- [plans/ROADMAP.md](./plans/ROADMAP.md) - 전체 프로젝트 로드맵 (10+ Phase)
- [CLAUDE.md](./CLAUDE.md) - 개발 원칙 및 기술 결정사항
- [TEAM_GUIDE.md](./TEAM_GUIDE.md) - 팀 가이드 및 협업 방식

## 🔗 외부 링크

- **GitHub**: https://github.com/faeqsu10/Sentimind
- **Vercel 배포**: https://sentimind-delta.vercel.app
- **Supabase 콘솔**: https://app.supabase.com
- **Google Gemini API**: https://ai.google.dev/

---

**마지막 업데이트**: 2026-03-05
**현재 상태**: Phase 5 진행 중 🔄
