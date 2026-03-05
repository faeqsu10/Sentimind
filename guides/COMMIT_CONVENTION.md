# Git 커밋 메시지 컨벤션

## 개요

Sentimind 프로젝트는 **Conventional Commits** 스타일을 따릅니다.

- **언어**: 타입은 영어, 설명은 한국어
- **형식**: `<type>(<scope>): <description>`
- **목표**: 자동 버전 관리, 히스토리 추적, 팀 협업 용이

---

## 메시지 형식

### 기본 구조

```
<타입>(<범위>): <한국어 설명>

<본문 - 선택적>

<꼬리말 - 선택적>
```

### 제목 (첫 번째 줄)

- **최대 길이**: 한글 35자 이내 (약 50자)
- **마침표 금지**: `.` 없음
- **이모지 금지**: 😊 같은 이모지 미사용
- **대문자 금지**: 소문자로 시작 (`Feat` ❌ → `feat` ✅)

**좋은 예시**
```
feat(api): /api/stats 엔드포인트 추가
fix(db): Supabase 연결 타임아웃 해결
docs: README 작성
```

**나쁜 예시**
```
Feat(API): /api/stats 엔드포인트를 추가한다.  // 대문자, 마침표, 41자 초과
Update stuff                                    // 타입 없음, 모호함
😊 기분 좋은 일 일어남                        // 이모지, 타입 없음
```

---

## 타입 목록

| 타입 | 설명 | 예시 |
|------|------|------|
| **feat** | 새로운 기능 추가 | `feat(api): 일기 검색 기능 추가` |
| **fix** | 버그 수정 | `fix(parser): Gemini JSON 파싱 오류 해결` |
| **docs** | 문서만 변경 | `docs: API 레퍼런스 작성` |
| **style** | 코드 스타일 (기능 무관) | `style: 들여쓰기 4칸으로 통일` |
| **refactor** | 코드 구조 개선 (기능 무관) | `refactor(api): 엔드포인트 분리` |
| **test** | 테스트 추가/수정 | `test: API 엔드포인트 테스트 작성` |
| **chore** | 빌드, 의존성, 설정 변경 | `chore: npm 패키지 업데이트` |
| **data** | 온톨로지, JSON 스키마 | `data: 감정 분류 온톨로지 추가` |
| **infra** | Supabase, 환경 설정 | `infra: Supabase 테이블 생성` |
| **phase** | Phase 시작/완료, 마일스톤 | `phase: Phase 5 개발 시작` |

### 타입 선택 가이드

**언제 어떤 타입을 쓸까?**

```javascript
// feat: 새로운 기능
feat(api): 감정별 필터링 엔드포인트 추가

// fix: 버그 수정
fix(api): 감정 분석 시 null 오류 해결

// refactor: 기능 동일, 구조만 개선
refactor(api): handleAnalyze 함수 분리

// style: 띄어쓰기, 포맷만 변경
style: 함수명 camelCase로 통일

// docs: 문서만 작성
docs: Supabase 설정 가이드 추가

// test: 테스트만 추가
test: API 엔드포인트 테스트 100% 커버

// chore: 빌드, 패키지, 설정
chore: Express 5.0으로 업그레이드

// data: 데이터 스키마, 온톨로지
data: 감정 온톨로지에 신뢰도 필드 추가

// infra: 서버 설정, DB 마이그레이션
infra: Supabase entries 테이블 생성

// phase: Phase 변경, 마일스톤
phase: Phase 5 시작 - Supabase 마이그레이션
```

---

## Scope (범위)

### 허용된 Scope

선택사항이지만, 권장 목록:

| Scope | 의미 |
|-------|------|
| `api` | REST API 엔드포인트 |
| `server` | Express 서버 설정, 미들웨어 |
| `frontend` | HTML, CSS, JavaScript |
| `data` | 온톨로지, JSON 파일 |
| `db` | 데이터베이스 쿼리, 스키마 |
| `auth` | 인증/인가 (향후) |
| `config` | 환경 변수, 설정 파일 |
| `ci` | GitHub Actions, 배포 설정 |

### Scope 사용 예

```
feat(api): /api/stats 엔드포인트 추가
fix(db): Supabase 연결 오류 해결
refactor(server): 미들웨어 구조 개선
docs(config): 환경 변수 설정 가이드
```

### Scope 없는 경우

전체 프로젝트에 영향을 미칠 때:

```
feat: 프로젝트 초기화
docs: README 작성
style: 코드 포맷 통일
```

---

## 본문 (Body)

선택사항이지만, **다음 경우에는 필수**:

1. **Breaking Change가 있을 때** (무조건)
2. **복잡한 설계 결정이 있을 때**
3. **Phase 시작/완료 시**

### 본문 작성 기준

```
<제목>

<빈 줄>

<본문: 무엇이 변경되었고, 왜 이렇게 했는지>
```

### 본문 예시

```
feat(db): Supabase 마이그레이션 시작

이제부터 PostgreSQL을 기본 데이터베이스로 사용합니다.
기존 entries.json은 로컬 개발에서만 폴백으로 사용됩니다.

이유:
- 클라우드 배포 시 영구 저장소 필요
- 다중 인스턴스 환경에서 데이터 동기화
- RLS 정책으로 보안 강화

마이그레이션:
- 기존 entries.json → Supabase entries 테이블로 데이터 이전
- 온톨로지 데이터도 함께 마이그레이션
- 향후 JSON 파일은 로컬 백업으로만 유지
```

