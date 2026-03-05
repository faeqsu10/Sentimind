# 팀 협업 가이드

## 팀 구성

- **Backend Developer (2명)**: server.js, API 엔드포인트, 온톨로지 엔진
- **DB Architect (0.5명)**: Supabase 스키마, 마이그레이션, 최적화
- **QA Engineer (1명)**: 테스트, 버그 리포팅, 배포 검증
- **Product Manager (0.5명)**: 기획, 우선순위 결정, 문서화

**총 인력**: 4명 (4.5명-day)
**기간**: 2-3주 (12-15일)

---

## 개발 워크플로우

### 1. 브랜치 관리

**브랜치 규칙**

| 브랜치 | 용도 | 기반 | 배포 |
|--------|------|------|------|
| `main` | 프로덕션 | - | ✅ Vercel 자동 |
| `develop` | 개발 통합 | main | ❌ |
| `feature/*` | 기능 개발 | develop | ❌ |
| `bugfix/*` | 버그 수정 | develop | ❌ |
| `hotfix/*` | 긴급 수정 | main | ✅ Vercel 자동 |

**생성 및 체크아웃**

```bash
# feature 브랜치 생성
git checkout -b feature/supabase-migration develop

# 작업 완료 후 푸시
git push origin feature/supabase-migration

# PR 생성: GitHub → feature/supabase-migration → develop
```

### 2. 커밋 메시지 컨벤션

**형식**
```
<타입>(<범위>): <한국어 설명>

<본문 - 선택적>

<꼬리말 - 선택적>
```

**예시**

```
feat(db): Supabase 마이그레이션 시작

- entries 테이블 생성
- emotion_ontology 초기화
- RLS 정책 설정

Closes #42
```

**타입 목록**

| 타입 | 용도 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 | `feat(api): /api/stats 엔드포인트 추가` |
| `fix` | 버그 수정 | `fix(api): 감정 분석 JSON 파싱 오류 해결` |
| `docs` | 문서만 변경 | `docs: API 레퍼런스 추가` |
| `style` | 코드 포맷/스타일 | `style: 들여쓰기 수정` |
| `refactor` | 리팩토링 | `refactor(api): 엔드포인트 구조 개선` |
| `test` | 테스트 | `test: API 엔드포인트 테스트 추가` |
| `chore` | 빌드, 설정, 패키지 | `chore: npm 패키지 업데이트` |
| `data` | 온톨로지, JSON 스키마 | `data: 감정 온톨로지 추가` |
| `infra` | Supabase, 환경 설정 | `infra: Supabase 테이블 생성` |
| `phase` | Phase 전환 | `phase: Phase 5 시작` |

**Scope 선택 (선택사항)**
- `api`, `server`, `frontend`, `data`, `db`, `auth`, `config`, `ci`

**본문 작성 기준**
- ✅ Breaking Change가 있을 때 (필수)
- ✅ 복잡한 설계 결정이 있을 때 (필수)
- ✅ Phase 시작/완료 (필수)
- ❌ 단순 기능 추가 (생략 가능)
- ❌ 명확한 제목 (생략 가능)

더 자세한 내용: [CLAUDE.md - Git Commit Convention](../CLAUDE.md)

### 3. Pull Request 프로세스

#### 3-1. PR 생성

```bash
# 1. feature 브랜치에서 작업
git add .
git commit -m "feat(db): Supabase 마이그레이션"

# 2. 원격 저장소에 푸시
git push origin feature/supabase-migration

# 3. GitHub에서 PR 생성
# 제목: feat(db): Supabase 마이그레이션
# 본문: 무엇이 변경되었는지, 왜 필요한지 설명
```

#### 3-2. PR 체크리스트

PR 템플릿 (`.github/pull_request_template.md`):

```markdown
## 설명
[무엇을 변경했는지 간단히 설명]

## 타입
- [ ] feat (새로운 기능)
- [ ] fix (버그 수정)
- [ ] docs (문서)
- [ ] refactor (리팩토링)
- [ ] chore (설정/빌드)

## 테스트 완료
- [ ] 로컬에서 테스트 완료
- [ ] API 엔드포인트 동작 확인
- [ ] Supabase 쿼리 실행 확인

## 체크리스트
- [ ] 커밋 메시지 컨벤션 준수
- [ ] 코드 리뷰 요청
- [ ] 문서 업데이트
- [ ] 로그 확인

Closes #[issue number]
```

#### 3-3. PR 리뷰

**리뷰어 역할**
1. 코드 품질 확인
2. 테스트 완료 확인
3. 아키텍처 일관성 확인
4. 피드백 제공

**승인 및 병합**
```bash
# PR이 승인되면 "Squash and merge" 또는 "Create a merge commit"
# 기본: Create a merge commit (히스토리 유지)
```

