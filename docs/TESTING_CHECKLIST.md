# Phase 5-6 Testing Checklist

**Project**: AI Empathy Diary (Sentimind)
**Server**: `node server-v2.js`
**Prerequisites**: Supabase project configured, .env populated

---

## 0. Pre-Test Setup

```bash
# 1. Install dependencies
npm install

# 2. Verify .env has required variables
cat .env | grep SUPABASE

# 3. Run migrations (if not done)
# Execute 001-004 SQL files in Supabase SQL Editor

# 4. Start server
node server-v2.js

# 5. Verify health check
curl http://localhost:3000/api/health
```

**Expected**: `{"status":"ok","version":"2.0.0","supabase":"connected"}`

---

## 1. Health Check

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 1.1 | Health endpoint | `curl localhost:3000/api/health` | 200, supabase: "connected" | [ ] |
| 1.2 | Static files | Browser: `localhost:3000` | index.html loads | [ ] |

---

## 2. Auth: Signup

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 2.1 | Valid signup | `curl -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"testpass1"}'` | 201, user.id present | [ ] |
| 2.2 | Duplicate email | Repeat 2.1 | 409, "이미 등록된 이메일" | [ ] |
| 2.3 | Missing email | `curl -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"password":"testpass1"}'` | 400, validation error | [ ] |
| 2.4 | Weak password | `curl -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"test2@example.com","password":"12345"}'` | 400, "8자 이상" | [ ] |
| 2.5 | No numbers in password | `curl -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"test2@example.com","password":"abcdefgh"}'` | 400, "숫자를 포함" | [ ] |
| 2.6 | Rate limit | Send 4 requests in 15min | 429 on 4th request | [ ] |

---

## 3. Auth: Login

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 3.1 | Valid login | `curl -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"testpass1"}'` | 200, access_token present | [ ] |
| 3.2 | Wrong password | Change password in -d | 401, "이메일 또는 비밀번호" | [ ] |
| 3.3 | Wrong email | Use non-existent email | 401 | [ ] |
| 3.4 | Missing password | Omit password field | 400 | [ ] |
| 3.5 | Rate limit | Send 6 requests in 1min | 429 on 6th | [ ] |

**Save the access_token from 3.1 for subsequent tests**:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

---

## 4. Auth: Other

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 4.1 | Get me | `curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/auth/me` | 200, user.id + email | [ ] |
| 4.2 | Get me (no token) | `curl localhost:3000/api/auth/me` | 401, UNAUTHORIZED | [ ] |
| 4.3 | Get me (bad token) | `curl -H "Authorization: Bearer invalid" localhost:3000/api/auth/me` | 401 | [ ] |
| 4.4 | Logout | `curl -X POST -H "Authorization: Bearer $TOKEN" localhost:3000/api/auth/logout` | 200, success: true | [ ] |
| 4.5 | Reset password | `curl -X POST localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d '{"email":"test@example.com"}'` | 200 (always) | [ ] |
| 4.6 | Reset nonexistent | `curl -X POST localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d '{"email":"nope@nope.com"}'` | 200 (no enumeration) | [ ] |
| 4.7 | Token refresh | `curl -X POST localhost:3000/api/auth/refresh -H 'Content-Type: application/json' -d '{"refresh_token":"..."}'` | 200, new tokens | [ ] |

---

## 5. Entries: CRUD

**Re-login to get a fresh token before these tests.**

### 5.1 Create Entry

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 5.1.1 | Valid entry | `curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' localhost:3000/api/entries -d '{"text":"오늘 좋은 하루","emotion":"기쁨","emoji":"😊","message":"좋았습니다","advice":"쉬세요"}'` | 201, id present, date present | [ ] |
| 5.1.2 | With ontology | Add `emotion_hierarchy`, `situation_context`, `confidence_score` fields | 201, all fields stored | [ ] |
| 5.1.3 | Empty text | `{"text":""}` | 400, "일기 내용을 입력" | [ ] |
| 5.1.4 | Text > 500 chars | 501 char string | 400, "500자 이내" | [ ] |
| 5.1.5 | No auth | Omit Authorization header | 401 | [ ] |
| 5.1.6 | Invalid confidence | `{"text":"test","confidence_score":150}` | 400, "0~100 사이" | [ ] |

### 5.2 List Entries

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 5.2.1 | List all | `curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/entries` | 200, array with entry from 5.1.1 | [ ] |
| 5.2.2 | Pagination | `?limit=1&offset=0` | 200, 1 entry, X-Total-Count header | [ ] |
| 5.2.3 | Emotion filter | `?emotion=기쁨` | 200, filtered results | [ ] |
| 5.2.4 | Text search | `?search=좋은` | 200, matching entries | [ ] |
| 5.2.5 | No auth | Omit token | 401 | [ ] |

