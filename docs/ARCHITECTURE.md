# Sentimind 아키텍처

## 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│                  Client (Browser)                    │
│            public/index.html (단일 HTML)            │
│  - CSS/JS 인라인 (Gowun 폰트, 반응형)               │
│  - 일기 작성, 감정 분석, 통계 대시보드              │
└────────────┬────────────────────────────────────────┘
             │ REST API (fetch)
             │
┌────────────▼────────────────────────────────────────┐
│            Express.js 백엔드 (server.js)            │
│  Port: 3000 (로컬) / Vercel (클라우드)             │
│                                                      │
│  핵심 엔드포인트:                                    │
│  ├─ POST /api/analyze     → Gemini API 호출         │
│  ├─ GET  /api/entries     → 일기 목록 조회          │
│  ├─ POST /api/entries     → 일기 저장               │
│  ├─ DELETE /api/entries/:id → 일기 삭제            │
│  └─ GET  /api/stats       → 통계 조회              │
│                                                      │
│  핵심 모듈:                                          │
│  ├─ OntologyEngine        (감정 분류 및 메타데이터) │
│  ├─ Logger                (로깅 시스템)             │
│  └─ Supabase Client       (PostgreSQL 연동)        │
└────────┬───────────┬──────────────────────┬────────┘
         │           │                      │
         ▼           ▼                      ▼
   ┌──────────┐ ┌──────────────┐ ┌──────────────────┐
   │ Gemini   │ │ Ontology     │ │ Supabase         │
   │ AI API   │ │ JSON Files   │ │ PostgreSQL       │
   │ (Emotion │ │ (Metadata)   │ │ (entries,        │
   │ Analysis)│ │              │ │  ontologies)     │
   └──────────┘ └──────────────┘ └──────────────────┘
```

## 데이터 흐름

### 1. 일기 작성 및 분석 (POST /api/analyze)

```
사용자 입력 (일기 텍스트)
    ↓
[Validation] 500자 이내 확인
    ↓
[Gemini API] 감정 분석 요청
    ├─ Text: 사용자 일기
    ├─ SystemPrompt: AI 역할 정의
    └─ Model: gemini-2.5-flash
    ↓
[JSON 파싱] Gemini 응답 처리
    ├─ emotion: 주 감정
    ├─ message: AI 공감 메시지
    └─ advice: 조언
    ↓
[OntologyEngine] 메타데이터 추가
    ├─ emotion_hierarchy: 감정 계층 (3단계)
    ├─ situation_context: 상황 도메인
    ├─ confidence: 신뢰도 점수
    └─ related_emotions: 관련 감정
    ↓
응답 반환 (프론트엔드에 전달)
```

### 2. 데이터 저장 (POST /api/entries)

```
일기 저장 요청
    ↓
[유효성 검사] 필드 확인
    ↓
[데이터 구성] Entry 객체 생성
    ├─ id: UUID
    ├─ date: TIMESTAMPTZ
    ├─ text: 일기 내용
    ├─ emotion: 감정
    ├─ emoji: 감정 아이콘
    ├─ message: AI 메시지
    └─ advice: 조언
    ↓
[저장소 선택] Supabase 또는 JSON
    ├─ IF SUPABASE_URL 존재
    │  └─ PostgreSQL entries 테이블에 INSERT
    └─ ELSE
       └─ entries.json 파일에 저장
    ↓
응답 (저장된 데이터)
```

## 온톨로지 엔진

### 감정 계층 (3단계)

```
Level 1: 긍정/부정/중립
├─ Level 2: 카테고리
│  ├─ 기쁨, 만족감, 감사, 설렘, 자신감 (긍정)
│  ├─ 슬픔, 분노, 불안, 외로움, 답답함 (부정)
│  └─ 중립, 혼란, 강인함 (중립)
└─ Level 3: 세부 감정
   └─ 예: 기쁨 → 기뻐, 신나, 들뜬, ...
```

### 상황 도메인 (5개)

```
1. 업무/학업 (work): 프로젝트, 발표, 시험, 회의
2. 인간관계 (relationship): 친구, 가족, 동료, 팀
3. 건강 (health): 운동, 식사, 수면, 심신
4. 일상/경험 (daily): 날씨, 이동, 쇼핑, 여행
5. 개인성장 (growth): 학습, 기술, 습관, 목표
```

## 환경별 구성

### 로컬 개발

```
Port: 3000
Data: ./data/entries.json
Logs: ./logs/app-YYYY-MM-DD.log
DB: JSON 파일 (JSON 활성화 시 Supabase)
```

### Vercel 배포

```
Port: 환경 변수 PORT
Data: /tmp/sentimind-data/entries.json
Logs: 콘솔만 (Vercel 모니터링)
DB: JSON 또는 Supabase (환경 변수 기반)
```

## 보안

### API 보호

- CORS 활성화 (express-cors)
- 요청 유효성 검사
- 환경 변수 (.env)로 API 키 보호
- Supabase RLS 정책

### 데이터 보호

- 파일 기반: 로컬 저장소 (git 제외)
- DB 기반: Supabase RLS (향후 인증 추가)
- 로깅: 민감 정보 제외

## 성능 최적화

### 데이터베이스

- Supabase 인덱스 (date, emotion, user_id)
- 응답 시간: <100ms (API 호출 제외)

### 프론트엔드

- 단일 HTML 파일 (No build step)
- CSS/JS 인라인 (병렬 요청 최소화)
- 반응형 디자인 (모바일 최적화)

### 백엔드

- Write lock (동시성 제어)
- Async/await (비동기 처리)
- 로깅 레벨링 (개발/배포 구분)

---

**마지막 업데이트**: 2026-03-05
