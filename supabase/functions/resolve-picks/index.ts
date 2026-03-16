/**
 * Edge Function: resolve-picks
 * After game scores are entered, calculates outcomes for all picks
 * and recalculates weekly_scores for all affected players.
 *
 * Request body: { week_id: string }
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all completed games (scores entered) for this week
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('*')
      .eq('week_id', week_id)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    if (gamesErr) throw gamesErr
    if (!games?.length) return json({ message: 'No scored games found' })

    // Get the week container type for bonus calculation
    const { data: week } = await supabase
      .from('weeks')
      .select('container_type')
      .eq('id', week_id)
      .single()

    // Resolve each game result
    for (const game of games) {
      const result = resolveResult(game)
      if (result && result !== game.result) {
        await supabase.from('games').update({ result }).eq('id', game.id)
      }
    }

    // Re-fetch games with updated results
    const { data: scoredGames } = await supabase
      .from('games')
      .select('*')
      .eq('week_id', week_id)
      .not('result', 'is', null)

    // Get all picks for this week
    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('week_id', week_id)

    if (!picks?.length) return json({ message: 'No picks to resolve' })

    // Update each pick with its outcome
    const gameMap = Object.fromEntries((scoredGames ?? []).map((g) => [g.id, g]))
    for (const pick of picks) {
      const game = gameMap[pick.game_id]
      if (!game?.result) continue

      let outcome: string | null = null
      let points = 0

      if (game.result === 'push') {
        outcome = 'push'
        points = 0.5
      } else if (
        (game.result === 'home_covers' && pick.picked_team === 'home') ||
        (game.result === 'away_covers' && pick.picked_team === 'away')
      ) {
        outcome = 'win'
        points = 1
      } else {
        outcome = 'loss'
        points = 0
      }

      await supabase
        .from('picks')
        .update({ outcome, points_earned: points, is_locked: true })
        .eq('id', pick.id)
    }

    // Recalculate weekly_scores per player
    const playerIds = [...new Set(picks.map((p) => p.user_id))]

    for (const userId of playerIds) {
      const userPicks = picks.filter((p) => p.user_id === userId)
      let totalCorrect = 0
      let nflCorrect = 0
      let pushCount = 0

      for (const pick of userPicks) {
        const game = gameMap[pick.game_id]
        if (!game?.result) continue

        if (game.result === 'push') {
          pushCount++
        } else if (
          (game.result === 'home_covers' && pick.picked_team === 'home') ||
          (game.result === 'away_covers' && pick.picked_team === 'away')
        ) {
          totalCorrect++
          if (game.sport === 'nfl') nflCorrect++
        }
      }

      const basePoints = totalCorrect + pushCount * 0.5
      let bonusPoints = 0
      const ct = week?.container_type

      if (ct === 'nfl_college') {
        if (nflCorrect >= 4) bonusPoints += 1
        if (totalCorrect >= 6) bonusPoints += 1
      } else {
        if (totalCorrect >= 4) bonusPoints += 1
        if (totalCorrect >= 6) bonusPoints += 1
      }

      const totalPoints = Math.min(basePoints + bonusPoints, 8)

      await supabase
        .from('weekly_scores')
        .upsert(
          {
            user_id: userId,
            week_id,
            correct_picks: totalCorrect,
            nfl_correct: nflCorrect,
            push_count: pushCount,
            base_points: basePoints,
            bonus_points: bonusPoints,
            total_points: totalPoints,
          },
          { onConflict: 'user_id,week_id' }
        )
    }

    return json({ success: true, players_updated: playerIds.length })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})

function resolveResult(game: any): string | null {
  if (game.home_score === null || game.away_score === null) return null
  const absSpread = Math.abs(game.spread)
  const margin = game.home_score - game.away_score
  if (game.favorite === 'home') {
    if (margin > absSpread) return 'home_covers'
    if (margin < absSpread) return 'away_covers'
    return 'push'
  } else {
    const awayMargin = game.away_score - game.home_score
    if (awayMargin > absSpread) return 'away_covers'
    if (awayMargin < absSpread) return 'home_covers'
    return 'push'
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