### 5.3 Update Entry

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 5.3.1 | Valid update | `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' localhost:3000/api/entries/ENTRY_ID -d '{"text":"수정된 일기"}'` | 200, updated text | [ ] |
| 5.3.2 | Non-existent ID | Use random ID | 404 | [ ] |
| 5.3.3 | Empty update | `{}` | 400, "수정할 항목이 없습니다" | [ ] |

### 5.4 Delete Entry

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 5.4.1 | Valid delete | `curl -X DELETE -H "Authorization: Bearer $TOKEN" localhost:3000/api/entries/ENTRY_ID` | 200, success: true | [ ] |
| 5.4.2 | Verify hidden | GET /api/entries should not include deleted entry | Deleted entry absent | [ ] |
| 5.4.3 | Non-existent ID | Use random ID | 404 | [ ] |
| 5.4.4 | No auth | Omit token | 401 | [ ] |

---

## 6. Stats

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 6.1 | Get stats | `curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/stats` | 200, total_entries, emotion_distribution, streak | [ ] |
| 6.2 | Streak present | Check response | streak.current >= 0, streak.max >= 0 | [ ] |
| 6.3 | Cache header | Check response headers | Cache-Control: private, max-age=60 | [ ] |
| 6.4 | No auth | Omit token | 401 | [ ] |

---

## 7. Profile

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 7.1 | Get profile | `curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/profile` | 200, id, email, theme | [ ] |
| 7.2 | Update nickname | `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' localhost:3000/api/profile -d '{"nickname":"테스터"}'` | 200, updated nickname | [ ] |
| 7.3 | Update theme | `{"theme":"dark"}` | 200 | [ ] |
| 7.4 | Invalid theme | `{"theme":"blue"}` | 400, "light 또는 dark" | [ ] |
| 7.5 | Long nickname | 31+ chars | 400, "30자 이내" | [ ] |
| 7.6 | Empty update | `{}` | 400 | [ ] |

---

## 8. Analyze (Gemini)

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 8.1 | Valid analyze | `curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' localhost:3000/api/analyze -d '{"text":"오늘 발표 잘 했어"}'` | 200, emotion + ontology | [ ] |
| 8.2 | Empty text | `{"text":""}` | 400 | [ ] |
| 8.3 | Text > 500 | 501 chars | 400 | [ ] |
| 8.4 | No auth | Omit token | 401 | [ ] |

---

## 9. RLS (Row Level Security)

**Requires two different user accounts.**

| # | Test | Expected | Status |
|---|------|----------|--------|
| 9.1 | User A creates entry | 201 | [ ] |
| 9.2 | User B lists entries | User A's entry NOT visible | [ ] |
| 9.3 | User B tries to delete User A's entry | 404 (RLS blocks) | [ ] |
| 9.4 | User A lists entries | Only User A's entries visible | [ ] |

---

## 10. Performance

| # | Test | Target | Status |
|---|------|--------|--------|
| 10.1 | GET /api/entries (< 50 rows) | < 200ms | [ ] |
| 10.2 | POST /api/entries | < 300ms | [ ] |
| 10.3 | GET /api/stats (< 100 rows) | < 300ms | [ ] |
| 10.4 | POST /api/analyze | < 5s (Gemini dependent) | [ ] |

---

## 11. JSON Fallback Mode

**Remove SUPABASE_URL from .env and restart server.**

| # | Test | Expected | Status |
|---|------|----------|--------|
| 11.1 | Health check | supabase: "disabled" | [ ] |
| 11.2 | Create entry | 201, saved to entries.json | [ ] |
| 11.3 | List entries | 200, reads from entries.json | [ ] |
| 11.4 | Delete entry | 200, removed from entries.json | [ ] |
| 11.5 | Auth endpoints | 501, "Supabase가 설정되지 않았습니다" | [ ] |

---

## 12. Migration Script

| # | Test | Command | Expected | Status |
|---|------|---------|----------|--------|
| 12.1 | Dry run | `DRY_RUN=true node scripts/migrate-entries.js` | Preview output, no DB writes | [ ] |
| 12.2 | Full migration | `node scripts/migrate-entries.js` | All entries migrated, PASS | [ ] |
| 12.3 | Idempotent re-run | Run migration again | No errors, count matches | [ ] |
| 12.4 | Missing .env vars | Remove SUPABASE_URL | Exit with clear error | [ ] |

---

## Summary

| Category | Total Tests | Pass | Fail |
|----------|------------|------|------|
| Health | 2 | | |
| Auth: Signup | 6 | | |
| Auth: Login | 5 | | |
| Auth: Other | 7 | | |
| Entries CRUD | 14 | | |
| Stats | 4 | | |
| Profile | 6 | | |
| Analyze | 4 | | |
| RLS | 4 | | |
| Performance | 4 | | |
| JSON Fallback | 5 | | |
| Migration | 4 | | |
| **Total** | **65** | | |

---

**Created**: 2026-03-05
**Tester**: QA Engineer
**Last Updated**: 2026-03-05
