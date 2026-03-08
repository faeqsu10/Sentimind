# 개발 학습 및 실수 기록

**목적**: 반복되는 실수 방지 및 프로젝트 패턴 확립

---

## 1. Vercel 배포 호환성 (2026-03-05)

### 문제
- localhost:3000에서는 작동하지만 Vercel 배포 시 404 오류 발생
- 원인: `vercel.json` 없음 + Express 서버 경로 설정 부재

### 해결책
1. **vercel.json 생성**: 모든 경로를 server.js로 라우팅
   ```json
   {
     "routes": [
       { "src": "/api/(.*)", "dest": "server.js" },
       { "src": "/(.*)", "dest": "server.js" }
     ]
   }
   ```

2. **package.json에 start 스크립트 추가**
   ```json
   "scripts": {
     "start": "node server.js",
     "dev": "node server.js"
   }
   ```

3. **Vercel 파일 시스템 호환성**: `/tmp` 디렉토리 사용
   - Vercel은 애플리케이션 디렉토리가 읽기 전용
   - 쓰기 가능한 `/tmp` 디렉토리로 entries.json 저장
   ```javascript
   const DATA_DIR = process.env.VERCEL ? '/tmp/sentimind-data' : './data';
   ```

### 교훈
- **Next.js/Express.js를 Vercel에 배포할 때마다 필수 체크**:
  - ✓ vercel.json 구성 (라우팅 규칙)
  - ✓ package.json의 start 스크립트
  - ✓ 파일 시스템 경로 (로컬 vs 클라우드)
  - ✓ 환경 변수 설정 (API 키, DB 연결 등)

---

## 2. 커밋 메시지 컨벤션 (2026-03-05)

### 규칙
```
<타입>(<범위>): <한국어 설명>
```

- **타입**: feat, fix, docs, style, refactor, test, chore, data, infra, phase
- **한국어 설명**: 35자 이내, 명령형
- **마침표·이모지**: 금지

### 자동화
- CLAUDE.md에 규칙 명시 → 스킬 생성 (commit-convention)
- Claude Code가 자동으로 규칙 따르도록 설정

### 교훈
- **팀 협업 전에 커밋 규칙 정의**: git 히스토리가 복잡해지기 전에 미리 정책 수립
- **기존 커밋도 정규화**: git filter-branch로 과거 커밋 메시지 통일

---

## 3. 로깅 및 에러 모니터링 (2026-03-05)

### 현재 상태
- 로그 시스템 없음 (console.log만 사용)
- 배포 환경에서 디버깅 어려움

### 구현 계획
1. **로컬 개발**: 파일 기반 로깅 (logs/ 디렉토리)
2. **Vercel 배포**: 콘솔 로그만 사용 (Vercel 모니터링 활용)
3. **로그 레벨**: info, warn, error

### 교훈
- **프로덕션 배포 시 로깅 필수**: 문제 발생 시 히스토리 추적 가능
- **환경별 로그 설정**: 로컬 vs 클라우드 환경 구분

---

## 4. 프로젝트 구조 원칙

### tasks/ 디렉토리 관리
- **tasks/todo.md**: 현재 진행 중인 작업 목록
- **tasks/lessons.md**: 학습 내용 및 실수 기록 (이 파일)
- **매 세션 후**: lessons.md 업데이트 (반복되는 패턴 기록)

### CLAUDE.md 활용
- **Workflow Orchestration**: 계획, 검증, 자동화 등 개발 원칙
- **기술 스택**: 프로젝트 고유의 결정사항 (Gemini 모델, 온톨로지 등)
- **Git Commit Convention**: 팀 협업 규칙

---

## 5. 설정값 외부화: 하드코딩 제거 원칙 (2026-03-05)

### 문제
코드에 하드코딩된 설정값들:
- `GEMINI_MODEL = 'gemini-2.5-flash'` (L12)
- `MAX_RETRIES = 2` (L425)
- `timeout = 30000` (L436)
- `LOG_RETENTION_DAYS = 7` (L73)

이들이 하드코딩되어 있으면:
- 환경별로 다른 값을 사용할 수 없음
- 배포 후 수정하려면 재배포 필요
- QA/Production 환경 분리 불가

### 해결책
**모든 설정값은 환경변수 또는 설정 파일로 분리**

```javascript
// ❌ 나쁜 예
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 2;
const TIMEOUT = 30000;

// ✅ 좋은 예
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2');
const TIMEOUT = parseInt(process.env.TIMEOUT || '30000');
```

또는 **config.js 파일 생성**:
```javascript
module.exports = {
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '2'),
  },
  logs: {
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7'),
    level: process.env.LOG_LEVEL || 'INFO',
  },
};
```

