-- =====================================================
-- WHO ENTERED A PICK, AND WHEN
-- =====================================================
--
-- The entry tab writes picks on a player's behalf and works after kickoff —
-- that is the whole point of it, because picks arrive by text long after the
-- games start. The same power is worth a receipt: a pick set while the game
-- was running was chosen with information nobody else had.
--
-- updated_at cannot answer this. picks_set_updated_at fires on every UPDATE
-- and the score sync PATCHes outcome and points onto every graded pick, so by
-- Sunday night every row in the week looks freshly touched. These two columns
-- move only when the pick itself moves.
--
-- The stamp is written by a trigger, not by the app. entered_by comes from
-- auth.uid(), which a browser cannot forge, and the trigger overwrites
-- whatever the client sent — so the record says who actually made the request
-- rather than who claimed to. A receipt the subject can edit is not a receipt.

ALTER TABLE public.picks
  ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.picks.entered_by IS
  'Who set picked_team: equal to user_id when the player entered their own, a different id when someone entered it for them. NULL for picks made before this column existed — unknown, which is not the same as innocent or guilty.';

COMMENT ON COLUMN public.picks.entered_at IS
  'When picked_team was last set. Read against the game kickoff to tell a late entry from an ordinary one; unrelated to updated_at, which grading moves.';


-- Stamp only a real change of pick.
--
-- Grading writes outcome, points_earned and is_locked. Those must not disturb
-- the record of who chose the team, so anything that leaves picked_team alone
-- carries the old stamp forward untouched. The score sync runs as the service
-- role, where auth.uid() is NULL, and would otherwise erase the entry it never
-- made.
CREATE OR REPLACE FUNCTION public.stamp_pick_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.picked_team IS DISTINCT FROM OLD.picked_team THEN
    NEW.entered_by := auth.uid();
    NEW.entered_at := now();
  ELSE
    NEW.entered_by := OLD.entered_by;
    NEW.entered_at := OLD.entered_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS picks_stamp_entry ON public.picks;

CREATE TRIGGER picks_stamp_entry
  BEFORE INSERT OR UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_pick_entry();
