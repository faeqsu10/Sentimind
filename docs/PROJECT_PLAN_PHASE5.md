# Phase 5-6 Project Management Plan

**Project**: Sentimind - AI Empathy Diary
**Phase**: 5-6 Merged Sprint (DB Migration + Authentication)
**Duration**: 4 weeks (2026-03-05 ~ 2026-04-02)
**Document Owner**: Project Orchestrator
**Last Updated**: 2026-03-05
**Status**: READY - Awaiting Sprint Start

---

## 1. Scope Definition

### 1-1. Sprint Objective

Phase 5 (Supabase Backend Migration) and Phase 6 (Authentication & User System) are merged into a single 4-week sprint per PRD v2.0 Section 8-1. Shipping DB migration alone delivers no user-facing value; combining both phases produces the first multi-tenant capable release.

### 1-2. Key Deliverables

| ID | Deliverable | Owner | Target Week |
|----|-------------|-------|-------------|
| D1 | Supabase project with 2 tables (entries, user_profiles) + indexes | DB Architect | Week 1 |
| D2 | RLS policies (user-isolated CRUD on entries, profiles) | Backend Lead | Week 1 |
| D3 | JWT verification middleware + authenticated API endpoints | Backend Lead | Week 1-2 |
| D4 | Signup / Login / Logout UI + Onboarding 3-step flow | Frontend Dev | Week 2 |
| D5 | entries.json migration script with validation report | Backend Dev #2 + QA | Week 3 |
| D6 | Full integration test suite (API + RLS + security + performance) | QA + All | Week 4 |
| D7 | Documentation update (schema, deployment, migration notes) | Backend Lead | Week 4 |

### 1-3. Out of Scope (deferred to Phase 7+)

- Google OAuth social login (Should, not Must)
- Push notification system
- Weekly emotion trend chart
- Streak feature
- Vercel production deployment (Phase 7)

---

## 2. Team Structure

### 2-1. Roles and Responsibilities

| Role | Allocation | Person | Primary Responsibilities |
|------|-----------|--------|--------------------------|
| **Backend Lead** (Senior) | Full-time | TBD | Supabase setup, RLS, JWT middleware, API integration, architecture review |
| **Backend Dev #2** (Junior) | Full-time | TBD | Migration script, data validation, API test cases, performance benchmarks |
| **Frontend Dev** | Full-time | TBD | Login/Signup UI, onboarding flow, auth state management, profile page |
| **DB Architect** | Part-time (0.5) | TBD | Schema design, indexing strategy, performance tuning, RLS review |
| **QA Engineer** | Full-time | TBD | Test plan, security verification, RLS testing, integration testing, log monitoring |
| **PM** | Part-time (0.5) | TBD | Schedule tracking, risk monitoring, stakeholder reporting |

### 2-2. RACI Matrix

| Task | Backend Lead | Backend #2 | Frontend | DB Arch | QA | PM |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Supabase project creation | R/A | - | - | C | - | I |
| Schema design | C | - | - | R/A | I | I |
| RLS policies | R/A | - | - | C | C | I |
| Index creation | I | - | - | R/A | - | I |
| JWT middleware | R/A | C | I | - | C | I |
| API endpoint migration | R/A | C | - | - | C | I |
| Migration script | C | R/A | - | C | C | I |
| Data validation | I | R | - | - | A | I |
| Auth UI (signup/login) | C | - | R/A | - | C | I |
| Onboarding flow | I | - | R/A | - | C | I |
| Integration testing | C | C | C | - | R/A | I |
| Security testing | C | - | - | C | R/A | I |
| Documentation | R/A | C | C | C | C | I |

R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 3. Work Breakdown Structure (WBS)

### 3-1. Task Inventory

