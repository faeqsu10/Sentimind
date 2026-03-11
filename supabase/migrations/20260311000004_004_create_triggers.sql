-- =============================================================
-- Sentimind: Phase 5 Migration - Triggers
-- Run order: 004 (after tables)
-- =============================================================

-- -----------------------------------------------
-- Auto-create user_profiles on signup
-- -----------------------------------------------
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

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------
-- Auto-update updated_at timestamp
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- user_profiles
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- entries
DROP TRIGGER IF EXISTS set_updated_at_entries ON public.entries;
CREATE TRIGGER set_updated_at_entries
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
