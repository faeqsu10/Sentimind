# Sentimind Phase 5+ Technical Architecture Design

**Version**: 1.0
**Date**: 2026-03-05
**Author**: Tech Architect
**Status**: Draft - Pending Review
**Scope**: Phase 5 (DB Migration) + Phase 6 (Auth) merged into single 4-week sprint

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Database Design](#4-database-design)
5. [API Architecture](#5-api-architecture)
6. [Security Architecture](#6-security-architecture)
7. [Migration Strategy](#7-migration-strategy)
8. [Performance & Scalability](#8-performance--scalability)
9. [Module Extraction Plan](#9-module-extraction-plan)
10. [Risk Register](#10-risk-register)
11. [Success Metrics](#11-success-metrics)

---

## 1. Executive Summary

### Problem

The current system stores all data in a single JSON file with no user isolation. This prevents:
- Multi-user deployment (anyone can read/delete anyone's data)
- Production hosting (Vercel `/tmp` erases data on redeploy)
- Concurrent writes beyond a single process

### Solution

Migrate to Supabase PostgreSQL with Row Level Security. Merge Phase 5 (DB) and Phase 6 (Auth) into a single 4-week sprint because:
1. A database without auth has no `user_id` to write -- you can't meaningfully use RLS
2. Auth without a database means sessions have nowhere to persist user data
3. Shipping DB-only provides zero user-facing value

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB + Auth as single sprint | Yes | Neither is useful alone; reduces integration risk |
| Schema starts minimal | 2 tables (user_profiles, entries) | user_stats removed (use SQL aggregation); activity_logs deferred to Phase 8 |
| Feature flag migration | `USE_SUPABASE=true` env var | Allows parallel JSON fallback during testing |
| Soft delete | `deleted_at TIMESTAMPTZ` | 30-day recovery window per PRD FR-DIARY-004 |
| TIMESTAMPTZ everywhere | Yes | Avoids timezone ambiguity in PostgreSQL |
| entries.id type | TEXT (nanoid) | PRD specifies nanoid; lighter than UUID for URLs |
| No microservices | Monolith with clean modules | See ADR-001 in ARCHITECTURE_REVIEW.md |

---

## 2. Current State Analysis

### System Topology (As-Is)

```
Browser (public/index.html, 1392 lines)
  |
  | fetch (JSON, no auth headers)
  v
Express (server.js, 866 lines)
  |
  +---> Gemini 2.5 Flash (POST /api/analyze)
  |       - thinkingBudget: 0
  |       - 30s timeout, 3 retries with exponential backoff
  |
  +---> data/entries.json (Promise-chain write lock)
  |
  +---> data/emotion-ontology.json (loaded once at startup)
  +---> data/situation-ontology.json (loaded once at startup)
  |
  +---> Supabase (behind USE_SUPABASE flag, partially wired)
```

### Critical Issues to Resolve

1. **Data loss on save**: `saveEntry()` in frontend sends only `{text, emotion, emoji, message, advice}`. Ontology metadata (`emotion_hierarchy`, `situation_context`, `confidence`, `related_emotions`) computed during `/api/analyze` is discarded.

2. **ID mismatch**: Current IDs are base36 (`Date.now().toString(36) + random`). Supabase expects either UUID or a consistent string type. PRD specifies nanoid.

3. **Partial Supabase wiring**: `server.js` already imports `@supabase/supabase-js` and has `USE_SUPABASE` conditional in `readEntries()`/`writeEntries()`, but the implementation is incomplete (no user_id, no RLS-aware client, `writeEntries` does full upsert loop).

4. **`emotion_correlations` bug**: Ontology maps English keys (`"anxiety"`, `"sadness"`) but engine lookups use Korean strings. `findRelatedEmotions()` always returns `[]`.

---

## 3. Target Architecture

### System Topology (To-Be)

```
Browser (public/index.html)
  |
  | (1) Supabase Auth JS SDK: signup/login/logout
  |     Returns: access_token (JWT) + refresh_token
  |
  | (2) fetch('/api/*', { Authorization: 'Bearer <JWT>' })
  v
Express (server.js -> routes/)
  |
  +---> Auth Middleware: validate JWT via Supabase
  |       Sets req.user and req.supabaseClient (user-scoped)
  |
  +---> Gemini 2.5 Flash (POST /api/analyze)
  |       Unchanged -- no DB interaction
  |
  +---> Supabase PostgreSQL (via user-scoped client)
  |       RLS enforces user_id = auth.uid() automatically
  |
  +---> data/emotion-ontology.json (loaded once at startup)
  +---> data/situation-ontology.json (loaded once at startup)
```

### Authentication Flow

```
1. User opens app
2. Frontend checks Supabase session (supabase.auth.getSession())
3a. No session -> Show login/signup form
3b. Has session -> Load diary UI with JWT in Authorization header

4. Every API call includes: Authorization: Bearer <access_token>
5. Express auth middleware:
   - Extracts token
   - Calls supabase.auth.getUser(token) to validate
   - Creates user-scoped Supabase client
   - Attaches to req.supabaseClient
6. Route handlers use req.supabaseClient for all DB operations
   - RLS automatically filters by auth.uid()
```

### Key Architectural Principle

The Express server does NOT use the service_role key for normal operations. Instead, each request gets a Supabase client initialized with the user's JWT. This means RLS policies are enforced at the database level, not in application code. The server cannot accidentally leak data across users.

The service_role key is ONLY used for:
- Migration script (one-time, offline)
- Admin operations (if ever needed)

---

## 4. Database Design

Full schema definition: see `docs/DATABASE_SCHEMA.md`

### Table Summary

| Table | Purpose | Row Count Estimate (6mo) |
|-------|---------|--------------------------|
| `user_profiles` | User settings, streak, onboarding state | ~200 |
| `entries` | Diary entries with ontology metadata | ~12,000 |

### Why Only 2 Tables

- **No `user_stats` table**: Stats (`/api/stats`) are computed via SQL aggregation. PostgreSQL handles `GROUP BY` on 100k rows in <50ms with proper indexes. Materialized views can be added at 500k+ rows if needed.

- **No `activity_logs` table**: Premature without auth. The existing Logger class writes structured JSON to files, which is sufficient for Phase 5-6. Activity logging to a DB table is a Phase 8 concern when you have actual user behavior to track.

### Index Strategy

| Access Pattern | Index | Expected Query Time |
|----------------|-------|---------------------|
| List user's entries by date | `idx_entries_user_created(user_id, created_at DESC)` | <10ms at 10k rows |
| Filter by emotion | `idx_entries_user_emotion(user_id, emotion) WHERE deleted_at IS NULL` | <10ms |
| Active entry lookup | `idx_entries_active(user_id) WHERE deleted_at IS NULL` | <5ms |
| JSONB aggregation on emotion_hierarchy | `idx_entries_hierarchy USING GIN` | <50ms |

---

## 5. API Architecture

Full endpoint specification: see `docs/API_DESIGN.md`

### Design Principles

1. **Zero breaking changes for existing frontend**: Response shapes stay identical. The frontend sees the same JSON it sees today.
2. **Auth required for all data endpoints**: `/api/analyze` also requires auth (prevents anonymous API abuse).
3. **Auth endpoints proxy Supabase Auth**: Frontend could call Supabase directly, but routing through Express keeps the architecture uniform and allows server-side session management.
4. **Pagination on list endpoints**: `GET /api/entries?limit=20&offset=0` -- required for scale.

### Endpoint Overview

**New endpoints (auth)**:
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/signup | No | Email/password registration |
| POST | /api/auth/login | No | Email/password login |
| POST | /api/auth/logout | Yes | Invalidate session |
| POST | /api/auth/reset-password | No | Send reset email |
| GET | /api/auth/me | Yes | Get current user profile |

**Modified endpoints (add auth + Supabase)**:
| Method | Path | Change |
|--------|------|--------|
| POST | /api/analyze | Add auth middleware; no DB change |
| GET | /api/entries | Auth + Supabase query + pagination |
| POST | /api/entries | Auth + Supabase insert + ontology metadata |
| DELETE | /api/entries/:id | Auth + soft delete (set deleted_at) |
| GET | /api/stats | Auth + SQL aggregation queries |

**New endpoints (data)**:
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| PATCH | /api/entries/:id | Yes | Update entry (24hr window) |
| GET | /api/profile | Yes | Get user profile |
| PATCH | /api/profile | Yes | Update user profile |

### Rate Limiting Strategy

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| POST /api/analyze | 10 req | 1 min | Gemini API cost control |
| POST /api/auth/signup | 3 req | 15 min | Prevent registration spam |
| POST /api/auth/login | 5 req | 1 min | Brute force protection |
| All other endpoints | 60 req | 1 min | General abuse prevention |

---

## 6. Security Architecture

### 6.1 Authentication: Supabase Auth

**Why Supabase Auth over custom JWT**:
- Built-in email verification, password reset, OAuth providers
- JWT issuance and refresh handled automatically
- Integrates natively with RLS (`auth.uid()` function)
- Zero custom crypto code to maintain
- Supabase Auth is GoTrue under the hood (battle-tested)

**Token Strategy**:

```
Access Token:  JWT, 1 hour expiry (Supabase default)
Refresh Token: Opaque, 7 day expiry
Storage:       Supabase JS SDK manages in memory
Persistence:   localStorage for refresh token (Supabase SDK default)
```

Note: The PRD mentions httpOnly cookies. However, since the frontend and API are on the same origin (Vercel serves both), Supabase's default localStorage-based session is sufficient and simpler. httpOnly cookies add complexity (CSRF tokens, cookie parsing middleware) with minimal benefit when same-origin. If we move to separate frontend/backend domains, switch to httpOnly cookies at that point.

### 6.2 Row Level Security

RLS is the primary security boundary. Even if application code has a bug, the database enforces isolation.

```
Every Supabase client is initialized with the user's JWT
  -> PostgreSQL sets auth.uid() = user's UUID
  -> RLS policies filter all queries: WHERE user_id = auth.uid()
  -> Application code CANNOT bypass this
```

Policies defined in `docs/DATABASE_SCHEMA.md` Section 3.

### 6.3 API Key Management

| Key | Where Used | Exposed to Client? |
|-----|------------|-------------------|
| GOOGLE_API_KEY | server.js (Gemini calls) | Never |
| SUPABASE_URL | Frontend (auth SDK) + server.js | Yes (designed to be public) |
| SUPABASE_ANON_KEY | Frontend (auth SDK) + server.js | Yes (designed to be public, RLS protects data) |
| SUPABASE_SERVICE_ROLE_KEY | Migration script only | Never |

### 6.4 CORS Configuration

```javascript
// Current: localhost only
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
}));

// Phase 5: Add production domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL, // e.g., 'https://sentimind.vercel.app'
  ].filter(Boolean),
  credentials: true, // Required if using cookies
}));
```

### 6.5 Input Validation (unchanged)

- Text: max 500 chars, string type, non-empty (already implemented)
- Email: RFC 5322 via Supabase Auth (new)
- Password: min 8 chars, alphanumeric (Supabase Auth config)
- All IDs: validate format before DB query (new)

---

## 7. Migration Strategy

### 7.1 Approach: Feature Flag + Dual Mode

```
Phase 5 Week 1-2: Build Supabase path behind USE_SUPABASE=true
Phase 5 Week 3:   Run migration script, verify data
Phase 5 Week 4:   Switch USE_SUPABASE=true in production
                   Keep entries.json as backup for 30 days
```

### 7.2 Migration Script

See `scripts/migrate-to-supabase.js` for the implementation.

Key design decisions:
1. **Batch inserts**: 50 entries per batch (Supabase REST API limit)
2. **New IDs**: Generate nanoid for each entry (old base36 IDs are incompatible)
3. **Legacy user**: Create a "legacy" user in auth.users for pre-auth entries
4. **Date mapping**: `entry.date` -> `created_at` (TIMESTAMPTZ)
5. **Ontology re-computation**: If entry lacks ontology metadata, re-compute via OntologyEngine
6. **Verification**: Count rows after migration, compare with source
7. **Idempotent**: Can be re-run safely (upsert on legacy entries)

### 7.3 Rollback Plan

If Supabase migration fails:
1. Set `USE_SUPABASE=false` in env -> immediate fallback to JSON
2. `entries.json` is never deleted during migration
3. New entries written during Supabase mode are NOT in JSON -> accept data loss for that window, or export from Supabase before rollback

### 7.4 Zero-Downtime Migration Sequence

```
Step 1: Deploy code with USE_SUPABASE=false (dual-mode support)
Step 2: Create Supabase tables and indexes
Step 3: Run migration script against production data
Step 4: Verify: row count matches, spot-check 10 entries
Step 5: Deploy with USE_SUPABASE=true
Step 6: Monitor for 24 hours
Step 7: If clean, remove JSON code path in next release
```

---

## 8. Performance & Scalability

### 8.1 Before vs After

| Operation | Current (JSON) | After (Supabase) |
|-----------|---------------|-------------------|
| List 50 entries | ~50ms (read full file, slice) | ~15ms (indexed query + limit) |
| Save entry | ~30ms (read all, prepend, write all) | ~10ms (single INSERT) |
| Delete entry | ~30ms (read all, splice, write all) | ~5ms (UPDATE deleted_at) |
| Stats aggregation | ~100ms at 500 entries, O(n) | ~20ms at 10k entries (SQL GROUP BY) |
| Concurrent users | 1 (file lock) | 100+ (PostgreSQL connections) |

### 8.2 Connection Pooling

Supabase uses PgBouncer by default. The anon key connects through the connection pooler. No additional configuration needed for Phase 5 scale (<100 concurrent users).

For Phase 8+ (>100 concurrent), switch to `SUPABASE_DB_URL` with `?pgbouncer=true` parameter for direct PostgreSQL access with pooling.

### 8.3 Caching Strategy

**Phase 5 (minimal)**:
- `/api/stats`: Add `Cache-Control: private, max-age=60` header. Stats don't need real-time accuracy.
- All other endpoints: No cache (user expects fresh data).

**Phase 8+ (if needed)**:
- In-memory LRU cache for stats per user (60-second TTL)
- Supabase Realtime for invalidation

### 8.4 Stats Query Optimization

Replace the current in-memory JavaScript aggregation (lines 757-807 in server.js) with SQL:

```sql
-- Top 5 emotions
SELECT emotion, COUNT(*) as count
FROM entries
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY emotion
ORDER BY count DESC
LIMIT 5;

-- Situation frequency (JSONB)
SELECT
  ctx->>'domain' as domain,
  ctx->>'context' as context,
  COUNT(*) as count
FROM entries,
  jsonb_array_elements(situation_context) as ctx
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY domain, context
ORDER BY count DESC
LIMIT 5;

-- Hourly distribution
SELECT
  EXTRACT(HOUR FROM created_at) as hour,
  emotion,
  COUNT(*) as count
FROM entries
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY hour, emotion
ORDER BY hour;

-- Summary
SELECT
  COUNT(*) as total_entries,
  ROUND(AVG(confidence_score)) as avg_confidence
FROM entries
WHERE user_id = $1 AND deleted_at IS NULL;
```

---

## 9. Module Extraction Plan

### 9.1 Current Problem

`server.js` is 866 lines containing: Logger class, OntologyEngine class, helper functions, all route handlers, middleware, startup logic. This must be split before adding auth complexity.

### 9.2 Target Structure

```
/home/faeqsu10/projects/vibe-coding/study-04/
  server.js                    (< 100 lines: app setup, middleware, route registration)
  lib/
    logger.js                  (Logger class, extracted as-is)
    ontology-engine.js         (OntologyEngine class, extracted as-is)
    gemini-client.js           (Gemini API call + parseGeminiResponse)
    auth-middleware.js          (JWT validation, user-scoped Supabase client)
    data/
      store.js                 (interface: getEntries, saveEntry, deleteEntry, getStats)
      json-store.js            (current JSON file implementation)
      supabase-store.js        (new Supabase implementation)
  routes/
    analyze.js                 (POST /api/analyze)
    entries.js                 (GET/POST/PATCH/DELETE /api/entries)
    stats.js                   (GET /api/stats)
    auth.js                    (POST /api/auth/*)
    profile.js                 (GET/PATCH /api/profile)
  config/
    llm-config.js              (existing, unchanged)
  migrations/
    001_create_tables.sql
    002_create_indexes.sql
    003_create_rls_policies.sql
    004_create_triggers.sql
  scripts/
    migrate-to-supabase.js
  tests/
    api.test.js                (basic integration tests)
```

### 9.3 Data Store Interface

```javascript
// lib/data/store.js
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

let store;
if (USE_SUPABASE) {
  store = require('./supabase-store');
} else {
  store = require('./json-store');
}

module.exports = store;

// Both json-store.js and supabase-store.js implement:
// - getEntries(userId, { limit, offset }) -> Entry[]
// - saveEntry(userId, entryData) -> Entry
// - deleteEntry(userId, entryId) -> void
// - updateEntry(userId, entryId, updates) -> Entry
// - getStats(userId) -> StatsObject
```

This interface is the key architectural seam. It allows:
- Testing with JSON store (no Supabase dependency)
- Gradual migration via feature flag
- Future store swaps (e.g., direct PostgreSQL without Supabase SDK)

---

## 10. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | RLS misconfiguration leaks user data | Medium | Critical | Write RLS test suite: create 2 test users, verify cross-access returns 0 rows. Run on every deploy. |
| R2 | Migration loses entries or corrupts ontology metadata | Low | High | Backup entries.json before migration. Verify row count and spot-check 10% of entries. Keep JSON fallback for 30 days. |
| R3 | Frontend breaks with auth (new login flow, JWT headers) | Medium | High | Build auth UI behind feature flag. Test full flow (signup -> login -> diary -> stats -> logout) before switching. |
| R4 | Supabase free tier limits hit during beta | Low | Medium | Monitor usage via Supabase dashboard. Free tier: 500MB DB, 50k MAU. At 200 DAU with 2 entries/day, that is ~100MB/year for entries. |
| R5 | Server.js refactor introduces regressions | Medium | Medium | Extract modules one at a time. Run manual test after each extraction. Add API integration tests before starting. |
| R6 | Gemini API calls fail after auth changes | Low | Low | Gemini endpoint is independent of DB/auth. The only change is requiring a valid JWT to call it. |

---

## 11. Success Metrics

| Metric | Current | Phase 5+6 Target | How to Verify |
|--------|---------|-------------------|---------------|
| User data isolation | None (shared JSON) | 100% (RLS enforced) | Security test: user A cannot see user B's entries |
| API response time (entries) | ~50ms (small dataset) | <100ms at 10k entries | Measure via logger |
| Concurrent user support | 1 | 100+ | Load test with 10 concurrent users |
| Data durability | Single file, no backup | PostgreSQL + Supabase daily backups | Verify backup schedule in Supabase dashboard |
| Auth flow completion | N/A | Signup -> login -> diary -> logout works | End-to-end test |
| Migration accuracy | N/A | 100% entries migrated | Row count comparison |
| Test coverage | 0% | >60% API endpoints | Test runner output |

---

## Appendix A: Environment Variables (Updated)

```bash
# Required (existing)
GOOGLE_API_KEY=your_gemini_api_key

# Required (new for Phase 5)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
USE_SUPABASE=true

# Required (new for migration only -- never deploy to production)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional (existing, unchanged)
PORT=3000
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TEMPERATURE=0.5
GEMINI_MAX_OUTPUT_TOKENS=512
GEMINI_THINKING_BUDGET=0
LOG_LEVEL=INFO

# Optional (new)
FRONTEND_URL=https://sentimind.vercel.app
```

## Appendix B: Implementation Order

```
Week 1:
  Day 1: Extract modules from server.js (lib/, routes/)
  Day 2: Create Supabase project, run SQL migrations
  Day 3: Implement supabase-store.js (data access layer)
  Day 4-5: Implement auth middleware + auth routes

Week 2:
  Day 1-2: Update frontend (auth UI, JWT headers, save ontology data)
  Day 3: Run migration script on staging
  Day 4-5: Integration testing

Week 3:
  Day 1-2: Fix bugs from integration testing
  Day 3: Security testing (RLS verification)
  Day 4-5: Performance testing, optimization

Week 4:
  Day 1: Production deployment
  Day 2-3: Monitor, fix production issues
  Day 4-5: Documentation, handoff
```

---

**Document version**: 1.0
**Next review**: After Week 2 integration testing
