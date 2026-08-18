-- =====================================================
-- 006: a pick is final once its game starts
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- Insert and update already refuse once kickoff_time has passed, but delete
-- only checked is_locked. That flag is set by the lock-picks function on a
-- schedule, so between kickoff and the next run a player could still retract
-- a pick — which is changing it, just by another route. Now that players
-- retract picks routinely to free a slot, that gap matters.
--
-- Checking kickoff directly means this holds whether or not lock-picks runs.

DROP POLICY IF EXISTS "picks: delete own before kickoff" ON public.picks;

CREATE POLICY "picks: delete own before kickoff"
  ON public.picks FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND is_locked = false
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

COMMENT ON POLICY "picks: delete own before kickoff" ON public.picks IS
  'Retracting a pick is only allowed before that game kicks off. Checked '
  'against games.kickoff_time rather than the is_locked flag, so it does not '
  'depend on the locking job having run.';
