# PRD: Sentimind - AI 공감 다이어리

**문서 버전**: v2.0
**작성일**: 2026-03-05
**이전 버전**: v1.0 (2026-03-05)
**상태**: 승인 대기

---

## 이해관계자 목록

| 역할 | 이름 | 책임 |
|------|------|------|
| Product Manager | - | 요구사항 정의, 우선순위, 승인 |
| Backend Developer (2) | - | API, Supabase 연동, 인증 |
| Frontend Developer (1) | - | UI/UX, 반응형, 온보딩 |
| DB Architect (0.5) | - | 스키마 설계, RLS 정책 |
| QA Engineer (1) | - | 테스트 계획, 보안 검증 |

---

## 1. 개요 (Overview)

### 1-1. 제품 명칭 및 슬로건

**Sentimind** - AI 공감 다이어리
> "당신의 감정을 이해하고, 함께 성장하는 일기"

### 1-2. 제품 설명

사용자가 하루를 한 줄로 기록하면 Google Gemini AI가 감정을 분석하고, 온톨로지 기반 3단계 감정 분류와 따뜻한 공감 메시지를 제공하는 웹 애플리케이션.

Phase 1-4를 통해 감정 분석 엔진과 기본 UI가 완성되었다. v2.0 PRD는 프로덕션 환경에 필요한 다중 사용자 지원, 인증, 리텐션 설계를 중심으로 Phase 5-8 요구사항을 정의한다.

### 1-3. 현재 상태 (Phase 4 완료 기준)

| 구성 요소 | 상태 | 한계 |
|-----------|------|------|
| Gemini 감정 분석 API | 완료 | 사용자 구분 없음 |
| OntologyEngine (3단계) | 완료 | 단일 사용자 공유 |
| 통계 대시보드 | 완료 | 개인화 불가 |
| 히스토리 검색/필터 | 완료 | 모든 사용자 데이터 혼재 |
| 데이터 저장 | entries.json (로컬) | 동시 쓰기 충돌 위험, Vercel 재배포 시 소실 |
| 인증 | 없음 | 누구나 전체 데이터 접근/삭제 가능 |
| 배포 | Vercel 계획 (미완료) | 프로덕션 미운영 |
| 로깅 | 구조화된 JSON 로깅 완료 | - |

---

## 2. 배경 및 목적 (Background and Objectives)

### 2-1. 문제 정의

**P1. 데이터 격리 불가 (Critical)**
현재 모든 사용자가 동일한 entries.json 파일을 공유한다. A 사용자의 일기를 B 사용자가 조회하고 삭제할 수 있다. 이는 프로덕션 출시 전 반드시 해결해야 할 보안 결함이다.

**P2. 파일 기반 스토리지의 구조적 한계 (High)**
entries.json은 동시 쓰기 충돌 위험이 있으며, Vercel Serverless 환경의 임시 파일 시스템(`/tmp`)은 재배포 시 데이터가 사라진다. Supabase 전환 없이는 안정적 운영이 불가하다.

**P3. 리텐션 설계 부재 (High)**
감정 분석 후 위로 메시지에서 경험이 끝난다. 스트릭, 주간 리포트, 온보딩 시퀀스 등 사용자를 매일 돌아오게 할 이유가 없다.

**P4. MVP 출시 지연 (Medium)**
현재 로드맵은 Phase 10(11주)에서야 마케팅이 시작된다. Phase 5+6 완료 시점(4-5주)에 베타 출시가 가능하며, 실 사용자 피드백 없는 장기 개발은 방향 오류 위험이 크다.

### 2-2. 비즈니스 목표

1. **보안/격리 확보**: 다중 사용자가 안전하게 사용할 수 있는 인증 및 RLS 구현
2. **프로덕션 출시**: Phase 5+6 완료 시점(5주)에 베타 사용자 모집 시작
3. **리텐션 확보**: 3개월 시점 7일 재방문율 35% 달성
4. **수익화 기반**: 프리미엄 기능 전환을 위한 사용자 기반 확보 (6개월 전환율 5%)

### 2-3. 성공 지표 (KPIs)

