import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Fetches and manages the current user's picks for a given week.
 * Returns picks as a map: { [game_id]: pick_row }
 */
export function usePicks(weekId) {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})   // { game_id → pick object }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPicks = useCallback(async () => {
    if (!weekId || !user) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('picks')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', user.id)

    if (err) {
      setError(err.message)
    } else {
      const map = {}
      data?.forEach((p) => { map[p.game_id] = p })
      setPicks(map)
    }
    setLoading(false)
  }, [weekId, user])

  useEffect(() => {
    fetchPicks()
  }, [fetchPicks])

  /**
   * Submit or change a pick.
   * Optimistically updates local state immediately so the page doesn't scroll.
   */
  async function makePick(gameId, pickedTeam) {
    if (!user) throw new Error('Not logged in')

    // Optimistic update — reflect the pick instantly in the UI
    setPicks((prev) => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] ?? {}),
        user_id: user.id,
        game_id: gameId,
        week_id: weekId,
        picked_team: pickedTeam,
        is_locked: false,
        outcome: null,
      },
    }))

    const { error: err } = await supabase
      .from('picks')
      .upsert(
        {
          user_id: user.id,
          game_id: gameId,
          week_id: weekId,
          picked_team: pickedTeam,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game_id' }
      )

    if (err) {
      // Roll back the optimistic update on error
      await fetchPicks()
      throw new Error(err.message)
    }
  }

  return { picks, loading, error, makePick, refetch: fetchPicks }
}
