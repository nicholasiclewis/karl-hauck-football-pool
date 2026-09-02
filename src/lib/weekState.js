/**
 * When a pool week is open for picks.
 *
 * A week is open from the moment it starts — its own Tuesday — and closes once
 * its last game has kicked off.
 *
 * Opening deliberately does not wait for odds. Lines post Wednesday morning in
 * most weeks (see oddsRelease.js), so a week that waits for a full board sits
 * shut through its first day and every player is told "No Active Week" while
 * the pool is in fact underway. An open week with an empty board can at least
 * say when the lines are due.
 */
import { isInWeekWindow, weekWindow } from './weekWindow.js'

/** True when `now` falls inside a week's Tuesday→Monday span. */
export function isRunning(week, now = new Date()) {
  if (!week?.week_start) return false
  return isInWeekWindow(now, weekWindow(week.week_start))
}

/**
 * Should this week be switched on?
 *
 * Only ever the week the calendar is actually inside. A commissioner importing
 * next week's odds early hands that week to the same code path, and a future
 * week must not go live ahead of itself.
 */
export function shouldOpen(week, now = new Date()) {
  return Boolean(week) && !week.is_complete && !week.picks_open && isRunning(week, now)
}

/**
 * Should this open week be switched off?
 *
 * @param {object} week
 * @param {string|Date|null} lastKickoff  the week's latest kickoff, or null
 *                                        when nothing has been imported yet
 */
export function shouldClose(week, lastKickoff, now = new Date()) {
  if (!week?.picks_open || week.is_complete) return false

  if (lastKickoff) {
    const t = new Date(lastKickoff).getTime()
    return Number.isFinite(t) && t <= now.getTime()
  }

  // No board at all. A week still running is waiting on its odds rather than
  // finished — closing it would shut the live week.
  return !isRunning(week, now)
}
