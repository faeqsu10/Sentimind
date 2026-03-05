-- =============================================================
-- Sentimind: Phase 5 Migration - Table Creation
-- Run order: 001 (first)
-- =============================================================

-- 1. User Profiles
-- Auto-created via trigger on auth.users insert
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(30),
  bio TEXT,
  theme VARCHAR(10) CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_time TIME,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  current_streak INT DEFAULT 0 CHECK (current_streak >= 0),
  max_streak INT DEFAULT 0 CHECK (max_streak >= 0),
  last_entry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS 'User preferences and gamification state';

-- 2. Diary Entries
CREATE TABLE IF NOT EXISTS public.entries (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  emotion VARCHAR(100),
  emoji VARCHAR(10),
  message TEXT,
  advice TEXT,
  emotion_hierarchy JSONB DEFAULT '{}',
  situation_context JSONB DEFAULT '[]',
  confidence_score INT DEFAULT 0
    CHECK (confidence_score >= 0 AND confidence_score <= 100),
  related_emotions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.entries IS 'Diary entries with AI emotion analysis and ontology metadata';
COMMENT ON COLUMN public.entries.deleted_at IS 'Soft delete: NULL = active';
