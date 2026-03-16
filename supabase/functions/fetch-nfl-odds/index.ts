/**
 * Edge Function: fetch-nfl-odds
 * Fetches NFL game odds from The Odds API and stores them as games in the database.
 *
 * Called from the Commissioner Dashboard → Games tab.
 * Request body: { week_id: string }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { week_id } = await req.json()
    if (!week_id) {
      return json({ error: 'week_id is required' }, 400)
    }

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the week exists
    const { data: week, error: weekErr } = await supabase
      .from('weeks')
      .select('id, week_number')
      .eq('id', week_id)
      .single()

    if (weekErr || !week) return json({ error: 'Week not found' }, 404)

    // Fetch from The Odds API
    const url =
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds` +
      `?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads&oddsFormat=american&dateFormat=iso`

    const oddsRes = await fetch(url)
    if (!oddsRes.ok) {
      throw new Error(`Odds API returned ${oddsRes.status}: ${await oddsRes.text()}`)
    }

    const events = await oddsRes.json()
    const inserted = []

    for (const event of events) {
      // Find spread market from the first bookmaker
      const book = event.bookmakers?.[0]
      const market = book?.markets?.find((m: any) => m.key === 'spreads')
      if (!market) continue

      const homeOut = market.outcomes.find((o: any) => o.name === event.home_team)
      const awayOut = market.outcomes.find((o: any) => o.name === event.away_team)
      if (!homeOut || !awayOut) continue

      const spread = homeOut.point // negative = home favored
      const favorite = spread < 0 ? 'home' : 'away'

      const { data, error } = await supabase
        .from('games')
        .upsert(
          {
            week_id,
            sport: 'nfl',
            home_team: event.home_team,
            away_team: event.away_team,
            spread,
            favorite,
            kickoff_time: event.commence_time,
            odds_api_id: event.id,
          },
          { onConflict: 'odds_api_id' }
        )
        .select()

      if (!error && data) inserted.push(...data)
    }

    return json({ success: true, games_synced: inserted.length, games: inserted })
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