| 지표 | 3개월 목표 | 6개월 목표 | 측정 방법 |
|------|-----------|-----------|---------|
| DAU | 50명 | 200명 | API 로그 + Supabase Analytics |
| 7일 리텐션율 | 35% | 45% | 코호트 분석 |
| 감정 분석 신뢰도 (사용자 평가) | 70% | 80% | 인앱 별점 |
| 프리미엄 전환율 | - | 5% | 결제 이벤트 |
| API 가용성 | 99.5% | 99.9% | Uptime 모니터링 |
| 평균 세션당 일기 수 | 1.2건 | 1.5건 | API 로그 |

---

## 3. 사용자 분석 (User Analysis)

### 3-1. 타겟 페르소나

**페르소나 A - 김소연 (Primary: 번아웃 직장인)**
- 나이/직업: 32세, 마케팅 매니저
- 상황: 야근이 잦고 감정 소진 상태. 일기를 써보고 싶지만 무엇을 쓸지 막막함
- 핵심 니즈: 짧게 기록하면 AI가 대신 읽어주고, 내 감정 패턴을 알고 싶음
- 페인포인트: 긴 일기 앱은 부담. 내 일기가 타인에게 보일까봐 불안
- 사용 패턴: 퇴근 후 스마트폰, 1-2분 내 기록

**페르소나 B - 이준혁 (Secondary: 자기성찰 대학생)**
- 나이/전공: 22세, 심리학과
- 핵심 니즈: 감정 분류가 정교하고 월별 트렌드를 데이터로 보고 싶음
- 페인포인트: 기존 앱은 분류가 너무 단순하고 내보내기 기능이 없음
- 사용 패턴: 하루 2-3회, PC에서도 사용

**페르소나 C - 박미선 (Tertiary: 자기성찰 워킹맘)**
- 나이/상황: 42세, 프리랜서 디자이너. 육아와 일 사이 감정 관리 필요
- 핵심 니즈: 간단하고 따뜻한 위로, 내 기록이 안전하다는 안심
- 페인포인트: 복잡한 앱 거부감, 데이터 보안에 민감
- 사용 패턴: 아침 또는 점심, 스마트폰 위주

### 3-2. 핵심 사용자 스토리

**인증 (US-AUTH)**

| ID | 스토리 | MoSCoW |
|----|--------|--------|
| US-A01 | 새 사용자로서, 이메일과 비밀번호로 회원가입하여 개인 계정을 만들고 싶다 | Must |
| US-A02 | 등록 사용자로서, 로그인하여 내 일기에만 접근하고 싶다 | Must |
| US-A03 | 사용자로서, Google 소셜 로그인으로 빠르게 가입하고 싶다 | Should |
| US-A04 | 사용자로서, 비밀번호를 잊었을 때 이메일로 재설정하고 싶다 | Should |

**일기 작성 (US-DIARY)**

| ID | 스토리 | MoSCoW |
|----|--------|--------|
| US-D01 | 사용자로서, 한 줄 일기를 입력하면 AI가 감정을 분석해주기를 원한다 | Must |
| US-D02 | 사용자로서, 분석된 감정의 3단계 계층 구조를 확인하고 싶다 | Must |
| US-D03 | 사용자로서, 공감 메시지와 행동 제안을 받고 싶다 | Must |
| US-D04 | 사용자로서, 일기를 저장하고 다시 읽을 수 있기를 원한다 | Must |
| US-D05 | 사용자로서, 내 일기를 삭제할 수 있기를 원한다 | Must |
| US-D06 | 사용자로서, 일기를 수정할 수 있기를 원한다 (24시간 이내) | Should |

**인사이트 (US-STATS)**

| ID | 스토리 | MoSCoW |
|----|--------|--------|
| US-S01 | 사용자로서, 내 감정 분포를 차트로 보고 싶다 | Must |
| US-S02 | 사용자로서, 가장 자주 느끼는 감정 Top 5를 알고 싶다 | Should |
| US-S03 | 사용자로서, 감정별로 일기를 필터링하고 검색하고 싶다 | Must |
| US-S04 | 사용자로서, 주간 감정 트렌드를 그래프로 보고 싶다 | Should |

