-- =====================================================
-- 009: restore SELECT on the payout columns
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- 008 revoked table-level SELECT on seasons and re-granted a named column
-- list, to keep join_code away from ordinary members. payout_1st/2nd/3rd were
-- added later by 002 and were missed off that list, so every read of them now
-- fails with "permission denied for column payout_1st".
--
-- That takes the Standings page down for everyone: src/pages/Standings.jsx
-- selects the three payout columns to label the podium.
--
-- Only join_code needs protecting. Payouts are shown to all players by design.

GRANT SELECT (payout_1st, payout_2nd, payout_3rd)
  ON public.seasons TO authenticated;

-- ── Verify ──────────────────────────────────────────────
-- Assert the whole contract, not just the columns added here: every column the
-- app reads must be selectable, and join_code must not be. Adding a column to
-- seasons without granting it is now a caught error rather than a broken page.
DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'id', 'year', 'dues_amount', 'is_active', 'closed_at',
    'used_conferences', 'payout_1st', 'payout_2nd', 'payout_3rd'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.seasons', col, 'SELECT') THEN
      RAISE EXCEPTION 'authenticated cannot select seasons.%', col;
    END IF;
  END LOOP;

  IF has_column_privilege('authenticated', 'public.seasons', 'join_code', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can still select seasons.join_code';
  END IF;

  RAISE NOTICE 'seasons column grants are correct: payouts readable, join_code not.';
END $$;
