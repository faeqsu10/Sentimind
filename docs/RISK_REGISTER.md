# Phase 5-6 Risk Register

**Project**: Sentimind - AI Empathy Diary
**Sprint**: Phase 5-6 Merged (DB Migration + Authentication)
**Last Updated**: 2026-03-05
**Risk Owner**: PM (Project Manager)
**Review Frequency**: Weekly (Friday review meeting)

---

## Risk Scoring

**Probability**: Low (1) | Medium (2) | High (3)
**Impact**: Low (1) | Medium (2) | High (3) | Critical (4)
**Risk Score** = Probability x Impact (1-12 scale)

| Score Range | Classification | Action Required |
|-------------|---------------|-----------------|
| 1-3 | LOW | Monitor only |
| 4-6 | MEDIUM | Mitigation plan required |
| 7-9 | HIGH | Active mitigation + weekly review |
| 10-12 | CRITICAL | Immediate escalation + daily review |

---

## Risk Register

### R01: Data Loss During Migration

| Field | Value |
|-------|-------|
| **ID** | R01 |
| **Category** | Technical |
| **Description** | entries.json data could be corrupted or lost during migration to Supabase PostgreSQL. Fields may be truncated, timestamps misformatted, or JSONB ontology metadata lost. |
| **Probability** | Low (1) |
| **Impact** | Critical (4) |
| **Risk Score** | 4 (MEDIUM) |
| **Owner** | Backend Dev #2 |
| **Affected Tasks** | T16, T17 |
| **Mitigation** | 1. Create 3 backups before migration: local copy, git-tracked copy, cloud backup. 2. Migration script runs in dry-run mode first (read-only validation). 3. Post-migration validation: row count, field-by-field comparison for 100% of records. 4. Rollback script prepared to restore from backup. |
| **Trigger Condition** | Validation report shows any discrepancy in row count or field values |
| **Contingency** | Restore from backup, fix migration script, re-run. JSON fallback still operational during this time. |
| **Status** | OPEN |

---

### R02: RLS Policy Misconfiguration (Data Exposure)

| Field | Value |
|-------|-------|
| **ID** | R02 |
| **Category** | Security |
| **Description** | Incorrectly configured RLS policies could expose User A's diary entries to User B. This is the most severe security risk for a personal diary application. |
| **Probability** | Medium (2) |
| **Impact** | Critical (4) |
| **Risk Score** | 8 (HIGH) |
| **Owner** | Backend Lead |
| **Affected Tasks** | T03, T23 |
| **Mitigation** | 1. DB Architect reviews all RLS policies before activation. 2. QA creates dedicated security test suite: create 2 test users, verify User A cannot read/modify/delete User B's entries. 3. Test with both Supabase client SDK and direct REST API calls. 4. RLS policies use `auth.uid() = user_id` pattern exclusively (no `true` policies in production). |
| **Trigger Condition** | Any test case shows cross-user data access |
| **Contingency** | Immediately disable public access. Fix RLS policies. Re-test before re-enabling. |
| **Status** | OPEN |

---

### R03: Supabase Account/Project Setup Delay

| Field | Value |
|-------|-------|
| **ID** | R03 |
| **Category** | Operational |
| **Description** | Supabase account creation or project provisioning could be delayed due to email verification, credit card requirements (Pro tier), or regional availability. |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Risk Score** | 3 (LOW) |
| **Owner** | Backend Lead |
| **Affected Tasks** | T01 (blocks entire sprint) |
| **Mitigation** | 1. Create Supabase account immediately (Day 0, before sprint officially starts). 2. Start with Free tier (no credit card needed). 3. Verify Seoul region availability in advance. 4. Have backup plan: use Supabase local dev (supabase CLI + Docker) if cloud provisioning is slow. |
| **Trigger Condition** | T01 not complete by end of Day 1 |
| **Contingency** | Use local Supabase via Docker for development while cloud project provisions. |
| **Status** | OPEN |

---

### R04: JWT/Auth Implementation Complexity

