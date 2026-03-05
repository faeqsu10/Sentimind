# Sentimind Database Schema Design

**Version**: 1.0
**Date**: 2026-03-05
**Target**: Supabase PostgreSQL (Seoul region)
**Related**: `docs/ARCHITECTURE_PHASE5.md`, `docs/API_DESIGN.md`

---

## 1. Schema Overview

```
auth.users (Supabase managed)
  |
  | 1:1 (trigger: on_auth_user_created)
  v
public.user_profiles
  |
  | 1:N
  v
public.entries
```

Two application tables. The `auth.users` table is managed by Supabase Auth and is not directly modified by application code.

---

## 2. Table Definitions

### 2.1 user_profiles

Stores user preferences and gamification state. Created automatically via trigger when a user signs up through Supabase Auth.

```sql
CREATE TABLE public.user_profiles (
  -- Primary key references Supabase Auth user
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile fields
  nickname VARCHAR(30),
  bio VARCHAR(200),

  -- Preferences
  theme VARCHAR(10) CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_time TIME,                -- User's preferred reminder time (KST)

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- Gamification (streaks)
  current_streak INT DEFAULT 0 CHECK (current_streak >= 0),
  max_streak INT DEFAULT 0 CHECK (max_streak >= 0),
  last_entry_date DATE,                  -- Last date user wrote a diary (KST)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comment on table
COMMENT ON TABLE public.user_profiles IS 'User preferences and gamification state. Auto-created on auth.users insert.';
COMMENT ON COLUMN public.user_profiles.notification_time IS 'KST time for daily reminder push notification';
COMMENT ON COLUMN public.user_profiles.last_entry_date IS 'Date of last diary entry, used for streak calculation';
```

### 2.2 entries

Core diary entries table with denormalized ontology metadata for query performance.

```sql
CREATE TABLE public.entries (
  -- Identity
  id TEXT PRIMARY KEY,                   -- nanoid (21 chars), NOT UUID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Diary content
  text VARCHAR(500) NOT NULL,

  -- Gemini analysis results
  emotion VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '???',
  message TEXT,
  advice TEXT,

  -- Ontology metadata (denormalized JSONB for query speed)
  emotion_hierarchy JSONB DEFAULT '{}',
  -- Expected shape: {"level1": "???", "level2": "???", "level3": "???", "emoji": "???"}

  situation_context JSONB DEFAULT '[]',
  -- Expected shape: [{"domain": "??????", "context": "??????"}, ...]

  confidence_score SMALLINT DEFAULT 0
    CHECK (confidence_score >= 0 AND confidence_score <= 100),

  related_emotions TEXT[] DEFAULT '{}',
  -- Expected shape: ["???", "?????????"]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ               -- Soft delete: NULL = active, non-NULL = deleted
);

-- Comments
COMMENT ON TABLE public.entries IS 'Diary entries with AI emotion analysis and ontology metadata';
COMMENT ON COLUMN public.entries.id IS 'nanoid (21 chars), generated client-side or server-side';
COMMENT ON COLUMN public.entries.emotion_hierarchy IS '3-level emotion classification from OntologyEngine';
COMMENT ON COLUMN public.entries.situation_context IS 'Array of domain/context pairs from situation ontology';
COMMENT ON COLUMN public.entries.deleted_at IS 'Soft delete timestamp. Non-NULL entries are hidden from normal queries via RLS.';
```

### 2.3 Auto-Profile Trigger

When Supabase Auth creates a user, automatically insert a matching `user_profiles` row.

```sql
-- Function: create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger: fires after new auth.users row
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 2.4 Updated_at Trigger

Automatically update `updated_at` on row modification.

```sql
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to user_profiles
CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Apply to entries
CREATE TRIGGER set_updated_at_entries
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

---

## 3. Row Level Security (RLS) Policies

### 3.1 user_profiles

```sql
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled by the trigger (SECURITY DEFINER bypasses RLS)
-- No direct INSERT policy needed for normal users
```

### 3.2 entries

