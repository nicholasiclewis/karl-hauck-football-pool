-- =====================================================
-- Karl Hauck Football Pool — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================
-- ENUMS (custom data types for constrained fields)
-- =====================================================

CREATE TYPE container_type AS ENUM (
  'college_only',
  'nfl_college',
  'nfl_only'
);

CREATE TYPE college_focus_type AS ENUM (
  'power4',
  'group5',
  'top25',
  'rivalry',
  'confchamp',
  'cfp'
);

CREATE TYPE sport_type    AS ENUM ('nfl', 'college');
CREATE TYPE favorite_type AS ENUM ('home', 'away');
CREATE TYPE result_type   AS ENUM ('home_covers', 'away_covers', 'push');
CREATE TYPE picked_team_type AS ENUM ('home', 'away');
CREATE TYPE outcome_type  AS ENUM ('win', 'loss', 'push');


-- =====================================================
-- TABLES
-- =====================================================

-- users: one row per player, linked to Supabase Auth
CREATE TABLE public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  is_commissioner  BOOLEAN NOT NULL DEFAULT false,
  is_treasurer     BOOLEAN NOT NULL DEFAULT false,
  join_code        TEXT UNIQUE,   -- personal invite code commissioner can generate per player
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- seasons: one row per football season
CREATE TABLE public.seasons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year             INTEGER NOT NULL,
  dues_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT false,
  closed_at        TIMESTAMPTZ,
  join_code        TEXT,          -- pool-wide code new players enter to sign up
  used_conferences JSONB NOT NULL DEFAULT '[]'::jsonb  -- tracks which conferences have been used this season
);

-- dues: one row per player per season
CREATE TABLE public.dues (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  season_id    UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  amount_owed  DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid  DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_paid      BOOLEAN NOT NULL DEFAULT false,
  paid_at      TIMESTAMPTZ,
  marked_by    UUID REFERENCES public.users(id),
  notes        TEXT,
  UNIQUE(user_id, season_id)
);

-- weeks: one row per week of competition
CREATE TABLE public.weeks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id      UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_number    INTEGER NOT NULL,
  container_type container_type NOT NULL,
  college_focus  college_focus_type,
  conference     TEXT,
  picks_open     BOOLEAN NOT NULL DEFAULT false,
  is_complete    BOOLEAN NOT NULL DEFAULT false,
  week_start     DATE NOT NULL,
  UNIQUE(season_id, week_number)
);

-- games: one game per row, linked to a week
CREATE TABLE public.games (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id      UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  sport        sport_type NOT NULL,
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  spread       DECIMAL(5,2) NOT NULL,  -- negative = home favored
  favorite     favorite_type NOT NULL,
  kickoff_time TIMESTAMPTZ NOT NULL,   -- picks lock at this time
  odds_api_id  TEXT UNIQUE,            -- The Odds API event ID for deduplication
  home_score   INTEGER,
  away_score   INTEGER,
  result       result_type,
  is_featured  BOOLEAN NOT NULL DEFAULT false
);

-- picks: one row per player per game
CREATE TABLE public.picks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  week_id       UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  picked_team   picked_team_type NOT NULL,
  is_locked     BOOLEAN NOT NULL DEFAULT false,
  outcome       outcome_type,
  points_earned DECIMAL(5,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)  -- one pick per player per game
);

-- weekly_scores: aggregated score per player per week (computed server-side)
CREATE TABLE public.weekly_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_id       UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  correct_picks INTEGER NOT NULL DEFAULT 0,
  nfl_correct   INTEGER NOT NULL DEFAULT 0,
  push_count    INTEGER NOT NULL DEFAULT 0,
  base_points   DECIMAL(5,2) NOT NULL DEFAULT 0,
  bonus_points  DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_points  DECIMAL(5,2) NOT NULL DEFAULT 0,
  UNIQUE(user_id, week_id)
);


-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-create a users row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update picks.updated_at whenever a pick is changed
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER picks_set_updated_at
  BEFORE UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =====================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_commissioner()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_commissioner FROM public.users WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_treasurer()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_treasurer FROM public.users WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Controls who can read/write each table
-- =====================================================

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_scores  ENABLE ROW LEVEL SECURITY;


-- ── users ──────────────────────────────────────────
-- Anyone logged in can see all players (for leaderboard)
CREATE POLICY "users: authenticated can read all"
  ON public.users FOR SELECT TO authenticated USING (true);

-- Users can only update their own row (commissioners can update anyone)
CREATE POLICY "users: update own or commissioner"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_commissioner())
  WITH CHECK (auth.uid() = id OR public.is_commissioner());

-- The signup trigger inserts with SECURITY DEFINER so no INSERT policy needed for anon
-- Commissioners can delete players
CREATE POLICY "users: commissioner can delete"
  ON public.users FOR DELETE TO authenticated
  USING (public.is_commissioner());


-- ── seasons ────────────────────────────────────────
CREATE POLICY "seasons: authenticated can read"
  ON public.seasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "seasons: commissioner can write"
  ON public.seasons FOR ALL TO authenticated
  USING (public.is_commissioner());


-- ── dues ───────────────────────────────────────────
-- Players can only see their own dues; treasurer sees all
CREATE POLICY "dues: own or treasurer can read"
  ON public.dues FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_treasurer());

-- Only treasurer can create/update/delete dues records
CREATE POLICY "dues: treasurer can write"
  ON public.dues FOR ALL TO authenticated
  USING (public.is_treasurer());


-- ── weeks ──────────────────────────────────────────
CREATE POLICY "weeks: authenticated can read"
  ON public.weeks FOR SELECT TO authenticated USING (true);

CREATE POLICY "weeks: commissioner can write"
  ON public.weeks FOR ALL TO authenticated
  USING (public.is_commissioner());


-- ── games ──────────────────────────────────────────
CREATE POLICY "games: authenticated can read"
  ON public.games FOR SELECT TO authenticated USING (true);

CREATE POLICY "games: commissioner can write"
  ON public.games FOR ALL TO authenticated
  USING (public.is_commissioner());


-- ── picks ──────────────────────────────────────────
-- Everyone can see all picks (needed for standings drill-down)
CREATE POLICY "picks: authenticated can read all"
  ON public.picks FOR SELECT TO authenticated USING (true);

-- Players can insert their own pick only if game hasn't kicked off
CREATE POLICY "picks: insert own before kickoff"
  ON public.picks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

-- Players can update their own pick only if not yet locked
CREATE POLICY "picks: update own before kickoff"
  ON public.picks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_locked = false)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.kickoff_time <= now()
    )
  );

-- Players can delete (retract) their own pick before kickoff
CREATE POLICY "picks: delete own before kickoff"
  ON public.picks FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_locked = false);

-- Commissioners can do anything to picks (for result overrides)
CREATE POLICY "picks: commissioner full access"
  ON public.picks FOR ALL TO authenticated
  USING (public.is_commissioner());


-- ── weekly_scores ──────────────────────────────────
CREATE POLICY "weekly_scores: authenticated can read"
  ON public.weekly_scores FOR SELECT TO authenticated USING (true);

-- Only commissioners can manually write scores (edge functions use service role)
CREATE POLICY "weekly_scores: commissioner can write"
  ON public.weekly_scores FOR ALL TO authenticated
  USING (public.is_commissioner());
