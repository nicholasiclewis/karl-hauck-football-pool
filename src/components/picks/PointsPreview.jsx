import { bonusStatus } from '../../lib/gameUtils'

/**
 * Live points tracker shown below the game cards.
 * Shows base points earned/projected + bonus status.
 */
export default function PointsPreview({ week, games, picks }) {
  const picksArray = Object.values(picks)
  const gameMap    = Object.fromEntries(games.map((g) => [g.id, g]))

  // Points already earned from resolved games
  let earnedPoints  = 0
  let correctCount  = 0
  let nflCorrect    = 0
  let pushCount     = 0

  for (const pick of picksArray) {
    const game = gameMap[pick.game_id]
    if (!game?.result) continue

    if (game.result === 'push') {
      earnedPoints += 0.5
      pushCount++
    } else if (
      (game.result === 'home_covers' && pick.picked_team === 'home') ||
      (game.result === 'away_covers' && pick.picked_team === 'away')
    ) {
      earnedPoints += 1
      correctCount++
      if (game.sport === 'nfl') nflCorrect++
    }
  }

  // Unresolved picks — each is a potential +1
  const unresolvedCount = picksArray.filter((p) => !gameMap[p.game_id]?.result).length
  const basePoints      = earnedPoints
  const projectedBase   = earnedPoints + unresolvedCount

  const ct = week?.container_type
  const bonus = bonusStatus(picks, games, ct)

  // Calculate projected bonus
  const projectedCorrect = correctCount + unresolvedCount
  const projectedNfl     = nflCorrect   + picksArray.filter((p) => {
    const g = gameMap[p.game_id]
    return g && !g.result && g.sport === 'nfl'
  }).length

  let projectedBonus = 0
  if (ct === 'nfl_college') {
    if (projectedNfl     >= 4) projectedBonus += 1
    if (projectedCorrect >= 6) projectedBonus += 1
  } else {
    if (projectedCorrect >= 4) projectedBonus += 1
    if (projectedCorrect >= 6) projectedBonus += 1
  }

  const projectedTotal = Math.min(projectedBase + projectedBonus, 8)

  return (
    <div className="mx-4 mb-6 bg-bg border border-border rounded-xl p-4">
      <p className="text-[10px] tracking-widest uppercase text-border2 mb-3">
        Live Points Tracker
      </p>

      {/* Base picks row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">Base picks</span>
        <span className="text-sm text-accent-text font-bold">
          {basePoints > 0 ? `${basePoints} pts` : `${unresolvedCount} projected`}
        </span>
      </div>

      {/* NFL bonus row — only for nfl_college weeks */}
      {ct === 'nfl_college' && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">All 4 NFL bonus</span>
          <span className={`text-sm font-bold ${bonus.nflBonus === 'achieved' ? 'text-green' : 'text-muted'}`}>
            {bonus.nflBonus === 'achieved' ? '+1 pt ✓' : `+1 · ${bonus.nflBonus}`}
          </span>
        </div>
      )}

      {/* Any-4 bonus row — only for college_only / nfl_only weeks */}
      {ct !== 'nfl_college' && bonus.anyFourBonus !== undefined && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">Any 4 correct bonus</span>
          <span className={`text-sm font-bold ${bonus.anyFourBonus === 'achieved' ? 'text-green' : 'text-muted'}`}>
            {bonus.anyFourBonus === 'achieved' ? '+1 pt ✓' : `+1 · ${bonus.anyFourBonus}`}
          </span>
        </div>
      )}

      {/* All-6 bonus row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">All 6 correct bonus</span>
        <span className={`text-sm font-bold ${bonus.allSixBonus === 'achieved' ? 'text-green' : 'text-muted'}`}>
          {bonus.allSixBonus === 'achieved' ? '+1 pt ✓' : `+1 · ${bonus.allSixBonus}`}
        </span>
      </div>

      <div className="h-px bg-border mb-3" />

      {/* Total row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">Projected Total</span>
        <span className="text-xl font-bold text-primary-light">{projectedTotal} pts</span>
      </div>

      {/* Max pts note */}
      {projectedTotal >= 8 && (
        <div className="mt-3 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg">
          <p className="text-xs text-primary-light">🏆 On pace for max points this week!</p>
        </div>
      )}
    </div>
  )
}
