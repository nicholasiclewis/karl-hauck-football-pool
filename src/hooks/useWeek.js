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

      // First, find the active season
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()

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
        const { data: gamesData, error: gamesErr } = await supabase
          .from('games')
          .select('*')
          .eq('week_id', weekData.id)
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