**리텐션 (US-RET)**

| ID | 스토리 | MoSCoW |
|----|--------|--------|
| US-R01 | 사용자로서, 첫 방문 시 온보딩 안내를 통해 앱 사용법을 쉽게 익히고 싶다 | Must |
| US-R02 | 사용자로서, 며칠 연속으로 일기를 썼는지 스트릭을 확인하고 싶다 | Should |
| US-R03 | 사용자로서, 일기 작성을 잊지 않도록 알림을 설정하고 싶다 | Should |

---

## 4. 기능 요구사항 (Functional Requirements)

### FR-AUTH: 사용자 인증

**FR-AUTH-001: 이메일/비밀번호 회원가입** [Must]

설명: Supabase Auth를 통한 이메일 기반 회원가입

상세 스펙:
- 이메일 유효성 검사 (RFC 5322 기준)
- 비밀번호: 최소 8자, 영문+숫자 조합 필수
- 이메일 인증 메일 자동 발송
- 중복 이메일 시 명확한 오류 메시지

수용 기준:
- 유효한 이메일 + 조건에 맞는 비밀번호 입력 시 3초 이내 회원가입 완료
- 가입 후 이메일 인증 링크가 10분 이내 수신됨
- 중복 이메일 입력 시 "이미 사용 중인 이메일입니다" 메시지 표시
- 회원가입 완료 후 온보딩 화면으로 자동 진입

---

**FR-AUTH-002: 로그인 / 로그아웃** [Must]

설명: JWT 기반 세션 관리, httpOnly Cookie 저장

상세 스펙:
- 세션 만료: 7일 (Refresh Token 자동 갱신)
- 로그아웃 시 서버 측 토큰 무효화
- 잘못된 자격증명 3회 연속 시 1분 잠금 (Supabase 내장)

수용 기준:
- 올바른 자격증명 입력 시 2초 이내 로그인 완료
- 로그아웃 후 브라우저 뒤로가기 시 인증 데이터 접근 불가
- 세션 만료 시 로그인 화면으로 자동 리다이렉트

---

**FR-AUTH-003: Google OAuth 소셜 로그인** [Should]

상세 스펙:
- Supabase Auth Google Provider
- 가입과 로그인을 단일 플로우로 처리
- 첫 소셜 로그인 시 닉네임 설정 화면 표시

수용 기준:
- Google 계정 선택 후 30초 이내 앱 진입 완료

---

**FR-AUTH-004: 비밀번호 재설정** [Should]

수용 기준:
- 재설정 이메일 10분 이내 수신
- 링크 유효 시간: 1시간
- 링크 만료 시 명확한 안내 메시지 표시

---

### FR-DIARY: 일기 작성 및 관리

**FR-DIARY-001: 일기 작성 및 AI 감정 분석** [Must]

설명: 텍스트 입력 후 Gemini API 분석, OntologyEngine 감정 계층 분류

상세 스펙:
- 입력: 텍스트 최대 500자 (실시간 카운터 표시)
- Gemini 2.5 Flash 분석 결과: emotion, emoji, message, advice
- OntologyEngine: 3단계 감정 계층 + 5개 상황 도메인 분류
- 로컬 임시 저장: 텍스트 변경 시 3초마다 sessionStorage 저장

수용 기준:
- 분석 버튼 클릭 후 5초 이내 결과 표시
- 분석 중 로딩 상태 (스피너) 표시
- 분석 실패 시 "다시 시도해주세요" 메시지와 재시도 버튼 표시
- 500자 초과 입력 시 즉시 경고 (제출 불가)

---

**FR-DIARY-002: 일기 저장** [Must]

설명: 분석 결과와 함께 사용자별 격리 저장

저장 데이터: id, user_id, text, emotion, emoji, message, advice, emotion_hierarchy (jsonb), situation_context (jsonb), confidence_score, created_at

수용 기준:
- 저장 버튼 클릭 시 2초 이내 완료 메시지 표시
- 저장된 일기는 히스토리 목록 최상단에 즉시 표시
- 네트워크 오류 시 재시도 안내 표시

