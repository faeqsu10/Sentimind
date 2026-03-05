# Phase 5-6 Implementation Plan

**Project**: AI Empathy Diary (Sentimind)
**Period**: 4 weeks (2026-03-05 ~ 04-02)
**Goal**: JSON -> Supabase PostgreSQL migration + user authentication system

---

## Architecture Overview

```
Before (Phase 4):
  Browser -> Express -> entries.json
                     -> Gemini API

After (Phase 5-6):
  Browser -> Express + Auth Middleware -> Supabase PostgreSQL (RLS)
                                      -> Supabase Auth (JWT)
                                      -> Gemini API
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ID format | nanoid (21 chars) | Shorter than UUID, URL-safe, no collision risk at our scale |
| Delete strategy | Soft delete (deleted_at) | Reversible, GDPR audit trail, RLS filters automatically |
| Auth method | Supabase Auth (email/password) | Built-in JWT, no custom auth server needed |
| Session management | JWT in Authorization header | Stateless, frontend-managed via Supabase SDK |
| Response compatibility | Backward compatible | Existing frontend works without changes during transition |
| JSON fallback | Maintained | Supabase disabled -> JSON file mode (dev/offline) |

---

## Week 1: Supabase Infrastructure

### Day 1-2: Project Setup + Schema

**Files**: `config/supabase-config.js`, `migrations/001-004`

- [x] Supabase 클라이언트 설정 모듈 (`config/supabase-config.js`)
  - Public client (RLS-aware)
  - Admin client (service role, bypasses RLS)
  - User-scoped client factory
- [ ] Supabase 프로젝트 생성 (ap-southeast-1)
- [ ] Migration SQL 실행 (순서: 001 -> 002 -> 003 -> 004)
  - `001_create_tables.sql`: user_profiles, entries
  - `002_create_indexes.sql`: 5 indexes (composite, partial, GIN)
  - `003_create_rls_policies.sql`: user_profiles 2, entries 4
  - `004_create_triggers.sql`: handle_new_user, update_updated_at
- [ ] .env 업데이트 (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)

**Verification**:
```bash
# Supabase 콘솔에서 확인
# 1. Tables 탭: user_profiles, entries 테이블 존재
# 2. Policies 탭: 6개 RLS 정책 활성화
# 3. SQL Editor에서 테스트 쿼리 실행
SELECT * FROM public.entries LIMIT 1;
```

### Day 3: Data Migration

**Files**: `scripts/migrate-entries.js`

- [x] Migration 스크립트 작성 (v2)
  - Data validation (type checking, length limits)
  - Ontology metadata gap-filling
  - Batch upsert with error isolation
  - Row count verification + spot check
  - Dry-run mode
- [ ] DRY_RUN=true 테스트
- [ ] 프로덕션 마이그레이션 실행
- [ ] 데이터 무결성 검증

**Verification**:
```bash
# Dry run first
DRY_RUN=true node scripts/migrate-entries.js

# Production migration
node scripts/migrate-entries.js

