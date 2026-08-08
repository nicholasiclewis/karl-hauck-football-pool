/**
 * Edge Function: fetch-nfl-odds
 * Fetches NFL game odds from The Odds API and stores them as games in the database.
 *
 * Called from the Commissioner Dashboard → Games tab.
 * Request body: { week_id: string }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, json, requireCommissioner } from '../_shared/auth.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Commissioner only: this writes games and spends metered Odds API quota.
    const auth = await requireCommissioner(req)
    if (!auth.ok) return auth.response
    const supabase = auth.admin

    const { week_id, sport_key: bodySportKey } = await req.json()
    if (!week_id) {
      return json({ error: 'week_id is required' }, 400)
    }

    // Sport key precedence: request body → ODDS_SPORT_KEY secret → NFL default.
    // Lets the same function run against e.g. baseball_mlb during the off-season.
    const sportKey =
      bodySportKey ?? Deno.env.get('ODDS_SPORT_KEY') ?? 'americanfootball_nfl'

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!

    // Verify the week exists
    const { data: week, error: weekErr } = await supabase
      .from('weeks')
      .select('id, week_number')
      .eq('id', week_id)
      .single()

    if (weekErr || !week) return json({ error: 'Week not found' }, 404)

    // Fetch from The Odds API
    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
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
    return json({ error: (err as Error).message }, 500)
  }
})
