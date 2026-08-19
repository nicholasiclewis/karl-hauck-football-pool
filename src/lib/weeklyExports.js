/**
 * Weekly handouts: results and upcoming games.
 *
 * These go out as two separate messages — results after a week closes, the new
 * slate when it opens. Each generator returns a PDF to attach and plain text to
 * paste into the body, because the commissioner sends these by hand.
 */
import { supabase } from './supabase'
import { pickLimits } from './gameSelection'
import { MAX_WEEK_POINTS, buildResultsEmail, buildGamesEmail } from './weeklyEmail'
import {
  standingsAfter, rankMovement, winStreaks, gameBreakdown, notables,
} from './weeklyInsights'
import { buildResultsPdf, buildGamesPdf } from './weeklyPdf'

// ── Data ─────────────────────────────────────────────────────────────────────

/**
 * Everything the results handout needs: the week's scores, who won, the season
 * table, and the storylines behind them.
 */
export async function loadResultsData(weekId) {
  const { data: week } = await supabase.from('weeks').select('*').eq('id', weekId).single()
  if (!week) throw new Error('Week not found')

  const { data: season } = await supabase
    .from('seasons').select('id,year').eq('id', week.season_id).single()

  const { data: allWeeks } = await supabase
    .from('weeks').select('id,week_number').eq('season_id', week.season_id).order('week_number')

  const weeks = allWeeks ?? []
  const weekIds = weeks.map((w) => w.id)
  const upTo = weekIds.slice(0, weekIds.indexOf(weekId) + 1)
  const upToPrev = upTo.slice(0, -1)

  const [{ data: scores }, { data: users }, { data: games }, { data: picks }] = await Promise.all([
    supabase.from('weekly_scores').select('*').in('week_id', weekIds),
    supabase.from('users').select('id,display_name'),
    supabase.from('games').select('*').eq('week_id', weekId).eq('is_featured', true),
    supabase.from('picks').select('*').eq('week_id', weekId),
  ])

  const rows  = scores ?? []
  const names = new Map((users ?? []).map((u) => [u.id, u.display_name]))

  // This week, best first, with a real W-L-P from the player's own picks
  // rather than assuming everyone submitted a full slate. Only resolved picks
  // count toward losses: a midweek resolve leaves weekend picks pending, and
  // pending is not a loss.
  const weekTable = rows
    .filter((s) => s.week_id === weekId)
    .map((s) => {
      const resolved = (picks ?? []).filter((p) => p.user_id === s.user_id && p.outcome).length
      const correct  = s.correct_picks ?? 0
      const pushes   = s.push_count ?? 0
      return {
        userId:  s.user_id,
        name:    names.get(s.user_id) ?? 'Unknown',
        correct,
        pushes,
        losses:  Math.max(0, resolved - correct - pushes),
        bonus:   Number(s.bonus_points ?? 0),
        points:  Number(s.total_points ?? 0),
      }
    })
    .sort((a, b) => b.points - a.points || b.correct - a.correct)

  const top     = weekTable[0]?.points ?? 0
  const winners = weekTable.filter((r) => r.points === top && top > 0)
  const perfect = weekTable.filter((r) => r.points >= MAX_WEEK_POINTS)

  const standings = standingsAfter(rows, upTo, names)
  const previous  = standingsAfter(rows, upToPrev, names)
  const movement  = rankMovement(standings, previous)
  const streaks   = winStreaks(rows, upTo)
  const breakdown = gameBreakdown(games ?? [], picks ?? [])
  const stories   = notables({ weekTable, standings, movement, streaks, breakdown })

  return {
    week, season, weekTable, winners, perfect,
    standings, movement, streaks, breakdown, stories,
    // The email builder still takes the simpler shape.
    season_table: standings.map((r) => ({ ...r })),
  }
}

/** The upcoming week's playable games. */
export async function loadGamesData(weekId) {
  const { data: week } = await supabase.from('weeks').select('*').eq('id', weekId).single()
  if (!week) throw new Error('Week not found')

  const { data: season } = await supabase
    .from('seasons').select('id,year').eq('id', week.season_id).single()

  const { data: games } = await supabase
    .from('games').select('*').eq('week_id', weekId).eq('is_featured', true).order('kickoff_time')

  return { week, season, games: games ?? [], limits: pickLimits(week.container_type) }
}

// ── Entry points ─────────────────────────────────────────────────────────────

export async function downloadResultsPdf(weekId) {
  const data = await loadResultsData(weekId)
  buildResultsPdf(data).save(`week-${data.week.week_number}-results.pdf`)
}

export async function downloadGamesPdf(weekId) {
  const data = await loadGamesData(weekId)
  buildGamesPdf(data).save(`week-${data.week.week_number}-games.pdf`)
}

// Text builders live in weeklyEmail.js and drawing in weeklyPdf.js, both free
// of any database import so they can be tested and rendered directly. Callers
// get one place to import from.
export { buildResultsEmail, buildGamesEmail, buildResultsPdf, buildGamesPdf }
