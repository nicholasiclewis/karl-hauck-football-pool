/**
 * Edge Function: fetch-baseball-odds
 * Fetches MLB game run lines from The Odds API.
 * No week_id required — intended for testing the full pick flow.
 *
 * Request body: {} (empty body ok)
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')
    if (!ODDS_API_KEY) return json({ error: 'ODDS_API_KEY not set' }, 500)

    // baseball_mlb with spreads = run line (-1.5 / +1.5)
    const url =
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds` +
      `?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads&oddsFormat=american&dateFormat=iso`

    const oddsRes = await fetch(url)
    if (!oddsRes.ok) {
      throw new Error(`Odds API returned ${oddsRes.status}: ${await oddsRes.text()}`)
    }

    const events = await oddsRes.json()
    const games = []

    for (const event of events) {
      const book = event.bookmakers?.[0]
      const market = book?.markets?.find((m: any) => m.key === 'spreads')
      if (!market) continue

      const homeOut = market.outcomes.find((o: any) => o.name === event.home_team)
      const awayOut = market.outcomes.find((o: any) => o.name === event.away_team)
      if (!homeOut || !awayOut) continue

      games.push({
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        home_spread: homeOut.point,   // e.g. -1.5 means home is favored
        away_spread: awayOut.point,   // e.g. +1.5
        favorite: homeOut.point < 0 ? 'home' : 'away',
        game_time: event.commence_time,
        bookmaker: book.title,
      })
    }

    return json({ success: true, sport: 'MLB', games_found: games.length, games })
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
