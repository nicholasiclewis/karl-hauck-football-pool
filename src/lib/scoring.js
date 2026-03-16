/**
 * Calculate the outcome of a single pick against the spread.
 *
 * spread is stored as negative when home is favored.
 * e.g. spread = -3.5 means home gives 3.5 points (home favored)
 *      spread = +3.5 means away gives 3.5 points (away favored)
 *
 * @param {Object} game - game row from the database
 * @param {string} pickedTeam - 'home' or 'away'
 * @returns {'win' | 'loss' | 'push' | null}
 */
export function calculatePickOutcome(game, pickedTeam) {
  if (game.home_score === null || game.away_score === null) return null

  const result = resolveGameResult(game)
  if (result === null) return null
  if (result === 'push') return 'push'

  if (
    (result === 'home_covers' && pickedTeam === 'home') ||
    (result === 'away_covers' && pickedTeam === 'away')
  ) {
    return 'win'
  }
  return 'loss'
}

/**
 * Determine which side covered the spread.
 * @param {Object} game
 * @returns {'home_covers' | 'away_covers' | 'push' | null}
 */
export function resolveGameResult(game) {
  if (game.home_score === null || game.away_score === null) return null

  const { home_score, away_score, spread, favorite } = game
  const absSpread = Math.abs(spread)
  const margin = home_score - away_score // positive = home winning

  if (favorite === 'home') {
    // Home must win by MORE than absSpread to cover
    if (margin > absSpread) return 'home_covers'
    if (margin < absSpread) return 'away_covers'
    return 'push'
  } else {
    // Away must win by MORE than absSpread to cover
    const awayMargin = away_score - home_score
    if (awayMargin > absSpread) return 'away_covers'
    if (awayMargin < absSpread) return 'home_covers'
    return 'push'
  }
}

/**
 * Calculate a player's weekly score given their pick results.
 *
 * Scoring rules:
 *   - Correct pick = 1 point
 *   - Push = 0.5 points
 *   - Wrong = 0 points
 *
 * Bonus (NFL + College weeks):
 *   - All 4 NFL correct = +1 bonus
 *   - All 6 correct = +1 more bonus (8 pts max)
 *
 * Bonus (College Only or NFL Only weeks):
 *   - Any 4 correct = +1 bonus
 *   - All 6 correct = +2 total bonus (8 pts max)
 *
 * @param {string} containerType - 'nfl_college' | 'college_only' | 'nfl_only'
 * @param {Object} counts - { totalCorrect, nflCorrect, pushCount }
 * @returns {{ basePoints, bonusPoints, totalPoints }}
 */
export function calculateWeeklyScore(containerType, { totalCorrect = 0, nflCorrect = 0, pushCount = 0 }) {
  const basePoints = totalCorrect + pushCount * 0.5

  let bonusPoints = 0

  if (containerType === 'nfl_college') {
    if (nflCorrect >= 4) bonusPoints += 1
    if (totalCorrect >= 6) bonusPoints += 1
  } else {
    // college_only or nfl_only
    if (totalCorrect >= 4) bonusPoints += 1
    if (totalCorrect >= 6) bonusPoints += 1 // total = +2
  }

  const totalPoints = Math.min(basePoints + bonusPoints, 8)
  return { basePoints, bonusPoints, totalPoints }
}

/**
 * Calculate the points earned for a single pick outcome.
 */
export function pointsForOutcome(outcome) {
  if (outcome === 'win') return 1
  if (outcome === 'push') return 0.5
  return 0
}
