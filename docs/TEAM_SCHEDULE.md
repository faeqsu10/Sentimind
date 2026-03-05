# Phase 5-6 Team Schedule (4-Week Sprint)

**Project**: Sentimind - AI Empathy Diary
**Sprint**: Phase 5-6 Merged (DB Migration + Authentication)
**Period**: 2026-03-05 (Thu) ~ 2026-04-02 (Thu)
**Last Updated**: 2026-03-05

---

## Week 1: Infrastructure Foundation (03/05 - 03/11)

### Goal
Supabase project operational with schema, RLS, indexes, and JWT middleware ready.

### Daily Breakdown

| Day | Date | Backend Lead | Backend #2 | Frontend Dev | DB Architect | QA |
|-----|------|-------------|-----------|-------------|-------------|-----|
| Thu | 03/05 | T01: Supabase project creation | Environment setup | Auth UI wireframes | T02: Schema design start | Test plan drafting |
| Fri | 03/06 | T05: Supabase client init | Study migration patterns | Auth UI wireframes | T02: Schema design cont. | Test plan drafting |
| Mon | 03/09 | T03: RLS policies | T16: Migration script start | T18: Login page markup | T02: Schema finalize + T04: Indexes | Test case design |
| Tue | 03/10 | T06: JWT middleware | T16: Migration script cont. | T18: Signup page markup | RLS review with Backend Lead | RLS test case design |
| Wed | 03/11 | T06: JWT middleware complete | T16: Migration script cont. | T18: Auth form validation | Available for consultation | Integration test setup |

### Week 1 Gate (G1)
- [ ] Supabase project created with correct region (Asia)
- [ ] 2 tables created: entries, user_profiles
- [ ] 4 RLS policies active on entries table
- [ ] 4 indexes created on entries table
- [ ] JWT verification middleware functional
- [ ] Migration script 50% complete (reading + transforming data)

### Handoffs Due
- H1: DB Architect -> Backend Lead (Schema complete) by 03/09
- H3: Backend Lead -> Backend #2 (Schema + RLS for migration) by 03/10

---

## Week 2: Auth Endpoints + Auth UI (03/12 - 03/18)

### Goal
All authenticated API endpoints working. Signup/Login UI connected to backend.

### Daily Breakdown

| Day | Date | Backend Lead | Backend #2 | Frontend Dev | DB Architect | QA |
|-----|------|-------------|-----------|-------------|-------------|-----|
| Thu | 03/12 | T07: Signup endpoint + T08: Login endpoint | T16: Migration script complete | T18: Auth UI styling | - | Smoke test auth endpoints |
| Fri | 03/13 | T09: Logout + T15: Analyze auth | T17: Local test run | T19: Auth state management | Performance review (2h) | Auth endpoint tests |
| Mon | 03/16 | T10: GET entries + T11: POST entries | T17: Validation logic | T19: Token storage + redirect | - | API endpoint tests start |
| Tue | 03/17 | T12: DELETE + T13: PATCH entries | T17: Validation complete | T20: Onboarding step 1-2 | - | API endpoint tests cont. |
| Wed | 03/18 | T14: Stats endpoint | Bug fixes from testing | T20: Onboarding step 3 | Index performance check (2h) | API endpoint tests cont. |

### Week 2 Gate (G2)
- [ ] POST /api/auth/signup returns 201 with valid JWT
- [ ] POST /api/auth/login returns 200 with valid JWT
- [ ] POST /api/auth/logout invalidates session
- [ ] All CRUD endpoints require authentication (401 without token)
- [ ] Login/Signup UI functional in browser
- [ ] Migration script complete and tested locally

### Handoffs Due
- H2: Backend Lead -> Frontend Dev (Auth endpoints ready) by 03/12
- H4: Backend #2 -> QA (Migration script ready for review) by 03/13

---

## Week 3: Migration + Integration (03/19 - 03/25)

### Goal
Data migration executed and validated. Onboarding complete. Full integration testing begins.

### Daily Breakdown

| Day | Date | Backend Lead | Backend #2 | Frontend Dev | DB Architect | QA |
|-----|------|-------------|-----------|-------------|-------------|-----|
| Thu | 03/19 | API bug fixes from W2 tests | T16: Execute migration on staging | T20: Onboarding finalize | Migration data review (2h) | T17: Migration validation |
| Fri | 03/20 | API bug fixes cont. | T17: Data integrity verification | T21: Profile page | - | T22: Integration tests start |
| Mon | 03/23 | Support QA testing | Performance benchmarks | Frontend polish + responsive | - | T22: Integration tests cont. |
| Tue | 03/24 | T26: Bug fixes from testing | T26: Bug fixes | T25: Frontend compatibility tests | - | T23: RLS security tests |
| Wed | 03/25 | T26: Bug fixes | T26: Bug fixes | T26: UI bug fixes | Final schema review (2h) | T24: Performance tests |

