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
- **Runtime**: Node.js
- **Framework**: Express.js
- **AI API**: Google Gemini 2.5 Flash
- **데이터베이스**: JSON 파일 (Phase 5: PostgreSQL + Supabase)

### 프론트엔드
- **구조**: 단일 HTML 파일 (CSS/JS 인라인)
- **폰트**: Google Fonts (Gowun Batang, Gowun Dodum)
- **상태**: 서버 기반 (localStorage 미사용)

### 온톨로지
- **감정 분류**: 3단계 계층 (30개 세부 감정)
- **상황 분석**: 5개 도메인 (17개 컨텍스트)
- **신뢰도 계산**: 텍스트 길이 + 키워드 매칭

## 📁 프로젝트 구조

```
Sentimind/
├── server.js                    # Express 백엔드 + OntologyEngine
├── public/
│   └── index.html              # 단일 프론트엔드 (1,392줄)
├── data/
│   ├── entries.json            # 일기 저장소
│   ├── emotion-ontology.json   # 감정 분류 체계
│   └── situation-ontology.json # 상황 분석 도메인
├── docs/
│   └── PRD.md                  # 11주 개발 일정 (Phase 5-10)
├── package.json                # 의존성
├── .env                        # API 키 (미포함)
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

현재 진행 상황:
- ✅ PRD 작성 완료 (11주 일정, 5-6명 팀)
- 🔄 Supabase 계정 생성 대기
- ⏳ PostgreSQL 스키마 생성
- ⏳ 데이터 마이그레이션 스크립트
- ⏳ Express API 업데이트

자세한 내용은 [docs/PRD.md](./docs/PRD.md) 참고

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

## 🔗 링크

- **GitHub**: https://github.com/faeqsu10/Sentimind
- **Google Gemini API**: https://ai.google.dev/
- **Supabase**: https://supabase.com/

---

**마지막 업데이트**: 2026-03-05
**서버 상태**: ✅ 실행 중 (PID 7218)