| ID | Task | Owner | Duration | Dependencies | Priority |
|----|------|-------|----------|-------------|----------|
| T01 | Supabase project creation + .env setup | Backend Lead | 0.5d | None | BLOCKER |
| T02 | Schema design: entries + user_profiles tables | DB Architect | 1.5d | T01 | BLOCKER |
| T03 | RLS policies: entries (4 CRUD) + profiles (read/write own) | Backend Lead | 1d | T02 | BLOCKER |
| T04 | Index creation (4 indexes on entries) | DB Architect | 0.5d | T02 | HIGH |
| T05 | Supabase JS client initialization in server.js | Backend Lead | 0.5d | T01 | HIGH |
| T06 | JWT verification middleware | Backend Lead | 1d | T05 | BLOCKER |
| T07 | POST /api/auth/signup endpoint | Backend Lead | 0.5d | T06 | BLOCKER |
| T08 | POST /api/auth/login endpoint | Backend Lead | 0.5d | T06 | BLOCKER |
| T09 | POST /api/auth/logout endpoint | Backend Lead | 0.25d | T06 | HIGH |
| T10 | GET /api/entries - Supabase query (authenticated) | Backend Lead | 0.5d | T03, T06 | BLOCKER |
| T11 | POST /api/entries - Supabase insert (authenticated) | Backend Lead | 0.5d | T03, T06 | BLOCKER |
| T12 | DELETE /api/entries/:id - soft delete (authenticated) | Backend Lead | 0.25d | T03, T06 | HIGH |
| T13 | PATCH /api/entries/:id - edit within 24h | Backend Lead | 0.5d | T03, T06 | MEDIUM |
| T14 | GET /api/stats - PostgreSQL aggregation | Backend Lead | 0.5d | T10 | HIGH |
| T15 | POST /api/analyze - maintain Gemini integration | Backend Lead | 0.25d | T06 | BLOCKER |
| T16 | Migration script (entries.json -> Supabase) | Backend #2 | 2d | T02, T03 | BLOCKER |
| T17 | Migration data validation | Backend #2 + QA | 1d | T16 | BLOCKER |
| T18 | Signup/Login UI (HTML/CSS/JS) | Frontend Dev | 2d | T07, T08 | BLOCKER |
| T19 | Auth state management (token storage, redirect) | Frontend Dev | 1d | T18 | HIGH |
| T20 | Onboarding 3-step tutorial | Frontend Dev | 1.5d | T18 | HIGH |
| T21 | Profile page (view/edit nickname, bio) | Frontend Dev | 1d | T19 | MEDIUM |
| T22 | API endpoint integration tests | QA | 2d | T10-T15 | BLOCKER |
| T23 | RLS security isolation tests | QA | 1d | T03, T22 | BLOCKER |
| T24 | Performance tests (< 500ms P95 for entries) | QA | 1d | T22 | HIGH |
| T25 | Frontend compatibility tests | QA | 1d | T18, T22 | HIGH |
| T26 | Bug fixes from testing | Backend Lead + #2 | 2d | T22-T25 | HIGH |
| T27 | Documentation (schema.md, migration notes, API update) | Backend Lead | 1d | T26 | MEDIUM |
| T28 | Final commit + GitHub push | Backend Lead | 0.25d | T27 | MEDIUM |

**Total estimated effort**: ~24 person-days across 4-week sprint (4-5 people)

### 3-2. Critical Path

The critical path determines the minimum possible project duration. Any delay on critical-path tasks delays the entire sprint.

```
T01 (Supabase setup, 0.5d)
  -> T02 (Schema design, 1.5d)
    -> T03 (RLS policies, 1d)
      -> T06 (JWT middleware, 1d)  [also needs T05]
        -> T10-T11 (API endpoints, 1d)
          -> T22 (Integration tests, 2d)
            -> T26 (Bug fixes, 2d)
              -> T27 (Documentation, 1d)
                -> T28 (Final commit, 0.25d)
```

**Critical path duration**: ~10.25 working days
**Available calendar**: 20 working days (4 weeks)
**Schedule buffer**: ~9.75 days (49% buffer)

### 3-3. Parallel Work Streams

Tasks that can run in parallel to maximize team utilization:

