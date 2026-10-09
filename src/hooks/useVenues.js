import { useEffect, useState } from 'react'
import { espnDate, indexFinals, parseVenues, scoreboardUrl } from '../lib/espnScores'

/**
 * Where each of the week's games is being played.
 *
 * Read from the same free ESPN scoreboard as the live scores, straight from
 * the browser, and for the same reason it is not stored: the odds feed the
 * games table is built from carries no venue, and a stadium is decoration.
 * A failed or slow lookup leaves the cards exactly as they were, so nothing
 * here surfaces an error.
 *
 * Unlike live scores this is asked once per week, not polled — a venue does
 * not change during the afternoon.
 *
 * @param {Array} games  the week's games
 * @returns {Map} matchup key -> { stadium, city, region, international, neutral }
 */
export function useVenues(games = []) {
  const [venues, setVenues] = useState(() => new Map())

  // One scoreboard per sport per day, as a stable string so the effect
  // re-runs when the set changes rather than on every render.
  const slots = [...new Set(
    games.map((g) => `${g.sport}|${espnDate(g.kickoff_time)}`)
  )].sort().join(',')

  useEffect(() => {
    setVenues(new Map())
    if (!slots) return

    const controller = new AbortController()

    Promise.all(slots.split(',').map(async (slot) => {
      const [sport, date] = slot.split('|')
      try {
        const res = await fetch(scoreboardUrl(sport, date), { signal: controller.signal })
        if (!res.ok) return []
        return parseVenues(await res.json(), sport)
      } catch {
        // One day's board failing should not cost the other days their venues.
        return []
      }
    })).then((found) => {
      if (!controller.signal.aborted) setVenues(indexFinals(found.flat()))
    })

    return () => controller.abort()
  }, [slots])

  return venues
}
