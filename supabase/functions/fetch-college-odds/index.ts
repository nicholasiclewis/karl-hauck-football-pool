/**
 * Edge Function: fetch-college-odds
 * Fetches college football game odds from The Odds API.
 * Returns all available games so the commissioner can choose which ones to add.
 *
 * Request body: { week_id: string, conference?: string }
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
    const { week_id, conference } = await req.json()
    if (!week_id) return json({ error: 'week_id is required' }, 400)

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: week, error: weekErr } = await supabase
      .from('weeks')
      .select('id')
      .eq('id', week_id)
      .single()

    if (weekErr || !week) return json({ error: 'Week not found' }, 404)

    // Fetch college football odds
    const url =
      `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds` +
      `?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads&oddsFormat=american&dateFormat=iso`

    const oddsRes = await fetch(url)
    if (!oddsRes.ok) {
      throw new Error(`Odds API returned ${oddsRes.status}`)
    }

    const events = await oddsRes.json()
    const available = []

    for (const event of events) {
      const book = event.bookmakers?.[0]
      const market = book?.markets?.find((m: any) => m.key === 'spreads')
      if (!market) continue

      const homeOut = market.outcomes.find((o: any) => o.name === event.home_team)
      const awayOut = market.outcomes.find((o: any) => o.name === event.away_team)
      if (!homeOut || !awayOut) continue

      available.push({
        odds_api_id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        spread: homeOut.point,
        favorite: homeOut.point < 0 ? 'home' : 'away',
        kickoff_time: event.commence_time,
      })
    }

    // If a conference filter is provided, return all games for the commissioner to review
    // (full conference-to-team mapping would be maintained separately)
    return json({ success: true, games_available: available.length, games: available })
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
