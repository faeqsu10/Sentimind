# AI 공감 다이어리 - 서비스화 PRD (Product Requirements Document)

**버전**: 1.0
**작성일**: 2026-03-05
**상태**: 검토 완료 (Phase 5 시작 가능)

---

## 1. 개요

### 1.1 프로젝트 명

**AI 공감 다이어리** - 온톨로지 기반 감정 분석 일기 앱

### 1.2 슬로건

> "당신의 감정을 이해하고, 함께 성장하는 일기"

### 1.3 비전

사용자의 일상적 감정을 AI가 정교하게 분석하여 공감과 통찰력을 제공하고, 감정 패턴을 추적하여 자아 성찰을 돕는 플랫폼.

### 1.4 타겟 사용자

| 세그먼트 | 연령 | 특성 |
|---------|------|------|
| Primary | 20-40대 | 직장인, 감정 관리 관심 |
| Secondary | 18-25 | 대학생, 스트레스 관리 필요 |
| Tertiary | 40+ | 일반 대중, 자기성찰 추구 |

---

## 2. 핵심 가치 제안 (Value Proposition)

### 2.1 차별점

| 기능 | 우리 | 경쟁사 |
|------|------|--------|
| **감정 분석 정확도** | 온톨로지 기반 3단계 분류 | 단순 키워드 매칭 |
| **AI 모델** | Google Gemini 2.5 Flash | 오픈AI GPT-3.5 or 로컬 모델 |
| **반응형 피드백** | 따뜻한 공감 메시지 | 거리감 있는 분석 결과 |
| **데이터 소유권** | 사용자 전체 소유 | 클라우드 종속성 |

### 2.2 핵심 기능

- 🤖 **감정 분석**: Gemini 기반 자연어 처리
- 📊 **온톨로지 분류**: 감정 → 세부 감정 → 상황 맥락 (3단계)
- 💚 **공감 메시지**: 사용자 감정에 맞춘 위로
- 📈 **통계 대시보드**: 감정 패턴 시각화
- 🔍 **검색/필터**: 감정별, 날짜별 조회
- 👤 **프로필 관리**: 사용자별 격리된 데이터

---

## 3. 요구사항 명세

### 3.1 기능 요구사항 (Functional Requirements)

#### FR-001: 회원가입 및 로그인
- **REQ-001**: 사용자는 이메일과 비밀번호로 회원가입 가능
  - 수용 기준 (AC):
    - 유효한 이메일 형식 검증
    - 비밀번호 8자 이상
    - 중복 이메일 차단

- **REQ-002**: 사용자는 이메일/비밀번호로 로그인 가능
  - AC:
    - 로그인 성공 시 JWT 토큰 발급 (httpOnly Cookie)
    - 로그인 실패 시 명확한 오류 메시지
    - 세션 유지 (최대 30일)

- **REQ-003**: OAuth 로그인 지원 (Google, GitHub) - Phase 1.1
  - AC: 소셜 계정으로 직접 가입/로그인 가능

#### FR-002: 일기 작성 및 분석
- **REQ-004**: 사용자는 일기 작성 (최대 500자)
  - AC:
    - 텍스트 입력 후 "분석" 버튼 클릭
    - 실시간 글자 수 카운터
    - 로컬 자동 저장 (3초마다)

- **REQ-005**: Gemini API를 통한 감정 분석
  - AC:
    - 5초 내 분석 완료
    - 감정 분류 (대분류 + 소분류)
    - 상황 맥락 자동 감지
    - 신뢰도 점수 (0-100%)
    - 공감 메시지 & 조언 제공

- **REQ-006**: 온톨로지 기반 감정 계층 표시
  - AC:
    - 3단계 감정 계층 시각화 (↓ 화살표)
    - 상황 태그에 이모지 표시 (💼직장, 🏥건강 등)
    - 신뢰도 배지 (상단, 색상 코딩)

#### FR-003: 일기 관리 (CRUD)
- **REQ-007**: 사용자는 일기 조회 가능
  - AC:
    - 최신순/오래된순 정렬
    - 페이지네이션 (50개씩)
    - 상세 보기 팝업

- **REQ-008**: 사용자는 일기 수정 가능
  - AC:
    - 작성 후 24시간 내 수정 가능
    - 수정 시간 기록
    - 수정 이력 관리 (선택사항)

- **REQ-009**: 사용자는 일기 삭제 가능
  - AC:
    - 소프트 삭제 (논리적 삭제)
    - 30일 내 복구 가능
    - 영구 삭제 옵션

