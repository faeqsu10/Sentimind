# Phase 5-6 Launch Checklist

**Project**: Sentimind - AI Empathy Diary
**Purpose**: Pre-deployment verification checklist for Phase 5-6 completion
**Last Updated**: 2026-03-05
**Sign-off Required By**: Backend Lead + QA Engineer + PM

---

## Instructions

Each item must be verified and checked off by the designated verifier. Items marked [BLOCKER] must pass before the sprint can be considered complete. Items marked [RECOMMENDED] are strongly advised but will not block release.

---

## 1. Database Infrastructure [BLOCKER]

**Verifier**: DB Architect + Backend Lead

- [ ] Supabase project is active and accessible
- [ ] Region is set to Asia (Seoul or nearest)
- [ ] `entries` table created with all columns matching PRD schema
  - [ ] id (TEXT, PRIMARY KEY)
  - [ ] user_id (UUID, FK to auth.users, NOT NULL)
  - [ ] text (VARCHAR(500), NOT NULL)
  - [ ] emotion, emoji, message, advice fields present
  - [ ] emotion_hierarchy (JSONB)
  - [ ] situation_context (JSONB)
  - [ ] confidence_score (INT, CHECK 0-100)
  - [ ] related_emotions (TEXT[])
  - [ ] created_at, updated_at (TIMESTAMPTZ)
  - [ ] deleted_at (TIMESTAMPTZ, nullable for soft delete)
- [ ] `user_profiles` table created with all columns matching PRD schema
  - [ ] id (UUID, FK to auth.users, PRIMARY KEY)
  - [ ] nickname, bio, notification_time fields present
  - [ ] onboarding_completed (BOOLEAN)
  - [ ] current_streak, max_streak (INT)
  - [ ] created_at, updated_at (TIMESTAMPTZ)

**Notes**: ____________________________________________

---

## 2. Indexes [BLOCKER]

**Verifier**: DB Architect

- [ ] `idx_entries_user_id` on entries(user_id)
- [ ] `idx_entries_created_at` on entries(created_at DESC)
- [ ] `idx_entries_user_emotion` on entries(user_id, emotion)
- [ ] `idx_entries_active` on entries(user_id) WHERE deleted_at IS NULL

**Notes**: ____________________________________________

---

## 3. Security - RLS Policies [BLOCKER]

**Verifier**: QA Engineer

- [ ] RLS enabled on `entries` table
- [ ] RLS enabled on `user_profiles` table
- [ ] SELECT policy: users can only read their own entries (WHERE deleted_at IS NULL)
- [ ] INSERT policy: users can only insert entries with their own user_id
- [ ] UPDATE policy: users can only update their own entries
- [ ] DELETE policy: users can only delete their own entries
- [ ] user_profiles: users can only access their own profile

### Security Test Results

- [ ] **Test A**: User A creates an entry. User B attempts to SELECT it. Result: 0 rows returned.
- [ ] **Test B**: User A creates an entry. User B attempts to DELETE it. Result: 0 rows affected.
- [ ] **Test C**: User A creates an entry. User B attempts to UPDATE it. Result: 0 rows affected.
- [ ] **Test D**: Unauthenticated request to /api/entries. Result: 401 Unauthorized.
- [ ] **Test E**: Expired JWT token request. Result: 401 Unauthorized.

**Test Date**: ____________ **Tester**: ____________

---

## 4. Authentication [BLOCKER]

**Verifier**: Backend Lead + QA Engineer

### Signup Flow
- [ ] POST /api/auth/signup accepts email + password
- [ ] Password validation: minimum 8 characters, alphanumeric required
- [ ] Duplicate email returns clear error message
- [ ] Successful signup returns JWT token
- [ ] Email validation follows RFC 5322

### Login Flow
- [ ] POST /api/auth/login accepts email + password
- [ ] Correct credentials return JWT within 2 seconds
- [ ] Incorrect credentials return 401 with clear message
- [ ] JWT stored securely (httpOnly cookie or secure header)

### Logout Flow
- [ ] POST /api/auth/logout invalidates session
- [ ] After logout, previous token no longer works

