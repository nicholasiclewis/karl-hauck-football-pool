-- ============================================================
-- Fix: public.seasons was readable by unauthenticated callers
--
-- 001_initial_schema.sql declares seasons as "TO authenticated", but the live
-- database had drifted: an anon-key request returned a full seasons row while
-- every other table correctly returned zero rows.
--
-- This was not a careless edit. signUp() in src/hooks/useAuth.jsx validates the
-- invite code by SELECTing from seasons, and that runs before the user exists —
-- so anon read had to be opened for signup to work at all.
--
-- The cost: the anon key ships inside the frontend bundle, so anyone who viewed
-- source could read join_code directly and sign themselves into the pool. The
-- invite gate was decorative.
--
-- Fix: validate the code through a SECURITY DEFINER function that answers
-- yes/no without ever returning the code, then close anon read on the table.
--
-- Requires the matching frontend change in useAuth.jsx (rpc call instead of
-- select). Safe to run more than once.
-- ============================================================

-- ── 1. Code checker ────────────────────────────────────────
-- SECURITY DEFINER runs as the owner, so it can read seasons while the caller
-- cannot. It returns only a boolean — the code itself never crosses the wire.
CREATE OR REPLACE FUNCTION public.verify_season_join_code(p_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.seasons
    WHERE is_active = true
      AND join_code IS NOT NULL
      AND join_code = upper(trim(p_code))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

-- Anon needs this specifically, since signup happens before authentication.
GRANT EXECUTE ON FUNCTION public.verify_season_join_code(TEXT) TO anon, authenticated;

-- ── 2. Reset seasons policies to a known state ─────────────
-- Drop whatever exists rather than guessing what the dashboard edit was called.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'seasons'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.seasons', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Restore the policies 001_initial_schema.sql intended.
CREATE POLICY "seasons: authenticated can read"
  ON public.seasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "seasons: commissioner can write"
  ON public.seasons FOR ALL TO authenticated
  USING (public.is_commissioner());

-- Remove any direct grant that would sidestep RLS intent.
REVOKE ALL ON public.seasons FROM anon;

-- ── 3. Verify ──────────────────────────────────────────────
DO $$
DECLARE
  anon_policies INT;
BEGIN
  SELECT count(*) INTO anon_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'seasons'
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles));

  IF anon_policies > 0 THEN
    RAISE EXCEPTION 'seasons still has % policy/policies granting anon access', anon_policies;
  END IF;

  RAISE NOTICE 'seasons RLS restored; join code now validated via verify_season_join_code().';
END $$;
