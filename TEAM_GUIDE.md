# Phase 5 팀 협업 가이드

**프로젝트**: AI 공감 다이어리 (Sentimind)
**단계**: Phase 5 - Supabase Backend Migration
**팀 규모**: 4-5명
**기간**: 2-3주

---

## 👥 팀 구성 및 역할

### 1. Backend Developer #1 (2명 중 Lead)
**주요 책임**:
- Express.js API 설계 및 구현
- Supabase 프로젝트 초기화
- RLS 정책 설정
- 마이그레이션 스크립트 검증
- API 엔드포인트 통합
- 통합 테스트 주도

**주간 작업 목표**:
- Week 1: Supabase 설정 + RLS 정책 (5일)
- Week 2: API 통합 + 테스트 (5일)
- Week 3: 버그 수정 및 최적화 (2일)

**필수 기술**:
- Node.js / Express.js
- PostgreSQL 기본
- Supabase 클라이언트 SDK
- Git / GitHub

---

### 2. Backend Developer #2 (2명 중 Support)
**주요 책임**:
- 마이그레이션 스크립트 작성
- 데이터 검증 프로세스 구축
- 백업 & 복구 전략 문서화
- API 테스트 케이스 작성
- 성능 벤치마크 수행

**주간 작업 목표**:
- Week 1: 마이그레이션 스크립트 작성 (4일)
- Week 2: 데이터 검증 및 테스트 (3일)
- Week 3: 성능 최적화 (2일)

**필수 기술**:
- Node.js
- JavaScript / JSON 처리
- SQL 기본
- 데이터 검증 경험

---

### 3. Database Architect (0.5명, 파트타임)
**주요 책임**:
- PostgreSQL 스키마 설계
- 인덱싱 전략 수립
- 성능 최적화 상담
- RLS 정책 리뷰
- 용량 계획 수립

**주간 작업 목표**:
- Week 1: 스키마 설계 + 인덱싱 (3-4시간/일)
- Week 2: 성능 모니터링 및 조언 (2-3시간/일)
- Week 3: 최적화 제안 (1-2시간/일)

**필수 기술**:
- PostgreSQL 심화
- 인덱싱 전략
- 성능 튜닝
- 데이터베이스 아키텍처

---

### 4. QA Engineer (1명)
**주요 책임**:
- 테스트 계획 수립
- API 테스트 작성 및 실행
- RLS 정책 검증
- 성능 테스트 (로드 테스트)
- 버그 리포트 및 추적
- 회귀 테스트
- **로그 모니터링 및 분석** (Phase 4+)

**로깅 책임** (Backend Dev와 공동 책임):
- 일일 로그 검토 (에러 확인, 성능 모니터링)
- 이상 패턴 감지 및 보고
- 로그 기반 버그 리포트 작성
- 성능 분석 및 트렌드 추적
- 자세한 내용: [`guides/LOGGING.md`](./guides/LOGGING.md)

**주간 작업 목표**:
- Week 1: 테스트 계획 수립 (1-2일)
- Week 2: API 테스트 실행 (3-4일)
- Week 3: 성능 테스트 및 버그 픽스 (3-4일)
- **일일**: 로그 검토 (30분)

**필수 기술**:
- API 테스트 (Postman, curl)
- SQL 기본
- 성능 모니터링
- 버그 추적 시스템
- JSON 로그 분석

---

### 5. Project Manager (0.5명, 선택)
**주요 책임**:
- 일정 관리 및 추적
- 팀 간 조율 및 이슈 해결
- 커뮤니케이션 촉진
- 위험 관리 및 블로커 해결
- 스테이크홀더 보고

**주간 작업 목표**:
- 매일: 팀 미팅 (15분 스탠드업)
- 주 2회: 진행상황 리뷰
- 필요시: `project-orchestrator` 에이전트 활용

**지원 도구**:
- `project-orchestrator` AI 에이전트로 자동화된 상태 추적
- 자세한 내용: 👇 "AI 에이전트 활용 가이드" 참고

---

## 📅 주간 스케줄

### 공통 일정

**매일 09:00 - 스탠드업 미팅 (15분)**
- 어제 완료사항
- 오늘 계획
- 블로커 공유
- Slack에서 동시 진행 가능

**월요일 10:00 - 주간 플래닝 (1시간)**
- 주간 목표 검토
- 작업 할당
- 위험 요소 논의

**금요일 16:00 - 주간 리뷰 (1시간)**
- 진행상황 검토
- 완료된 작업 데모
- 다음주 준비

