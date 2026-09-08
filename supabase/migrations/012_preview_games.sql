-- =====================================================
-- 012: games can exist before their line does
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- A week opens on its Tuesday but its lines do not post until Wednesday, so
-- for a full day the board was empty and the picks page could only promise
-- that something would appear. The schedule itself is knowable on Tuesday —
-- The Odds API's events endpoint returns it, and unlike the odds endpoints it
-- costs nothing — so the week can show who is playing while the numbers are
-- still being set.
--
-- That needs a game row without a spread, which the table forbade.
--
-- spread and favorite stay NOT NULL in spirit: every game that can be picked
-- has both. What changes is that a game may exist before it can be picked.

ALTER TABLE public.games
  ALTER COLUMN spread   DROP NOT NULL,
  ALTER COLUMN favorite DROP NOT NULL;

COMMENT ON COLUMN public.games.spread IS
  'Negative when home is favored. NULL means the line has not posted yet: the game is on the board as a preview and cannot be picked until it fills in.';


-- No line, no pick.
--
-- The app hides the buttons on a game without a spread, but a pick written
-- against one would be ungradeable — resolveGameResult has no number to
-- measure the result against — and would sit in the week scoring nothing while
-- looking like a real pick. This is the rule that makes that impossible rather
-- than merely unlikely.
--
-- Commissioners are not exempt. Their policy exists so picks can be entered
-- late on somebody's behalf, not so a pick can be made against a game the pool
-- has no number for.
CREATE OR REPLACE FUNCTION public.enforce_pick_has_line()
RETURNS TRIGGER AS $$
DECLARE
  v_spread   DECIMAL(5,2);
  v_favorite favorite_type;
  v_exists   BOOLEAN;
BEGIN
  SELECT TRUE, g.spread, g.favorite
    INTO v_exists, v_spread, v_favorite
  FROM public.games g WHERE g.id = NEW.game_id;

  -- A missing game is enforce_pick_limits' complaint to make, not this one's.
  IF v_exists IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_spread IS NULL OR v_favorite IS NULL THEN
    RAISE EXCEPTION
      'That game has no line yet. Picks open when the spread posts.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS picks_require_line ON public.picks;

CREATE TRIGGER picks_require_line
  BEFORE INSERT OR UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pick_has_line();
