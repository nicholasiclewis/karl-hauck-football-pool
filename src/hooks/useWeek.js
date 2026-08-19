import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches the currently active week and its games.
 * "Active" means picks_open = true in the most recent week of the active season.
 */
export function useWeek() {
  const [week, setWeek] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchActiveWeek()
  }, [])

  async function fetchActiveWeek() {
    try {
      setLoading(true)
      setError(null)

      // First, find the active season. Capture the error rather than just the
      // data: a failed query otherwise looks identical to "no active season"
      // and renders the No Active Week screen as if it were intentional.
      const { data: season, error: seasonErr } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()

      if (seasonErr) throw seasonErr

      if (!season) {
        setLoading(false)
        return
      }

      // Find the open week for that season
      const { data: weekData, error: weekErr } = await supabase
        .from('weeks')
        .select('*')
        .eq('season_id', season.id)
        .eq('picks_open', true)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (weekErr) throw weekErr
      setWeek(weekData)

      if (weekData) {
        // Featured only. The Tuesday importer parks every game in the week's
        // window in this table as a candidate; the six the commissioner
        // selected are the ones players pick from.
        const { data: gamesData, error: gamesErr } = await supabase
          .from('games')
          .select('*')
          .eq('week_id', weekData.id)
          .eq('is_featured', true)
          .order('kickoff_time')

        if (gamesErr) throw gamesErr
        setGames(gamesData || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { week, games, loading, error, refetch: fetchActiveWeek }
}
