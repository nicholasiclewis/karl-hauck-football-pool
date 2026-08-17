-- =====================================================
-- 004: is_featured becomes the "this game is in play" flag
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- The Tuesday auto-import pulls every game in a week's Tuesday→Monday window
-- into public.games as a candidate, so the table now holds far more rows than
-- the six a week actually plays. is_featured marks the six the commissioner
-- selected; everything player-facing filters on it.
--
-- The column already existed (default false) but was never read.

-- Backfill first, before anything starts filtering on it. Every game already
-- in the table was hand-added by the commissioner, so all of it is live —
-- without this, existing weeks would suddenly show zero games to players.
UPDATE public.games
SET    is_featured = true
WHERE  is_featured = false;

-- Player-facing reads are always "featured games for this week, by kickoff".
CREATE INDEX IF NOT EXISTS games_week_featured_kickoff_idx
  ON public.games (week_id, is_featured, kickoff_time);

-- The importer looks games up by event id to refresh spreads without
-- duplicating rows. odds_api_id is already UNIQUE, which gives us that index,
-- but it is nullable for manually added games — that is intentional.

COMMENT ON COLUMN public.games.is_featured IS
  'True when this game is one of the six in play for its week. The Tuesday '
  'importer inserts candidates as false and suggests six; the commissioner '
  'confirms or swaps them in the Games tab.';

COMMENT ON COLUMN public.weeks.week_start IS
  'The Tuesday a pool week begins. The week covers that Tuesday 00:00 ET '
  'through the following Monday 23:59:59 ET, so it includes midweek, '
  'weekend and Monday night games.';
