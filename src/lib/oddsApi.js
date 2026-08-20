/**
 * All calls to The Odds API go through Supabase Edge Functions.
 * Never call the API directly from the frontend — the API key must stay secret.
 *
 * These functions invoke the edge functions we deploy to Supabase.
 */
import { supabase } from './supabase'

/** Fetch NFL game odds for a week and store them as games in the database. */
export async function fetchNflOdds(weekId) {
  const { data, error } = await supabase.functions.invoke('fetch-nfl-odds', {
    body: { week_id: weekId },
  })
  if (error) throw new Error(error.message)
  return data
}

/** Fetch college football odds for a week (filtered by conference) and store them. */
export async function fetchCollegeOdds(weekId, conference) {
  const { data, error } = await supabase.functions.invoke('fetch-college-odds', {
    body: { week_id: weekId, conference },
  })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Pull finals for a week now, instead of waiting for the next scheduled tick.
 *
 * Same endpoint the scheduler uses, so a manual pull behaves identically to an
 * automatic one: it reads ESPN's free scoreboard, writes whatever games have
 * finished — not all-or-nothing — and re-resolves the week's points on the way
 * out. The old fetch-scores edge function is left in place but no longer used
 * here; it spent Odds API credits for the same answer.
 */
export async function fetchScores(weekId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch(`/api/sync-scores?week_id=${weekId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const out = await res.json()
  if (!res.ok || out.ok === false) throw new Error(out.error ?? `HTTP ${res.status}`)
  return out
}

/** Resolve pick outcomes for all completed games in a week. */
export async function resolveWeekPicks(weekId) {
  const { data, error } = await supabase.functions.invoke('resolve-picks', {
    body: { week_id: weekId },
  })
  if (error) throw new Error(error.message)
  return data
}