---

### Sprint 별 일정

**Sprint 1: Week 1 (기반 인프라)**
```
Mon: Supabase 프로젝트 생성 + 스키마 설계 시작
Tue-Wed: 스키마 생성 + RLS 설정
Thu-Fri: 인덱싱 + 마이그레이션 스크립트 준비
```

**Sprint 2: Week 1-2 (데이터 마이그레이션)**
```
Mon-Tue: 마이그레이션 스크립트 완성 + 테스트
Wed-Thu: 데이터 검증 + API 통합 준비
Fri: 통합 테스트 시작
```

**Sprint 3: Week 2-3 (API 통합 & 테스트)**
```
Mon-Wed: API 엔드포인트 구현 + 테스트
Thu-Fri: 버그 수정 + 성능 최적화
```

---

## 💬 커뮤니케이션 채널

| 채널 | 용도 | 빈도 |
|------|------|------|
| **Slack #development** | 일상 협업 | 실시간 |
| **Slack #logging** | 로그 에러 보고 & 논의 | 필요시 |
| **GitHub Issues** | 버그 & 작업 추적 | 필요시 |
| **GitHub PR** | 코드 리뷰 | 완료시 |
| **Weekly Meeting** | 진행상황 검토 | 주 1회 |
| **Email** | 공식 공지 | 필요시 |

### 로그 기반 협업 워크플로우

```
1️⃣ QA 엔지니어가 로그에서 에러 발견
   → GitHub Issue 생성 + Slack #logging에 알림

2️⃣ Backend 개발자가 원인 분석
   → Issue에 댓글로 원인 및 해결 방안 작성
   → 로그 수준에 따라 즉시/스프린트 처리 결정

3️⃣ 주간 회의에서 로그 분석 결과 공유
   → 이번 주 주요 에러 패턴
   → 성능 트렌드
   → 예방 방안 논의
```

### 커밋 메시지 컨벤션

