/**
 * The elf game's scoreboard (supabase/migrations/013_elf_game_scores.sql).
 *
 * Only rounds played during Christmas week count. The best of them wins its
 * player a 🎁 on the standings once the week is over. While previewing on the
 * dev server every round counts and the gift shows straight away, so the
 * whole thing can be seen before the week arrives.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { previewing, themeWindow } from './seasonalTheme'

function countedRounds(query) {
  if (previewing()) return query
  const { start, end } = themeWindow('christmas')
  return query.gte('played_at', start.toISOString()).lt('played_at', end.toISOString())
}

/** Records a finished round. A failure only costs the round its place. */
export async function saveElfScore(score) {
  const { error } = await supabase.from('elf_game_scores').insert({ score })
  if (error) console.error('elf_game_scores insert error:', error)
}

/** The best round so far: { userId, name, score }, or null. Ties go to whoever got there first. */
export async function fetchElfLeader() {
  const { data, error } = await countedRounds(
    supabase.from('elf_game_scores').select('score, user_id, users(display_name)')
  )
    .order('score', { ascending: false })
    .order('played_at', { ascending: true })
    .limit(1)
  // Before the migration runs the table is missing; no leader is the honest answer.
  if (error || !data?.length || data[0].score <= 0) return null
  return { userId: data[0].user_id, name: data[0].users?.display_name ?? 'Someone', score: data[0].score }
}

/** The player who won the elf game, once Christmas week is over; null until then. */
export function useElfChampion() {
  const [champion, setChampion] = useState(null)
  useEffect(() => {
    const over = new Date() >= themeWindow('christmas').end
    const preview = ['christmas', 'newyear'].includes(previewing())
    if (!over && !preview) return
    let live = true
    fetchElfLeader().then((leader) => live && setChampion(leader))
    return () => { live = false }
  }, [])
  return champion
}
