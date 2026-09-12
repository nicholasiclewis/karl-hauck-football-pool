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
   * Sent as one delete rather than a loop, and named down to the games that
   * have yet to kick off rather than left to RLS to refuse the rest.
   *
   * The refusal is not dependable for everyone: policies on picks are
   * permissive, so a commissioner's full-access policy ORs with the player
   * one and grants exactly the delete the kickoff rule meant to stop. A
   * commissioner clearing a week partway through would take their settled
   * picks with it — and the points already on them — while the dialog had
   * offered to clear only the games still to come, and the count that reports
   * what was kept came back zero. Scoping the delete makes this behave the
   * same way whoever is signed in.
   */
  async function clearPicks() {
    if (!user || !weekId) throw new Error('Not logged in')

    const before = Object.keys(picks).length
    if (before === 0) return { cleared: 0, kept: 0 }

    const { data: open, error: gamesErr } = await supabase
      .from('games')
      .select('id')
      .eq('week_id', weekId)
      .gt('kickoff_time', new Date().toISOString())

    if (gamesErr) throw new Error(gamesErr.message)

    const clearable = (open ?? []).map((g) => g.id).filter((id) => picks[id])
    if (clearable.length === 0) return { cleared: 0, kept: before }

    const { data, error: err } = await supabase
      .from('picks')
      .delete()
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .in('game_id', clearable)
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
