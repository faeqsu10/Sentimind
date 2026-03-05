# Sentimind API Design - Phase 5+6

**Version**: 1.0
**Date**: 2026-03-05
**Base URL**: `http://localhost:3000` (dev) / `https://sentimind.vercel.app` (prod)
**Related**: `docs/ARCHITECTURE_PHASE5.md`, `docs/DATABASE_SCHEMA.md`

---

## 1. API Conventions

### 1.1 Authentication

All endpoints except `/api/auth/*` require a valid JWT in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Missing or invalid tokens return `401 Unauthorized`.

### 1.2 Response Format

**Success**:
```json
{
  "data": { ... },
  "meta": { "count": 50, "total": 237 }
}
```

**Error**:
```json
{
  "error": "Korean error message for user display",
  "code": "ENTRY_NOT_FOUND"
}
```

Note: For backward compatibility during Phase 5 transition, existing endpoints (`/api/entries`, `/api/stats`) continue returning the current flat response shape. The `{ data, meta }` wrapper is used only for new endpoints. Migration to uniform response shape happens in Phase 7.

### 1.3 Pagination

List endpoints support cursor-based pagination via `limit` and `offset` query parameters:

```
GET /api/entries?limit=20&offset=0
GET /api/entries?limit=20&offset=20
```

Default: `limit=20`, `offset=0`. Maximum `limit=100`.

### 1.4 Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | VALIDATION_ERROR | Invalid input |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | Valid JWT but no permission (RLS) |
| 404 | NOT_FOUND | Resource does not exist |
| 409 | CONFLICT | Duplicate (e.g., email already registered) |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 502 | AI_SERVICE_ERROR | Gemini API failure |
| 504 | TIMEOUT | Gemini API timeout |

---

## 2. Auth Endpoints

### POST /api/auth/signup

Create a new user account via Supabase Auth.

**Auth**: None

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Validation**:
- `email`: Required, valid RFC 5322 format
- `password`: Required, min 8 chars, must contain letter + number

**Response 201**:
```json
{
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "user@example.com"
    },
    "session": null
  },
  "message": "Verification email sent"
}
```

Note: `session` is `null` because email verification is required before login.

**Response 409**:
```json
{
  "error": "Already registered email",
  "code": "CONFLICT"
}
```

**Rate Limit**: 3 requests / 15 minutes per IP

---

### POST /api/auth/login

Authenticate and receive JWT tokens.

**Auth**: None

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response 200**:
```json
{
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "v1.abc123...",
      "expires_in": 3600,
      "token_type": "bearer"
    }
  }
}
```

**Response 401**:
```json
{
  "error": "Incorrect email or password",
  "code": "UNAUTHORIZED"
}
```

**Rate Limit**: 5 requests / 1 minute per IP

---

### POST /api/auth/logout

Invalidate the current session.

**Auth**: Required

**Request**: Empty body

**Response 200**:
```json
{
  "data": { "success": true }
}
```

---

### POST /api/auth/reset-password

Send a password reset email.

**Auth**: None

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response 200** (always returns 200 to prevent email enumeration):
```json
{
  "data": { "message": "If the email exists, a reset link has been sent" }
}
```

---

### GET /api/auth/me

Get the current authenticated user's info.

**Auth**: Required