| Field | Value |
|-------|-------|
| **ID** | R04 |
| **Category** | Technical |
| **Description** | JWT verification middleware, httpOnly cookie handling, and Supabase Auth integration may take longer than estimated. Token refresh logic, CORS issues, and cookie security settings are common sources of unexpected complexity. |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Risk Score** | 6 (MEDIUM) |
| **Owner** | Backend Lead |
| **Affected Tasks** | T06, T07, T08 (blocks T10-T15 and T18) |
| **Mitigation** | 1. Use Supabase Auth JS SDK (handles most complexity). 2. Start with Supabase's built-in JWT verification (not custom implementation). 3. Prototype auth flow in isolation before integrating with API endpoints. 4. Backend Lead allocated as senior resource specifically for this task. |
| **Trigger Condition** | T06 not complete by end of Week 1 (03/11) |
| **Contingency** | Simplify: use Supabase anon key with RLS for initial version, add JWT middleware in parallel. This keeps API work unblocked. |
| **Status** | OPEN |

---

### R05: API Backward Compatibility Break

| Field | Value |
|-------|-------|
| **ID** | R05 |
| **Category** | Technical |
| **Description** | Migrating API endpoints from JSON file reads to Supabase queries may change response format, field names, or data types, breaking the existing frontend. |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Risk Score** | 4 (MEDIUM) |
| **Owner** | Backend Lead |
| **Affected Tasks** | T10-T14 |
| **Mitigation** | 1. Document current API response format before making changes. 2. Use adapter/transform layer to maintain backward compatibility. 3. Frontend Dev verifies each endpoint change against existing HTML/JS code. 4. Write comparison tests: old response vs new response structure. |
| **Trigger Condition** | Frontend tests fail after API migration |
| **Contingency** | Add response transformation middleware to normalize Supabase output to match legacy format. |
| **Status** | OPEN |

---

### R06: Supabase Performance Degradation

| Field | Value |
|-------|-------|
| **ID** | R06 |
| **Category** | Performance |
| **Description** | API response times may increase when switching from local JSON file reads to remote Supabase PostgreSQL queries, especially on Free tier with shared resources. |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Risk Score** | 4 (MEDIUM) |
| **Owner** | DB Architect |
| **Affected Tasks** | T04, T24 |
| **Mitigation** | 1. Create proper indexes (T04) on day 1 of schema creation. 2. Use connection pooling (Supabase provides this). 3. Set performance budget: GET /api/entries < 500ms P95. 4. Monitor query execution times via Supabase dashboard. 5. Consider caching for /api/stats endpoint (5-minute TTL). |
| **Trigger Condition** | P95 response time exceeds 500ms during performance testing |
| **Contingency** | Upgrade to Supabase Pro ($25/mo) for dedicated resources. Optimize queries. Add server-side caching. |
| **Status** | OPEN |

---

### R07: Team Member Unavailability

| Field | Value |
|-------|-------|
| **ID** | R07 |
| **Category** | Resource |
| **Description** | A team member (especially Backend Lead or DB Architect) becomes unavailable mid-sprint due to illness, personal reasons, or competing priorities. |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Risk Score** | 3 (LOW) |
| **Owner** | PM |
| **Affected Tasks** | All (depends on who is absent) |
| **Mitigation** | 1. Pair programming on critical-path tasks (knowledge sharing). 2. All work documented in GitHub (PRs, Issues). 3. DB Architect tasks front-loaded in Week 1. 4. Backend Dev #2 can handle some Backend Lead tasks if needed. |
| **Trigger Condition** | Any team member absent for 2+ consecutive days |
| **Contingency** | Re-prioritize: focus on Must-have tasks only. Extend sprint by up to 1 week if needed. |
| **Status** | OPEN |

---

### R08: Schema Design Errors Discovered Late