---

## 이슈 추적

### 이슈 생성

GitHub Issues → New issue

**이슈 템플릿**

```markdown
### 설명
[버그, 기능 요청, 논의 등의 설명]

### 우선순위
- [ ] Critical (즉시 해결)
- [ ] High (이번 주)
- [ ] Medium (이번 달)
- [ ] Low (Backlog)

### 할당
[담당자 선택]

### 라벨
[bug, feature, documentation, question]

### 관련 PR
[PR 링크]
```

### 이슈 링크

PR에서 이슈 자동 종료:

```
Closes #42
Fixes #42
Resolves #42
```

---

## 코드 리뷰 기준

### 체크리스트

- [ ] 코드가 명확하고 이해하기 쉬운가?
- [ ] 변수/함수명이 의도를 반영하는가?
- [ ] 에러 처리가 적절한가?
- [ ] 보안 취약점은 없는가? (SQL injection, XSS 등)
- [ ] 성능 이슈는 없는가?
- [ ] 테스트는 작성되었는가?
- [ ] 문서는 업데이트되었는가?

### 리뷰 예시

```markdown
### 좋은 피드백
"이 함수는 동시성을 고려해야 합니다.
entries 배열이 여러 요청에서 동시에 수정될 수 있으므로
write lock을 추가하는 게 좋겠습니다."

### 피해야 할 피드백
"이건 안 돼"
"이렇게 하지 마"
```

---

## 의사소통

### 채널

| 채널 | 용도 | 예시 |
|------|------|------|
| GitHub Issues | 작업 추적 | 기능 개발, 버그 리포팅 |
| GitHub PR | 코드 리뷰 | 승인, 피드백 |
| GitHub Discussions | 설계 논의 | 아키텍처, 기술 결정 |

### 데일리 스탠드업

**시간**: 매일 10:00 AM
**형식**: 15분 (비동기 가능)

```markdown
### ✅ 완료
- [ ] Supabase 테이블 생성
- [ ] RLS 정책 설정

### 🔄 진행 중
- [ ] 마이그레이션 스크립트 작성

### 🚧 막힘
- [ ] Node 버전 호환성 문제
  → 해결책: Node 20으로 업그레이드
```

### 주간 리뷰

**시간**: 매주 금요일 16:00
**내용**:
1. 주간 완료 작업
2. 다음 주 계획
3. 기술 이슈 논의

---

## 배포 프로세스

### 테스트 체크리스트

배포 전 필수 확인:

- [ ] 로컬 `npm run dev` 정상 작동
- [ ] API 엔드포인트 테스트 (`test.http`)
- [ ] Supabase 데이터 저장 확인
- [ ] 로그 에러 확인 (`logs/app-*.log`)
- [ ] PR 리뷰 승인 완료

### 배포 단계

```bash
# 1. main 브랜치 기반 hotfix 또는 develop 병합
git checkout main
git pull origin main

# 2. PR 병합 (GitHub UI)
# feature/supabase-migration → develop
# develop → main (주간 또는 필요시)

# 3. 태그 생성 (선택)
git tag -a v1.1.0 -m "Phase 5 배포"
git push origin v1.1.0

# 4. Vercel 자동 배포
# main 푸시 후 자동으로 배포됨
# https://vercel.com/dashboard에서 배포 상태 확인
```

### 배포 후 확인

```bash
# Vercel 로그 확인
vercel logs https://sentimind-delta.vercel.app

# 프로덕션 API 테스트
curl https://sentimind-delta.vercel.app/api/entries

# 데이터 동기화 확인
curl https://sentimind-delta.vercel.app/api/stats
```

---

## 문서화 규칙

### 생성/수정 시

1. **변경 내용에 따른 문서 업데이트**
   - API 추가 → `docs/API.md` 업데이트
   - 스키마 변경 → `docs/DATABASE.md` 업데이트
   - 아키텍처 변경 → `docs/ARCHITECTURE.md` 업데이트

2. **문서 품질**
   - 한국어 작성
   - 코드 예시 포함
   - 마지막 업데이트 날짜 기록

3. **파일 위치**
   - 기술 가이드: `docs/`
   - 개발 가이드: `guides/`
   - 프로젝트 계획: `plans/`
   - 개발 작업: `tasks/`

---

## 트러블슈팅

문제 발생 시 대응 순서:

1. **로컬에서 재현** (`npm run dev`)
2. **로그 확인** (`logs/app-*.log` 또는 콘솔)
3. **Git 히스토리 확인** (`git log --oneline`)
4. **이슈 생성** (GitHub Issues)
5. **팀원 협의** (GitHub Discussions)
6. **코드 리뷰** (PR)

더 자세한 내용: [guides/TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**마지막 업데이트**: 2026-03-05
