# Sentimind - 전문가 분석 기반 개선 작업

**프로젝트**: Sentimind - AI 공감 다이어리
**작업 기간**: 2026-03-06
**상태**: 완료

---

## 완료된 작업

### 1. ES Module 파일 분리 (refactor)
- [x] 단일 index.html (7,400줄) -> 16개 파일로 분리
- [x] CSS 4개 파일 (base, layout, components, landing)
- [x] JS 12개 모듈 (app, state, utils, api, auth, guest, diary, history, calendar, stats, profile, sidebar)
- [x] SW 캐시 업데이트, Vercel 빌드 설정
- 커밋: `9b3f816`

### 2. UX Quick Wins + 리텐션 (feat)
- [x] 모바일 스트릭 배너 (7일 dot + 연속 기록일)
- [x] AI 피드백 버튼 (helpful/not_helpful)
- [x] 리텐션 카드 (마일스톤, 감정 다양성, 스트릭, 인사이트)
- [x] 피드백 API (PATCH /entries/:id/feedback)
- 커밋: `66be073`

### 3. 전문가 4인 UX 심층 개선 (feat)
- [x] 행동심리학: 감정별 컨페티/파티클 분화, 분석 상세 접기
- [x] 감성카피: 모든 UI 텍스트 감정적 언어로 변환
- [x] 감정AI: 유사 일기 시간 맥락, 온톨로지 인사이트
- [x] 데이터분석: 25개 이벤트 설계서 (tasks/growth-analytics-design.md)
- 커밋: `d8d7aed`

### 4. 이벤트 트래킹 시스템 (feat)
- [x] public/js/analytics.js — 클라이언트 배치 트래킹 (sendBeacon)
- [x] routes/analytics.js — POST /api/analytics 서버 엔드포인트
- [x] 12개 핵심 이벤트 구현 (ICE 스코어 기반)
- [x] Supabase analytics_events 테이블 + 인덱스
- [x] 문서 동기화 (README, API.md)
- 커밋: `220b73e`, `b293dbc`

### 5. 감정 어휘 성장 트래커 + AI 페르소나 (feat)
- [x] 사이드바: 마음의 스펙트럼 카드 (고유 감정 수 + 컬러 dot)
- [x] 행동심리학 SDT 역량감(Competence) 강화
- [x] AI 페르소나 "마음이" 아이덴티티 (Relatedness)
- 커밋: `a53ece9`

### 6. Supabase 마이그레이션
- [x] 009: user_rating 컬럼 (entries 테이블)
- [x] 010: analytics_events 테이블

---

## 구현된 이벤트 트래킹 (12개)

| 이벤트 | 위치 | 목적 |
|--------|------|------|
| landing_viewed | app.js | 랜딩 방문 측정 |
| landing_cta_clicked | app.js | CTA 전환 측정 |
| auth_form_started | app.js | 인증 폼 진입 |
| signup_completed | auth.js | 회원가입 완료 |
| onboarding_step_viewed | app.js | 온보딩 이탈 측정 |
| app_session_started | app.js | DAU/세션 측정 |
| diary_submitted | diary.js | 일기 제출 (NSM 기반) |
| first_diary_submitted | diary.js | Aha Moment 측정 |
| ai_response_received | diary.js | AI 분석 성공 |
| ai_feedback_submitted | diary.js | AI 품질 평가 |
| ai_analysis_failed | diary.js | 오류 모니터링 |
| tab_switched | app.js | 기능 채택율 |
| signup_modal_shown | guest.js | 게스트 전환 넛지 |

### 7. UI 스타일 개선 (2026-03-07)
- [x] 다크모드, 프로필, 캘린더, 리포트 버튼 보완
- [x] 카드, 탭, 모달, 차트 디자인 전면 개편
- [x] 히스토리 카드 이모지 원형 + 메타 레이아웃 개선
- [x] Pebble 뉴트럴 스톤 색상 체계 적용
- 커밋: `a3de297` ~ `ad89313`

### 8. Google OAuth 소셜 로그인 (2026-03-08)
- [x] 백엔드: GET /api/auth/oauth/:provider 엔드포인트
- [x] 프론트엔드: Google 로그인/회원가입 버튼 + handleGoogleOAuth()
- [x] OAuth 신규 유저 닉네임 자동 반영 트리거 (migration 014)
- 커밋: `fd1df4e`, `740ee9e`

### 9. 통계 RPC JSONB 버그 수정 (2026-03-08)
- [x] get_user_stats_by_period 함수 text→jsonb 타입 에러 수정 (migration 013)
- 커밋: `0a7187d`

### 10. 타임존 버그 수정 (2026-03-08)
- [x] UTC .split('T')[0] → toLocalDateStr() 로컬 날짜 변환
- [x] 프론트엔드 8개 파일 20곳+ 수정 (스트릭, 달력, 통계, 사이드바 등)
- [x] 서버 /api/stats에 tz_offset 파라미터 추가
- 커밋: `7466646`, `a399c40`

### 11. 인증 이벤트 테이블 (2026-03-08)
- [x] auth_events 테이블 생성 (Supabase, RLS 적용)
- [x] 7종 이벤트 자동 기록 (signup, login, logout, oauth, password, delete)
- [x] 아키텍트 리뷰 반영 (INSERT RLS 보안 수정)
- 커밋: `ea02984`, `a399c40`

---

## 향후 고려사항 (미구현)

- [ ] Supabase Redirect URLs에 프로덕션 URL 추가 (Google OAuth 프로덕션 동작)
- [ ] Vercel 환경변수 SITE_URL 설정
- [ ] Push notification 실제 구현 (Retention)
- [ ] AI 응답 톤 커스터마이징 (Autonomy/SDT)
- [ ] A/B 테스트 인프라
- [ ] 나머지 13개 이벤트 (E-03, E-07, E-09, E-15~E-22, E-25)
- [ ] 인증 이벤트 관리자 대시보드
- [ ] 서버 측 스트릭 계산에 클라이언트 타임존 반영 (현재 KST 고정)
