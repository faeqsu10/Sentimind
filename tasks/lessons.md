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

## 5. Supabase 마이그레이션 체크리스트 (Phase 5 준비)

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

**마지막 업데이트**: 2026-03-05
**다음 리뷰**: Phase 5 시작 전