| Field | Value |
|-------|-------|
| **ID** | R08 |
| **Category** | Technical |
| **Description** | Schema design flaws (wrong column types, missing constraints, incorrect FK relationships) discovered during integration testing in Week 3-4 may require migration reruns. |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Risk Score** | 4 (MEDIUM) |
| **Owner** | DB Architect |
| **Affected Tasks** | T02, T16, T17 |
| **Mitigation** | 1. Use PRD v2.0 Section 7 schema as reference (already reviewed). 2. DB Architect and Backend Lead review schema together before creation. 3. Run migration script on test data early (Week 1-2) to catch issues. 4. Use Supabase migrations for schema changes (not manual SQL). |
| **Trigger Condition** | Schema change required after Week 2 |
| **Contingency** | Write ALTER TABLE migration. Re-run data migration. Retest affected API endpoints. Budget 2 days for this. |
| **Status** | OPEN |

---

### R09: Supabase Free Tier Limits Hit

| Field | Value |
|-------|-------|
| **ID** | R09 |
| **Category** | Operational |
| **Description** | Supabase Free tier limits (500MB storage, 2GB bandwidth, 50K monthly active users) may be insufficient if testing generates excessive data or connections. |
| **Probability** | Low (1) |
| **Impact** | Low (1) |
| **Risk Score** | 1 (LOW) |
| **Owner** | Backend Lead |
| **Affected Tasks** | All Supabase tasks |
| **Mitigation** | 1. Current data is small (entries.json ~42 entries). 2. Free tier is sufficient for development and beta. 3. Monitor usage in Supabase dashboard weekly. |
| **Trigger Condition** | Dashboard shows > 80% of any free tier limit |
| **Contingency** | Upgrade to Pro tier ($25/mo). Budget already accounts for this. |
| **Status** | OPEN |

---

### R10: Gemini API Integration Regression

| Field | Value |
|-------|-------|
| **ID** | R10 |
| **Category** | Technical |
| **Description** | Adding authentication to POST /api/analyze may break the existing Gemini API integration. The analyze endpoint's request/response flow includes complex JSON parsing (parseGeminiResponse) that could be affected by middleware changes. |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Risk Score** | 3 (LOW) |
| **Owner** | Backend Lead |
| **Affected Tasks** | T15 |
| **Mitigation** | 1. T15 is specifically allocated to verify Gemini integration after auth middleware is added. 2. Existing retry logic and parseGeminiResponse function should remain untouched. 3. Auth middleware should be applied at route level, not modifying request body. |
| **Trigger Condition** | POST /api/analyze returns errors or incorrect format after auth integration |
| **Contingency** | Isolate auth middleware from analyze endpoint. Debug middleware chain. |
| **Status** | OPEN |

---

## Risk Summary Dashboard

| ID | Risk | Score | Classification | Status |
|----|------|:-----:|---------------|--------|
| R02 | RLS Policy Misconfiguration | 8 | HIGH | OPEN |
| R04 | JWT/Auth Complexity | 6 | MEDIUM | OPEN |
| R01 | Data Loss During Migration | 4 | MEDIUM | OPEN |
| R05 | API Backward Compatibility | 4 | MEDIUM | OPEN |
| R06 | Supabase Performance | 4 | MEDIUM | OPEN |
| R08 | Schema Design Errors | 4 | MEDIUM | OPEN |
| R03 | Supabase Setup Delay | 3 | LOW | OPEN |
| R07 | Team Member Unavailability | 3 | LOW | OPEN |
| R10 | Gemini Integration Regression | 3 | LOW | OPEN |
| R09 | Free Tier Limits | 1 | LOW | OPEN |

### Top 3 Risks Requiring Active Monitoring

1. **R02 (RLS Misconfiguration)** - Highest risk score. Security-critical. Weekly review by Backend Lead + QA.
2. **R04 (JWT Complexity)** - On critical path. If delayed, blocks 80% of sprint work. Daily check in standup.
3. **R01 (Data Loss)** - Low probability but catastrophic impact. Backup verification before every migration run.

---

## Risk Review Log

| Date | Reviewer | Changes | Notes |
|------|----------|---------|-------|
| 2026-03-05 | Project Orchestrator | Initial register created | 10 risks identified |
| | | | |

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-05 | Initial risk register based on PRD v2.0 and project analysis |