---

**FR-DIARY-003: 일기 목록 조회** [Must]

설명: 사용자 자신의 일기만 표시 (RLS 적용)

상세 스펙:
- 기본 정렬: 최신순
- 페이지네이션: 20건씩 (무한 스크롤)
- 표시 항목: 날짜, 텍스트 미리보기 50자, 감정 이모지, 감정명

수용 기준:
- 목록 초기 로드 500ms 이내
- 다른 사용자의 일기가 절대 노출되지 않음 (보안 테스트 필수)
- 일기가 없는 경우 "첫 일기를 작성해보세요" 안내 표시

---

**FR-DIARY-004: 일기 삭제** [Must]

상세 스펙:
- 소프트 삭제 (deleted_at 컬럼, 30일 내 복구 가능)
- 삭제 전 확인 다이얼로그
- 소유자만 삭제 가능 (RLS)

수용 기준:
- 삭제 후 목록에서 즉시 제거 (낙관적 UI 업데이트)
- 타 사용자의 일기 삭제 시도 시 403 반환

---

**FR-DIARY-005: 일기 수정** [Should]

상세 스펙:
- 작성 후 24시간 이내 수정 가능
- 수정 시 감정 재분석 여부 선택 가능
- updated_at 필드 갱신

수용 기준:
- 수정 완료 후 목록에 즉시 반영
- 24시간 경과 시 수정 버튼 비활성화 및 안내 메시지 표시

---

**FR-DIARY-006: 일기 검색 및 필터** [Must]

상세 스펙:
- 텍스트 검색: 300ms 디바운스, 클라이언트 사이드
- 감정 필터: 다중 선택 가능 (칩 UI)
- 날짜 범위 필터: 최근 7일 / 30일 / 전체

수용 기준:
- 검색어 입력 후 300ms 이내 결과 반영
- 감정 필터 선택 시 해당 감정 일기만 즉시 표시
- 검색 결과 없을 시 "검색 결과가 없습니다" 표시

---

### FR-STATS: 통계 및 인사이트

**FR-STATS-001: 감정 분포 대시보드** [Must]

상세 스펙:
- 요약 카드: 전체 일기 수, 주요 감정, 평균 신뢰도
- 상위 5개 감정 바 차트 (CSS 기반)
- 상위 5개 상황 도메인 목록
- 최근 5개 일기 미리보기

수용 기준:
- 통계 탭 클릭 시 1초 이내 데이터 표시
- 일기 저장 후 새로고침 시 통계 반영

---

**FR-STATS-002: 주간 감정 트렌드** [Should]

상세 스펙:
- 최근 4주 데이터를 주간 단위로 시각화
- 긍정/부정 감정 비율 추이
- 데이터 없는 구간은 "기록 없음" 표시

수용 기준:
- 7일 이상의 일기 데이터가 있을 때 트렌드 그래프 표시

---

### FR-RETENTION: 사용자 리텐션

**FR-RET-001: 온보딩 시퀀스** [Must]

설명: 첫 로그인 사용자에게 앱 핵심 기능을 안내하는 3단계 튜토리얼

단계 설계:
1. "감정 일기란?" - 서비스 소개
2. "이렇게 쓰면 돼요" - 샘플 텍스트 제공, 첫 분석 체험
3. "알림 설정" - 매일 일기 쓸 시간 선택 (선택)

수용 기준:
- 첫 로그인 시 자동 표시
- 온보딩 완료 후 즉시 일기 작성 화면 진입
- "건너뛰기" 옵션 제공
- 온보딩 완료 여부 user_profiles에 저장

---

**FR-RET-002: 연속 기록 스트릭** [Should]

상세 스펙:
- 현재 연속 기록일 수, 최장 스트릭 표시
- 오늘 기록 여부 아이콘 표시
- 자정(한국 시간) 기준으로 계산
- 하루라도 빠지면 스트릭 리셋

수용 기준:
- 홈 화면 상단에 스트릭 정보 표시
- 스트릭 30일 달성 시 뱃지 표시 (Could)

---

**FR-RET-003: 일기 작성 알림** [Should]

