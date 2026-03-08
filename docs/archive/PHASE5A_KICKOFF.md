# Phase 5-A Kickoff 문서
## Landing Page + Guest Mode (UX 개선)

**작성일**: 2026-03-06
**팀 미팅**: 오늘 오후
**프로젝트 명**: Sentimind (AI 공감 다이어리)

---

## 🎯 미션 (왜 하는가?)

### 3가지 핵심 문제
1. **신규 사용자 이탈**: 로그인이 강제되어 서비스 가치를 못 느낌
2. **오프라인 알림 혼동**: 불필요한 경고로 사용자 경험 저하
3. **가치 미전달**: 첫 화면이 로그인 폼뿐이라 매력 없음

### 목표 (성과)
- 🎯 Landing 이탈률 70% → 30% (40% 개선)
- 🎯 Guest → Member 전환율 0% → 30%
- 🎯 평균 체험 시간 0분 → 3분

---

## 📋 무엇을 할 것인가? (범위)

### 5가지 기능 (F1-F5)

#### 🟢 P0 (필수) — 신규 사용자 경험의 핵심
1. **F1. Landing Page** (신규)
   - Hero 섹션 + 3개 기능 카드 + FAQ
   - 스크린샷/영상 + 평가 + Footer
   - CTA: [무료로 시작하기]

2. **F2. Guest Mode** (신규)
   - 로그인 없이 3분 내 체험
   - 샘플 일기 3개 + 직접 작성
   - AI 분석 + localStorage 저장 (최대 10개)

#### 🟠 P1 (권장) — 사용성 개선
3. **F3. 오프라인 알림 개선**
   - 게스트: 알림 없음 (로컬만)
   - 멤버: "저장 중..." → "✅ 저장 완료"

4. **F5. CTA 최적화**
   - "이 일기를 저장할래요?" 모달
   - 자연스러운 회원가입 유도

#### 🟡 P2 (보완) — 데이터 일관성
5. **F4. Guest → Member 마이그레이션**
   - 회원가입 후 자동 클라우드 저장
   - 데이터 손실 없음
   - POST /api/entries/import (신규 API)

---

## 🗓️ 언제? (일정)

### 8일 (1.6주)
```
📅 D1-D2: F1 Landing Page (FE 1명)
📅 D3-D4: F2 Guest Mode (FE 1명 + BE 1명)
📅 D5: F3, F5 개선 (FE 1명)
📅 D6-D7: F4 마이그레이션 (FE 1명 + BE 1명)
📅 D8: QA + 회귀 테스트
📅 D9: Staging 배포 + 피드백 수집
📅 D10: Production 배포
```

---

## 👥 누가? (팀)

| 역할 | 명수 | 주요 작업 |
|------|------|----------|
| **Frontend Developer** | 2 | Landing, Guest UI, CTA 모달 |
| **Backend Developer** | 1 | /api/entries/import, 마이그레이션 로직 |
| **QA Engineer** | 1 | 회귀 테스트, 크로스 브라우저 |
| **PM/Designer** | 1 | 와이어프레임, 색상/폰트, 피드백 |

---

## 📊 우선순위 & 위험도

```
우선순위        위험도
P0 (필수)      낮음 — F1, F2 (명확함)
P1 (권장)      낮음 — F3, F5 (UI만)
P2 (보완)      중간 — F4 (데이터, 복잡도 높음)
```

---

## 💻 기술 스택 (변화 없음)

### Frontend
- **언어**: JavaScript (인라인, index.html)
- **CSS**: Gowun Batang/Dodum (기존)
- **저장소**: localStorage (게스트)

