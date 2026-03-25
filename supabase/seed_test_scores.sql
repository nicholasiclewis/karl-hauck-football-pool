-- ============================================================
-- TEST SEED: Fake weekly scores for standings preview
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- Delete this file when done previewing.
-- ============================================================

DO $$
DECLARE
  v_season_id   UUID;
  v_week_ids    UUID[];
  v_user_ids    UUID[];
  v_user_id     UUID;
  v_week_id     UUID;
  i             INT;
  pts           DECIMAL[];
BEGIN

  -- 1. Get the active season
  SELECT id INTO v_season_id FROM public.seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season found. Create one first in the Commissioner tab.';
  END IF;

  -- 2. Create 3 test weeks if fewer than 3 exist
  FOR i IN 1..3 LOOP
    INSERT INTO public.weeks (season_id, week_number, container_type, picks_open, is_complete, week_start)
    VALUES (v_season_id, i, 'nfl_college', false, true, current_date - ((3 - i) * 7))
    ON CONFLICT (season_id, week_number) DO NOTHING;
  END LOOP;

  -- 3. Collect week IDs (first 3 weeks)
  SELECT ARRAY(
    SELECT id FROM public.weeks
    WHERE season_id = v_season_id
    ORDER BY week_number ASC
    LIMIT 3
  ) INTO v_week_ids;

  -- 4. Collect all user IDs
  SELECT ARRAY(SELECT id FROM public.users) INTO v_user_ids;

  -- 5. Insert random-ish scores for each user × each week
  FOREACH v_user_id IN ARRAY v_user_ids LOOP
    FOR i IN 1..array_length(v_week_ids, 1) LOOP
      v_week_id := v_week_ids[i];

      -- Vary scores per user/week so standings look realistic
      INSERT INTO public.weekly_scores (
        user_id, week_id,
        correct_picks, nfl_correct, push_count,
        base_points, bonus_points, total_points
      )
      VALUES (
        v_user_id, v_week_id,
        (3 + (random() * 3)::int),              -- correct_picks: 3–6
        (1 + (random() * 3)::int),              -- nfl_correct: 1–4
        (random() * 2)::int,                    -- push_count: 0–1
        (3 + (random() * 3))::decimal(5,2),     -- base_points
        (random() * 2)::int::decimal(5,2),      -- bonus_points: 0–2
        (4 + (random() * 4))::decimal(5,2)      -- total_points: 4–8
      )
      ON CONFLICT (user_id, week_id) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed complete. Users: %, Weeks: %',
    array_length(v_user_ids, 1),
    array_length(v_week_ids, 1);
END $$;
