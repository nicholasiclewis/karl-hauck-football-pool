/**
 * Which day of a week each sport's odds go live.
 *
 * The pool week still starts Tuesday, but lines post Wednesday morning: a day
 * of movement settles the numbers, and NFL and college land together so the
 * slate arrives as one thing.
 *
 * The exception is a game that kicks off before Wednesday morning — odds can
 * never post after their own kickoff:
 *
 *   - MAC weeks post college on Tuesday. MACtion is a Tuesday/Wednesday-night
 *     league, so a Wednesday release would miss its own opener.
 *   - NFL posts Tuesday in any week carrying a Tuesday NFL game.
 *
 * Both exceptions are derived from real kickoffs, read from the Odds API's
 * events endpoint, which is free — checking costs nothing. The MAC rule is
 * *also* an explicit conference check, so a MAC week still releases Tuesday
 * even if that lookup fails.
 */
import { addDays, parseDateOnly, poolTimeToUtc, toDateString } from './weekWindow.js'

/** Odds post at 9:00 am ET, on whichever day is the release day. */
export const RELEASE_HOUR = 9

/** Days from week_start (a Tuesday) to each possible release day. */
export const TUESDAY = 0
export const WEDNESDAY = 1

/** The instant odds post, for a week starting `weekStart`. */
export function releaseInstant(weekStart, dayOffset = WEDNESDAY) {
  const { year, month, day } = addDays(parseDateOnly(weekStart), dayOffset)
  return poolTimeToUtc(year, month, day, RELEASE_HOUR)
}

/** The date odds post on, as 'YYYY-MM-DD'. */
export function releaseDate(weekStart, dayOffset = WEDNESDAY) {
  return toDateString(addDays(parseDateOnly(weekStart), dayOffset))
}

/** True for a college week built around the MAC. */
export function isMacWeek(week) {
  return String(week?.conference ?? '').trim().toUpperCase() === 'MAC'
}

/**
 * The date a sport's odds should post for a week.
 *
 * @param {string} sport      'nfl' | 'college'
 * @param {object} week       the weeks row ({ week_start, conference })
 * @param {Array} [kickoffs]  that sport's kickoff times inside the week window
 * @returns {string} 'YYYY-MM-DD'
 */
export function releaseDateFor(sport, week, kickoffs = []) {
  const weekStart = week.week_start
  if (sport === 'college' && isMacWeek(week)) return releaseDate(weekStart, TUESDAY)

  const wednesday = releaseInstant(weekStart, WEDNESDAY).getTime()
  const early = kickoffs.some((k) => {
    const t = new Date(k).getTime()
    return Number.isFinite(t) && t < wednesday
  })

  return releaseDate(weekStart, early ? TUESDAY : WEDNESDAY)
}

/**
 * Which of a week's sports have reached their release day by `date`.
 * Dates compare as strings because they are zero-padded ISO days.
 *
 * Wednesday's run therefore also covers anything that was meant to post
 * Tuesday and did not — a missed release repairs itself the next morning
 * rather than leaving the week half-open.
 */
export function sportsReleasedBy(date, sports, week, kickoffsBySport = {}) {
  return sports.filter((sport) => date >= releaseDateFor(sport, week, kickoffsBySport[sport] ?? []))
}