```sql
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- Users can read their own ACTIVE entries (soft-deleted entries hidden)
CREATE POLICY "entries_select_own"
  ON public.entries
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can insert entries for themselves only
CREATE POLICY "entries_insert_own"
  ON public.entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own active entries
CREATE POLICY "entries_update_own"
  ON public.entries
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (soft-delete) their own entries
-- Note: application performs UPDATE (set deleted_at), not DELETE
-- This policy is for hard-delete if ever needed (e.g., GDPR purge)
CREATE POLICY "entries_delete_own"
  ON public.entries
  FOR DELETE
  USING (auth.uid() = user_id);
```

**Important**: The SELECT policy automatically excludes soft-deleted entries. Application code does NOT need `WHERE deleted_at IS NULL` -- RLS handles it. This prevents accidental data leaks from forgotten WHERE clauses.

---

## 4. Indexes

```sql
-- Primary access pattern: list user's entries sorted by date
CREATE INDEX idx_entries_user_created
  ON public.entries (user_id, created_at DESC);

-- Filter by emotion for stats and search
CREATE INDEX idx_entries_user_emotion
  ON public.entries (user_id, emotion)
  WHERE deleted_at IS NULL;

-- Partial index for active entries (used by most queries)
CREATE INDEX idx_entries_active
  ON public.entries (user_id)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB queries on emotion_hierarchy (stats aggregation)
CREATE INDEX idx_entries_hierarchy
  ON public.entries USING GIN (emotion_hierarchy)
  WHERE deleted_at IS NULL;

-- For situation_context JSONB array queries
CREATE INDEX idx_entries_situation
  ON public.entries USING GIN (situation_context)
  WHERE deleted_at IS NULL;
```

### Index Rationale

| Index | Query It Serves | Without It |
|-------|----------------|------------|
| `idx_entries_user_created` | `GET /api/entries?limit=20&offset=0` sorted by date | Full table scan per user |
| `idx_entries_user_emotion` | `GET /api/stats` emotion aggregation | Sequential scan with filter |
| `idx_entries_active` | Any query filtering active entries | Reads deleted rows unnecessarily |
| `idx_entries_hierarchy` | Stats queries on `emotion_hierarchy->>'level1'` | Sequential JSONB parsing |
| `idx_entries_situation` | Stats queries expanding `situation_context` array | Sequential JSONB parsing |

---

## 5. Data Types and Constraints Summary

| Column | Type | Constraint | Why |
|--------|------|-----------|-----|
| `user_profiles.id` | UUID | FK -> auth.users, CASCADE | Supabase Auth manages UUIDs |
| `entries.id` | TEXT | PK | nanoid (21 chars), shorter than UUID for URLs |
| `entries.user_id` | UUID | NOT NULL, FK -> auth.users, CASCADE | User isolation |
| `entries.text` | VARCHAR(500) | NOT NULL | Matches frontend 500-char limit |
| `entries.emotion` | VARCHAR(100) | NOT NULL | Korean emotion names up to ~50 chars |
| `entries.confidence_score` | SMALLINT | CHECK 0-100 | Percentage, 2 bytes vs 4 for INT |
| `entries.emotion_hierarchy` | JSONB | DEFAULT '{}' | Flexible schema, GIN-indexable |
| `entries.situation_context` | JSONB | DEFAULT '[]' | Array of objects, GIN-indexable |
| `entries.related_emotions` | TEXT[] | DEFAULT '{}' | Simple string array |
| All timestamps | TIMESTAMPTZ | DEFAULT now() | Always store with timezone |

---

## 6. Sample Data