#### FR-004: 검색 및 필터
- **REQ-010**: 텍스트 검색
  - AC:
    - 일기 내용 실시간 검색
    - 대소문자 무시
    - "N건 검색되었습니다" 표시

- **REQ-011**: 감정별 필터
  - AC:
    - 다중 선택 가능 (칩 UI)
    - 선택된 감정만 표시
    - 필터 초기화 버튼

#### FR-005: 대시보드 및 통계
- **REQ-012**: 대시보드 조회
  - AC:
    - 요약 카드 (전체 일기, 주요 감정, 평균 신뢰도)
    - 상위 5개 감정 차트
    - 상위 5개 상황 차트
    - 최근 5개 일기 목록

- **REQ-013**: 통계 API (/api/stats)
  - AC:
    - 감정 분포 JSON 반환
    - 상황별 분포 JSON 반환
    - 시간대별 분포 JSON 반환
    - 캐시 (5분마다 업데이트)

#### FR-006: 프로필 관리
- **REQ-014**: 프로필 조회/수정
  - AC:
    - 사용자명, 바이오 수정
    - 프로필 이미지 업로드
    - 테마 선택 (라이트/다크) - Phase 1.1
    - 알림 설정 관리

- **REQ-015**: 계정 탈퇴
  - AC:
    - 회원 탈퇴 시 모든 데이터 삭제 요청
    - 30일 유예 기간 후 완전 삭제
    - 삭제 확인 메일 발송

### 3.2 비기능 요구사항 (Non-Functional Requirements)

#### 성능 (Performance)
- **NFR-001**: API 응답 시간
  - GET /api/entries: < 500ms
  - POST /api/analyze: < 5초 (Gemini API 포함)
  - GET /api/stats: < 1초 (캐시)

- **NFR-002**: 페이지 로딩 속도
  - First Contentful Paint (FCP): < 2초
  - Time to Interactive (TTI): < 4초

- **NFR-003**: 동시 사용자 처리
  - DAU 100명 기준 충분
  - 500명으로 확장 가능한 아키텍처

#### 보안 (Security)
- **NFR-004**: 인증 & 인가
  - Supabase Auth (httpOnly Cookie 기반)
  - JWT 토큰 (HS256)
  - RLS (Row-Level Security) 정책 적용

- **NFR-005**: 데이터 암호화
  - 전송 중: HTTPS/TLS 1.2+
  - 저장소: Supabase 기본 암호화
  - 민감 정보 (비밀번호): bcrypt 해싱

- **NFR-006**: 접근 제어
  - 사용자는 자신의 데이터만 접근
  - 관리자 기능 없음 (초기)

#### 가용성 (Availability)
- **NFR-007**: 서비스 가용성
  - 목표: 99.5% uptime
  - RTO (복구 시간): 1시간
  - RPO (데이터 손실): 1시간

- **NFR-008**: 백업
  - 자동 일일 백업 (Supabase Pro)
  - PITR (Point-In-Time Recovery): 7일

#### 확장성 (Scalability)
- **NFR-009**: 데이터 모델
  - PostgreSQL 인덱싱으로 10배 확장 가능
  - 연 100만개 일기 처리 가능

- **NFR-010**: 비용 효율성
  - Supabase 무료 플랜: 500MB
  - DAU 100명 시 월 $0 (무료)
  - DAU 500명 시 월 $25-50

#### 규정 준수 (Compliance)
- **NFR-011**: 개인정보보호
  - GDPR 준수 (데이터 삭제/이동 기능)
  - 한국 개인정보보호법 준수
  - 만 14세 미만 가입 금지

- **NFR-012**: 접근성
  - WCAG 2.1 AA 준수
  - 키보드 네비게이션 지원
  - 화면 리더 호환성

---

## 4. 기술 아키텍처

### 4.1 기술 스택 (최종 결정)

| 계층 | 기술 | 이유 |
|------|------|------|
| **Frontend** | Next.js 13+ (App Router) | SSR + API Routes 통합 |
| **Backend** | Next.js API Routes | 단일 스택, 유지보수 용이 |
| **Database** | Supabase (PostgreSQL) | 관계형 DB + Auth + Realtime |
| **AI** | Google Gemini 2.5 Flash | 감정 분석 최적 |
| **Auth** | Supabase Auth | httpOnly Cookie 기반 |
| **Monitoring** | Sentry | 에러 추적 |
| **Analytics** | Segment (선택사항) | 사용자 행동 추적 |
| **Hosting** | Vercel | Next.js 네이티브 배포 |

### 4.2 아키텍처 다이어그램

