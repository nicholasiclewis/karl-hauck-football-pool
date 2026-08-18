-- =====================================================
-- 010: let everyone see who has paid (and only that)
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================
--
-- The standings show a dues badge against every player — ✅ paid, 🔴 not, and
-- 🤡 once the season is far enough along. That is deliberate: the pool wants
-- unpaid players visible to everyone.
--
-- It has never worked. RLS on dues is "own row or treasurer", so no player can
-- read anyone else's status, and the page passed a hard-coded false instead —
-- meaning paid players were shown as unpaid too.
--
-- Rather than open the dues table, expose only the flag the badge needs.
-- amount_owed, amount_paid, notes and marked_by stay treasurer-only: who has
-- paid is public in this pool, what they owe is not.

CREATE OR REPLACE FUNCTION public.get_dues_status()
RETURNS TABLE (user_id UUID, is_paid BOOLEAN) AS $$
  SELECT d.user_id, d.is_paid
  FROM   public.dues d
  JOIN   public.seasons s ON s.id = d.season_id
  WHERE  s.is_active;
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

-- Signed-in players only. Anon has no business knowing who owes money.
REVOKE ALL ON FUNCTION public.get_dues_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dues_status() TO authenticated;

COMMENT ON FUNCTION public.get_dues_status() IS
  'Paid/unpaid per player for the active season, readable by any signed-in '
  'player so the standings badge works. Deliberately returns no amounts — the '
  'dues table itself stays own-row-or-treasurer.';