상세 스펙:
- 사용자 지정 시간에 브라우저 푸시 알림
- 당일 미작성 시 리마인더 1회 발송
- 알림 권한 요청: 온보딩 3단계

수용 기준:
- 알림 클릭 시 앱으로 직접 진입
- 알림 설정 페이지에서 시간 변경 가능

---

### FR-PROFILE: 프로필 관리

**FR-PROFILE-001: 프로필 조회 및 수정** [Must]

상세 스펙:
- 닉네임 (최대 30자), 바이오 (최대 200자)
- 알림 설정 관리
- 가입일, 총 일기 수 표시

수용 기준:
- 프로필 수정 즉시 반영 (낙관적 업데이트)

---

**FR-PROFILE-002: 계정 탈퇴** [Must]

상세 스펙:
- 탈퇴 확인 (이메일 재입력)
- 30일 유예 기간 후 완전 삭제
- 탈퇴 확인 메일 발송
- Supabase cascade delete 적용

수용 기준:
- 탈퇴 후 로그인 시도 시 "탈퇴한 계정입니다" 안내

---

**FR-PROFILE-003: 데이터 내보내기** [Could]

상세 스펙:
- 모든 일기를 JSON 또는 CSV로 다운로드
- GDPR Article 20 (데이터 이동성) 준수

---

## 5. 비기능 요구사항 (Non-functional Requirements)

### 5-1. 성능 (Performance)

| ID | 항목 | 기준값 | 측정 방법 |
|----|------|--------|---------|
| NFR-PERF-001 | GET /api/entries 응답 시간 | 500ms 이내 (P95) | API 로그 |
| NFR-PERF-002 | POST /api/analyze 응답 시간 | 5초 이내 (P95) | API 로그 |
| NFR-PERF-003 | GET /api/stats 응답 시간 | 1초 이내 (캐시 5분) | API 로그 |
| NFR-PERF-004 | 페이지 FCP | 2초 이내 | Lighthouse |
| NFR-PERF-005 | 페이지 TTI | 4초 이내 | Lighthouse |
| NFR-PERF-006 | 동시 사용자 | 100명 (목표 500명 확장 가능) | 부하 테스트 |

### 5-2. 보안 (Security)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-SEC-001 | 사용자 데이터 격리 | Supabase RLS 정책 필수 적용 |
| NFR-SEC-002 | 세션 토큰 저장 | httpOnly Cookie (XSS 방지) |
| NFR-SEC-003 | 통신 암호화 | HTTPS/TLS 1.2 이상 |
| NFR-SEC-004 | API 키 보호 | 서버 측 환경변수, 클라이언트 미노출 |
| NFR-SEC-005 | Rate Limiting | POST /api/analyze 분당 10회 |
| NFR-SEC-006 | 입력 검증 | 모든 사용자 입력 서버 측 검증 필수 |
| NFR-SEC-007 | SQL Injection 방지 | Supabase SDK 파라미터 바인딩 사용 |
| NFR-SEC-008 | 비밀번호 해싱 | bcrypt (Supabase Auth 내장) |

### 5-3. 가용성 (Availability)

| ID | 항목 | 기준값 |
|----|------|--------|
| NFR-AVAIL-001 | 서비스 가용성 | 99.5% uptime (월 기준 3.6시간 다운 허용) |
| NFR-AVAIL-002 | 배포 중 다운타임 | Vercel Zero-downtime 배포 |
| NFR-AVAIL-003 | RTO | 1시간 이내 복구 |
| NFR-AVAIL-004 | RPO | 24시간 (Supabase 자동 백업) |
| NFR-AVAIL-005 | Gemini API 장애 | 5초 이내 사용자 친화적 오류 메시지 |

### 5-4. 접근성 (Accessibility)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-ACC-001 | 웹 접근성 | WCAG 2.1 AA 준수 |
| NFR-ACC-002 | 키보드 네비게이션 | 모든 기능 키보드 접근 가능 |
| NFR-ACC-003 | 스크린 리더 | ARIA 레이블 적용 |
| NFR-ACC-004 | 색상 대비 | 4.5:1 이상 (텍스트), 3:1 이상 (UI) |