# Verify in Supabase SQL Editor
SELECT COUNT(*) FROM entries;
SELECT emotion, COUNT(*) FROM entries GROUP BY emotion;
```

### Day 4-5: Auth Middleware + Validators

**Files**: `lib/auth-middleware.js`, `lib/validators.js`

- [x] Auth middleware 구현
  - JWT extraction from Authorization header
  - User verification via supabase.auth.getUser()
  - User-scoped Supabase client creation
  - Optional auth variant for public endpoints
- [x] Input validators 구현
  - Email, password (signup/login)
  - Entry text, confidence score
  - Profile fields (nickname, bio, theme, notification_time)
  - Pagination (limit, offset)

---

## Week 2: Auth Endpoints + API Migration

### Day 6-7: Auth Routes

**File**: `server-v2.js` (auth section)

- [x] POST /api/auth/signup (rate: 3/15min)
- [x] POST /api/auth/login (rate: 5/min)
- [x] POST /api/auth/logout
- [x] POST /api/auth/reset-password
- [x] POST /api/auth/refresh
- [x] GET /api/auth/me
- [ ] OAuth 프로바이더 설정 (Google, GitHub) - Supabase 콘솔

### Day 8-9: Entry CRUD Migration

**File**: `server-v2.js` (entries section)

- [x] GET /api/entries (pagination, emotion filter, text search)
- [x] POST /api/entries (with ontology metadata, streak update)
- [x] PATCH /api/entries/:id (24h edit window)
- [x] DELETE /api/entries/:id (soft delete)
- [x] JSON fallback for all CRUD operations

### Day 10: Stats + Profile

**File**: `server-v2.js` (stats, profile sections)

- [x] GET /api/stats (streak data included)
- [x] GET /api/profile
- [x] PATCH /api/profile
- [x] GET /api/health (new)

---

## Week 3: Frontend Integration + Testing

### Day 11-12: Frontend Auth UI

**File**: `public/index.html`

- [ ] Supabase SDK CDN 추가
- [ ] 로그인/회원가입 폼 UI
- [ ] Auth state management (onAuthStateChange)
- [ ] fetchWithAuth() wrapper
- [ ] saveEntry() - ontology 데이터 포함

### Day 13-14: Integration Testing

- [ ] API 엔드포인트 전수 테스트 (TESTING_CHECKLIST.md 참조)
- [ ] RLS 정책 검증 (사용자 간 데이터 격리)
- [ ] 에러 시나리오 테스트 (만료 토큰, 잘못된 입력 등)
- [ ] 성능 테스트 (응답 시간 < 200ms)

---

## Week 4: Security Hardening + Documentation

### Day 15-16: Security

- [ ] CORS 설정 검증 (프로덕션 도메인)
- [ ] Rate limiter 파인튜닝
- [ ] 보안 이벤트 로깅 강화
- [ ] 환경변수 검증 (시작 시 필수값 체크)

### Day 17-18: Documentation + Deployment

- [ ] API 문서 업데이트 (auth 엔드포인트 추가)
- [ ] .env.example 업데이트
- [ ] Vercel 배포 설정 업데이트
- [ ] server.js -> server-v2.js 전환 (또는 server.js 덮어쓰기)

---

## File Map

```
study-04/
  config/
    llm-config.js          # Gemini API config (existing)
    supabase-config.js      # NEW: Supabase client setup
  lib/
    auth-middleware.js       # NEW: JWT auth middleware
    validators.js            # NEW: Input validation
  migrations/
    001_create_tables.sql    # existing
    002_create_indexes.sql   # existing
    003_create_rls_policies.sql  # existing
    004_create_triggers.sql  # existing
  scripts/
    migrate-to-supabase.js   # existing (v1)
    migrate-entries.js        # NEW: enhanced migration (v2)
  docs/
    IMPLEMENTATION_PLAN.md    # THIS FILE
    TESTING_CHECKLIST.md      # NEW: test scenarios
  server.js                   # Current v1 (preserved)
  server-v2.js                # NEW: Supabase + Auth version
```

## Environment Variables (New)

```bash
# .env additions for Phase 5-6
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional rate limit overrides
SIGNUP_RATE_LIMIT=3     # per 15 min per IP
LOGIN_RATE_LIMIT=5      # per min per IP

# CORS (comma-separated additional origins)
CORS_ORIGINS=https://sentimind.vercel.app

# Migration
LEGACY_USER_EMAIL=legacy@sentimind.local
DRY_RUN=false
BATCH_SIZE=50
```

## Rollback Strategy

1. **server-v2.js fails**: Revert to `node server.js` (JSON mode, no auth)
2. **Migration fails**: Re-run `scripts/migrate-entries.js` (idempotent)
3. **Supabase down**: server-v2.js falls back to JSON file automatically when `USE_SUPABASE=false`
4. **Auth issues**: Disable auth by removing `SUPABASE_URL` from .env (auth middleware passes through)

---

**Created**: 2026-03-05
**Status**: Week 1-2 code artifacts complete, awaiting Supabase project creation
