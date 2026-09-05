/**
 * Who in the pool took which side, game by game.
 *
 * The thing everyone actually argues about on Sunday night is who was on what,
 * and until now the app only ever showed a player their own slate. The weekly
 * report had it and the app did not, so the answer lived in a PDF.
 *
 * Only for weeks that are over. Picks are readable by any signed-in player at
 * the database level, but showing them while a week is live would turn the
 * pool into a copying exercise — the gate belongs in front of this, not here.
 */

/**
 * @param {Array} games  the week's featured games, in the order to report them
 * @param {Array} picks  every pick in the week, from every player
 * @param {Map|object} names  user_id → display name
 * @returns {Array} one row per game: the two sides, each a sorted list of
 *                 names, plus which side covered
 */
export function roomPicks(games, picks, names) {
  const nameOf = (id) => {
    const found = names instanceof Map ? names.get(id) : names?.[id]
    // A player whose name did not come back is still a body on that side —
    // dropping them would quietly understate how the room was split.
    return (typeof found === 'string' && found.trim()) || 'Unknown player'
  }

  const byGame = new Map()
  for (const pick of picks ?? []) {
    if (!byGame.has(pick.game_id)) byGame.set(pick.game_id, [])
    byGame.get(pick.game_id).push(pick)
  }

  return (games ?? []).map((game) => {
    const on = byGame.get(game.id) ?? []
    const side = (which) =>
      on
        .filter((p) => p.picked_team === which)
        .map((p) => nameOf(p.user_id))
        .sort((a, b) => a.localeCompare(b))

    const home = side('home')
    const away = side('away')

    return {
      game,
      home,
      away,
      total: home.length + away.length,
      // Mirrors the pick card's vocabulary: only what the sync settled counts,
      // so an ungraded game shows the split without declaring anybody right.
      covered:
        game.result === 'home_covers' ? 'home'
        : game.result === 'away_covers' ? 'away'
        : game.result === 'push' ? 'push'
        : null,
    }
  })
}