### 5-5. 규정 준수 (Compliance)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-COMP-001 | 개인정보보호 | 한국 개인정보보호법, GDPR 준수 |
| NFR-COMP-002 | 연령 제한 | 만 14세 미만 가입 금지 |
| NFR-COMP-003 | 데이터 삭제 권리 | GDPR Article 17: 탈퇴 시 데이터 삭제 |
| NFR-COMP-004 | 데이터 이동성 | GDPR Article 20: CSV/JSON 내보내기 |

필수 법적 문서 (출시 전 작성):
- [ ] 개인정보 처리 방침 (Privacy Policy)
- [ ] 서비스 이용약관 (Terms of Service)
- [ ] 쿠키 정책 (Cookie Policy)

---

## 6. 기술 제약사항 (Technical Constraints)

### 6-1. 현행 기술 스택 (Phase 5-8 유지)

| 계층 | 기술 | 비고 |
|------|------|------|
| Frontend | 단일 HTML (CSS/JS 인라인) | Phase 8 이후 Next.js 검토 |
| Backend | Node.js + Express | Vercel Serverless |
| Database | Supabase PostgreSQL | Seoul 리전 |
| AI | Google Gemini 2.5 Flash | thinkingBudget: 0 필수 |
| Auth | Supabase Auth | JWT + httpOnly Cookie |
| Monitoring | 구조화된 JSON 로깅 | 기존 Logger 클래스 활용 |
| Hosting | Vercel | Serverless Functions |

### 6-2. 의존성 제약

- Gemini API: Tier 1 레이트 리밋 준수 (config/llm-config.js 참조)
- Supabase Free 티어: 500MB DB, 50,000 월간 활성 사용자
- Vercel Free 티어: 100GB 대역폭/월

### 6-3. 범위 밖 (Out of Scope) - 이 PRD에서 다루지 않음

- Next.js / React 프레임워크 전환 (Phase 9+ 검토)
- 모바일 네이티브 앱 (iOS/Android)
- 소셜 기능 (친구 추가, 공개 일기)
- 결제 시스템 구현 (설계만 포함)
- 다국어 지원 (한국어 전용)
- 음성 입력

---

## 7. 데이터 모델 (Data Model)

### 7-1. 스키마 정의

```sql
-- 사용자 프로필 (Supabase Auth의 auth.users와 연동)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(30),
  bio TEXT,
  notification_time TIME,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  current_streak INT DEFAULT 0,
  max_streak INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 일기 항목
CREATE TABLE public.entries (
  id TEXT PRIMARY KEY,                          -- nanoid 기반
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text VARCHAR(500) NOT NULL,
  emotion VARCHAR(100),
  emoji VARCHAR(10),
  message TEXT,
  advice TEXT,
  emotion_hierarchy JSONB,                      -- {level1, level2, level3, emoji}
  situation_context JSONB,                      -- [{domain, context}, ...]
  confidence_score INT DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  related_emotions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                        -- 소프트 삭제
);

-- 인덱스
CREATE INDEX idx_entries_user_id ON public.entries(user_id);
CREATE INDEX idx_entries_created_at ON public.entries(created_at DESC);
CREATE INDEX idx_entries_user_emotion ON public.entries(user_id, emotion);
CREATE INDEX idx_entries_active ON public.entries(user_id) WHERE deleted_at IS NULL;
```

### 7-2. RLS 정책

```sql
-- entries 테이블 보안 정책
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 일기만 조회" ON public.entries
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "사용자는 자신의 일기만 삽입" ON public.entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 일기만 수정" ON public.entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 일기만 삭제" ON public.entries
  FOR DELETE USING (auth.uid() = user_id);

-- user_profiles 보안 정책
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 프로필만 접근" ON public.user_profiles
  USING (auth.uid() = id);
```

---

## 8. 개발 일정 (Timeline and Milestones)

### 8-1. Phase 5+6 병합 스프린트: DB 마이그레이션 + 인증 (4주)

