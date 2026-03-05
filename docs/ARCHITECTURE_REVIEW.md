# Sentimind - Technical Architecture Review & Improvement Plan

**Date**: 2026-03-05
**Scope**: Full architecture review covering Phase 1-4 (current state) through Phase 10 (long-term vision)
**Audience**: Development team, technical leads

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Phase 5: Supabase Migration Design (Revised)](#2-phase-5-supabase-migration-design-revised)
3. [Performance & Scalability](#3-performance--scalability)
4. [Technical Debt & Refactoring](#4-technical-debt--refactoring)
5. [Phase 6-10 Roadmap](#5-phase-6-10-roadmap)
6. [Risk Register](#6-risk-register)

---

## 1. Current Architecture Analysis

### 1.1 System Topology

```
Browser (index.html)
   |
   | fetch (JSON)
   v
Express (server.js, :3000)
   |
   +---> Gemini 2.5 Flash (POST /api/analyze)
   |        - thinkingBudget: 0
   |        - 30s timeout, 2 retries on parse failure
   |
   +---> data/entries.json (read/write with Promise-chain lock)
   |
   +---> data/emotion-ontology.json (loaded once at startup)
   +---> data/situation-ontology.json (loaded once at startup)
```

### 1.2 Strengths

| Area | Detail |
|------|--------|
| **Simplicity** | Single-file backend (464 lines), single-file frontend (1392 lines). Extremely low deployment complexity -- `node server.js` and done. |
| **Gemini integration** | Solid defensive coding: `parseGeminiResponse()` handles code-block-wrapped JSON, retry loop for parse failures, specific HTTP status handling (429, 400/403, timeout). |
| **OntologyEngine** | Clean separation of concerns. Ontology data is declarative JSON, engine is a pure class with no side effects. Easy to test and extend. |
| **Write lock** | Promise-chain write lock in `writeEntries()` prevents concurrent file corruption -- correct pattern for single-process JSON file I/O. |
| **Frontend UX** | Well-crafted single-page app with tab navigation, filter/search, accessibility (ARIA attributes, keyboard nav, `sr-only` labels), responsive design with `clamp()`. |
| **Security basics** | API key server-side only, `express.static` restricted to `public/`, input validation (500 char limit), CORS whitelisting. |

### 1.3 Weaknesses

| Severity | Area | Issue | Impact |
|----------|------|-------|--------|
| **Critical** | Data layer | JSON file as database. Every read loads the entire file; every write rewrites the entire file. | O(n) for all operations. Fails at ~1,000 entries due to memory/latency. No concurrent process support. |
| **Critical** | Auth | No authentication. All data is shared across all users. | Cannot deploy publicly. No multi-tenancy. |
| **High** | Frontend scalability | 1,392-line monolithic HTML with inline CSS (~500 lines) and inline JS (~550 lines). | Hard to maintain, no code splitting, no component reuse, cache invalidation requires full page reload. |
| **High** | Error handling | `readEntries()` silently returns `[]` on any error (line 182). Stats endpoint reads all entries into memory. | Data loss goes undetected. Memory spike on large datasets. |
| **Medium** | OntologyEngine | `calculateConfidence()` is a naive formula: `min(textLength/100, 0.8) * 100 + 10`, rounded. | Confidence is essentially a proxy for text length, not actual analysis quality. Misleading to users. |
| **Medium** | ID generation | `Date.now().toString(36) + random` -- not UUID, not collision-safe under high concurrency. | Unlikely collision in single-user scenario, but will cause issues with Supabase migration (UUID expected). |
| **Medium** | State management | Frontend stores `allEntries` as a flat array, re-fetches entire list after every save/delete. | Unnecessary network overhead as entry count grows. |
| **Low** | Testing | Zero test files. No `npm test` configured. | Regressions go undetected. |
| **Low** | Ontology | `saveEntry()` does not persist ontology metadata. The `POST /api/entries` body only includes `text, emotion, emoji, message, advice`. | Ontology insights are computed at analysis time but lost in storage. |

### 1.4 OntologyEngine Evaluation

**Design**: Good. Stateless class that operates on injected data. Three-level emotion hierarchy traversal is correct.

**Gaps**:
1. `findEmotionHierarchy()` uses loose string matching (`emotion.includes(level3.korean)`) which can produce false positives for short Korean strings.
2. `inferSituationContext()` uses `toLowerCase()` but Korean has no case -- this is harmless but misleading. The keyword matching is basic substring search with no word boundary awareness.
3. `emotion_correlations` in the ontology file maps to English strings (`"hope"`, `"confidence"`) but the engine returns Korean strings. The `findRelatedEmotions()` method will always return `[]` for Korean emotion inputs.
4. **Recommendation**: Keep the engine architecture, fix the correlation mapping, and eventually replace the keyword-based `calculateConfidence()` with Gemini's own confidence scoring if available.

---

## 2. Phase 5: Supabase Migration Design (Revised)

The existing `tasks/todo.md` plan is a solid starting point. Below are architectural improvements and corrections.

### 2.1 Schema Optimization

**Problem with current plan**: The `users` table uses `DEFAULT auth.uid()` for the `id` column. This only works when the insert is performed by an authenticated Supabase client, not from a server-side service key context.

**Revised schema**:

```sql
-- =============================================================
-- 1. USERS
-- =============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  theme VARCHAR(10) CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- 2. ENTRIES (core table)
-- =============================================================
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  emotion VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '💭',
  message TEXT,
  advice TEXT,

  -- Ontology metadata (denormalized for query speed)
  emotion_hierarchy JSONB DEFAULT '{}',
  situation_context JSONB DEFAULT '[]',
  confidence_score SMALLINT DEFAULT 0
    CHECK (confidence_score >= 0 AND confidence_score <= 100),
  related_emotions TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ  -- soft delete
);

-- =============================================================
-- 3. INDEXES
-- =============================================================
CREATE INDEX idx_entries_user_created
  ON entries(user_id, created_at DESC);

CREATE INDEX idx_entries_user_emotion
  ON entries(user_id, emotion)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_entries_active
  ON entries(id)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB queries on emotion_hierarchy
CREATE INDEX idx_entries_hierarchy
  ON entries USING GIN (emotion_hierarchy);
```

**Key changes from original plan**:

1. **Removed `user_stats` table**. Stats should be computed with SQL aggregation queries, not materialized in a separate table. At this scale (under 100k entries), PostgreSQL handles aggregation easily. Materialized views can be added later if needed.

2. **Removed `activity_logs` table** from Phase 5 scope. This is a Phase 7+ concern. Adding audit logging before you have authentication is premature.

3. **Changed `TIMESTAMP` to `TIMESTAMPTZ`**. Always store timestamps with timezone in PostgreSQL.

4. **Removed `email`, `bio`, `profile_image_url`, `notification_enabled`** from `users`. These are Phase 6+ features. The `users` table should start minimal and grow with actual requirements.

5. **Added auto-profile trigger**. When Supabase Auth creates a user in `auth.users`, automatically create a matching `public.users` row. This is the standard Supabase pattern.

### 2.2 RLS Policies

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own profile only
CREATE POLICY "users_read_own"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Entries: full CRUD on own non-deleted entries
CREATE POLICY "entries_select_own" ON entries FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "entries_insert_own" ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entries_update_own" ON entries FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "entries_delete_own" ON entries FOR DELETE
  USING (auth.uid() = user_id);
```

**Note**: The SELECT policy filters out soft-deleted entries automatically. This means the application never needs to add `WHERE deleted_at IS NULL` -- RLS handles it.

### 2.3 Migration Strategy

**Phase 5 operates in two modes simultaneously**:

```
Mode A (current): Express -> JSON file     (default, no auth)
Mode B (new):     Express -> Supabase      (behind feature flag)
```

**Implementation approach**:

```javascript
// server.js - Data access layer abstraction
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

async function getEntries(userId) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
  return readEntries(); // existing JSON implementation
}
```

**Why**: This lets you test the Supabase path in staging while keeping production on JSON until migration is verified. The feature flag is a simple env var switch.

**Migration script improvements over current plan**:

1. Use batch inserts (50 at a time) instead of one-by-one
2. Generate proper UUIDs for migrated entries (not reuse old base36 IDs)
3. Map existing `date` field to `created_at`
4. Extract ontology data from entry if present, otherwise re-compute via OntologyEngine
5. Verify row count matches after migration
6. Keep `entries.json` as backup (do not delete)

### 2.4 API Contract Changes

**Goal**: Zero breaking changes to the frontend. The response shape stays identical.

| Endpoint | Current | After Phase 5 | Breaking? |
|----------|---------|---------------|-----------|
| `POST /api/analyze` | Returns `{emotion, emoji, message, advice, ontology}` | No change (Gemini call, not DB) | No |
| `GET /api/entries` | Returns `[{id, date, text, emotion, emoji, message, advice}]` | Returns same shape, `date` mapped from `created_at` | No |
| `POST /api/entries` | Accepts `{text, emotion, emoji, message, advice}` | Same + saves ontology metadata | No |
| `DELETE /api/entries/:id` | Hard delete | Soft delete (sets `deleted_at`) | No (client sees same 200) |
| `GET /api/stats` | Computes from full JSON array | SQL aggregation | No (same response shape) |

**New endpoints to add**:
- `PUT /api/entries/:id` -- update entry text (triggers re-analysis)
- Pagination on `GET /api/entries?page=1&limit=20` -- required for scale

### 2.5 Stats Query Optimization

Replace the in-memory JavaScript aggregation with SQL:

```sql
-- Top emotions (replaces JavaScript reduce loop)
SELECT emotion, COUNT(*) as count
FROM entries
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY emotion
ORDER BY count DESC
LIMIT 5;

-- Situation frequency (leverages GIN index on JSONB)
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
```

---

## 3. Performance & Scalability

### 3.1 Current Bottlenecks

| Bottleneck | Threshold | Solution |
|------------|-----------|----------|
| JSON file I/O (read entire file per request) | ~500 entries = noticeable lag, ~5,000 = unusable | Phase 5: Supabase/PostgreSQL |
| Full entry list re-fetch on every save/delete | ~100 entries = perceptible delay | Phase 5: Return saved entry, append client-side |
| Gemini API latency (~1-3s per call) | Always present | Already mitigated with loading state. Consider streaming in Phase 8. |
| No pagination | ~50 entries displayed (MAX_DISPLAY), but all fetched | Phase 5: Server-side pagination |
| Stats computed from full dataset in memory | ~10,000 entries | Phase 5: SQL aggregation |
| Single-process Node.js | ~500 concurrent users | Phase 8: Horizontal scaling or serverless |

### 3.2 Scaling Projections

| Scale | Users | Entries | Architecture Required |
|-------|-------|---------|----------------------|
| **Current** | 1 | < 500 | JSON file is fine |
| **Phase 5** | 1-100 | < 10,000 | Supabase free tier |
| **Phase 7** | 100-1,000 | < 100,000 | Supabase Pro, connection pooling |
| **Phase 9** | 1,000-10,000 | < 1,000,000 | Read replicas, CDN, edge functions |
| **Phase 10** | 10,000+ | 1M+ | Consider dedicated PostgreSQL, caching layer |

### 3.3 Caching Strategy (Phase 7+)

```
Tier 1: Browser cache (static assets)
  - index.html: no-cache (SPA, always fresh)
  - CSS/JS bundles: immutable, 1yr max-age (after splitting from HTML)
  - Fonts: 1yr max-age (Google Fonts handles this)

Tier 2: API response cache (server-side)
  - GET /api/stats: Cache for 60 seconds (stale-while-revalidate)
  - GET /api/entries: No cache (user expects real-time)

Tier 3: Database query cache
  - Not needed until > 100,000 entries per user
  - PostgreSQL's own buffer cache handles most cases
```

### 3.4 Indexing Strategy

The indexes defined in Section 2.1 cover the primary access patterns:

| Query Pattern | Index Used |
|---------------|-----------|
| List user's entries by date | `idx_entries_user_created` |
| Filter by user + emotion | `idx_entries_user_emotion` |
| Lookup entry by ID (for delete/update) | Primary key (implicit) |
| Stats aggregation on emotion_hierarchy | `idx_entries_hierarchy` (GIN) |

---

## 4. Technical Debt & Refactoring

### 4.1 Priority Refactoring (Do in Phase 5)

**R1: Persist ontology metadata in entries**

Currently, `POST /api/entries` does not save ontology data. The frontend sends `{text, emotion, emoji, message, advice}` but the ontology response includes `emotion_hierarchy`, `situation_context`, `confidence`, and `related_emotions`.

Fix: Update `saveEntry()` in the frontend to include ontology fields. Update `POST /api/entries` to accept and store them.

```javascript
// Frontend fix - saveEntry()
async function saveEntry(text, result) {
  const body = {
    text,
    emotion: result.emotion,
    emoji: result.emoji,
    message: result.message,
    advice: result.advice,
  };

  // Include ontology metadata if present
  if (result.ontology) {
    body.emotion_hierarchy = result.ontology.emotion_hierarchy;
    body.situation_context = result.ontology.situation_context;
    body.confidence_score = result.ontology.confidence;
    body.related_emotions = result.ontology.related_emotions;
  }

  // ... rest of fetch call
}
```

**R2: Fix `emotion_correlations` mapping**

The ontology file maps Korean emotion names to English related emotions. `findRelatedEmotions()` will never match. Either change the keys to Korean or change the values to Korean.

**R3: Extract data access layer**

Before migrating to Supabase, extract all JSON file operations into a separate module (`data-access.js`). This creates a clean seam for swapping implementations.

```
server.js
  |
  +---> data-access.js (interface)
         |
         +---> json-store.js    (current implementation)
         +---> supabase-store.js (Phase 5 implementation)
```

### 4.2 Deferred Refactoring (Phase 6-7)

**R4: Split index.html into components**

The 1,392-line HTML file should eventually be split, but NOT before Phase 6. The current monolith works fine for a single developer and avoids build tool complexity. When you add authentication UI (login/signup forms), that is the natural trigger to adopt a component framework.

**R5: Add error boundaries to the frontend**

Currently, any API failure shows a toast. For critical operations (save, delete), add retry logic with exponential backoff.

**R6: Add request validation middleware**

Extract input validation from route handlers into Express middleware. Reduces code duplication between `/api/analyze` and `/api/entries`.

### 4.3 Microservices Consideration

**Verdict: Do NOT adopt microservices.**

The entire application is a single-purpose tool (diary analysis) with three operations:
1. Write diary text
2. Analyze emotion via Gemini
3. Read/search history

This does not warrant microservices. A monolithic Express server with clean module boundaries (data access, ontology engine, API routes) is the correct architecture for this scale. Even at 10,000 users, a single well-configured server handles this load.

If you eventually need to extract anything, the Gemini API proxy is the only candidate for a separate function (e.g., a Supabase Edge Function), because it has different scaling characteristics (CPU-bound parsing, external API timeout).

---

## 5. Phase 6-10 Roadmap

### Phase 6: Authentication (Week 4-5)

**Architecture**: Supabase Auth with JWT tokens.

```
Browser
  |
  +-- Supabase Auth JS SDK (sign up, sign in, sign out)
  |     |
  |     v
  |   Supabase Auth (GoTrue)
  |     |
  |     +-- Returns JWT (access_token + refresh_token)
  |
  +-- fetch('/api/entries', { headers: { Authorization: 'Bearer <JWT>' } })
        |
        v
      Express middleware: verify JWT via Supabase
        |
        v
      Supabase client with user context (RLS applies automatically)
```

**Key decisions**:
- Use Supabase's built-in email/password auth (no OAuth initially)
- Store JWT in memory (not localStorage) to prevent XSS token theft
- Use `httpOnly` cookie as a fallback for session persistence
- The Express server validates the JWT and passes it to the Supabase client

**Auth middleware**:

```javascript
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  req.supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  next();
}
```

### Phase 7: Frontend Modernization (Week 6-8)

**Decision: Next.js vs. Vite + React vs. Keep Vanilla JS**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Next.js** | SSR, file-based routing, API routes replace Express | Heavy framework for a simple app, learning curve, vendor lock-in | No -- overkill |
| **Vite + React** | Fast HMR, component model, large ecosystem | Adds build step, bundle size | Yes -- if team knows React |
| **Vite + Vanilla TS** | Minimal overhead, type safety, keeps current architecture | No component model | Yes -- simplest upgrade path |
| **Keep as-is** | Zero migration cost | Growing maintenance burden | Acceptable until 2,000+ lines |

**Recommendation**: Adopt **Vite + Vanilla TypeScript** first. This gives you:
- Module splitting (separate CSS/JS files, code splitting)
- Type safety for API contracts
- Hot module replacement for development
- No framework lock-in
- Easy migration to React/Svelte later if needed

If the team already knows React, skip directly to **Vite + React** with these components:
- `<DiaryInput />` -- form with character counter
- `<ResponseCard />` -- AI response display with ontology
- `<HistoryList />` -- filterable entry list
- `<Dashboard />` -- stats charts
- `<AuthForm />` -- login/signup (Phase 6)

### Phase 8: Deployment & CI/CD (Week 8-9)

```
GitHub (main branch)
  |
  +-- Push triggers GitHub Actions
       |
       +-- Lint + Type check
       +-- Run tests (Vitest)
       +-- Build frontend (Vite)
       +-- Deploy to:
            |
            +-- Option A: Vercel (frontend) + Supabase (backend/DB)
            |     - Express API moves to Supabase Edge Functions
            |     - Simplest deployment, lowest ops cost
            |
            +-- Option B: Railway/Render (Express) + Supabase (DB)
            |     - Keep Express as-is
            |     - More control, slightly more cost
            |
            +-- Option C: Docker + any VPS
                  - Most control, most ops work
```

**Recommendation**: Option A (Vercel + Supabase) for simplicity. The Express server's only job beyond static serving is the Gemini API proxy, which maps cleanly to a Supabase Edge Function or Vercel Serverless Function.

### Phase 9: Advanced Features (Week 10-12)

- **Emotion trends**: Weekly/monthly aggregation views using PostgreSQL window functions
- **Export**: CSV/PDF generation via server-side endpoint
- **Dark mode**: CSS custom properties already in place (`--color-*`), add `:root[data-theme="dark"]`
- **PWA**: Service worker for offline diary writing with sync-on-reconnect
- **Notifications**: Supabase Realtime for multi-device sync

### Phase 10: Scale & Polish (Week 13+)

- **i18n**: Extract Korean strings to locale files
- **Rate limiting**: Express-rate-limit middleware (already partially handled by Gemini's 429)
- **Observability**: Structured logging (pino), error tracking (Sentry)
- **Performance monitoring**: Core Web Vitals tracking
- **Accessibility audit**: Full WCAG 2.1 AA compliance review

---

## 6. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Supabase free tier limits exceeded | Medium | High | Monitor usage, have migration path to self-hosted PostgreSQL |
| R2 | Gemini API pricing/quota changes | Medium | High | Abstract Gemini calls behind interface, allow swap to Claude/GPT |
| R3 | Data loss during JSON-to-PostgreSQL migration | Low | Critical | Backup `entries.json` before migration, verify row counts, run migration on test project first |
| R4 | Frontend grows beyond maintainability | High | Medium | Phase 7 addresses this. Until then, keep functions small and well-named. |
| R5 | OntologyEngine keyword matching produces wrong results | Medium | Low | The engine enriches, not replaces, Gemini's analysis. Wrong enrichment is annoying but not harmful. |
| R6 | No test coverage means regressions go unnoticed | High | Medium | Add minimal API integration tests in Phase 5 (5-10 tests covering CRUD + stats). |

---

## Appendix A: Recommended Phase 5 File Structure

```
/home/faeqsu10/projects/vibe-coding/study-04/
  server.js                 (refactored: routes only, delegates to data layer)
  lib/
    data-access.js          (interface: getEntries, saveEntry, deleteEntry, getStats)
    json-store.js           (current JSON implementation)
    supabase-store.js       (new Supabase implementation)
    ontology-engine.js      (extracted from server.js, unchanged logic)
    gemini-client.js        (extracted: Gemini API call + parsing)
  migrations/
    001_create_tables.sql   (schema from Section 2.1)
    002_create_indexes.sql
    003_create_rls.sql
    migrate.js              (JSON -> PostgreSQL migration script)
  public/
    index.html              (minimal frontend changes: save ontology data)
  data/
    emotion-ontology.json
    situation-ontology.json
    entries.json            (kept as backup, no longer primary store)
  tests/
    api.test.js             (basic CRUD integration tests)
  .env.example              (updated with Supabase vars)
  package.json              (add @supabase/supabase-js, vitest)
```

## Appendix B: Success Metrics

| Metric | Current | Phase 5 Target | Phase 7 Target |
|--------|---------|----------------|----------------|
| API response time (entries list) | ~50ms (small dataset) | < 100ms at 10,000 entries | < 50ms with pagination |
| Concurrent user support | 1 (JSON file lock) | 100+ (PostgreSQL) | 1,000+ |
| Data durability | Single JSON file, no backup | PostgreSQL with Supabase backups | Point-in-time recovery |
| Test coverage | 0% | > 60% (API endpoints) | > 80% |
| Frontend bundle size | 54.7KB (single HTML) | Same | < 100KB gzipped (after splitting) |
| Lighthouse accessibility score | ~85 (estimated) | ~90 | 95+ |

---

**Document version**: 1.0
**Author**: Tech Architect Agent
**Next review**: After Phase 5 completion
