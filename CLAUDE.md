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