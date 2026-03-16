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

/** Fetch final scores from The Odds API and write them to the games table. */
export async function fetchScores(weekId) {
  const { data, error } = await supabase.functions.invoke('fetch-scores', {
    body: { week_id: weekId },
  })
  if (error) throw new Error(error.message)
  return data
}

/** Resolve pick outcomes for all completed games in a week. */
export async function resolveWeekPicks(weekId) {
  const { data, error } = await supabase.functions.invoke('resolve-picks', {
    body: { week_id: weekId },
  })
  if (error) throw new Error(error.message)
  return data
}
