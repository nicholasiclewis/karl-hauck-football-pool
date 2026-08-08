/**
 * Edge Function: fetch-scores
 * Pulls final scores from The Odds API for all games in a given week
 * and writes home_score / away_score back to the games table.
 *
 * Matching priority:
 *   1. odds_api_id  (games originally imported via fetch-nfl-odds / fetch-college-odds)
 *   2. home_team + away_team exact match (manually entered games)
 *
 * NFL scores are split across two sport keys — americanfootball_nfl covers the
 * regular season only, and preseason games appear solely under
 * americanfootball_nfl_preseason. We query both and merge, otherwise August
 * games import fine via fetch-nfl-odds and then never resolve.
 *
 * Request body: { week_id: string, sport_key?: string }
 *   sport_key overrides the NFL key list entirely (mirrors fetch-nfl-odds).
 * Response:     { success: true, updated: number }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, json, requireCommissioner } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Commissioner only: writes scores and spends metered Odds API quota.
    const auth = await requireCommissioner(req)
    if (!auth.ok) return auth.response
    const supabase = auth.admin

    const { week_id, sport_key: bodySportKey } = await req.json()
    if (!week_id) return json({ error: 'week_id is required' }, 400)

    // Both NFL keys by default; an explicit sport_key replaces the list.
    const nflScoreKeys: string[] = bodySportKey
      ? [bodySportKey]
      : ['americanfootball_nfl', 'americanfootball_nfl_preseason']

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!

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
    const attempted: string[] = []
    const failures: string[] = []

    /**
     * Pull one sport key. Failures are collected rather than thrown: a key can
     * legitimately be out of season (preseason in December, regular season in
     * August), and one dead key must not stop the others from resolving.
     */
    async function pullScores(sportKey: string, sport: string) {
      attempted.push(sportKey)
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/` +
          `?apiKey=${ODDS_API_KEY}&daysFrom=7&dateFormat=iso`
        )
        if (!res.ok) {
          failures.push(`${sportKey}: ${res.status} ${await res.text()}`)
          return
        }
        const data = await res.json()
        apiEvents.push(...data.map((e: any) => ({ ...e, _sport: sport })))
      } catch (e) {
        failures.push(`${sportKey}: ${(e as Error).message}`)
      }
    }

    if (hasNfl) {
      for (const key of nflScoreKeys) await pullScores(key, 'nfl')
    }

    if (hasCollege) {
      await pullScores('americanfootball_ncaaf', 'college')
    }

    // Every key we tried failed — that's a real fault (bad API key, quota,
    // outage), not an off-season key. Surface it instead of reporting 0 updates.
    if (attempted.length > 0 && failures.length === attempted.length) {
      throw new Error(`Odds API scores failed: ${failures.join(' | ')}`)
    }

    // The same event can appear under more than one key; keep the first.
    const seen = new Set<string>()
    const deduped = apiEvents.filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    // Only look at completed events that have scores
    const completed = deduped.filter(e => e.completed && e.scores?.length === 2)

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

    return json({
      success: true,
      updated,
      total_games: dbGames.length,
      sport_keys_queried: attempted,
      // Non-fatal: an off-season key looks identical to a broken one here.
      sport_keys_failed: failures,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
