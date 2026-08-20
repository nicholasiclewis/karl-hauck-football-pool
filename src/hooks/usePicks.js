import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRefreshOnFocus } from './useRefreshOnFocus'

/**
 * Fetches and manages the current user's picks for a given week.
 * Returns picks as a map: { [game_id]: pick_row }
 */
export function usePicks(weekId) {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})   // { game_id → pick object }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPicks = useCallback(async ({ quiet = false } = {}) => {
    if (!weekId || !user) return
    if (!quiet) setLoading(true)
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

  // Outcomes and points are written to these rows as games settle.
  useRefreshOnFocus(() => fetchPicks({ quiet: true }), { enabled: Boolean(weekId && user) })

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

  /**
   * Retract a pick. Players choose 6 games out of many, so removing one is how
   * they free a slot to pick a different game.
   */
  async function removePick(gameId) {
    if (!user) throw new Error('Not logged in')

    const previous = picks[gameId]
    setPicks((prev) => {
      const next = { ...prev }
      delete next[gameId]
      return next
    })

    // .select() matters: a DELETE blocked by RLS comes back as success with
    // zero rows, so without checking what was actually removed the UI would
    // show the pick gone and then have it reappear on the next load.
    const { data, error: err } = await supabase
      .from('picks')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .select('id')

    if (err || !data?.length) {
      // Put it back rather than leaving the UI lying about what's saved.
      setPicks((prev) => (previous ? { ...prev, [gameId]: previous } : prev))
      throw new Error(
        err?.message ??
        'Could not retract that pick — it may already be locked because the game has started.'
      )
    }
  }

  /**
   * Retract every pick for this week.
   *
   * Sent as one delete rather than a loop. RLS only permits removing picks
   * whose game has not kicked off, so the result is whatever actually went —
   * reported back so the caller can say which ones were already locked instead
   * of claiming a clean sweep.
   */
  async function clearPicks() {
    if (!user || !weekId) throw new Error('Not logged in')

    const before = Object.keys(picks).length
    const { data, error: err } = await supabase
      .from('picks')
      .delete()
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .select('id')

    if (err) {
      await fetchPicks()
      throw new Error(err.message)
    }

    await fetchPicks()
    const cleared = data?.length ?? 0
    return { cleared, kept: Math.max(0, before - cleared) }
  }

  return { picks, loading, error, makePick, removePick, clearPicks, refetch: fetchPicks }
}