### 교훈
- **설정값과 코드는 항상 분리**: 환경별로 쉽게 변경 가능하도록
- **기본값은 제공하되 환경변수로 오버라이드 가능**: 유연성과 안정성
- **초기 구축부터 이 원칙 적용**: 나중에 분리하는 것보다 훨씬 쉬움

### 담당 역할
- **Backend Developer**: 하드코딩된 값 찾아서 환경변수로 분리
- **DevOps/Tech Architect**: 설정 파일 구조 설계

---

## 6. Supabase 마이그레이션 체크리스트 (Phase 5 준비)

### 배포 호환성 확인 후 진행할 사항
- [ ] Supabase RLS 정책 설계
- [ ] entries.json → PostgreSQL 마이그레이션 스크립트
- [ ] API 엔드포인트 Supabase 클라이언트로 변경
- [ ] 환경 변수 (SUPABASE_URL, SERVICE_KEY)

---

## 📋 체크리스트

### 매 개발 세션 시작 전
- [ ] lessons.md에서 관련 내용 확인
- [ ] CLAUDE.md의 최신 원칙 검토
- [ ] tasks/todo.md의 현재 상태 확인

### 커밋 전
- [ ] 커밋 메시지 컨벤션 준수 (feat/fix/docs/...)
- [ ] 한글 35자 이내, 마침표 없음
- [ ] 필요하면 lessons.md에 패턴 기록

### 배포 전 (Vercel)
- [ ] vercel.json 확인
- [ ] package.json의 start 스크립트 확인
- [ ] 환경 변수 설정 완료
- [ ] 로컬에서 `npm start` 테스트

---

## 7. 로그아웃 시 클라이언트 상태 완전 초기화 (2026-03-08)

### 문제
로그아웃 → 다른 계정 로그인 시 사이드바에 이전 유저 데이터가 잠깐 보임.
`resetSessionAndUI()`에서 인증 토큰만 지우고 `state.allEntries` 등 데이터 상태를 초기화하지 않았음.

### 해결책
로그아웃 시 모든 유저 관련 상태를 빈 값으로 리셋:
```javascript
state.allEntries = [];
state.filteredEntries = [];
state.latestAnalysisResult = null;
```

### 일반화 규칙
- **로그아웃/계정 전환 시 모든 유저 데이터 상태를 초기화할 것**
- 인증 토큰뿐 아니라 캐시된 API 응답, 필터 상태, 분석 결과 등 모두 포함
- 체크리스트: token, profile, entries, filtered data, analysis results, UI state

---

## 8. 이메일 확인 리다이렉트 URL 설정 (2026-03-08)

### 문제
회원가입 후 이메일 확인 링크 클릭 시 에러 페이지로 이동.
`signUp()` 호출 시 `emailRedirectTo` 미설정으로 Supabase 기본값(localhost) 사용.

### 해결책
```javascript
const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
// signUp options에 추가:
emailRedirectTo: siteUrl,
```

### 일반화 규칙
- **Supabase Auth 사용 시 모든 리다이렉트 URL을 명시적으로 설정**
  - signUp → `emailRedirectTo`
  - OAuth → `redirectTo`
  - passwordReset → `redirectTo`
- **Supabase 대시보드에서도 설정 필수**:
  - Site URL: 프로덕션 URL
  - Redirect URLs: 허용된 리다이렉트 목록

---

## 9. supabaseAdmin null 체크 — service_role 키 의존성 (2026-03-08)

### 문제
`auth_events` 테이블에 데이터가 기록되지 않음.
`supabaseAdmin`이 `SUPABASE_SERVICE_ROLE_KEY` 없으면 null이 되는데, `recordAuthEvent()`가 `if (!supabaseAdmin) return;`으로 조용히 실패.

### 교훈
- **service_role 키가 필요한 기능은 키 부재 시 경고 로그를 남길 것**
- 환경변수 누락 시 silent fail보다 startup 경고가 낫다
- **Vercel 배포 시 필수 환경변수 체크리스트**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SITE_URL, GOOGLE_API_KEY

---

## 10. TIMESTAMPTZ는 UTC 저장이 정상 (2026-03-08)

### 혼동 포인트
Supabase 대시보드에서 `created_at`이 한국 시간보다 9시간 빠르게 보임 → UTC 표시가 정상.

### 규칙
- **DB에 시간 저장은 항상 UTC** (`TIMESTAMPTZ DEFAULT now()`)
- **프론트엔드에서 로컬 변환**: `Intl.DateTimeFormat('ko-KR', ...)` 또는 `toLocalDateStr()`
- **DB의 UTC 값을 KST로 "수정"하면 안 됨** — 9시간 이중 오프셋 발생
- 서버→클라이언트 API 응답도 UTC ISO 문자열 그대로 전달

---

**마지막 업데이트**: 2026-03-08
**다음 리뷰**: 다음 세션
