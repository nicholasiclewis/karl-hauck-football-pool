/**
 * Edge Function: fetch-preseason-odds
 * Fetches NFL preseason spreads from The Odds API.
 * No week_id required and nothing is written to the database —
 * intended for testing the full pick flow during August.
 *
 * Mirrors fetch-baseball-odds, which served the same purpose in the off-season.
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

    // Preseason is its own sport key — americanfootball_nfl returns no events in August.
    const url =
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl_preseason/odds` +
      `?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads&oddsFormat=american&dateFormat=iso`

    const oddsRes = await fetch(url)
    if (!oddsRes.ok) {
      throw new Error(`Odds API returned ${oddsRes.status}: ${await oddsRes.text()}`)
    }

    const events = await oddsRes.json()
    const games = []
    const skipped = []

    for (const event of events) {
      const book = event.bookmakers?.[0]
      const market = book?.markets?.find((m: any) => m.key === 'spreads')
      if (!market) {
        // Preseason lines post late; plenty of games have no spread yet.
        skipped.push({ id: event.id, matchup: `${event.away_team} @ ${event.home_team}`, reason: 'no spreads market' })
        continue
      }

      const homeOut = market.outcomes.find((o: any) => o.name === event.home_team)
      const awayOut = market.outcomes.find((o: any) => o.name === event.away_team)
      if (!homeOut || !awayOut) {
        skipped.push({ id: event.id, matchup: `${event.away_team} @ ${event.home_team}`, reason: 'outcome names did not match team names' })
        continue
      }

      games.push({
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        home_spread: homeOut.point,   // negative = home favored
        away_spread: awayOut.point,
        // Matches fetch-nfl-odds: a pick'em (0) is labelled away, which is
        // arbitrary but harmless since scoring uses Math.abs(spread).
        favorite: homeOut.point < 0 ? 'home' : 'away',
        is_pickem: homeOut.point === 0,
        game_time: event.commence_time,
        bookmaker: book.title,
      })
    }

    return json({
      success: true,
      sport: 'NFL Preseason',
      sport_key: 'americanfootball_nfl_preseason',
      events_returned: events.length,
      games_found: games.length,
      games,
      skipped,
    })
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
