# 프로젝트 로드맵

## 비전

**AI 공감 다이어리(Sentimind)**는 사용자의 감정 일기를 Google Gemini AI가 분석하고, 공감과 위로 메시지로 응답하는 서비스입니다.

**최종 목표**: 사용자가 자신의 감정을 기록하고, AI 조언을 받고, 감정 패턴을 추적하며, 커뮤니티와 공유하는 플랫폼 구축.

---

## 완료된 Phase

### ✅ Phase 1-3: 온톨로지 백엔드 통합 (2026-01 ~ 2026-02)

**완료 사항**
- Gemini 2.5 Flash API 연동
- OntologyEngine 클래스 구현 (3단계 감정 분류)
- situation_ontology (5개 도메인) 추가
- /api/stats 엔드포인트 (통계 조회)

**산출물**
- emotion-ontology.json (3단계 계층)
- situation-ontology.json (5개 도메인)
- OntologyEngine 클래스

**기술 스택**
- Node.js + Express
- Google Gemini API
- JSON 파일 기반 데이터 저장

---

### ✅ Phase 4: UI/UX 개선 (2026-02-15 ~ 2026-03-05)

**완료 사항**
- 응답 카드 UI 개선 (감정 계층, 신뢰도, 이모지)
- 통계 대시보드 (탭 네비게이션, CSS 차트)
- 히스토리 필터/검색 (실시간 텍스트 검색)
- 접근성 개선 (ARIA, 키보드 네비게이션)

**산출물**
- 개선된 index.html (CSS/JS 인라인)
- 반응형 디자인 (모바일 최적화)
- 통계 대시보드 페이지

**기술 스택**
- 단일 HTML 페이지
- CSS Grid/Flexbox
- JavaScript (Vanilla, 프레임워크 무)

---

## 진행 중: Phase 5 (2026-03-05 ~ 2026-03-26)

### 🔄 Supabase 백엔드 마이그레이션

**목표**: JSON → PostgreSQL 전환
**기간**: 2-3주
**팀**: 4명

**진행 항목**
- [ ] Supabase 프로젝트 설정
- [ ] 데이터베이스 스키마 생성
- [ ] RLS 정책 설정
- [ ] server.js Supabase 연동
- [ ] 데이터 마이그레이션
- [ ] 로컬/클라우드 테스트
- [ ] 모니터링 설정
- [ ] 문서화

**기술 스택**
- Supabase PostgreSQL
- @supabase/supabase-js
- Hybrid JSON/SQL 아키텍처

**산출물**
- Supabase 프로젝트
- PostgreSQL 스키마 (entries, ontologies)
- 마이그레이션 스크립트
- 문서 (DATABASE.md, DEPLOYMENT.md)

더 자세한 내용: [plans/PHASE5.md](PHASE5.md)

---

## 계획된 Phase (향후 3개월)

### Phase 6: 사용자 인증 (2026-03-26 ~ 2026-04-09, 2주)

**목표**: 사용자 계정 시스템 구축

**기능**
- [ ] Supabase Auth 연동
- [ ] 회원가입 (이메일 인증)
- [ ] 로그인/로그아웃
- [ ] 사용자별 데이터 격리 (RLS 정책 강화)
- [ ] 계정 관리 페이지

**기술**
- Supabase Auth (JWT)
- Password hashing
- Email verification
- Session management

**우선순위**: 🔴 높음
**복잡도**: ⭐⭐⭐⭐

---

### Phase 7: 실시간 기능 (2026-04-09 ~ 2026-04-16, 1주)

**목표**: 실시간 데이터 동기화

**기능**
- [ ] Supabase Realtime 구독
- [ ] 일기 실시간 동기화
- [ ] 웹소켓 연결
- [ ] 오프라인 모드 (Service Worker)

**기술**
- Supabase Realtime
- WebSocket
- Service Worker (PWA)

**우선순위**: 🟡 중간
**복잡도**: ⭐⭐⭐

---

### Phase 8: AI 고급 기능 (2026-04-16 ~ 2026-04-30, 2주)

**목표**: AI 기반 통계 및 추천

**기능**
- [ ] 감정 트렌드 분석 (주간/월간)
- [ ] 벡터 데이터베이스 (pgvector)
- [ ] 유사 일기 추천 (semantic search)
- [ ] AI 감정 예측 (시계열 분석)
- [ ] 개인화된 조언 (맥락 기반)

**기술**
- pgvector (PostgreSQL 확장)
- Embedding API (OpenAI/Gemini)
- Time-series analysis
- Semantic search

**우선순위**: 🔴 높음
**복잡도**: ⭐⭐⭐⭐⭐

---

### Phase 9: 모바일 앱 (2026-04-30 ~ 2026-05-21, 3주)

**목표**: iOS/Android 네이티브 앱

**기능**
- [ ] React Native 프로젝트 설정
- [ ] 크로스플랫폼 UI (일기 쓰기, 대시보드)
- [ ] 네이티브 알림 (일기 리마인더)
- [ ] 오프라인 캐싱
- [ ] App Store/Google Play 배포

**기술**
- React Native
- Expo
- SQLite (로컬 캐시)
- Push notifications (Firebase)

**우선순위**: 🟡 중간
**복잡도**: ⭐⭐⭐⭐⭐

---

### Phase 10: 소셜 기능 (2026-05-21 ~ 2026-06-04, 2주)

