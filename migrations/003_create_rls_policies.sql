-- =============================================================
-- Sentimind: Phase 5 Migration - Row Level Security
-- Run order: 003 (after tables)
-- =============================================================

-- -----------------------------------------------
-- user_profiles RLS
-- -----------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: INSERT handled by trigger (SECURITY DEFINER bypasses RLS)

-- -----------------------------------------------
-- entries RLS
-- -----------------------------------------------
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- SELECT: own active entries only (soft-deleted hidden automatically)
CREATE POLICY "entries_select_own"
  ON public.entries
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: own entries only
CREATE POLICY "entries_insert_own"
  ON public.entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: own active entries only
CREATE POLICY "entries_update_own"
  ON public.entries
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: own entries (hard delete for GDPR purge)
CREATE POLICY "entries_delete_own"
  ON public.entries
  FOR DELETE
  USING (auth.uid() = user_id);
