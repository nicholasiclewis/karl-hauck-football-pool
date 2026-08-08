/**
 * Edge Function: lock-picks
 * Locks all picks for games whose kickoff_time has passed.
 * Should be scheduled to run every 5 minutes via Supabase cron.
 *
 * No request body needed — processes all unlocked picks automatically.
 *
 * Auth: the scheduler sends x-cron-secret; a commissioner can also trigger it
 * by hand. It takes no arguments, so without a gate any holder of the public
 * anon key could fire it.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, json, requireCronOrCommissioner } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireCronOrCommissioner(req)
    if (!auth.ok) return auth.response
    const supabase = auth.admin

    // Find all games that have kicked off but still have unlocked picks
    const { data: kickedOffGames } = await supabase
      .from('games')
      .select('id')
      .lte('kickoff_time', new Date().toISOString())

    if (!kickedOffGames?.length) {
      return json({ message: 'No games to lock', locked: 0 })
    }

    const gameIds = kickedOffGames.map((g) => g.id)

    // Lock all picks for those games
    const { data: locked, error } = await supabase
      .from('picks')
      .update({ is_locked: true })
      .in('game_id', gameIds)
      .eq('is_locked', false)
      .select('id')

    if (error) throw error

    return json({ success: true, locked: locked?.length ?? 0 })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
