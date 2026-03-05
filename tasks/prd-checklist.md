# PRD 구현 체크리스트

**기준 문서**: docs/PRD.md v2.0
**작성일**: 2026-03-05
**목적**: 각 팀이 PRD 요구사항을 기반으로 구현 및 검증할 때 사용하는 체크리스트

---

## Phase 5+6: DB 마이그레이션 + 사용자 인증

### DB Architect 체크리스트

**스키마 및 정책**
- [ ] P5-01 entries 테이블 생성 (id, user_id, text, emotion, emoji, message, advice, emotion_hierarchy, situation_context, confidence_score, created_at, updated_at, deleted_at)
- [ ] P5-02 user_profiles 테이블 생성 (id, nickname, bio, notification_time, onboarding_completed, current_streak, max_streak, created_at, updated_at)
- [ ] P5-03 인덱스 생성 (idx_entries_user_id, idx_entries_created_at, idx_entries_user_emotion, idx_entries_active)
- [ ] P5-04 RLS 정책 4개 적용 (entries: SELECT/INSERT/UPDATE/DELETE)
- [ ] P5-05 user_profiles RLS 정책 적용
- [ ] P5-06 RLS 정책 검증 (다른 user_id로 접근 시도 차단 확인)

**마이그레이션**
- [ ] P5-07 entries.json 백업 (마이그레이션 전 반드시 실행)
- [ ] P5-08 마이그레이션 스크립트 작성 및 로컬 테스트
- [ ] P5-09 스테이징 환경에서 마이그레이션 실행
- [ ] P5-10 마이그레이션 결과 데이터 정합성 검증 (건수, 필드값)
- [ ] P5-11 프로덕션 마이그레이션 실행

---

### Backend Developer 체크리스트

**인증 미들웨어**
- [ ] B-01 JWT 검증 미들웨어 (authMiddleware) 구현
  - 수용 기준: 유효 토큰 통과, 만료/변조 토큰 401 반환
- [ ] B-02 기존 모든 API 엔드포인트에 authMiddleware 적용
  - POST /api/analyze, GET/POST/DELETE /api/entries, GET /api/stats

**인증 API**
- [ ] B-03 POST /api/auth/signup 구현
  - 수용 기준: 유효 이메일 + 비밀번호(8자+) 시 201 반환, 중복 이메일 409 반환
- [ ] B-04 POST /api/auth/login 구현
  - 수용 기준: 올바른 자격증명 200 + httpOnly Cookie, 잘못된 자격증명 401 반환
- [ ] B-05 POST /api/auth/logout 구현
  - 수용 기준: 토큰 무효화, Cookie 삭제
- [ ] B-06 POST /api/auth/reset-password 구현
  - 수용 기준: 유효 이메일 시 200 + 재설정 이메일 발송

**데이터 API (user_id 기반 필터링)**
- [ ] B-07 GET /api/entries: user_id 필터 적용 (인증된 사용자 데이터만 반환)
- [ ] B-08 POST /api/entries: user_id 자동 설정 (JWT에서 추출)
- [ ] B-09 DELETE /api/entries/:id: 소유자 검증 후 소프트 삭제 (deleted_at 설정)
- [ ] B-10 PATCH /api/entries/:id: 소유자 검증 + 24시간 수정 제한
- [ ] B-11 GET /api/stats: user_id 기반 통계 계산

**프로필 API**
- [ ] B-12 GET /api/profile: 사용자 프로필 조회
- [ ] B-13 PATCH /api/profile: 닉네임, 바이오, notification_time 수정
- [ ] B-14 스트릭 계산 로직: 매일 자정 갱신, 하루 빠지면 리셋

---

### Frontend Developer 체크리스트

**인증 UI**
- [ ] F-01 회원가입 화면 구현
  - 필드: 이메일, 비밀번호, 비밀번호 확인
  - 유효성: 실시간 피드백 (이메일 형식, 비밀번호 조건)
  - 수용 기준: 가입 완료 후 "이메일을 확인해주세요" 메시지 표시
- [ ] F-02 로그인 화면 구현
  - 수용 기준: 로그인 성공 시 온보딩/홈으로 이동
- [ ] F-03 비밀번호 재설정 화면 구현

**온보딩 시퀀스**
- [ ] F-04 온보딩 1단계: 서비스 소개 카드
- [ ] F-05 온보딩 2단계: 샘플 텍스트 제공 + 첫 분석 체험
- [ ] F-06 온보딩 3단계: 알림 시간 설정 (선택)
- [ ] F-07 온보딩 완료 상태 서버에 저장 (onboarding_completed: true)
- [ ] F-08 "건너뛰기" 버튼 제공

**인증 상태 관리**
- [ ] F-09 로그인 상태 체크 (페이지 진입 시 토큰 유효성 확인)
- [ ] F-10 미인증 상태에서 보호된 경로 접근 시 로그인 화면으로 리다이렉트
- [ ] F-11 세션 만료 시 사용자 친화적 안내 후 로그인 화면으로 이동

---

### QA Engineer 체크리스트

