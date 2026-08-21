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
 * Polling stops the moment no game is in progress, so an idle Picks page sits
 * silent rather than hitting ESPN every half minute all week.
 *
 * @param {Array} games  the week's games
 * @returns {Map} matchup key -> { state, detail, home_score, away_score }
 */
const POLL_MS = 30_000

/** A game that could plausibly be on the field right now. */
function inPlay(game, now) {
  const kick = new Date(game.kickoff_time).getTime()
  if (!Number.isFinite(kick)) return false
  // Ends the window well after any game: the sync writes the final long
  // before this, and a stale poll costs a request nobody sees.
  const SIX_HOURS = 6 * 60 * 60 * 1000
  return now >= kick && now <= kick + SIX_HOURS
}

export function useLiveScores(games = []) {
  const [scores, setScores] = useState(() => new Map())

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

    async function poll() {
      const found = []
      for (const slot of slots.split(',')) {
        const [sport, date] = slot.split('|')
        try {
          const res = await fetch(scoreboardUrl(sport, date))
          if (!res.ok) continue
          found.push(...parseLiveScores(await res.json(), sport))
        } catch {
          // A missed poll is a non-event — the next one is thirty seconds out,
          // and the card falls back to whatever the database says.
        }
      }
      if (!cancelled) setScores(indexFinals(found))
    }

    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [slots])

  return scores
}