### user_profiles row

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "nickname": "???",
  "bio": null,
  "theme": "light",
  "notification_enabled": true,
  "notification_time": "21:00:00",
  "onboarding_completed": true,
  "current_streak": 5,
  "max_streak": 12,
  "last_entry_date": "2026-03-05",
  "created_at": "2026-03-01T09:00:00+09:00",
  "updated_at": "2026-03-05T21:30:00+09:00"
}
```

### entries row

```json
{
  "id": "V1StGXR8_Z5jdHi6B-myT",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "text": "?????? ?????? ????????? ??? ?????? ??????. ??????????????? ??????????????? ???????????????",
  "emotion": "?????????",
  "emoji": "???",
  "message": "????????? ?????? ?????? ?????? ?????? ?????? ???????????? ?????? ?????? ????????????!",
  "advice": "????????? ????????? ????????? ???????????? ????????? ?????? ???????????????.",
  "emotion_hierarchy": {
    "level1": "??????",
    "level2": "??????",
    "level3": "?????????",
    "emoji": "???"
  },
  "situation_context": [
    { "domain": "??????", "context": "??????" }
  ],
  "confidence_score": 45,
  "related_emotions": ["??????", "??????"],
  "created_at": "2026-03-05T12:41:44.974+09:00",
  "updated_at": "2026-03-05T12:41:44.974+09:00",
  "deleted_at": null
}
```

---

## 7. Migration SQL Files

These SQL files should be run in order via Supabase SQL Editor or `supabase db push`.

### 7.1 File: migrations/001_create_tables.sql

Contains: `CREATE TABLE user_profiles`, `CREATE TABLE entries` from Section 2.

### 7.2 File: migrations/002_create_indexes.sql

Contains: All `CREATE INDEX` statements from Section 4.

### 7.3 File: migrations/003_create_rls_policies.sql

Contains: All `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements from Section 3.

### 7.4 File: migrations/004_create_triggers.sql

Contains: `handle_new_user()`, `update_updated_at()`, and their associated triggers from Sections 2.3 and 2.4.

---

## 8. Stats Queries (replacing in-memory JavaScript)

### 8.1 Full stats for /api/stats

```sql
-- Query 1: Summary counts
SELECT
  COUNT(*) as total_entries,
  COALESCE(ROUND(AVG(confidence_score)), 0) as avg_confidence
FROM public.entries
WHERE user_id = $1 AND deleted_at IS NULL;

-- Query 2: Top 5 emotions
SELECT emotion, COUNT(*) as count
FROM public.entries
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY emotion
ORDER BY count DESC
LIMIT 5;

-- Query 3: Top 5 situations
SELECT
  ctx->>'domain' as domain,
  ctx->>'context' as context,
  COUNT(*) as count
FROM public.entries,
  jsonb_array_elements(situation_context) as ctx
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY domain, context
ORDER BY count DESC
LIMIT 5;

-- Query 4: Hourly distribution
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Seoul') as hour,
  emotion,
  COUNT(*) as count
FROM public.entries
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY hour, emotion
ORDER BY hour;

-- Query 5: Latest 5 entries
SELECT id, text, emotion, emoji, created_at
FROM public.entries
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

### 8.2 Streak Calculation

Streak is maintained in `user_profiles` rather than computed on the fly. Update logic in the API:

```sql
-- Called after saving a new entry
-- Step 1: Check if user already wrote today
SELECT last_entry_date FROM public.user_profiles WHERE id = $1;

-- Step 2: If last_entry_date = today (KST), do nothing
-- Step 3: If last_entry_date = yesterday (KST), increment streak
UPDATE public.user_profiles
SET
  current_streak = current_streak + 1,
  max_streak = GREATEST(max_streak, current_streak + 1),
  last_entry_date = CURRENT_DATE AT TIME ZONE 'Asia/Seoul'
WHERE id = $1;

-- Step 4: If last_entry_date < yesterday, reset streak to 1
UPDATE public.user_profiles
SET
  current_streak = 1,
  max_streak = GREATEST(max_streak, 1),
  last_entry_date = CURRENT_DATE AT TIME ZONE 'Asia/Seoul'
WHERE id = $1;
```

---

## 9. Future Schema Extensions (Not in Phase 5)

These are noted here for awareness but are NOT implemented now.

| Phase | Table/Column | Purpose |
|-------|-------------|---------|
| Phase 8 | `activity_logs` | User action audit trail |
| Phase 8 | `user_profiles.premium_tier` | Subscription level |
| Phase 9 | `weekly_reports` | Pre-computed weekly summaries |
| Phase 9 | `notification_queue` | Push notification scheduling |

---

**Document version**: 1.0
**Next review**: After Supabase project creation