**Response 200**:
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com"
  }
}
```

---

## 3. Diary Endpoints

### POST /api/analyze

Analyze diary text via Gemini API. Returns emotion analysis with ontology enrichment.

**Auth**: Required
**Rate Limit**: 10 requests / 1 minute per user

**Request**:
```json
{
  "text": "Today was a great day at work"
}
```

**Validation**:
- `text`: Required, string, 1-500 chars, non-empty after trim

**Response 200** (unchanged from current):
```json
{
  "emotion": "?????????",
  "emoji": "???",
  "message": "Empathetic message from Gemini...",
  "advice": "Action suggestion...",
  "ontology": {
    "emotion_hierarchy": {
      "level1": "??????",
      "level2": "??????",
      "level3": "?????????",
      "emoji": "???"
    },
    "situation_context": [
      { "domain": "??????", "context": "?????????" }
    ],
    "confidence": 45,
    "related_emotions": []
  }
}
```

**Error Responses**:
- 400: Invalid input
- 429: Rate limited (user or Gemini)
- 502: Gemini API error
- 504: Gemini timeout

---

### GET /api/entries

List the authenticated user's diary entries (active only, sorted by newest).

**Auth**: Required

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 20 | Items per page (max 100) |
| offset | int | 0 | Skip N items |
| emotion | string | - | Filter by emotion name |
| search | string | - | Full-text search in entry text |

**Response 200**:
```json
[
  {
    "id": "V1StGXR8_Z5jdHi6B-myT",
    "date": "2026-03-05T03:52:06.658Z",
    "text": "Test diary entry",
    "emotion": "??????",
    "emoji": "???",
    "message": "Nice day...",
    "advice": "",
    "emotion_hierarchy": { "level1": "??????", "level2": "??????", "emoji": "???" },
    "situation_context": [{ "domain": "??????", "context": "??????" }],
    "confidence_score": 45,
    "related_emotions": []
  }
]
```

Note: The response is a flat array (backward compatible with current frontend). `date` is mapped from `created_at` for compatibility. The `X-Total-Count` response header contains the total number of active entries for pagination UI.

**Response Headers**:
```
X-Total-Count: 237
```

---

### POST /api/entries

Save a new diary entry.

**Auth**: Required

**Request**:
```json
{
  "text": "Test diary entry",
  "emotion": "??????",
  "emoji": "???",
  "message": "Nice day...",
  "advice": "Take a walk.",
  "emotion_hierarchy": { "level1": "??????", "level2": "??????", "emoji": "???" },
  "situation_context": [{ "domain": "??????", "context": "??????" }],
  "confidence_score": 45,
  "related_emotions": ["?????????", "??????"]
}
```

**Validation**:
- `text`: Required, string, 1-500 chars
- `emotion`: Required, string
- `emoji`: Optional, string, max 10 chars
- `message`: Optional, string
- `advice`: Optional, string
- `emotion_hierarchy`: Optional, object
- `situation_context`: Optional, array of objects
- `confidence_score`: Optional, integer 0-100
- `related_emotions`: Optional, array of strings

**Response 201**:
```json
{
  "id": "V1StGXR8_Z5jdHi6B-myT",
  "date": "2026-03-05T12:00:00.000Z",
  "text": "Test diary entry",
  "emotion": "??????",
  "emoji": "???",
  "message": "Nice day...",
  "advice": "Take a walk.",
  "emotion_hierarchy": { "level1": "??????", "level2": "??????", "emoji": "???" },
  "situation_context": [{ "domain": "??????", "context": "??????" }],
  "confidence_score": 45,
  "related_emotions": ["?????????", "??????"]
}
```

**Side Effect**: Updates `user_profiles.current_streak`, `max_streak`, and `last_entry_date`.

---

### PATCH /api/entries/:id

Update an existing diary entry. Only allowed within 24 hours of creation.

**Auth**: Required

**Request**:
```json
{
  "text": "Updated diary text",
  "reanalyze": true
}
```

**Validation**:
- `text`: Optional, string, 1-500 chars
- `reanalyze`: Optional, boolean (if true, re-run Gemini analysis on new text)
- Entry must be created within last 24 hours

**Response 200**:
```json
{
  "id": "V1StGXR8_Z5jdHi6B-myT",
  "date": "2026-03-05T12:00:00.000Z",
  "text": "Updated diary text",
  "emotion": "??????",
  "emoji": "???",
  "message": "Updated empathy message...",
  "advice": "Updated advice...",
  "updated_at": "2026-03-05T13:30:00.000Z"
}
```

**Response 403** (24hr expired):
```json
{
  "error": "24 hours have passed since creation, editing is no longer allowed",
  "code": "EDIT_WINDOW_EXPIRED"
}
```

---

### DELETE /api/entries/:id

Soft-delete a diary entry (sets `deleted_at`).

**Auth**: Required

**Response 200**:
```json
{
  "success": true
}
```

**Response 404**:
```json
{
  "error": "Entry not found",
  "code": "NOT_FOUND"
}
```

---

## 4. Stats Endpoint

### GET /api/stats

Get aggregated emotion statistics for the authenticated user.

**Auth**: Required

**Response 200** (backward compatible with current shape):
```json
{
  "total_entries": 42,
  "avg_confidence": 55,
  "emotion_distribution": {
    "??????": 12,
    "?????????": 8,
    "??????": 6,
    "?????????": 4,
    "?????????": 3
  },
  "top_emotions": [
    { "emotion": "??????", "count": 12 },
    { "emotion": "?????????", "count": 8 },
    { "emotion": "??????", "count": 6 },
    { "emotion": "?????????", "count": 4 },
    { "emotion": "?????????", "count": 3 }
  ],
  "top_situations": [
    { "situation": "??????/??????", "count": 15 },
    { "situation": "??????/??????", "count": 10 }
  ],
  "hourly_distribution": {
    "9:00": { "??????": 3, "?????????": 1 },
    "21:00": { "??????": 5, "??????": 2 }
  },
  "latest_entries": [
    {
      "id": "V1StGXR8_Z5jdHi6B-myT",
      "text": "...",
      "emotion": "??????",
      "emoji": "???",
      "date": "2026-03-05T12:00:00.000Z"
    }
  ],
  "streak": {
    "current": 5,
    "max": 12,
    "today_completed": true
  }
}
```

Note: `streak` is a new field added in Phase 5. The existing fields maintain their exact shape for backward compatibility.

**Cache**: `Cache-Control: private, max-age=60`

---

## 5. Profile Endpoints

### GET /api/profile

Get the authenticated user's profile.

**Auth**: Required

**Response 200**:
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "nickname": "???",
    "bio": null,
    "theme": "light",
    "notification_enabled": true,
    "notification_time": "21:00",
    "onboarding_completed": true,
    "current_streak": 5,
    "max_streak": 12,
    "created_at": "2026-03-01T09:00:00.000Z",
    "total_entries": 42
  }
}
```

