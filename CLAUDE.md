# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 공감 다이어리 — 사용자가 한 줄 일기를 쓰면 AI(Google Gemini)가 감정을 분석하고 공감/위로 메시지를 생성하는 웹 앱.

## Commands

- **서버 실행**: `node server.js` (http://localhost:3000)
- **의존성 설치**: `npm install`

## Architecture

```
public/index.html  ──fetch──▸  server.js (Express :3000)  ──fetch──▸  Google Gemini API
                                    │
                               data/entries.json (파일 기반 DB)
```

- **server.js**: Express 백엔드. Gemini API 프록시(`POST /api/analyze`), 일기 CRUD(`/api/entries`), 정적 파일 서빙(`public/`). API 키는 `.env`에서 로드하여 서버에서만 사용.
- **public/index.html**: 단일 HTML 파일 (CSS/JS 인라인). 서버 API를 호출하여 감정 분석 및 일기 저장. localStorage 미사용, 모든 데이터는 서버에 저장.
- **data/entries.json**: 일기 항목 저장소. 비동기 I/O + write lock으로 동시성 처리.

## Key Technical Decisions

- Gemini 2.5 Flash 모델 사용 시 `thinkingConfig: { thinkingBudget: 0 }` 필수 (thinking 토큰이 출력 토큰을 소진하는 문제 방지)
- Gemini 응답이 `` ```json `` 코드블록으로 감싸질 수 있어 `parseGeminiResponse()`에서 정규식으로 추출
- `express.static`은 `public/` 디렉토리만 서빙 (server.js, .env, data/ 노출 방지)
- 프런트엔드 폰트: Google Fonts의 Gowun Batang(일기 텍스트) + Gowun Dodum(UI)

## Environment Variables (.env)

- `GOOGLE_API_KEY`: Google AI (Gemini) API 키

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## Git Commit Convention

### 형식

```
<타입>(<범위>): <한국어 설명>

<본문 - 선택적, 한국어>

<꼬리말 - 선택적>
```

### 언어 정책

- **타입, scope**: 영어 소문자
- **설명 (제목), 본문**: 한국어
- **제목 최대 길이**: 한글 35자 이내
- **마침표, 이모지**: 금지

### 타입 목록 (총 10가지)

| 타입 | 용도 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `style` | 코드 포맷/스타일만 변경 |
| `refactor` | 리팩토링 (기능/버그 변경 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정, 패키지 변경 |
| `data` | 온톨로지, JSON 스키마, 마이그레이션 |
| `infra` | Supabase, 서버 설정, 환경변수 |
| `phase` | Phase 전환, 마일스톤 완료 |

### Scope 목록 (선택적)

`api` · `server` · `frontend` · `data` · `db` · `auth` · `config` · `ci`

### 본문 작성 기준

- **필수**: Breaking Change, Phase 시작/완료, 복잡한 설계 결정
- **생략 가능**: 단순 기능 추가, 문서 추가 (제목이 자명한 경우)

### Breaking Change 예시

```
feat(db)!: entries 테이블 스키마 변경

BREAKING CHANGE: Supabase 전환으로 entries.json 호환 중단.
마이그레이션: node scripts/migrate-to-supabase.js
```

### 커밋 메시지 예시

**Good ✅**
```
feat(api): Gemini 감정 분석 엔드포인트 추가
docs: 커밋 메시지 컨벤션 추가
fix(frontend): 검색 필터 버그 수정
data: 온톨로지 새 도메인 추가
chore(config): .env.example 템플릿 추가
```

**Bad ❌**
```
update code.                          # 마침표, 모호함
WIP: weird feature.                   # 마침표, WIP는 타입 아님
Add new stuff                         # 타입 없음
소켓 연결 수정                         # 타입 없음
Feat(API): Feature added (영문)       # 설명이 영문
```