```
┌─────────────────────────────────────────────┐
│       Next.js Frontend (Vercel)              │
│   - 로그인/회원가입 화면                      │
│   - 일기 입력 & 분석 화면                    │
│   - 대시보드 & 통계                          │
│   - 프로필 관리                              │
└────────────────────┬────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────┐
│    Next.js API Routes (/api/*)               │
│   - /api/auth/* (인증)                      │
│   - /api/entries/* (CRUD)                   │
│   - /api/analyze (Gemini 통합)              │
│   - /api/stats (통계)                       │
│   - /api/profile (프로필)                   │
└────────────────────┬────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐  ┌────────▼────────┐  ┌───▼───┐
│Google │  │ Supabase        │  │Sentry │
│Gemini │  │PostgreSQL       │  │Logging│
│API    │  │Auth (httpOnly)  │  │       │
│       │  │Realtime         │  │       │
│       │  │Storage          │  │       │
└───────┘  └─────────────────┘  └───────┘
```

---

## 5. 데이터 모델 (최종 버전)

### 5.1 데이터베이스 스키마

```sql
-- 1. Users (Supabase Auth와 연동)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE,
  bio TEXT,
  profile_image_url VARCHAR(500),
  theme VARCHAR(10) CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
  notification_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Diary Entries
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  text VARCHAR(500) NOT NULL,
  emotion VARCHAR(100) NOT NULL,
  emoji VARCHAR(10),
  message TEXT,
  advice TEXT,
  -- 온톨로지 메타데이터
  emotion_hierarchy JSONB,  -- {level1, level2, level3, emoji}
  situation_context JSONB,  -- [{domain, context}, ...]
  confidence_score INT DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  related_emotions VARCHAR(255)[],
  -- 시스템 필드
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP  -- 소프트 딜리트
);

-- 3. User Statistics (캐시)
CREATE TABLE user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_entries INT DEFAULT 0,
  top_emotion VARCHAR(100),
  avg_confidence INT DEFAULT 0,
  last_calculated TIMESTAMP DEFAULT NOW()
);

-- 4. Activity Logs (분석용)
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(100),  -- 'entry_created', 'dashboard_viewed'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 데이터만 접근
CREATE POLICY "Users see only their entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스 (성능 최적화)
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX idx_entries_user_emotion ON entries(user_id, emotion);
CREATE INDEX idx_entries_deleted_at ON entries(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

---

## 6. 개발 로드맵 (수정된 일정)

### 6.1 Phase 5: Supabase 마이그레이션 (2-3주)

**목표**: JSON 파일 → PostgreSQL 마이그레이션

| 작업 | 예상 | 책임 |
|------|------|------|
| Supabase 프로젝트 생성 | 1일 | Backend Dev |
| 스키마 설계 & 생성 | 2일 | Database Architect |
| RLS 정책 설정 | 1일 | Backend Dev |
| 기존 데이터 마이그레이션 | 2일 | Backend Dev |
| API 엔드포인트 수정 | 3일 | Backend Dev |
| 테스트 & 버그 수정 | 3일 | Backend Dev + QA |

**산출물**: Supabase 프로젝트, 마이그레이션 스크립트, 업데이트된 API

---

### 6.2 Phase 6: 인증 & 사용자 시스템 (1-2주)

| 작업 | 예상 | 책임 |
|------|------|------|
| Supabase Auth 설정 | 1일 | Backend Dev |
| 회원가입 엔드포인트 | 2일 | Backend Dev |
| 로그인/로그아웃 엔드포인트 | 2일 | Backend Dev |
| httpOnly Cookie 관리 | 1일 | Backend Dev |
| 권한 검증 & RLS 적용 | 1일 | Backend Dev |

**산출물**: Auth 엔드포인트, httpOnly Cookie 구현, 사용자 격리 완성

---

### 6.3 Phase 7: 프론트엔드 통합 (2주)

| 작업 | 예상 | 책임 |
|------|------|------|
| Next.js로 마이그레이션 | 2일 | Frontend Dev |
| 로그인/회원가입 UI | 2일 | Frontend Dev |
| API 엔드포인트 변경 | 1일 | Frontend Dev |
| 인증 상태 관리 | 2일 | Frontend Dev |
| 테스트 & 버그 수정 | 2일 | Frontend Dev + QA |

**산출물**: Next.js 프로젝트, 로그인 화면, 보호된 라우트

---

### 6.4 Phase 8: 모니터링 & 분석 (1주)

| 작업 | 예상 | 책임 |
|------|------|------|
| Sentry 설정 (개발 중 에러 추적) | 1일 | Backend Dev |
| 로깅 시스템 | 2일 | Backend Dev |
| 성능 모니터링 | 1일 | Backend Dev |
| 보안 감사 | 1.5일 | Security Review |

**산출물**: 에러 추적 대시보드, 로그 시스템, 성능 메트릭

---

### 6.5 Phase 9: 배포 & CI/CD (1-2주)

| 작업 | 예상 | 책임 |
|------|------|------|
| Vercel 배포 | 1일 | Backend Dev |
| GitHub Actions 파이프라인 | 2일 | Backend Dev |
| 도메인 & HTTPS | 1일 | Backend Dev |
| 환경 변수 설정 | 1일 | Backend Dev |
| 로드 테스트 | 2일 | QA |

**산출물**: 프로덕션 배포, CI/CD 파이프라인

---

### 6.6 Phase 10: 마케팅 & 출시 (2주+)

| 작업 | 예상 | 책임 |
|------|------|------|
| 랜딩 페이지 | 2일 | Frontend Dev |
| 마케팅 자료 (영상, 이미지) | 3일 | Design/Marketing |
| SNS 계정 & 첫 포스트 | 1일 | PM |
| ProductHunt/커뮤니티 제출 | 2일 | PM |

**산출물**: 랜딩 페이지, SNS 채널, 초기 사용자 100명

---

### 6.7 최종 일정

```
Week 1-3    Phase 5 (Supabase 마이그레이션)
Week 4      Phase 6 (인증)
Week 4-5    Phase 6.5: Sentry 기본 설정 (병행)
Week 6-7    Phase 7 (프론트엔드)
Week 8      Phase 8 (모니터링 & 분석)
Week 9      Phase 9 (배포 & CI/CD)
Week 10-11  Phase 10 (마케팅 & 출시)

