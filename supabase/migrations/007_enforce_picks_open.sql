-- =====================================================
-- 007: picks only count while the week is open
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- picks_open decides whether a week is live, but nothing in the database
-- consulted it — the insert and update policies only checked ownership and
-- kickoff. A signed-in player who knew a game id could file a pick against a
-- week that had not been opened yet, or one already closed.
--
-- That matters more now that weeks open and close on their own: there is a
-- window every Tuesday morning where a week has its games imported but is
-- deliberately not open yet.
--
-- Commissioners keep full access through their own policy, so corrections
-- after the fact still work.

DROP POLICY IF EXISTS "picks: insert own before kickoff" ON public.picks;

CREATE POLICY "picks: insert own before kickoff"
  ON public.picks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = week_id AND w.picks_open AND NOT w.is_complete
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

DROP POLICY IF EXISTS "picks: update own before kickoff" ON public.picks;

CREATE POLICY "picks: update own before kickoff"
  ON public.picks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_locked = false)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = week_id AND w.picks_open AND NOT w.is_complete
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

-- Retracting stays allowed only while the week is open and before kickoff,
-- so a closed week cannot be quietly emptied out.
DROP POLICY IF EXISTS "picks: delete own before kickoff" ON public.picks;

CREATE POLICY "picks: delete own before kickoff"
  ON public.picks FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND is_locked = false
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = week_id AND w.picks_open AND NOT w.is_complete
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

COMMENT ON COLUMN public.weeks.picks_open IS
  'Whether the week is live for players. Enforced by RLS on picks, not just '
  'in the UI. Set automatically: on the morning the week starts once it has '
  'games, off once its last game has kicked off.';