### JWT Middleware
- [ ] All /api/entries endpoints require valid JWT
- [ ] All /api/stats endpoint requires valid JWT
- [ ] POST /api/analyze requires valid JWT
- [ ] /api/auth/* endpoints are publicly accessible (no JWT required)
- [ ] Token expiry handled gracefully (redirect to login)

**Notes**: ____________________________________________

---

## 5. API Endpoints [BLOCKER]

**Verifier**: QA Engineer

### Authenticated CRUD Operations

| Endpoint | Method | Test Result | Response Time | Status |
|----------|--------|-------------|---------------|--------|
| /api/auth/signup | POST | [ ] Pass | ___ms | |
| /api/auth/login | POST | [ ] Pass | ___ms | |
| /api/auth/logout | POST | [ ] Pass | ___ms | |
| /api/entries | GET | [ ] Pass | ___ms | |
| /api/entries | POST | [ ] Pass | ___ms | |
| /api/entries/:id | PATCH | [ ] Pass | ___ms | |
| /api/entries/:id | DELETE | [ ] Pass | ___ms | |
| /api/analyze | POST | [ ] Pass | ___ms | |
| /api/stats | GET | [ ] Pass | ___ms | |

### Response Format Compatibility
- [ ] GET /api/entries response format matches pre-migration format
- [ ] Ontology metadata (emotion_hierarchy, situation_context) preserved
- [ ] Timestamps returned in consistent format
- [ ] Error responses follow consistent structure: `{ error: string }`

### Gemini Integration
- [ ] POST /api/analyze still returns emotion, emoji, message, advice
- [ ] OntologyEngine enrichment still functional
- [ ] parseGeminiResponse handles markdown code blocks
- [ ] Retry logic (3 attempts with exponential backoff) still works
- [ ] thinkingConfig: { thinkingBudget: 0 } still set for Flash model

**Notes**: ____________________________________________

---

## 6. Data Migration [BLOCKER]

**Verifier**: Backend Dev #2 + QA Engineer

### Pre-Migration
- [ ] Backup of entries.json created (local copy)
- [ ] Backup of entries.json committed to git (or stored separately)
- [ ] Entry count recorded before migration: _____ entries

### Migration Execution
- [ ] Migration script ran without errors
- [ ] All entries inserted into Supabase
- [ ] Legacy user created for pre-auth entries

### Post-Migration Validation
- [ ] Row count matches: Supabase _____ == Original _____
- [ ] Spot check 5 random entries: text content matches
- [ ] Spot check: emotion_hierarchy JSONB preserved correctly
- [ ] Spot check: situation_context JSONB preserved correctly
- [ ] Spot check: confidence_score values preserved
- [ ] Spot check: created_at timestamps preserved
- [ ] No NULL values in required fields (text, emotion, user_id)

### Rollback Readiness
- [ ] Rollback script tested (can restore from backup)
- [ ] JSON fallback mode still works if SUPABASE_URL is removed

**Migration Date**: ____________ **Migrated By**: ____________

---

## 7. Frontend [BLOCKER]

**Verifier**: Frontend Dev + QA Engineer

### Auth UI
- [ ] Login page renders correctly
- [ ] Signup page renders correctly
- [ ] Form validation works (email format, password requirements)
- [ ] Error messages display clearly
- [ ] Successful login redirects to diary page
- [ ] Logout clears session and redirects to login

### Onboarding
- [ ] 3-step tutorial displays on first login
- [ ] "Skip" option works
- [ ] Onboarding completion recorded in user_profiles
- [ ] Does not show again after completion

### Existing Features (Regression)
- [ ] Diary writing works (text input -> analyze -> save)
- [ ] Diary history displays correctly
- [ ] Diary deletion works (with confirmation dialog)
- [ ] Statistics dashboard displays correctly
- [ ] Search/filter functionality works
- [ ] Emotion hierarchy card displays correctly
- [ ] Confidence badge displays correctly

### Responsive Design
- [ ] Mobile (375px): all features accessible
- [ ] Tablet (768px): layout appropriate
- [ ] Desktop (1280px): layout appropriate

### Accessibility
- [ ] Tab navigation works through all interactive elements
- [ ] ARIA labels present on form inputs
- [ ] Screen reader announces login/signup status
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 UI)

**Notes**: ____________________________________________

---

## 8. Performance [RECOMMENDED]

**Verifier**: QA Engineer

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| GET /api/entries (P95) | < 500ms | ___ms | [ ] |
| POST /api/entries (P95) | < 500ms | ___ms | [ ] |
| POST /api/analyze (P95) | < 5000ms | ___ms | [ ] |
| GET /api/stats (P95) | < 1000ms | ___ms | [ ] |
| Page First Contentful Paint | < 2000ms | ___ms | [ ] |
| 10 concurrent users | No errors | ___errors | [ ] |

**Test Tool Used**: ____________
**Test Date**: ____________

---

## 9. Environment Configuration [BLOCKER]

**Verifier**: Backend Lead

### Environment Variables
- [ ] GOOGLE_API_KEY set and working
- [ ] SUPABASE_URL set and correct
- [ ] SUPABASE_ANON_KEY set and correct
- [ ] SUPABASE_SERVICE_KEY set (server-side only, not exposed to client)
- [ ] LOG_LEVEL configured appropriately

### Security
- [ ] .env is in .gitignore (not committed)
- [ ] .env.example updated with all new variables (no real values)
- [ ] SUPABASE_SERVICE_KEY not exposed in frontend code
- [ ] GOOGLE_API_KEY not exposed in frontend code
- [ ] No hardcoded secrets in server.js

### Dependencies
- [ ] package.json includes @supabase/supabase-js
- [ ] `npm install` runs without errors
- [ ] `node server.js` starts without errors
- [ ] Server accessible at http://localhost:3000

**Notes**: ____________________________________________

---

## 10. Documentation [RECOMMENDED]

**Verifier**: PM

- [ ] docs/PHASE5_NOTES.md created (migration process, known issues)
- [ ] docs/DATABASE.md updated with new schema
- [ ] docs/API.md updated with auth endpoints
- [ ] .env.example updated with Supabase variables
- [ ] TEAM_GUIDE.md updated if needed
- [ ] tasks/todo.md updated with completion status

---

## 11. Git and Version Control [BLOCKER]

**Verifier**: Backend Lead

- [ ] All changes committed with proper commit convention
- [ ] No sensitive files (.env, credentials) in git history
- [ ] All commits pushed to GitHub
- [ ] Migration script committed (scripts/migrate-to-supabase.js or migrate.js)
- [ ] Commit messages follow convention: `<type>(<scope>): <Korean description>`

---

## 12. Known Issues and Tech Debt

Document any known issues that are accepted for this release:

| ID | Description | Severity | Deferred To |
|----|-------------|----------|-------------|
| | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Backend Lead | | | [ ] Approved |
| QA Engineer | | | [ ] Approved |
| PM | | | [ ] Approved |
| DB Architect | | | [ ] Approved |

### Final Decision

- [ ] **GO**: All BLOCKER items passed. Sprint complete. Ready for Phase 7.
- [ ] **NO-GO**: The following BLOCKER items have not passed: ____________

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-05 | Initial checklist based on PRD v2.0 and project plan |
