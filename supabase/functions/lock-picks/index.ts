/**
 * Edge Function: lock-picks
 * Locks all picks for games whose kickoff_time has passed.
 * Should be scheduled to run every 5 minutes via Supabase cron.
 *
 * No request body needed — processes all unlocked picks automatically.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
    return json({ error: err.message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
