-- =====================================================
-- 013: scores from the Christmas elf game
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- During Christmas week an elf hides on the pages; catch him and you play his
-- present-catching game. Every finished round is kept here. Whoever has the
-- highest single round when the week is over gets a 🎁 beside their avatar on
-- the standings. The week itself is decided in the app
-- (src/lib/seasonalTheme.js), which only counts rounds played inside it, so
-- rounds played while previewing the theme early never win anything.

CREATE TABLE public.elf_game_scores (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100000),
  played_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX elf_game_scores_played_at ON public.elf_game_scores (played_at, score DESC);

ALTER TABLE public.elf_game_scores ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can see the scores: it's a leaderboard.
CREATE POLICY "elf_game_scores: authenticated can read"
  ON public.elf_game_scores FOR SELECT TO authenticated USING (true);

-- A player records only their own rounds, stamped with the server's clock.
CREATE POLICY "elf_game_scores: insert own"
  ON public.elf_game_scores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND played_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute');

GRANT SELECT, INSERT ON public.elf_game_scores TO authenticated;
