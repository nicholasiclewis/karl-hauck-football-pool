import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches season standings by aggregating weekly_scores for all players.
 */
export function useStandings(seasonId) {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (seasonId) fetchStandings()
  }, [seasonId])

  async function fetchStandings() {
    try {
      setLoading(true)

      // Get all week IDs for this season
      const { data: weekRows, error: weekErr } = await supabase
        .from('weeks')
        .select('id')
        .eq('season_id', seasonId)

      if (weekErr) throw weekErr

      const weekIds = weekRows?.map((w) => w.id) ?? []
      if (weekIds.length === 0) {
        setStandings([])
        setLoading(false)
        return
      }

      // Get all weekly scores for those weeks, joined with user info
      const { data, error: scoresErr } = await supabase
        .from('weekly_scores')
        .select(`
          user_id,
          week_id,
          correct_picks,
          nfl_correct,
          push_count,
          base_points,
          bonus_points,
          total_points,
          users:user_id ( display_name, is_commissioner, is_treasurer )
        `)
        .in('week_id', weekIds)

      if (scoresErr) throw scoresErr

      // Aggregate totals per player
      const totals = {}
      data?.forEach((row) => {
        if (!totals[row.user_id]) {
          totals[row.user_id] = {
            user_id: row.user_id,
            display_name: row.users?.display_name ?? 'Unknown',
            is_commissioner: row.users?.is_commissioner ?? false,
            is_treasurer: row.users?.is_treasurer ?? false,
            total_points: 0,
            correct_picks: 0,
            push_count: 0,
            weeks_played: 0,
            weekly: [],
          }
        }
        totals[row.user_id].total_points += row.total_points
        totals[row.user_id].correct_picks += row.correct_picks
        totals[row.user_id].push_count += row.push_count
        totals[row.user_id].weeks_played += 1
        totals[row.user_id].weekly.push(row)
      })

      const sorted = Object.values(totals).sort(
        (a, b) => b.total_points - a.total_points
      )

      setStandings(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { standings, loading, error, refetch: fetchStandings }
}