총 11주 (약 2.5개월)
```

**팀 구성 (권장):**
- PM (1명): 전체 조율, 마케팅
- Backend Dev (2명): API, Supabase 통합, 모니터링
- Database Architect (0.5명): 스키마, 성능
- Frontend Dev (1명): Next.js 통합, UI
- QA Engineer (1명): 테스트, 로드 테스트
- **총 5-6명** (풀타임 또는 파트타임)

---

## 7. 범위 정의 (Scope)

### 7.1 포함 사항 (In Scope)

✅ Supabase PostgreSQL 마이그레이션
✅ 회원가입/로그인 (이메일 기반)
✅ 일기 CRUD (생성, 조회, 수정, 삭제)
✅ Gemini 감정 분석 통합
✅ 온톨로지 기반 분류 (3단계)
✅ 검색 & 필터 기능
✅ 대시보드 & 통계
✅ 프로필 관리
✅ 모니터링 & 로깅
✅ Vercel 배포 & CI/CD

### 7.2 불포함 사항 (Out of Scope)

❌ OAuth 로그인 (Google, GitHub) → Phase 1.1
❌ 소셜 기능 (친구, 공유) → Phase 1.1
❌ 다크 테마 → Phase 1.1
❌ 모바일 앱 (React Native) → Phase 2.0
❌ 음성 인식 일기 → Phase 2.0
❌ 커뮤니티 기능 → Phase 2.0
❌ B2B 기능 → Phase 3.0

---

## 8. 성공 지표 (KPIs)

### 8.1 3개월 목표

| 지표 | 목표 | 기준 |
|------|------|------|
| 일일 활성 사용자 (DAU) | 100명 | 매일 로그인 |
| 월간 활성 사용자 (MAU) | 500명 | 지난 30일 1회+ 로그인 |
| 월평균 일기 작성 | 2,000개 | 500명 × 4개 |
| 평균 신뢰도 | 75% | Gemini 분석 신뢰도 점수 |
| 리텐션 (7일) | 50% | 첫 방문 후 7일 내 재방문 |
| NPS (순추천지수) | 40+ | 최소 "추천할 만함" 수준 |

### 8.2 6개월 목표

| 지표 | 목표 |
|------|------|
| DAU | 500명 |
| MAU | 2,000명 |
| 월평균 일기 | 10,000개 |
| 프리미엄 전환율 | 5% |

---

## 9. 비즈니스 모델

### 9.1 Phase 1 (3개월): 무료 서비스

**목표**: 사용자 획득 & 데이터 수집

- 모든 기능 무료
- 사용자 행동 데이터 분석
- 피드백 수집

---

### 9.2 Phase 2 (6개월): 프리미엄 모델

| 플랜 | 가격 | 제한사항 | 대상 |
|------|------|---------|------|
| **무료** | $0/월 | 월 30개 일기 | 라이트 사용자 |
| **프리미엄** | $4.99/월 | 무제한 | 헤비 사용자 |
| **Pro** | $9.99/월 | 무제한 + 고급 분석 | 파워 사용자 |

**무료 한도 설정 근거**:
- 3개월 운영 후 사용자 분석
- P75 사용량을 기준으로 결정
- (현재 추정치: 월 30개)

---

### 9.3 Phase 3 (1년+): B2B 확장

- 기업 웰니스 프로그램
- 상담사/심리치료사 연계
- 학교/대학 적응 프로그램

---

## 10. 규정 준수 (Compliance)

### 10.1 개인정보보호

**문서 작성 필요** (법률 검토 필수):
- [ ] 개인정보 처리 방침 (Privacy Policy)
- [ ] 서비스 이용약관 (Terms of Service)
- [ ] 쿠키 정책 (Cookie Policy)
- [ ] 데이터 삭제 요청 프로세스 (GDPR Article 17)
- [ ] 데이터 이동성 (GDPR Article 20) - JSON/CSV 내보내기

### 10.2 연령 제한

- 만 14세 미만 가입 금지
- 회원가입 시 약관 동의 필수

### 10.3 데이터 백업 & 복구

- 주간 자동 백업 (Supabase Pro)
- PITR (Point-In-Time Recovery): 7일

---

## 11. 위험 관리

### 11.1 기술적 위험

| 위험 | 영향 | 대응 |
|------|------|------|
| Supabase 장애 | 높음 | 자동 백업 + 모니터링 |
| Gemini API 비용 급증 | 중간 | 응답 캐싱 + 일일 한도 설정 |
| 성능 저하 | 중간 | 인덱싱 + CDN + 캐싱 |
| 보안 위반 | 매우 높음 | 정기 보안 감사 + Sentry |

### 11.2 비즈니스 위험

| 위험 | 대응 |
|------|------|
| 초기 사용자 부족 | ProductHunt + 커뮤니티 마케팅 |
| 경쟁 서비스 출현 | 온톨로지 기술 차별화 유지 |
| 사용자 이탈 | 월 1회 뉴스레터 + 피드백 기반 개선 |

---

## 12. 승인 및 서명

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| Product Manager | - | ☐ | - |
| Backend Lead | - | ☐ | - |
| Frontend Lead | - | ☐ | - |
| 법무 (법률 검토) | - | ☐ | - |

---

## 부록 A: Gemini API 비용 관리

### API 호출 한도

```
무료 사용자:
- 일일 10회 분석 가능
- 월 최대 300회