### Backend
- **서버**: Node.js + Express
- **DB**: Supabase (PostgreSQL)
- **API**: /api/auth/*, /api/entries/*, /api/analyze
- **신규**: POST /api/entries/import (50줄)

---

## 📈 성공 기준

### 비즈니스
- ✅ Landing 이탈률 < 40%
- ✅ Guest 체험 완료율 > 70%
- ✅ Guest → Member 전환율 > 30%
- ✅ 마이그레이션 성공율 > 95%

### 기술
- ✅ 회귀 테스트 100% 통과
- ✅ 모바일 응답 < 1초
- ✅ Lighthouse > 85 (Performance)
- ✅ 에러 로그 < 1%

### 사용자
- ✅ "서비스를 이해했다" > 80%
- ✅ NPS > 40 (만족도)

---

## 📚 문서 (3개)

1. **REQUIREMENTS.md** (7,000줄)
   - 5개 User Story + 수용 기준
   - 기술 제약사항 3개
   - 데이터 흐름 다이어그램
   - 회귀 테스트 체크리스트

2. **TECH_SPEC.md** (1,000줄)
   - Frontend 기술 스펙 (HTML/CSS/JS)
   - Backend API 스펙
   - 통합 시나리오
   - 테스트 케이스 (단위/통합/E2E)

3. **UX_IMPROVEMENT_PLAN.md** (500줄)
   - 요약 버전 (경영진용)
   - 사용자 여정 (다이어그램)
   - 우선순위 매트릭스

---

## 🚨 주의사항 (제약)

### T1. 단일 HTML 파일
- ✅ CSS/JS 인라인 추가 가능
- ❌ 새 파일 생성 불가
- **영향**: HTML 700-1000줄 증가

### T2. Backend 최소 변경
- ✅ 신규 API: POST /api/entries/import (50줄)
- ✅ 기존 API 유지
- ❌ 스키마 변경 금지
- **영향**: server.js 50줄 추가

### T3. 회귀 방지
- ✅ 로그인/회원가입 정상
- ✅ 데이터 저장/조회 정상
- ✅ 반응형 유지
- **테스트**: 20+ 회귀 테스트

---

## 🔍 검증 체크리스트

### Before Development
- [ ] 와이어프레임 확정 (디자인 팀)
- [ ] 색상/폰트 확정
- [ ] API 스펙 승인 (백엔드)
- [ ] 테스트 전략 확인

### During Development (Daily)
- [ ] Daily standup (10분)
- [ ] Slack #sentimind 채널 업데이트
- [ ] 회귀 테스트 진행 상황 공유

### Before Production
- [ ] 회귀 테스트 100% 통과
- [ ] Code Review 완료
- [ ] Staging 배포 + 1시간 모니터링
- [ ] 사용자 피드백 수집

### After Production
- [ ] 첫 24시간 모니터링
- [ ] 에러 로그 분석
- [ ] 사용자 피드백 정리
- [ ] Post-launch 회의 (D11)

---

## 🎁 주요 개선사항

### Before (현재)
```
사용자 방문 → 로그인 폼 → "뭐야?" → 바운스
```

### After (Phase 5-A)
```
사용자 방문
  ↓
Landing Page (서비스 설명, 3분)
  ├─ Hero + 기능 카드
  ├─ FAQ + 평가
  └─ CTA: [무료로 시작하기] 또는 [알아보기]
  ↓
Demo (무로그인 체험, 3분)
  ├─ 샘플 일기 또는 직접 작성
  ├─ AI 분석 + 공감 응답
  └─ [이 기능을 계속 쓸래요?]
  ↓
회원가입 (자연스러운 전환)
  ├─ "클라우드에 저장하시겠어요?"
  └─ 마이그레이션 (자동)
  ↓
App (멤버 사용)
  └─ 데이터 클라우드 동기화
```

---

## 📞 연락처 & 리소스

### Slack 채널
- **#sentimind**: 프로젝트 논의
- **#sentimind-design**: 디자인 피드백
- **#sentimind-qa**: QA 테스트

### 문서
- 📄 [REQUIREMENTS.md](./REQUIREMENTS.md)
- 📄 [TECH_SPEC.md](./TECH_SPEC.md)
- 📄 [UX_IMPROVEMENT_PLAN.md](./UX_IMPROVEMENT_PLAN.md)
- 📄 [CLAUDE.md](./CLAUDE.md) (커밋 컨벤션)

### GitHub
- 🔗 [Repository](https://github.com/faeqsu10/Sentimind)
- 🔗 [Issues](https://github.com/faeqsu10/Sentimind/issues)
- 🔗 [Discussions](https://github.com/faeqsu10/Sentimind/discussions)

---

## 🎓 학습 포인트

### 이 Phase에서 배우는 것
1. **UX 설계**: Landing → Demo → Signup 전환 경로
2. **상태 관리**: 게스트 vs 멤버 모드 분리
3. **데이터 마이그레이션**: localStorage → Supabase
4. **사용자 심리**: 강제 아닌 자연스러운 CTA
5. **오프라인 처리**: 명확한 상태 표시

---

## ✅ 다음 단계 (오늘)

1. **이 문서 읽기** (30분)
   - 모든 팀원이 목표 이해

2. **팀 미팅** (30분)
   - 질문/우려사항 논의
   - 역할 분담 확정

3. **와이어프레임 작업** (PM/Designer)
   - Landing 레이아웃 확정
   - 색상/폰트 최종 결정

4. **개발 환경 준비** (개발팀)
   - 로컬 브랜치 생성
   - 첫 커밋 준비

---

## 📋 커밋 컨벤션 (중요!)

모든 커밋은 다음 형식으로:
```
<타입>(<범위>): <한국어 설명>
```

**예시**:
```
feat(frontend): Landing Page 구현
feat(frontend): Guest Mode UI 추가
feat(api): 일기 마이그레이션 엔드포인트 추가
fix(frontend): 오프라인 알림 제거
test(qa): 회귀 테스트 완료
```

👉 자세한 규칙: [CLAUDE.md 커밋 컨벤션](./CLAUDE.md#git-commit-convention)

---

## 🎯 최종 목표

**2026-03-13 (1주일 내)**
- 🎯 Phase 5-A 완료 (Staging 배포)
- 🎯 회귀 테스트 100% 통과
- 🎯 사용자 피드백 수집 (1일)
- 🎯 Production 배포 준비

**2026-03-20 (2주일)**
- 🎯 Phase 5-B 시작 (Supabase 마이그레이션)
- 🎯 Guest Mode 메트릭 분석
- 🎯 회사 블로그 배포 (Landing 소개)

---

## 📝 FAQ

**Q1. 게스트 데이터를 10개 제한한 이유는?**
A: 회원가입을 자연스럽게 유도하기 위해. 너무 많으면 회원가입 동기 약해짐.

**Q2. 마이그레이션에서 데이터가 손실될 가능성은?**
A: 매우 낮음. localStorage 백업 있고, Supabase insert 실패 시 재시도 로직 있음.

**Q3. 모바일과 데스크톱 모두 지원하나?**
A: 네, 반응형 디자인으로 모두 지원. 모바일 우선 개발.

**Q4. 기존 멤버 사용자는 영향받나?**
A: 없음. isGuestMode 상태로 완전히 분리되어 있음.

**Q5. Landing 페이지가 검색 최적화되나?**
A: 네, 제목/설명/og:image 추가 예정. SEO 점검 포함.

---

## 🚀 Let's Go!

**여러분의 목표**:
> 신규 사용자가 Landing에서 3분 내 서비스를 이해하고,
> Demo로 체험한 후, 자연스럽게 회원가입하도록 유도하기.

**성공의 신호**:
- 첫 주: Landing 이탈률 < 40%
- 둘째 주: Guest → Member 전환율 > 30%
- 셋째 주: NPS > 40

---

## 문서 버전

| 버전 | 날짜 | 변경사항 |
|------|------|---------|
| 1.0 | 2026-03-06 | 초안 작성 (5가지 기능, 일정, 팀 구성) |
| 1.1 | 2026-03-06 | FAQ 추가, 성공 기준 상세화 |

**Last Updated**: 2026-03-06 14:00 KST

---

**이 문서는 모든 팀원이 공유해야 합니다.**
**질문이 있으면 Slack #sentimind에 올려주세요.**

🎉 **Phase 5-A를 성공적으로 진행하기를 바랍니다!**

