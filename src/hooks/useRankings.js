import { useState, useEffect, useMemo } from 'react'
import { fetchTop25ForWeek, buildRankMap, rankOf } from '../lib/rankings'

/**
 * The poll behind a pool week, for showing ranks next to college teams.
 *
 * ESPN's rankings endpoint needs no key and sends CORS headers, so this runs
 * straight from the browser. It is decoration: a failed or slow lookup leaves
 * every team unranked and the page renders exactly as it did before, so
 * nothing here surfaces an error.
 *
 * The label names the poll the ranks came from rather than the requested one:
 * fetchTop25 falls back when AP has nothing for a week, and a Coaches number
 * must not be captioned "AP Top 25".
 *
 * @param {string}  weekStart 'YYYY-MM-DD', the Tuesday a pool week begins
 * @param {boolean} enabled   skip the fetch entirely (an NFL-only week)
 * @returns {{ rankOf: (team: string) => number|null, label: string }}
 */
export function useRankings(weekStart, enabled = true) {
  const [rankMap, setRankMap] = useState(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    setRankMap(null)
    setLabel('')
    if (!weekStart || !enabled) return

    const controller = new AbortController()
    fetchTop25ForWeek(weekStart, { poll: 'ap', signal: controller.signal })
      .then((poll) => {
        setRankMap(buildRankMap(poll))
        setLabel(poll.pollLabel)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [weekStart, enabled])

  const lookup = useMemo(
    () => (team) => (rankMap ? rankOf(team, rankMap) : null),
    [rankMap]
  )

  return { rankOf: lookup, label }
}