전략 검토 결과, Phase 5(DB)와 Phase 6(인증)을 별도로 출시하는 것은 사용자 가치 없다. 4주 단일 스프린트로 병합하여 완성한다.

| 주차 | 작업 | 담당 | 산출물 |
|------|------|------|--------|
| Week 1 | Supabase 스키마 생성, RLS 정책 설정 | DB Architect | entries/profiles 테이블, 정책 문서 |
| Week 1-2 | server.js Supabase 연동 완성, JWT 검증 미들웨어 | Backend Dev | 인증된 API 엔드포인트 |
| Week 2 | 회원가입/로그인 UI, 온보딩 3단계 | Frontend Dev | 인증 화면, 온보딩 플로우 |
| Week 3 | entries.json 마이그레이션 스크립트, 데이터 검증 | Backend Dev + QA | 마이그레이션 완료 보고서 |
| Week 4 | 통합 테스트, 보안 격리 검증, 버그 수정 | QA + 전팀 | 테스트 리포트 |

완료 기준:
- 회원가입 → 로그인 → 일기 작성 → 개인 데이터 조회 플로우 완성
- 다른 사용자의 일기 접근 시 403 반환 (보안 테스트 통과)
- 기존 entries.json 데이터 마이그레이션 100% 완료

### 8-2. Phase 7: 프로덕션 배포 (1주)

**기간**: Week 5

| 작업 | 담당 | 산출물 |
|------|------|--------|
| Vercel 프로덕션 배포 | Backend Dev | 프로덕션 URL |
| 환경변수 설정 (Vercel Secrets) | Backend Dev | 배포 체크리스트 |
| Uptime 모니터링 설정 | QA | 알람 구성 |
| 베타 사용자 10명 초대 | PM | 피드백 채널 개설 |

완료 기준: 프로덕션 URL 정상 접속, 10명 베타 사용자 온보딩 완료

### 8-3. Phase 8: 리텐션 기능 (2주)

**기간**: Week 6-7

| 작업 | 담당 | 산출물 |
|------|------|--------|
| 연속 스트릭 기능 | Backend + Frontend | 스트릭 UI |
| 주간 감정 트렌드 그래프 | Frontend | 트렌드 차트 |
| 프로필 페이지 | Frontend | 프로필/설정 화면 |
| 브라우저 푸시 알림 | Backend + Frontend | 알림 설정 기능 |

완료 기준: 7일 리텐션율 20% 이상 (베타 사용자 10명 기준)

### 8-4. 전체 마일스톤

| 마일스톤 | 목표일 | 성공 기준 |
|---------|-------|---------|
| M1: DB + 인증 완료 | Week 4 (4/2) | 보안 격리 테스트 통과 |
| M2: 프로덕션 출시 | Week 5 (4/9) | 베타 10명 온보딩 |
| M3: 리텐션 기능 | Week 7 (4/23) | 7일 리텐션 20% 이상 |
| M4: 공개 베타 | Week 9 (5/7) | DAU 30명 이상 |

---

## 9. 비즈니스 모델

### 9-1. Phase 1 (0-3개월): 완전 무료

목표: 사용자 획득 및 행동 데이터 수집. 제약 없이 모든 기능 제공.

### 9-2. Phase 2 (4-6개월): 프리미엄 도입

| 플랜 | 가격 | 기능 |
|------|------|------|
| 무료 | $0/월 | 무제한 일기 + 기본 통계 |
| 프리미엄 | $4.99/월 | 무제한 + 주간 리포트 + 고급 트렌드 분석 + CSV 내보내기 |
| Pro | $9.99/월 | 프리미엄 + AI 개인화 코칭 + 우선 지원 |

참고: "무료 한도 30개" 방식은 라이트 사용자를 차단하는 부작용이 있어, 기능 차별화 방식을 권장함.

### 9-3. API 비용 예측

```
DAU 100명 × 2회/일 = 200회/일
월간: 200 × 30 = 6,000회
Gemini 2.5 Flash 예상 비용: ~$0.50/월 (현재 티어 기준)
```

---

## 10. 리스크 관리 (Risk Management)

### 10-1. 기술 리스크

