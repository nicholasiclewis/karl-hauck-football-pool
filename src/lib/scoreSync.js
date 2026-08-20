/**
 * Which games to look up, and when a week can close.
 *
 * The rule is as simple as it sounds: a game is worth asking about from the
 * moment it kicks off until it has a score. ESPN's scoreboard reports whether
 * a game is finished, so "the game ended" is something read rather than
 * guessed — no waiting a fixed four or five hours and hoping that was long
 * enough. A game that runs to double overtime is picked up when it actually
 * ends, and one called at halftime for weather is picked up then too.
 *
 * That only works because the scoreboard is free. Against a metered feed the
 * cost of asking forces a guess about when to ask; against a free one, asking
 * often is the whole trick. Nothing here is on a timer.
 *
 * A tick with no game in progress reads nothing at all — the check below is a
 * filter over rows the sync already had to load.
 */

import { partsInPoolTz } from './weekWindow.js'

export const HOUR_MS = 60 * 60 * 1000

/** After the window ends, close the week even if a score never arrived. */
export const CLOSE_BACKSTOP_HOURS = 12

export const NFL_KEY = 'americanfootball_nfl'
export const NFL_PRESEASON_KEY = 'americanfootball_nfl_preseason'
export const COLLEGE_KEY = 'americanfootball_ncaaf'

/** True when both scores are on the row. */
export function isScored(game) {
  return game?.home_score != null && game?.away_score != null
}

const kickoffMs = (game) => new Date(game.kickoff_time).getTime()

/**
 * Games this tick should look up: kicked off, still missing a score.
 *
 * A game keeps being watched until it has one. A lightning delay that pushes a
 * college game into the next morning, or a name the matcher misses, therefore
 * resolves itself on a later tick instead of needing anyone to notice — and
 * the games still ahead of their kickoff cost nothing to skip.
 */
export function watchedGames(games, { now = new Date() } = {}) {
  const t = now.getTime()
  return games
    .filter((game) => {
      if (isScored(game)) return false
      const kick = kickoffMs(game)
      return Number.isFinite(kick) && t >= kick
    })
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))
}

/**
 * The Odds API scores keys covering a set of games.
 *
 * Only used by the paid fallback, but the same August/September split applies:
 * preseason lives under its own key and never appears under the regular one,
 * while that key returns nothing at all once the season starts.
 */
export function scoreKeysFor(games) {
  const keys = new Set()
  for (const game of games) {
    if (game.sport === 'college') {
      keys.add(COLLEGE_KEY)
    } else if (game.sport === 'nfl') {
      for (const key of nflKeysForKickoff(game.kickoff_time)) keys.add(key)
    }
  }
  return [...keys]
}

/**
 * NFL sport keys covering a kickoff: preseason runs through August.
 * The month is read in the pool timezone — a 9pm Eastern game on August 31 is
 * already September in UTC, and it is very much still a preseason game.
 */
export function nflKeysForKickoff(kickoff) {
  const { month } = partsInPoolTz(kickoff instanceof Date ? kickoff : new Date(kickoff))
  return month <= 8 ? [NFL_KEY, NFL_PRESEASON_KEY] : [NFL_KEY]
}

/**
 * What this tick should do for one week.
 *
 * `closeReady` deliberately does not fire the moment the calendar window ends.
 * The window closes at Monday midnight but Monday night football is not final
 * until after that, so a week waits for its last game — and, if a score never
 * comes, gives up at the backstop rather than staying open forever.
 *
 * @param {object} week    the weeks row
 * @param {Array}  games   that week's featured games
 * @param {object} window  from weekWindow()
 * @param {Date}   [now]
 */
export function weekSyncPlan({ week, games, window, now = new Date() }) {
  const ended = now.getTime() > window.end.getTime()
  const unscored = games.filter((g) => !isScored(g))
  const watching = watchedGames(games, { now })

  const lastKickoff = games.reduce((max, g) => Math.max(max, kickoffMs(g) || 0), 0)
  const settled = lastKickoff + CLOSE_BACKSTOP_HOURS * HOUR_MS

  return {
    weekId:     week.id,
    weekNumber: week.week_number,
    ended,
    watching,
    unscored,
    // A game with no score by the backstop is not getting one from the feed.
    // The commissioner can still enter it by hand and re-resolve.
    closeReady: ended && (unscored.length === 0 || now.getTime() >= settled),
  }
}