**모든 팀원이 따를 커밋 메시지 규칙**: [`CLAUDE.md` - Git Commit Convention](./CLAUDE.md#git-commit-convention)

**핵심 규칙**:
- 형식: `<타입>(<범위>): <한국어 설명>` (예: `feat(api): Gemini 감정 분석 추가`)
- 10가지 타입: `feat`, `fix`, `docs`, `chore`, `data`, `infra`, `phase` 등
- 한글 설명 35자 이내, 마침표 금지
- PR 리뷰 시 커밋 메시지 규칙 준수 확인

---

## 🔧 개발 환경 설정

### 모든 팀원

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
   # .env 파일 생성 (절대 git에 커밋하지 않음)
   GOOGLE_API_KEY=your_key
   SUPABASE_URL=your_url
   SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_KEY=your_key  # Backend Dev만
   ```

4. **브랜치 전략**
   ```bash
   # main에서 feature 브랜치 생성
   git checkout -b feature/phase5-supabase
   # 작업 완료 후 PR 생성
   git push origin feature/phase5-supabase
   # PR 리뷰 후 merge
   ```

---

## 🎯 업무 분담 매트릭스

| 작업 | Backend #1 | Backend #2 | DB Arch | QA | PM |
|------|-----------|-----------|---------|-----|-----|
| **Supabase 초기화** | 👤 | ⭐ | 📋 | - | - |
| **스키마 설계** | 👤 | - | 👤 | - | - |
| **RLS 정책** | 👤 | - | 📋 | ✅ | - |
| **인덱싱** | - | - | 👤 | - | - |
| **마이그레이션** | 📋 | 👤 | - | ✅ | - |
| **API 통합** | 👤 | ⭐ | - | - | - |
| **테스트** | 📋 | 📋 | - | 👤 | - |
| **버그 수정** | 👤 | 👤 | - | 📋 | - |

범례:
- 👤 = 주 책임
- ⭐ = 주 담당 (완전 책임)
- 📋 = 상담/검토
- ✅ = 검증
- `-` = 관련 없음

---

## 📋 체크인 포인트

### Day 1 (월요일) - Supabase 초기화
**완료 기준**:
- [ ] Supabase 프로젝트 생성됨
- [ ] API URL & 키 확보됨
- [ ] 팀 모두 접근 권한 확인됨
- [ ] `.env` 파일 공유됨 (안전하게)

**담당**: Backend Dev #1
**검증**: PM

---

### Day 3 (수요일) - 스키마 & RLS 완성
**완료 기준**:
- [ ] 4개 테이블 생성됨
- [ ] RLS 정책 3/3 설정됨
- [ ] 인덱스 6/6 생성됨
- [ ] 데이터베이스 구조 문서화됨

**담당**: Database Architect + Backend Dev #1
**검증**: QA Engineer

---

### Day 5 (금요일) - 마이그레이션 완성
**완료 기준**:
- [ ] 마이그레이션 스크립트 작성됨
- [ ] entries.json 전체 마이그레이션됨
- [ ] 데이터 검증 100% 통과됨
- [ ] 롤백 계획 수립됨

**담당**: Backend Dev #2
**검증**: QA Engineer

---

### Day 8 (목요일) - API 통합 완성
**완료 기준**:
- [ ] 모든 API 엔드포인트 통합됨
- [ ] Gemini 연동 정상 작동
- [ ] 온톨로지 메타데이터 정상 저장
- [ ] 프론트엔드와 호환성 확인

**담당**: Backend Dev #1
**검증**: QA Engineer

---

### Day 12 (월요일) - 테스트 & 최적화
**완료 기준**:
- [ ] 모든 API 엔드포인트 테스트 통과
- [ ] RLS 정책 보안 검증 완료
- [ ] 성능 테스트 통과 (< 100ms)
- [ ] 0개 미해결 버그

**담당**: QA Engineer + Backend Dev
**검증**: PM

---

## 🚨 위험 관리

| 위험 | 영향 | 대응 | 담당 |
|------|------|------|------|
| Supabase 계정 생성 지연 | 높음 | 미리 생성 | Backend #1 |
| 스키마 설계 오류 | 높음 | 아키텍트 검토 | DB Arch |
| 데이터 손실 | 매우 높음 | 백업 + 검증 | Backend #2 |
| 성능 저하 | 중간 | 인덱싱 + 모니터링 | DB Arch |
| API 통합 지연 | 중간 | Early testing | Backend #1 |
| 테스트 실패 | 중간 | 여유 일정 계획 | QA |

---

## 🤖 AI 에이전트 활용 가이드

### project-orchestrator 사용 시기

Phase 5 진행 중 프로젝트 관리 및 팀 조율이 필요할 때 사용합니다.

**사용 사례**:

1. **타임라인 관리**
   - 주간 계획 수립
   - 스프린트 진행상황 추적
   - 일정 조정 및 우선순위 변경
   - 완료 기준 검증

2. **팀 간 조율**
   - "Phase 5 진행 상황 + 팀 간 블로커 확인"
   - "다음 주 스케줄 조정 + 의존성 파악"
   - 병목 지점(blocker) 해결
   - 위험도 평가 및 대응

3. **상태 동기화**
   - 주간 진행 리포트 작성
   - 팀 간 의존성 확인
   - 리스크 평가

### db-architect 사용 시기

데이터베이스 설계, 성능 최적화, RLS 정책 검토가 필요할 때 사용합니다.

**사용 사례**:
- "PostgreSQL 스키마 검토 및 인덱싱 전략 수립"
- "RLS 정책의 보안 취약점 분석"
- "쿼리 성능 최적화 제안"

### release-manager 사용 시기

릴리스 직전 실제 출시 가능 여부를 판단할 때 사용합니다.

**사용 사례**:
- "지금 상태로 배포 가능한지 확인"
- "체크리스트와 실제 구현이 맞는지 검증"
- "남은 출시 리스크와 소유자 정리"

### api-contract-guardian 사용 시기

백엔드 구현, 프런트 호출, 테스트, 문서 사이의 API 계약이 맞는지 점검할 때 사용합니다.

**사용 사례**:
- "README 예제와 실제 엔드포인트가 같은지 확인"
- "프런트가 호출하는 payload와 서버가 받는 payload 비교"
- "API 변경 후 어떤 문서와 테스트를 같이 고쳐야 하는지 확인"

### 권장 AI 에이전트 팀 구성

현재 저장소 기준 권장 코어 팀:

| 역할 | 에이전트 | 용도 |
|------|---------|------|
| 총괄 조율 | `project-orchestrator` | 일정, 의존성, 블로커, 우선순위 |
| 백엔드 구현 | `backend-developer` | API, 인증, 서버 로직 |
| 프런트 구현 | `frontend-developer` | UI, 사용자 흐름, 접근성 |
| DB 설계 | `db-architect` | 스키마, 인덱싱, RLS, 성능 |
| QA | `qa-engineer` | 기능 검증, 회귀 점검, 테스트 관점 리뷰 |
| 릴리스 검증 | `release-manager` | 출시 가능 여부, 체크리스트, 리스크 판단 |
| 계약 정합성 | `api-contract-guardian` | 구현/문서/테스트/API 호출 일치 점검 |

확장 팀:

| 역할 | 에이전트 | 용도 |
|------|---------|------|
| 기술 설계 | `tech-architect` | 대규모 구조 변경, 시스템 설계 |
| 제품 요구사항 | `product-requirements-manager` | PRD, 우선순위, 로드맵 |
| UX 개선 | `ux-designer` | 플로우, 카피, 사용성 |
| 성능 최적화 | `performance-optimizer` | 병목 분석, 최적화 |

### 에이전트 협업 플레이북

아래 순서를 기본값으로 사용합니다.

#### 1. 신규 기능 개발

1. `project-orchestrator`
   - 범위, 의존성, 우선순위 정리
2. `product-requirements-manager` 또는 `tech-architect`
   - 요구사항 또는 기술 설계 확정
3. `api-contract-guardian`
   - API 계약, 문서, 테스트 영향 범위 확인
4. `backend-developer` / `frontend-developer` / `db-architect`
   - 실제 구현
5. `qa-engineer`
   - 기능 검증, 회귀 위험 점검
6. `release-manager`
   - 출시 가능 여부 판단

#### 2. 버그 수정

1. `project-orchestrator`
   - 영향 범위와 소유자 확인
2. `backend-developer` 또는 `frontend-developer`
   - 재현, 원인 분석, 수정
3. `api-contract-guardian`
   - 버그 수정으로 문서/API 계약 수정이 필요한지 확인
4. `qa-engineer`
   - 회귀 테스트 및 사용자 흐름 검증

#### 3. API 변경

1. `api-contract-guardian`
   - 엔드포인트, payload, 응답 형태 기준선 확인
2. `backend-developer`
   - 서버 구현 및 테스트 수정
3. `frontend-developer`
   - 호출부와 UI 영향 수정
4. `qa-engineer`
   - 실제 호출 경로 검증
5. `release-manager`
   - 문서, 테스트, 체크리스트 반영 여부 확인

#### 4. 출시 전 점검

1. `release-manager`
   - 출시 차단 이슈와 잔여 리스크 식별
2. `qa-engineer`
   - 핵심 흐름 검증
3. `api-contract-guardian`
   - README, API 문서, 프런트 호출, 서버 구현 정합성 검토
4. `project-orchestrator`
   - 미해결 항목 소유자와 처리 순서 확정

#### 5. 문서/체크리스트 드리프트 발견 시

1. `api-contract-guardian`
   - 구현과 문서의 실제 차이 정리
2. `release-manager`
   - 출시 리스크인지 운영 리스크인지 판단
3. 해당 구현 담당 에이전트
   - 코드 또는 문서 수정

---

## 📚 자료 및 가이드

### 필수 학습 자료
- [Supabase 공식 문서](https://supabase.com/docs)
- [PostgreSQL RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Express.js 가이드](https://expressjs.com/)

### 프로젝트 문서
- `docs/PRD.md` - 전체 기술 명세
- `docs/schema.md` - 데이터베이스 스키마
- `CLAUDE.md` - 프로젝트 개발 원칙

### 예제 코드
- `server.js` - Express API 구현
- `migrate.js` (작성 예정) - 데이터 마이그레이션

---

## ✅ 퇴근 체크리스트

**매일 퇴근 전** (15분):
- [ ] 오늘 완료한 작업 문서화
- [ ] GitHub에 코드 푸시
- [ ] PR 생성 또는 기존 PR 업데이트
- [ ] 코드 리뷰 요청 (필요시)
- [ ] Slack에 진행상황 공유

**주말 전** (금요일 16:30):
- [ ] 주간 완료 사항 정리
- [ ] 다음주 할 일 확인
- [ ] 블로커 사항 리포트

---

## 📞 도움 요청하기

**즉시 도움 필요한 경우**:
- Slack #development에 @mention 또는
- 짧은 호출 (Slack call)

**문제 추적**:
- GitHub Issues에 생성
- 제목: [Phase5-BlockerType] 간단한 설명
- 예: `[Phase5-Database] RLS 정책 설정 실패`

**일반 질문**:
- Slack 스레드에서 논의
- 필요시 회의 일정 잡기

---

**작성일**: 2026-03-05
**최종 업데이트**: 2026-03-05
**상태**: 🟢 준비 완료
