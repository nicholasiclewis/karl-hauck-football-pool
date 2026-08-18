-- =====================================================
-- 005: enforce per-sport pick limits in the database
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- Players now choose their own slate out of every eligible game, rather than
-- picking a side on a fixed six. That moves the limit onto picks, and a limit
-- enforced only in the browser is not a limit — the anon key is public, so a
-- player could POST a seventh pick directly.
--
-- Limits by container type:
--   nfl_college  → 4 NFL + 2 college
--   nfl_only     → 6 NFL
--   college_only → 6 college
--
-- Changing sides on a game you already picked is an UPDATE (the app upserts on
-- user_id,game_id) and must stay allowed, so the count below excludes the game
-- being written.

CREATE OR REPLACE FUNCTION public.enforce_pick_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_container container_type;
  v_sport     sport_type;
  v_featured  BOOLEAN;
  v_game_week UUID;
  v_limit     INTEGER;
  v_used      INTEGER;
BEGIN
  SELECT w.container_type INTO v_container
  FROM public.weeks w WHERE w.id = NEW.week_id;

  SELECT g.sport, g.is_featured, g.week_id
    INTO v_sport, v_featured, v_game_week
  FROM public.games g WHERE g.id = NEW.game_id;

  IF v_sport IS NULL THEN
    RAISE EXCEPTION 'Pick references a game that does not exist';
  END IF;

  -- The pick's week must be the game's week. Without this a client could file
  -- a pick against one week while pointing at another week's game.
  IF v_game_week IS DISTINCT FROM NEW.week_id THEN
    RAISE EXCEPTION 'Pick week does not match the game''s week';
  END IF;

  -- Only games in play can be picked.
  IF NOT v_featured THEN
    RAISE EXCEPTION 'That game is not in play for this week';
  END IF;

  v_limit := CASE
    WHEN v_container = 'nfl_college'  AND v_sport = 'nfl'     THEN 4
    WHEN v_container = 'nfl_college'  AND v_sport = 'college' THEN 2
    WHEN v_container = 'nfl_only'     AND v_sport = 'nfl'     THEN 6
    WHEN v_container = 'college_only' AND v_sport = 'college' THEN 6
    ELSE 0
  END;

  IF v_limit = 0 THEN
    RAISE EXCEPTION 'This week does not use % games', v_sport;
  END IF;

  SELECT count(*) INTO v_used
  FROM public.picks p
  JOIN public.games g ON g.id = p.game_id
  WHERE p.user_id = NEW.user_id
    AND p.week_id = NEW.week_id
    AND g.sport   = v_sport
    -- Exclude the game being written so switching sides is not blocked.
    AND p.game_id <> NEW.game_id;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Pick limit reached: this week allows % % pick(s)', v_limit, v_sport;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS picks_enforce_limits ON public.picks;
CREATE TRIGGER picks_enforce_limits
  BEFORE INSERT OR UPDATE OF game_id, week_id, user_id ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pick_limits();

COMMENT ON FUNCTION public.enforce_pick_limits() IS
  'Caps picks per user, per week, per sport, and rejects picks against games '
  'that are not in play or belong to another week. The browser enforces the '
  'same rules for feedback; this is what actually holds.';

COMMENT ON COLUMN public.games.is_featured IS
  'True when this game is eligible for players to pick this week. The importer '
  'sets it on every game matching the week window, sport and college focus. '
  'Players choose their own slate from these, capped per sport.';
