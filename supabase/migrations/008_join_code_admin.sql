-- =====================================================
-- 008: the join code belongs to the commissioner
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- 003 closed the serious hole: anon could read seasons straight out of the
-- frontend bundle, so join_code was public and the invite gate decorative.
--
-- What it restored, though, was "authenticated can read USING (true)" — so
-- every signed-in player can still read join_code and pass it on. Milder,
-- since they are already in the pool, but it means the commissioner does not
-- actually control who joins.
--
-- RLS is row-level, so a policy cannot hide a single column. Instead: revoke
-- the column from ordinary members and hand it back through SECURITY DEFINER
-- functions that check the role, the same shape as verify_season_join_code.

-- ── 1. Read the code (commissioner only) ───────────────────
CREATE OR REPLACE FUNCTION public.get_season_join_code()
RETURNS TEXT AS $$
  SELECT CASE
    WHEN public.is_commissioner()
    THEN (SELECT join_code FROM public.seasons WHERE is_active = true LIMIT 1)
    ELSE NULL
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_season_join_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_join_code() TO authenticated;

-- ── 2. Rotate the code (commissioner only) ─────────────────
-- Generated server-side so a client cannot set a guessable code. Ambiguous
-- characters are left out: these get read aloud and typed on phones.
CREATE OR REPLACE FUNCTION public.regenerate_season_join_code()
RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code TEXT := '';
  i INT;
BEGIN
  IF NOT public.is_commissioner() THEN
    RAISE EXCEPTION 'Forbidden: commissioner role required';
  END IF;

  FOR i IN 1..6 LOOP
    new_code := new_code || substr(alphabet, floor(random() * length(alphabet))::INT + 1, 1);
  END LOOP;

  UPDATE public.seasons SET join_code = new_code WHERE is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active season to set a join code on';
  END IF;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.regenerate_season_join_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_season_join_code() TO authenticated;

-- ── 3. Take the column away from ordinary members ──────────
-- Column-level privileges are checked before RLS, so this holds regardless of
-- the row policy.
--
-- A column-level REVOKE alone does nothing here: Supabase grants SELECT on the
-- whole table to authenticated, and a table-wide grant already implies every
-- column. Postgres has no way to subtract one column from it. The table grant
-- has to go, and the columns we do want handed back explicitly.
--
-- Any column added to seasons later will be unreadable until it is added to
-- this list — which is the safe direction to fail.
REVOKE SELECT ON public.seasons FROM authenticated;

GRANT SELECT (id, year, dues_amount, is_active, closed_at, used_conferences)
  ON public.seasons TO authenticated;

COMMENT ON COLUMN public.seasons.join_code IS
  'Pool-wide invite code. Not selectable by ordinary members: read it with '
  'get_season_join_code() and rotate it with regenerate_season_join_code(), '
  'both commissioner-gated. Signup checks it via verify_season_join_code(), '
  'which returns only a boolean.';

-- ── 4. Verify ──────────────────────────────────────────────
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.seasons', 'join_code', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can still select seasons.join_code';
  END IF;

  -- The app reads these on every page; losing them would break more than it
  -- protects, so confirm the re-grant landed rather than assuming.
  IF NOT has_column_privilege('authenticated', 'public.seasons', 'year', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.seasons', 'dues_amount', 'SELECT') THEN
    RAISE EXCEPTION 'the column re-grant did not apply; seasons is now unreadable';
  END IF;

  RAISE NOTICE 'join_code is now commissioner-only; signup still works via verify_season_join_code().';
END $$;
