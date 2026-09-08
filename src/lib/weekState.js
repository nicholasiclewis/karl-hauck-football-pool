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
import { isInWeekWindow, poolToday, weekWindow } from './weekWindow.js'

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

/**
 * Which week the app should be looking at right now.
 *
 * Screens that offer a week picker were defaulting to the first row of a list
 * ordered newest-first, which is the *last* week of the season. With the whole
 * season planned out ahead — nineteen weeks sitting in the table from day one —
 * that meant every one of them opened on a week months away with nothing in it.
 *
 * The calendar decides, not the row order and not picks_open: a flag that has
 * yet to be flipped by the scheduler would send this to the wrong week for the
 * few hours in between.
 *
 * @param {Array} weeks  weeks rows, in any order
 * @param {Date}  [now]
 * @returns {object|null} the week to show, or null when there are none
 */
export function currentWeek(weeks, now = new Date()) {
  const list = (weeks ?? []).filter((w) => w?.week_start)
  if (!list.length) return null

  // Normally this is the answer: the week the calendar is actually inside.
  const running = list.find((w) => isRunning(w, now))
  if (running) return running

  // Otherwise the most recent week that has already begun. Weeks run back to
  // back in season, so this only comes up either side of one — a gap in the
  // planned weeks, or the days after the last week's window closes.
  const today = poolToday(now)
  const begun = list.filter((w) => w.week_start <= today)
  if (begun.length) {
    return begun.reduce((latest, w) => (w.week_start > latest.week_start ? w : latest))
  }

  // Nothing has started yet: the season is still ahead, so show its first week
  // rather than its last.
  return list.reduce((first, w) => (w.week_start < first.week_start ? w : first))
}
