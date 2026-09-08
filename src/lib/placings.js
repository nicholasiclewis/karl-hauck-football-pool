/**
 * Positions in a table where players can be level.
 *
 * The pool has no tiebreaker until the last week of the season, so two players
 * on the same points are genuinely in the same position — not in some order
 * decided by whichever of them the sort happened to put first. The standings
 * used the array index, which quietly invented a placing the pool has no rule
 * for, and told one of two level players they were behind the other.
 *
 * Standard competition ranking: level players share the higher position and
 * the next distinct score skips the ones used up. Two players on 24.5 are both
 * 2nd, and the player behind them is 4th.
 */

/**
 * @param {Array} rows       already sorted, best first
 * @param {Function} [pointsOf]  how to read a row's score
 * @returns {Array} the same rows with `rank`, and `tied` when the position is
 *                  shared with somebody else
 */
export function assignRanks(rows, pointsOf = (r) => r.total_points) {
  const list = rows ?? []

  let lastPoints = null
  let lastRank = 0

  const ranked = list.map((row, i) => {
    const points = pointsOf(row)
    // Scores land on half points and are rounded to one decimal before they
    // get here, so equality is exact rather than a float comparison to regret.
    const rank = i > 0 && points === lastPoints ? lastRank : i + 1
    lastPoints = points
    lastRank = rank
    return { ...row, rank }
  })

  const shared = new Map()
  for (const r of ranked) shared.set(r.rank, (shared.get(r.rank) ?? 0) + 1)

  return ranked.map((r) => ({ ...r, tied: shared.get(r.rank) > 1 }))
}