Note: `total_entries` is computed via `COUNT(*)` on entries table, not stored.

---

### PATCH /api/profile

Update the authenticated user's profile.

**Auth**: Required

**Request** (all fields optional):
```json
{
  "nickname": "New Nickname",
  "bio": "Short bio",
  "theme": "dark",
  "notification_enabled": false,
  "notification_time": "22:00",
  "onboarding_completed": true
}
```

**Validation**:
- `nickname`: String, max 30 chars
- `bio`: String, max 200 chars
- `theme`: "light" or "dark"
- `notification_time`: HH:MM format

**Response 200**:
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "nickname": "New Nickname",
    "updated_at": "2026-03-05T13:00:00.000Z"
  }
}
```

---

## 6. Auth Middleware Implementation

```javascript
// lib/auth-middleware.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Server-side client for token verification
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  try {
    // Verify the JWT and get the user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
      });
    }

    // Attach user info to request
    req.user = user;

    // Create a user-scoped Supabase client
    // This client's queries are filtered by RLS (auth.uid() = user.id)
    req.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'UNAUTHORIZED',
    });
  }
}

module.exports = { authMiddleware };
```

### Usage in Routes

```javascript
// routes/entries.js
const { authMiddleware } = require('../lib/auth-middleware');
const router = require('express').Router();

router.get('/api/entries', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  const { data, error, count } = await req.supabaseClient
    .from('entries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to load entries' });
  }

  // Map created_at -> date for backward compatibility
  const entries = data.map(e => ({
    ...e,
    date: e.created_at,
  }));

  res.set('X-Total-Count', count);
  res.json(entries);
});

module.exports = router;
```

---

## 7. Rate Limiting Configuration

```javascript
const rateLimit = require('express-rate-limit');

// Analyze endpoint: cost-sensitive (Gemini API calls)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                    // 10 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

// Auth signup: prevent registration spam
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 3,                     // 3 signups per 15 min per IP
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many signup attempts', code: 'RATE_LIMITED' },
});

// Auth login: brute force protection
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,                     // 5 attempts per minute per IP
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many login attempts, please wait', code: 'RATE_LIMITED' },
});

// General API: abuse prevention
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
```

---

## 8. Frontend Integration Changes

### 8.1 Add Supabase Auth SDK

```html
<!-- In index.html <head> -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

### 8.2 Initialize Supabase Client

```javascript
const supabase = window.supabase.createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);
```

### 8.3 Auth State Management

```javascript
// Check session on page load
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDiaryUI();
    loadEntries();
  } else {
    showAuthUI();
  }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    showDiaryUI();
    loadEntries();
  } else if (event === 'SIGNED_OUT') {
    showAuthUI();
  }
});
```

### 8.4 Add JWT to API Calls

```javascript
async function fetchWithAuth(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showAuthUI();
    throw new Error('Not authenticated');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
}
```

### 8.5 Fix saveEntry to Include Ontology Data

```javascript
// BEFORE (current - loses ontology data):
async function saveEntry(text, result) {
  const response = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      emotion: result.emotion,
      emoji: result.emoji,
      message: result.message,
      advice: result.advice,
    }),
  });
}

// AFTER (includes ontology metadata):
async function saveEntry(text, result) {
  const body = {
    text,
    emotion: result.emotion,
    emoji: result.emoji,
    message: result.message,
    advice: result.advice,
  };

  if (result.ontology) {
    body.emotion_hierarchy = result.ontology.emotion_hierarchy;
    body.situation_context = result.ontology.situation_context;
    body.confidence_score = result.ontology.confidence;
    body.related_emotions = result.ontology.related_emotions;
  }

  const response = await fetchWithAuth('/api/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json();
    throw { userMessage: data.error || 'Failed to save diary' };
  }
}
```

---

## 9. Backward Compatibility Matrix

| Aspect | Current | Phase 5 | Breaking? |
|--------|---------|---------|-----------|
| `/api/entries` response shape | `[{id, date, text, emotion, emoji, message, advice}]` | Same + optional ontology fields | No |
| `/api/stats` response shape | `{total_entries, avg_confidence, ...}` | Same + `streak` field | No (additive) |
| `/api/analyze` response shape | `{emotion, emoji, message, advice, ontology}` | Unchanged | No |
| DELETE behavior | Hard delete | Soft delete (same 200 response) | No |
| Auth requirement | None | Required (new) | Yes (but no existing users) |
| Entry IDs | base36 | nanoid | Yes (migration generates new IDs) |

The only truly breaking change is requiring authentication. Since there are no existing public users (only dev/test data), this is acceptable.

---

**Document version**: 1.0
**Next review**: After auth middleware implementation
