/**
 * Edge Function: fetch-scores
 * Pulls final scores from The Odds API for all games in a given week
 * and writes home_score / away_score back to the games table.
 *
 * Matching priority:
 *   1. odds_api_id  (games originally imported via fetch-nfl-odds / fetch-college-odds)
 *   2. home_team + away_team exact match (manually entered games)
 *
 * Request body: { week_id: string }
 * Response:     { success: true, updated: number }
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
    const { week_id } = await req.json()
    if (!week_id) return json({ error: 'week_id is required' }, 400)

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch our games for this week
    const { data: dbGames, error: dbErr } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, odds_api_id')
      .eq('week_id', week_id)

    if (dbErr) throw dbErr
    if (!dbGames?.length) return json({ error: 'No games found for this week' }, 404)

    const hasNfl     = dbGames.some(g => g.sport === 'nfl')
    const hasCollege = dbGames.some(g => g.sport === 'college')

    // Fetch scores from the Odds API (look back up to 7 days)
    const apiEvents: any[] = []

    if (hasNfl) {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/` +
        `?apiKey=${ODDS_API_KEY}&daysFrom=7&dateFormat=iso`
      )
      if (!res.ok) throw new Error(`Odds API NFL scores: ${res.status} ${await res.text()}`)
      const data = await res.json()
      apiEvents.push(...data.map((e: any) => ({ ...e, _sport: 'nfl' })))
    }

    if (hasCollege) {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/scores/` +
        `?apiKey=${ODDS_API_KEY}&daysFrom=7&dateFormat=iso`
      )
      if (!res.ok) throw new Error(`Odds API NCAAF scores: ${res.status} ${await res.text()}`)
      const data = await res.json()
      apiEvents.push(...data.map((e: any) => ({ ...e, _sport: 'college' })))
    }

    // Only look at completed events that have scores
    const completed = apiEvents.filter(e => e.completed && e.scores?.length === 2)

    let updated = 0

    for (const dbGame of dbGames) {
      // Find matching API event
      const match = completed.find(e => {
        // Priority 1: odds_api_id
        if (dbGame.odds_api_id && e.id === dbGame.odds_api_id) return true
        // Priority 2: exact team name match (same sport)
        if (e._sport !== dbGame.sport) return false
        return (
          e.home_team === dbGame.home_team &&
          e.away_team === dbGame.away_team
        )
      })

      if (!match) continue

      // scores array: [{ name, score }, { name, score }]
      const homeEntry = match.scores.find((s: any) => s.name === match.home_team)
      const awayEntry = match.scores.find((s: any) => s.name === match.away_team)
      if (!homeEntry || !awayEntry) continue

      const home_score = parseInt(homeEntry.score, 10)
      const away_score = parseInt(awayEntry.score, 10)
      if (isNaN(home_score) || isNaN(away_score)) continue

      const { error: updateErr } = await supabase
        .from('games')
        .update({ home_score, away_score })
        .eq('id', dbGame.id)

      if (!updateErr) updated++
    }

    return json({ success: true, updated, total_games: dbGames.length })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