**목표**: 커뮤니티 및 공유 기능

**기능**
- [ ] 친구 추가/관리
- [ ] 일기 공개/비공개 설정
- [ ] 공유 다이어리 (협력 일기)
- [ ] 댓글 및 반응 (emoji reactions)
- [ ] 감정 커뮤니티 (감정별 그룹)

**기술**
- Supabase RLS 정책 (권한 관리)
- Real-time subscriptions
- Notification system
- Social graph (팔로우)

**우선순위**: 🟡 중간
**복잡도**: ⭐⭐⭐⭐

---

## 장기 비전 (6-12개월)

### Phase 11+: 고급 기능 (2026-06 ~)

**가능한 방향**
- **음성 입력**: 음성 → 텍스트 → 감정 분석
- **멀티미디어**: 사진, 비디오 일기
- **음악 추천**: 감정에 맞는 플레이리스트
- **치료사 연동**: 전문가 상담 매칭
- **커뮤니티**: 감정 지도 (전국 감정 분포)
- **웨어러블**: Apple Watch, Fitbit 연동
- **자동 요약**: 주간/월간 감정 보고서
- **다국어 지원**: 한국어, 영어, 일본어

---

## 아키텍처 진화

### Phase 1-4: 단순 구조
```
Browser → Express → Gemini API
               ↓
          JSON 파일
```

### Phase 5: 클라우드 DB
```
Browser → Express → Gemini API
               ↓
          Supabase PostgreSQL
```

### Phase 6-7: 사용자 중심
```
Browser ←→ Express ←→ Gemini API
  ↓           ↓
Auth      Supabase + Realtime
```

### Phase 8+: AI 중심
```
Browser ←→ Express ←→ Gemini API
  ↓           ↓           ↓
Auth    Supabase + pgvector + Embedding API
        + Realtime + Vector Search
```

---

## 마일스톤

| 마일스톤 | 날짜 | Phase | 상태 |
|---------|------|-------|------|
| MVP 완성 | 2026-03-05 | 1-4 | ✅ 완료 |
| 클라우드 DB | 2026-03-26 | 5 | 🔄 진행 중 |
| 사용자 계정 | 2026-04-09 | 6 | 📅 예정 |
| 실시간 기능 | 2026-04-16 | 7 | 📅 예정 |
| AI 고급 기능 | 2026-04-30 | 8 | 📅 예정 |
| 모바일 앱 | 2026-05-21 | 9 | 📅 예정 |
| 소셜 기능 | 2026-06-04 | 10 | 📅 예정 |
| Beta 오픈 | 2026-07-01 | 11+ | 📅 예정 |

---

## 리소스 계획

### 팀 구성

| 역할 | 인원 | 기간 | 예상 비용 |
|------|------|------|---------|
| Backend Developer | 2 | 6개월 | $60k |
| Frontend Developer | 1 | 4개월 | $30k |
| DB Architect | 0.5 | 3개월 | $15k |
| QA Engineer | 1 | 6개월 | $30k |
| Product Manager | 0.5 | 6개월 | $15k |
| **합계** | **4.5** | **6개월** | **$150k** |

### 인프라 비용 (월)

| 서비스 | 요금 | 비고 |
|--------|------|------|
| Supabase Pro | $25 | PostgreSQL, Auth, Realtime |
| Vercel Pro | $20 | Serverless functions, Analytics |
| Google Gemini API | ~$10 | 일일 100건 기준 |
| **합계** | **~$55/월** | **연간 $660** |

---

## 성공 지표

### 사용자
- [ ] 월간 활성 사용자 (MAU) 1,000명
- [ ] 일평균 새로운 일기 100건
- [ ] 사용자 만족도 4.5/5 별

### 기술
- [ ] API 가용성 99.9%
- [ ] 응답 시간 <100ms
- [ ] 자동 테스트 커버리지 80%+

### 비즈니스
- [ ] 월간 반복 사용자 (DAU/MAU) 40%+
- [ ] 사용자 유지율 (30일) 60%+
- [ ] NPS (순 추천 지수) > 50

---

## 문서 링크

### 기술 문서
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) - 시스템 아키텍처
- [docs/DATABASE.md](../docs/DATABASE.md) - 데이터베이스 스키마
- [docs/API.md](../docs/API.md) - API 엔드포인트
- [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) - 배포 가이드

### 개발 가이드
- [guides/SETUP.md](../guides/SETUP.md) - 로컬 환경 설정
- [guides/TEAM_WORKFLOW.md](../guides/TEAM_WORKFLOW.md) - 팀 협업
- [guides/TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md) - 문제 해결
- [guides/COMMIT_CONVENTION.md](../guides/COMMIT_CONVENTION.md) - 커밋 컨벤션

### 계획 문서
- [plans/PHASE5.md](PHASE5.md) - Phase 5 상세 계획
- [CLAUDE.md](../CLAUDE.md) - 개발 원칙
- [TEAM_GUIDE.md](../TEAM_GUIDE.md) - 팀 가이드

---

## 피드백 및 개선

이 로드맵은 **살아있는 문서**입니다.

**업데이트 주기**: 주 1회 (매주 금요일)
**소유자**: Product Manager
**승인**: 팀 리드

변경사항은 GitHub Issues로 제안하고 팀원과 논의합니다.

---

**마지막 업데이트**: 2026-03-05
**다음 검토**: 2026-03-12