**보안 테스트 (필수)**
- [ ] QA-S01 A 계정으로 B 계정의 일기 목록 조회 시도 → 빈 목록 또는 403 반환 확인
- [ ] QA-S02 A 계정으로 B 계정의 일기 ID로 삭제 요청 → 403 또는 404 반환 확인
- [ ] QA-S03 인증 없이 /api/entries 접근 → 401 반환 확인
- [ ] QA-S04 만료된 토큰으로 /api/entries 접근 → 401 반환 확인
- [ ] QA-S05 변조된 JWT 토큰으로 접근 → 401 반환 확인

**인증 플로우 테스트**
- [ ] QA-A01 유효한 이메일 + 비밀번호 회원가입 → 성공
- [ ] QA-A02 중복 이메일 회원가입 → 409 오류 메시지 확인
- [ ] QA-A03 잘못된 비밀번호(7자) 회원가입 → 오류 메시지 확인
- [ ] QA-A04 올바른 자격증명 로그인 → 성공, httpOnly Cookie 설정 확인
- [ ] QA-A05 잘못된 자격증명 로그인 → 오류 메시지 확인
- [ ] QA-A06 로그아웃 → Cookie 삭제 확인

**기능 테스트**
- [ ] QA-F01 일기 작성 → 감정 분석 → 저장 → 목록 반영 확인
- [ ] QA-F02 일기 삭제 → 목록에서 즉시 제거 확인
- [ ] QA-F03 감정 필터 → 해당 감정만 표시 확인
- [ ] QA-F04 텍스트 검색 → 300ms 이내 반영 확인
- [ ] QA-F05 통계 탭 → 1초 이내 데이터 표시 확인

**성능 테스트**
- [ ] QA-P01 GET /api/entries 응답 시간 500ms 이하 (P95)
- [ ] QA-P02 POST /api/analyze 응답 시간 5초 이하 (P95)
- [ ] QA-P03 동시 10명 사용 시 응답 시간 기준값 유지

**접근성 테스트**
- [ ] QA-ACC01 Lighthouse 접근성 점수 90점 이상
- [ ] QA-ACC02 키보드만으로 회원가입 → 로그인 → 일기 작성 완료
- [ ] QA-ACC03 화면 낭독기(VoiceOver 또는 NVDA) 기본 플로우 동작

**반응형 테스트**
- [ ] QA-R01 375px (iPhone SE): 모든 기능 동작
- [ ] QA-R02 768px (iPad): 레이아웃 정상
- [ ] QA-R03 1280px (Desktop): 레이아웃 정상

---

## Phase 7: 프로덕션 배포

- [ ] D-01 Vercel 환경변수 설정 (GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, NODE_ENV)
- [ ] D-02 Vercel 프로덕션 배포 실행
- [ ] D-03 프로덕션 스모크 테스트 5개 시나리오 통과
  - 홈 화면 접속
  - 회원가입
  - 일기 작성 및 분석
  - 일기 저장 및 조회
  - 로그아웃
- [ ] D-04 Uptime 모니터링 설정 (UptimeRobot 또는 유사 도구)
- [ ] D-05 베타 사용자 10명 이메일 초대 발송
- [ ] D-06 피드백 수집 양식 링크 공유

---

## Phase 8: 리텐션 기능

**Backend**
- [ ] R-B01 스트릭 계산 API (GET /api/stats에 streak 필드 추가)
- [ ] R-B02 주간 감정 트렌드 API (GET /api/stats/weekly)
- [ ] R-B03 CSV 내보내기 API (GET /api/entries/export)

**Frontend**
- [ ] R-F01 홈 화면 스트릭 UI (현재 스트릭, 최장 스트릭, 오늘 기록 여부)
- [ ] R-F02 주간 트렌드 그래프 (최근 4주, 감정별 비율)
- [ ] R-F03 프로필 페이지 (닉네임, 바이오, 가입일, 총 일기 수)
- [ ] R-F04 설정 페이지 (알림 시간, 데이터 내보내기, 계정 탈퇴)
- [ ] R-F05 브라우저 푸시 알림 설정 UI

**QA**
- [ ] R-QA01 연속 3일 기록 후 스트릭 3 표시 확인
- [ ] R-QA02 하루 빠진 후 스트릭 리셋 확인
- [ ] R-QA03 주간 트렌드 그래프 데이터 정확도 확인
- [ ] R-QA04 CSV 내보내기 파일 형식 및 데이터 정합성 확인

---

## 공통: 법적 문서 (출시 전 필수)

- [ ] 개인정보 처리 방침 작성 및 법률 검토
- [ ] 서비스 이용약관 작성 및 법률 검토
- [ ] 쿠키 정책 작성
- [ ] 회원가입 시 약관 동의 UI 적용
- [ ] 만 14세 미만 가입 제한 문구 추가

---

## 진행 상황 추적

| Phase | 상태 | 완료율 | 비고 |
|-------|------|--------|------|
| Phase 5+6 | 준비 중 | 0% | 스키마 확정 대기 |
| Phase 7 | 대기 | - | Phase 5+6 완료 후 |
| Phase 8 | 대기 | - | Phase 7 완료 후 |

---

**마지막 업데이트**: 2026-03-05
**업데이트 책임**: PM + 각 담당자 (완료 시 직접 체크)