| Stream A (Backend Lead) | Stream B (Backend #2) | Stream C (Frontend) | Stream D (QA) |
|--------------------------|----------------------|---------------------|---------------|
| T01, T02 support | - | - | Test plan drafting |
| T03, T05, T06 | T16 (migration script) | UI wireframes | Test case design |
| T07-T15 (API endpoints) | T17 (data validation) | T18-T21 (Auth UI) | T22-T25 (testing) |
| T26 (bug fixes) | T26 (bug fixes) | T26 (UI bug fixes) | Regression testing |
| T27-T28 (docs) | - | - | Final verification |

---

## 4. Dependency Map

### 4-1. Task Dependencies (DAG)

```
T01 (Supabase Setup)
 |
 +---> T02 (Schema) --+--> T03 (RLS) --+--> T10 (GET entries)
 |                     |                +--> T11 (POST entries)
 |                     |                +--> T12 (DELETE entries)
 |                     |                +--> T13 (PATCH entries)
 |                     |                +--> T16 (Migration script)
 |                     |
 |                     +--> T04 (Indexes)  [parallel with T03]
 |
 +---> T05 (Client init) --> T06 (JWT middleware) --+--> T07 (signup)
                                                     +--> T08 (login)
                                                     +--> T09 (logout)
                                                     +--> T15 (analyze)

T07, T08 --> T18 (Auth UI) --> T19 (Auth state) --> T20 (Onboarding)
                                                 --> T21 (Profile)

T10-T15 --> T22 (Integration tests) --> T23 (Security tests)
                                    --> T24 (Performance tests)
T18 -----> T25 (Frontend tests)

T22-T25 --> T26 (Bug fixes) --> T27 (Documentation) --> T28 (Final commit)
```

### 4-2. Cross-Team Handoff Points

| Handoff | From | To | Trigger | Artifact |
|---------|------|-----|---------|----------|
| H1 | DB Architect -> Backend Lead | Schema created in Supabase | T02 complete | Table DDL + schema.md |
| H2 | Backend Lead -> Frontend Dev | Auth endpoints ready | T07, T08 complete | API docs with curl examples |
| H3 | Backend Lead -> Backend #2 | Schema + RLS ready | T02, T03 complete | Connection string + schema |
| H4 | Backend #2 -> QA | Migration complete | T16, T17 complete | Validation report |
| H5 | All devs -> QA | All features code-complete | T15, T18 complete | Branch ready for testing |
| H6 | QA -> Backend Lead | Bug reports filed | T22-T25 complete | GitHub Issues |

---

## 5. Budget and Resource Plan

### 5-1. Infrastructure Costs (Monthly)

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Supabase | Free -> Pro ($25/mo if needed) | $0 - $25 | Free: 500MB DB, 50K MAU |
| Vercel | Free (Hobby) | $0 | Serverless, 100GB bandwidth |
| Google Gemini API | Pay-as-you-go | ~$0.50 | ~200 requests/day at Tier 1 |
| Domain (optional) | - | $0 - $12/yr | Vercel subdomain is free |
| **Total (monthly)** | | **$0.50 - $25.50** | |

### 5-2. Development Effort

| Role | Weeks | Days/Week | Total Person-Days | Estimated Cost |
|------|-------|-----------|-------------------|---------------|
| Backend Lead (Senior) | 4 | 5 | 20 | $4,000 |
| Backend Dev #2 (Junior) | 4 | 5 | 20 | $2,800 |
| Frontend Dev | 4 | 5 | 20 | $3,000 |
| DB Architect (0.5) | 4 | 2.5 | 10 | $2,000 |
| QA Engineer | 4 | 5 | 20 | $2,500 |
| PM (0.5) | 4 | 2.5 | 10 | $1,200 |
| **Total** | | | **100 person-days** | **$15,500** |

Note: Cost estimates are approximations. Actual costs depend on team location and rate.

### 5-3. Budget Summary

| Category | 4-Week Sprint | Annual (if Pro tier) |
|----------|--------------|---------------------|
| Infrastructure | $0.50 - $25.50 | $6 - $306 |
| Development | ~$15,500 | One-time |
| **Total Phase 5-6** | **$15,500 - $15,526** | |

---

## 6. Communication Plan

### 6-1. Recurring Meetings

| Meeting | Frequency | Duration | Attendees | Purpose |
|---------|-----------|----------|-----------|---------|
| Daily Standup | Mon-Fri 09:00 | 15 min | All team | Yesterday / Today / Blockers |
| Weekly Planning | Monday 10:00 | 60 min | All team | Week goals, task assignment, risk review |
| Weekly Review | Friday 16:00 | 60 min | All team | Demo completed work, retrospective |
| Architecture Review | As needed | 30-60 min | Backend Lead + DB Arch | Schema changes, RLS review |

### 6-2. Communication Channels

| Channel | Purpose | Response SLA |
|---------|---------|-------------|
| Slack #phase5 | Daily development discussion | 2 hours |
| Slack #logging | Error reports, log analysis | 4 hours |
| GitHub Issues | Bug tracking, task tracking | 24 hours |
| GitHub PRs | Code review | 24 hours |
| Email | Formal announcements | 48 hours |

### 6-3. Escalation Path

| Level | Condition | Action | Owner |
|-------|-----------|--------|-------|
| L1 | Task blocked > 4 hours | Raise in Slack #phase5 | Any team member |
| L2 | Task blocked > 1 day | Escalate in daily standup | PM |
| L3 | Critical path at risk | Emergency meeting + re-plan | PM + Backend Lead |
| L4 | Sprint deadline at risk | Scope negotiation with stakeholders | PM |

---

## 7. Quality Gates

### 7-1. Week-End Checkpoints

| Checkpoint | Date | Criteria | Verified By |
|------------|------|----------|-------------|
| G1: Infrastructure Ready | End of Week 1 | Supabase project, schema, RLS, indexes created; JWT middleware functional | DB Architect + QA |
| G2: Auth Flow Complete | End of Week 2 | Signup/login/logout working E2E; all API endpoints authenticated | QA + PM |
| G3: Migration Validated | End of Week 3 | All entries.json data in Supabase; validation report 100% pass | QA + Backend #2 |
| G4: Release Candidate | End of Week 4 | All tests pass; 0 P1 bugs; documentation complete | Full team |

### 7-2. Definition of Done (Sprint Level)

- [ ] Signup -> Login -> Write diary -> View personal data flow works end-to-end
- [ ] Other users' diary entries return 403 (security isolation test passed)
- [ ] All entries.json data migrated to Supabase with 100% integrity
- [ ] API response time < 500ms P95 for GET /api/entries
- [ ] POST /api/analyze returns result within 5 seconds P95
- [ ] Mobile responsive layout verified (375px, 768px, 1280px)
- [ ] All changes committed to GitHub with proper commit conventions
- [ ] Migration process documented in docs/PHASE5_NOTES.md

---

## 8. Change Management

### 8-1. Change Request Process

1. Requester files GitHub Issue with label `change-request`
2. PM evaluates impact on timeline and scope
3. Backend Lead evaluates technical feasibility
4. Team discusses in next standup or emergency meeting
5. PM approves/rejects with documented rationale

### 8-2. Scope Change Triggers

Any of the following requires a formal change request:
- Adding new database tables beyond entries + user_profiles
- Adding new API endpoints beyond the 12 defined in PRD
- Changing authentication method (e.g., switching from JWT to session-based)
- Adding features from Phase 7+ scope

---

## 9. Post-Sprint Plan

### 9-1. Handoff to Phase 7 (Production Deployment)

Upon Phase 5-6 completion:
1. Tag release: `v2.0.0-beta`
2. Create `phase7/production-deployment` branch
3. Prepare Vercel environment variables
4. Draft beta user invitation list (10 users)
5. Set up uptime monitoring

### 9-2. Lessons Learned

At sprint end, the team will conduct a retrospective covering:
- Estimation accuracy (planned vs actual days per task)
- Blocker patterns and resolution times
- Communication effectiveness
- Technical debt incurred

Results will be recorded in `tasks/lessons.md`.

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-05 | Initial creation based on PRD v2.0 |
