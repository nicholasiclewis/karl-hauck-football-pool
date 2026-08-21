import { useEffect, useState } from 'react'
import { espnDate, indexFinals, parseLiveScores, scoreboardUrl } from '../lib/espnScores'

/**
 * Running scores for games being played right now.
 *
 * Read straight from the browser: ESPN's scoreboard needs no key and sends
 * `access-control-allow-origin: *`, the same reason rankings.js calls it
 * directly. Nothing here is written anywhere — these scores are for the card
 * to display, and only the scheduled sync (which waits for a game to be
 * final) is allowed to put a number in the database. That separation is the
 * point: a score on screen at halftime is useful, a score graded at halftime
 * is a ruined week.
 *
 * Every failure mode degrades to the same place — no live score, and the
 * final still arrives from the sync a few minutes after the game ends. There
 * is deliberately no second source: the only alternative is metered, and
 * paying per poll to show a number that is thirty seconds newer is a bad
 * trade.
 *
 * Polling stops the moment no game is in progress, so an idle Picks page sits
 * silent rather than hitting ESPN every half minute all week.
 *
 * @param {Array} games  the week's games
 * @returns {Map} matchup key -> { state, detail, home_score, away_score }
 */
const POLL_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000
const HEARTBEAT_MS = 60_000

/** How long after kickoff a game could still plausibly be on the field. */
const PLAY_WINDOW_MS = 6 * 60 * 60 * 1000

function inPlay(game, now) {
  const kick = new Date(game.kickoff_time).getTime()
  if (!Number.isFinite(kick)) return false
  return now >= kick && now <= kick + PLAY_WINDOW_MS
}

export function useLiveScores(games = []) {
  const [scores, setScores] = useState(() => new Map())

  // Re-evaluate which games are in play on a slow heartbeat. Without it, a
  // page opened before kickoff would never notice the game starting: when
  // nothing is live there is no polling, and with no polling there is no
  // render to reconsider. It also keeps the kickoff countdowns ticking.
  const [, setTick] = useState(0)
  useEffect(() => {
    const beat = setInterval(() => setTick((n) => n + 1), HEARTBEAT_MS)
    return () => clearInterval(beat)
  }, [])

  // Which scoreboards are worth reading, as a stable string so the effect
  // re-runs when the set changes rather than on every render.
  const now = Date.now()
  const slots = [...new Set(
    games.filter((g) => inPlay(g, now)).map((g) => `${g.sport}|${espnDate(g.kickoff_time)}`)
  )].sort().join(',')

  useEffect(() => {
    if (!slots) {
      setScores(new Map())
      return
    }

    let cancelled = false
    let timer = null
    let failures = 0

    async function poll() {
      const found = []
      let answered = false

      for (const slot of slots.split(',')) {
        const [sport, date] = slot.split('|')
        try {
          const res = await fetch(scoreboardUrl(sport, date))
          if (!res.ok) continue
          found.push(...parseLiveScores(await res.json(), sport))
          answered = true
        } catch {
          // Counted below. A dropped request is ordinary on a phone.
        }
      }
      if (cancelled) return

      if (answered) {
        failures = 0
        setScores(indexFinals(found))
      } else {
        // Keep the last good scores rather than blanking a card over one
        // failed request, and ease off so a dead endpoint is not hammered
        // every thirty seconds for the rest of the game.
        failures++
      }

      const delay = answered
        ? POLL_MS
        : Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS)

      timer = setTimeout(poll, delay)
    }

    poll()

    // Mobile browsers suspend timers in a backgrounded tab, so a phone coming
    // back would otherwise show whatever the score was when it went to sleep.
    // Returning to the app polls at once and clears any backoff.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      failures = 0
      poll()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [slots])

  return scores
}
