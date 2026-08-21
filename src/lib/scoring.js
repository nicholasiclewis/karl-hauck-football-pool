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
 * A player's week so far: what they have actually banked, and the most they
 * can still finish on.
 *
 * `earned` counts settled games only — it is the score that goes on the
 * standings if every remaining pick loses. Bonuses count toward it as soon as
 * their condition is met, because correct picks only ever accumulate: a bonus
 * earned cannot be taken back.
 *
 * `max` assumes every unsettled pick wins. It falls as games go against the
 * player, which is the point — a number that always reads 8 tells nobody
 * anything.
 *
 * Both go through calculateWeeklyScore, the same function the sync grades
 * with, so what the app shows can never disagree with the standings.
 *
 * @param {object|Array} picks  { game_id → pick } or an array of picks
 * @param {Array} games         the week's games
 * @param {string} containerType
 */
export function weekPoints(picks, games, containerType) {
  const picksArray = Array.isArray(picks) ? picks : Object.values(picks ?? {})
  const byId = Object.fromEntries((games ?? []).map((g) => [g.id, g]))

  let correct = 0
  let nflCorrect = 0
  let pushes = 0
  let settled = 0
  let pending = 0
  let pendingNfl = 0

  for (const pick of picksArray) {
    const game = byId[pick.game_id]
    if (!game) continue

    // A game with no result is still to come, however far along it looks on
    // the scoreboard — only the sync's final settles anything.
    if (!game.result) {
      pending++
      if (game.sport === 'nfl') pendingNfl++
      continue
    }

    settled++
    if (game.result === 'push') {
      pushes++
    } else if ((game.result === 'home_covers') === (pick.picked_team === 'home')) {
      correct++
      if (game.sport === 'nfl') nflCorrect++
    }
  }

  const banked = calculateWeeklyScore(containerType, {
    totalCorrect: correct,
    nflCorrect,
    pushCount: pushes,
  })

  const best = calculateWeeklyScore(containerType, {
    totalCorrect: correct + pending,
    nflCorrect:   nflCorrect + pendingNfl,
    pushCount:    pushes,
  })

  return {
    earned:      banked.totalPoints,
    max:         best.totalPoints,
    bonusEarned: banked.bonusPoints,
    bonusMax:    best.bonusPoints,
    correct,
    nflCorrect,
    pushes,
    settled,
    pending,
    pendingNfl,
    picks: picksArray.length,
  }
}

/**
 * Calculate the points earned for a single pick outcome.
 */
export function pointsForOutcome(outcome) {
  if (outcome === 'win') return 1
  if (outcome === 'push') return 0.5
  return 0
}