| 리스크 | 확률 | 영향도 | 완화 전략 |
|--------|------|--------|---------|
| Supabase RLS 설정 오류로 데이터 노출 | 중 | 높음 | QA 보안 테스트 필수, 스테이징 환경 별도 검증 |
| entries.json 마이그레이션 실패 | 낮음 | 높음 | 마이그레이션 전 백업 필수, 롤백 스크립트 준비 |
| Gemini API 레이트 리밋 초과 | 중 | 중간 | 지수 백오프 구현됨, 사용자당 분당 10회 제한 |
| Vercel Serverless 콜드 스타트 | 낮음 | 중간 | 응답 시간 모니터링, 웜업 설정 |

### 10-2. 비즈니스 리스크

| 리스크 | 완화 전략 |
|--------|---------|
| 초기 사용자 부족 | 베타 출시 5주 후로 앞당겨 피드백 조기 수집 |
| 경쟁 서비스 출현 | 온톨로지 기반 3단계 감정 분류 차별화 유지 |
| 사용자 이탈 | 스트릭/알림으로 습관화 유도, 월 1회 뉴스레터 |

### 10-3. 일정 리스크

| 리스크 | 완화 전략 |
|--------|---------|
| 팀원 이탈 | 인증(Must) 먼저 완성, 리텐션 기능은 이후 진행 |
| 보안 감사 피드백 재작업 | Phase 7 일정에 3일 버퍼 포함 |

---

## 11. 수용 기준 요약 체크리스트 (QA 기준)

Phase 7(배포) 진입 전 충족 필수:

- [ ] 회원가입 플로우 완전 동작 (이메일 인증 포함)
- [ ] 로그인 후 개인 데이터만 표시됨
- [ ] 다른 사용자의 일기 조회/삭제 시도 시 403 반환
- [ ] 감정 분석 결과 5초 이내 표시
- [ ] 일기 저장 후 히스토리 즉시 반영
- [ ] 온보딩 3단계 완전 동작
- [ ] 통계 데이터 정확도 수동 검증 (5개 일기 기준)
- [ ] 모바일 반응형 레이아웃 (375px / 768px / 1280px)
- [ ] Lighthouse 성능 점수 70점 이상
- [ ] WCAG 2.1 AA 자동 검사 통과
- [ ] 계정 탈퇴 시 데이터 삭제 동작 확인

---

## 12. 부록 (Appendix)

### 12-1. API 엔드포인트 목록 (Phase 7 목표)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/signup | 회원가입 | No |
| POST | /api/auth/login | 로그인 | No |
| POST | /api/auth/logout | 로그아웃 | Yes |
| POST | /api/auth/reset-password | 비밀번호 재설정 요청 | No |
| POST | /api/analyze | 감정 분석 | Yes |
| GET | /api/entries | 일기 목록 조회 | Yes |
| POST | /api/entries | 일기 저장 | Yes |
| PATCH | /api/entries/:id | 일기 수정 | Yes |
| DELETE | /api/entries/:id | 일기 삭제 | Yes |
| GET | /api/stats | 감정 통계 | Yes |
| GET | /api/profile | 프로필 조회 | Yes |
| PATCH | /api/profile | 프로필 수정 | Yes |

### 12-2. 관련 문서

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/DATABASE.md](./DATABASE.md)
- [docs/API.md](./API.md)
- [plans/ROADMAP.md](../plans/ROADMAP.md)
- [plans/PHASE5.md](../plans/PHASE5.md)
- [docs/PRODUCT_STRATEGY_REVIEW.md](./PRODUCT_STRATEGY_REVIEW.md)

---

## 승인

| 역할 | 이름 | 승인 | 날짜 |
|------|------|------|------|
| Product Manager | - | [ ] | - |
| Backend Lead | - | [ ] | - |
| Frontend Lead | - | [ ] | - |

---

**문서 이력**

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-03-05 | 초안 (기능 요구사항 + 기술 아키텍처) |
| v2.0 | 2026-03-05 | 전략 검토 반영: Phase 5+6 병합, 리텐션 설계 추가, 비즈니스 모델 수정, 수용 기준 강화 |