### Week 3 Gate (G3)
- [ ] All entries.json data in Supabase (count match, field integrity)
- [ ] Migration validation report generated (0 errors)
- [ ] Onboarding 3-step flow functional
- [ ] Profile page functional
- [ ] Integration tests: 80%+ pass rate
- [ ] No P1 (critical) bugs open

### Handoffs Due
- H5: All devs -> QA (Features code-complete) by 03/23
- H6: QA -> All devs (Bug reports filed) by 03/24

---

## Week 4: Stabilization + Release (03/26 - 04/02)

### Goal
Zero P1 bugs. All tests passing. Documentation complete. Sprint closed.

### Daily Breakdown

| Day | Date | Backend Lead | Backend #2 | Frontend Dev | DB Architect | QA |
|-----|------|-------------|-----------|-------------|-------------|-----|
| Thu | 03/26 | T26: Final bug fixes | T26: Final bug fixes | T26: UI bug fixes | - | Regression testing |
| Fri | 03/27 | T27: Documentation | Cross-browser testing support | Cross-device testing | - | Regression testing cont. |
| Mon | 03/30 | T27: Documentation complete | T27: Migration docs | Accessibility check | - | Final test report |
| Tue | 03/31 | Code review + cleanup | Code review + cleanup | Code review + cleanup | - | Sign-off checklist |
| Wed | 04/01 | T28: Final commit | Support | Support | - | Verification |
| Thu | 04/02 | Sprint retrospective | Sprint retrospective | Sprint retrospective | Sprint retrospective | Sprint retrospective |

### Week 4 Gate (G4) - Release Candidate
- [ ] All integration tests passing (100%)
- [ ] RLS security tests passing (100%)
- [ ] Performance tests within thresholds
- [ ] 0 open P1 or P2 bugs
- [ ] Documentation complete (schema.md, API.md updated, PHASE5_NOTES.md)
- [ ] All changes committed and pushed to GitHub
- [ ] Sprint retrospective conducted

---

## Capacity Planning

### Available Capacity (4 weeks)

| Role | Days/Week | Total Days | Meetings Overhead (15%) | Net Productive Days |
|------|-----------|-----------|------------------------|-------------------|
| Backend Lead | 5 | 20 | 3 | 17 |
| Backend Dev #2 | 5 | 20 | 3 | 17 |
| Frontend Dev | 5 | 20 | 3 | 17 |
| DB Architect | 2.5 | 10 | 1.5 | 8.5 |
| QA Engineer | 5 | 20 | 3 | 17 |
| **Total** | | **90** | **13.5** | **76.5** |

### Planned Work vs Capacity

| Role | Planned Tasks (days) | Net Available (days) | Utilization | Buffer |
|------|---------------------|---------------------|-------------|--------|
| Backend Lead | 12 | 17 | 71% | 5 days |
| Backend Dev #2 | 6 | 17 | 35% | 11 days |
| Frontend Dev | 7 | 17 | 41% | 10 days |
| DB Architect | 3.5 | 8.5 | 41% | 5 days |
| QA Engineer | 7 | 17 | 41% | 10 days |

Note: Buffer accounts for bug fixes (T26), code reviews, unexpected issues, and learning curve. Backend Dev #2 and Frontend Dev have significant buffer, which is intentional for a junior-heavy team where estimates may be optimistic.

---

## Key Dates Summary

| Date | Event | Importance |
|------|-------|-----------|
| 2026-03-05 | Sprint start | -- |
| 2026-03-09 | Schema + RLS + Indexes complete (G1 partial) | BLOCKER for API work |
| 2026-03-11 | JWT middleware complete (G1) | BLOCKER for all auth work |
| 2026-03-12 | Auth endpoints ready | BLOCKER for Frontend auth UI |
| 2026-03-18 | All API endpoints code-complete (G2) | BLOCKER for testing |
| 2026-03-20 | Migration validated (G3 partial) | BLOCKER for production data |
| 2026-03-25 | Testing complete (G3) | BLOCKER for stabilization |
| 2026-04-01 | Final commit (G4) | Sprint close |
| 2026-04-02 | Sprint retrospective | Team improvement |

---

## Holiday / Absence Tracking

| Person | Planned Absence | Impact | Mitigation |
|--------|----------------|--------|-----------|
| (Fill as known) | - | - | - |

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-05 | Initial schedule based on PRD v2.0 Phase 5-6 merged sprint |