프리미엄:
- 일일 무제한
- 응답 캐싱 (동일 텍스트 재분석 금지)
```

### 비용 예측

```
DAU 100명 × 2회/일 = 200회/일
월간: 200 × 30 = 6,000회
Gemini 가격: $0.075/1K tokens (입력)
예상 비용: 6,000 × 0.075 / 1,000 = $0.45/월 (매우 저렴)
```

---

## 부록 B: 데이터 마이그레이션 전략

### 기존 entries.json → PostgreSQL 마이그레이션

```javascript
// 마이그레이션 스크립트 (Node.js)
const fs = require('fs');
const supabase = require('@supabase/supabase-js').createClient(URL, KEY);

async function migrate() {
  const entries = JSON.parse(fs.readFileSync('data/entries.json', 'utf-8'));

  for (const entry of entries) {
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: 'default-user-uuid', // 마이그레이션 시 기본값
        text: entry.text,
        emotion: entry.emotion,
        emoji: entry.emoji,
        message: entry.message,
        advice: entry.advice,
        emotion_hierarchy: entry.ontology?.emotion_hierarchy,
        situation_context: entry.ontology?.situation_context,
        confidence_score: entry.ontology?.confidence || 0,
        created_at: entry.date
      });

    if (error) console.error(`Migration failed: ${error}`);
  }

  console.log('Migration complete!');
}

migrate();
```

---

## 문서 관리

**버전 이력:**
| 버전 | 날짜 | 변경사항 |
|------|------|---------|
| 1.0 | 2026-03-05 | 초안 검토 완료, Phase 5 시작 가능 |

**다음 검토 일정**: Phase 5 완료 후 (약 3주)

---

**이 문서는 전체 팀에게 공유되며, Phase 5 시작 전 모든 이해관계자의 검토와 승인이 필요합니다.**
