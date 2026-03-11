-- =============================================================
-- Sentimind: Phase 5 Migration - Indexes
-- Run order: 002 (after tables)
-- =============================================================

-- List user's entries sorted by date (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_entries_user_created
  ON public.entries (user_id, created_at DESC);

-- Filter by emotion for stats and search
CREATE INDEX IF NOT EXISTS idx_entries_user_emotion
  ON public.entries (user_id, emotion)
  WHERE deleted_at IS NULL;

-- Partial index for active entries
CREATE INDEX IF NOT EXISTS idx_entries_active
  ON public.entries (user_id)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB queries on emotion_hierarchy
CREATE INDEX IF NOT EXISTS idx_entries_hierarchy
  ON public.entries USING GIN (emotion_hierarchy)
  WHERE deleted_at IS NULL;

-- GIN index for situation_context JSONB array queries
CREATE INDEX IF NOT EXISTS idx_entries_situation
  ON public.entries USING GIN (situation_context)
  WHERE deleted_at IS NULL;