### Breaking Change

Breaking Change가 있으면 제목이나 본문에 명시:

```
feat(db)!: entries 테이블 스키마 변경

BREAKING CHANGE: created_at 컬럼이 required에서 nullable로 변경됩니다.
기존 쿼리에서 NULL 체크가 필요합니다.

마이그레이션:
ALTER TABLE entries MODIFY COLUMN created_at TIMESTAMP NULL;
```

또는 제목에 `!` 추가:

```
feat(db)!: entries 테이블 필드명 변경

user_id → user_uuid로 변경되었습니다.
```

---

## 꼬리말 (Footer)

선택사항. GitHub 이슈 자동 종료:

```
fix(api): 감정 분석 오류 해결

null 체크를 추가했습니다.

Closes #42
```

### 인정 (Closes, Fixes, Resolves)

```
Closes #42            // 이슈 #42를 종료
Fixes #42             // 버그 #42를 수정
Resolves #42          // 질문 #42를 해결

# 여러 이슈
Closes #42, #43, #44
```

---

## 실제 예시

### 좋은 커밋 메시지

```
1️⃣ 단순 기능 추가
feat(api): /api/stats 엔드포인트 추가

---

2️⃣ 버그 수정
fix(parser): Gemini 응답 JSON 파싱 오류 해결

마크다운 코드블록이 포함된 응답을 처리하도록 수정했습니다.

---

3️⃣ 마이그레이션 (Breaking Change)
infra(db): Supabase 테이블 생성

emotion_ontology, situation_ontology, entries 테이블을 생성하고
RLS 정책을 설정했습니다.

데이터 마이그레이션 스크립트:
node scripts/migrate-to-supabase.js

---

4️⃣ 여러 파일 변경
feat(api,server): 요청 로깅 시스템 추가

- Logger 클래스 생성
- 모든 API 엔드포인트에 로깅 추가
- 로그 파일 자동 생성 (logs/app-YYYY-MM-DD.log)

Closes #15

---

5️⃣ 단순 문서
docs: API 엔드포인트 참조 추가
```

### 나쁜 커밋 메시지

```
❌ "버그 수정"                                    // 타입 없음, 모호함
❌ "Fix stuff"                                    // 타입 있지만 설명 불명확
❌ "feat: Fixed an issue with the API"           // 혼용 언어 + 동사 사용
❌ "feat(API): /api/analyze 엔드포인트 추가해."  // scope 대문자, 마침표
❌ "😊 기쁜 마음으로 리팩토링 완료"             // 이모지, 타입 없음
```

---

## 커밋 워크플로우

### 로컬 개발

```bash
# 1. 브랜치 생성
git checkout -b feature/new-api develop

# 2. 코드 수정
# ... 파일 편집 ...

# 3. 변경사항 스테이징
git add .

# 4. 커밋 메시지 작성 (에디터 열림)
git commit

# 에디터에서:
# feat(api): 새로운 엔드포인트 추가
#
# 사용자 검색 기능을 추가했습니다.

# 5. 푸시
git push origin feature/new-api

# 6. PR 생성 (GitHub)
```

### 커밋 메시지 에디터

```bash
# 기본 에디터 설정
git config --global core.editor "nano"

# 또는 VS Code
git config --global core.editor "code --wait"

# 한 줄로 커밋 (에디터 생략)
git commit -m "feat(api): 새로운 엔드포인트 추가"

# 본문 포함 (에디터 열림)
git commit  # 추천
```

### 커밋 수정

```bash
# 마지막 커밋 메시지 수정
git commit --amend

# 푸시 전이면 간단하지만
# 푸시 후에는 force push 필요 (팀원과 협의 후)
git push --force-with-lease
```

---

## 자동화

### GitHub Actions (향후)

```yaml
# .github/workflows/commit-check.yml
name: Commit Message Lint
on: [pull_request]
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: wagoid/commitlint-github-action@v5
```

### 커밋 메시지 템플릿

```bash
# .gitmessage 파일 생성
cat > .gitmessage << 'EOF'
# <타입>(<범위>): <한국어 설명 35자 이내>
#
# <본문 - 선택적, 무엇이 변경되었고 왜인지>
#
# <꼬리말 - Closes #42>

# 타입: feat, fix, docs, style, refactor, test, chore, data, infra, phase
# 범위: api, server, frontend, data, db, auth, config, ci
EOF

# 전역 설정
git config --global commit.template ~/.gitmessage
```

---

## 팀 규칙

### PR 머지 전 체크리스트

- [ ] 커밋 메시지가 규칙을 따르는가?
- [ ] 타입이 적절한가? (feat, fix, refactor 등)
- [ ] 설명이 명확한가?
- [ ] 본문이 필요한 경우 포함되었는가?

### 리뷰 의견

"커밋 메시지를 규칙에 맞게 수정해주세요"

```markdown
이 PR의 커밋 메시지가 컨벤션을 따르지 않습니다:

현재: "Fix API issue"
제안: "fix(api): 감정 분석 JSON 파싱 오류 해결"

이유:
- 타입이 있어야 함 (fix)
- 범위 명시 (api)
- 한국어로 설명 (명확성)
```

---

## 참고 자료

- **Conventional Commits**: https://www.conventionalcommits.org/ko/
- **GitHub Docs**: https://github.com/conventional-changelog/conventional-changelog
- **Angular 스타일**: https://angular.io/guide/styleguide#commit-message-guidelines

---

**마지막 업데이트**: 2026-03-05
