# Test Coverage Summary — 2026-03-16

## Snapshot

- Test files: 44
- Total tests: 298
- Current status: all passing via `npm test`

## What Is Covered

### Server and Route Coverage

- Auth middleware and auth lifecycle routes
- Analyze, entries, stats, report, followup, illustrated diary
- Emotion graph, analytics, migrate, profile
- Error logs route and observability utilities
- DB utility helpers and validators

### Frontend Module Coverage

- API/auth/session refresh flows
- Guest mode, reminder, stats, history, calendar, sidebar
- Diary, profile, app shell, tutorial, splash
- Emotion graph client, analytics client, error reporter
- Shared state and shared utility helpers

### Integration Scenarios Added

- Auth boot with expired token -> refresh -> onboarding -> app entry
- Anonymous session -> guest conversion -> guest data migration
- Diary submit -> analyze -> save -> history/sidebar/dashboard refresh
- Report generate -> history load -> delete
- App dashboard tab -> stats load -> report generate -> history render

## Current Assessment

- Critical regression risk around main user journeys is now low.
- Remaining gaps are not major feature holes; they are optional deeper scenarios.
- The next step is no longer "add more unit tests everywhere", but either:
  - stop here and treat coverage work as complete for this phase, or
  - add true browser E2E coverage outside Vitest.

## Optional Backlog

If more coverage is desired later, prioritize:

1. Full browser E2E for auth -> write diary -> view dashboard
2. Real service worker / offline sync E2E
3. Visual regression for dashboard, emotion graph, tutorial overlay
4. CI reporting for coverage trend over time
