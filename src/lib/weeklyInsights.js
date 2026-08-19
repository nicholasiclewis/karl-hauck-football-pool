/**
 * The storylines behind a week's numbers.
 *
 * A table of totals says who won. These say why anyone should care: who is
 * climbing, who is streaking, which game wrecked everybody. Pure functions over
 * plain rows so they can be tested without a database.
 */

export const MAX_WEEK_POINTS = 8

/** Points a scored week is worth to a player. */
const pts = (s) => Number(s?.total_points ?? 0)

/**
 * Cumulative season table after a given week.
 *
 * @param {Array} scores   weekly_scores rows, each { user_id, week_id, ... }
 * @param {Array} weekIds  week ids to include, in play order
 * @param {Map}   names    user_id -> display name
 */
export function standingsAfter(scores, weekIds, names) {
  const include = new Set(weekIds)
  const totals = new Map()

  for (const s of scores) {
    if (!include.has(s.week_id)) continue
    const cur = totals.get(s.user_id) ?? {
      userId: s.user_id, name: names.get(s.user_id) ?? 'Unknown',
      points: 0, correct: 0, played: 0, weeksWon: 0,
    }
    cur.points  += pts(s)
    cur.correct += s.correct_picks ?? 0
    cur.played  += 1
    totals.set(s.user_id, cur)
  }

  // Weeks won, shared when tied — a tie is a win for everyone on it.
  for (const id of weekIds) {
    const wk = scores.filter((s) => s.week_id === id)
    if (!wk.length) continue
    const best = Math.max(...wk.map(pts))
    if (best <= 0) continue
    for (const s of wk.filter((s) => pts(s) === best)) {
      const row = totals.get(s.user_id)
      if (row) row.weeksWon += 1
    }
  }

  // Pushes score 0.5, so repeated addition drifts — the email prints these
  // raw, so a player on 19.7 would read 19.700000000000003. One decimal is
  // exact for half-point scores.
  for (const t of totals.values()) t.points = Math.round(t.points * 10) / 10

  const table = [...totals.values()]
    .sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name))

  // Ties share a rank: two players on the same points are both 2nd, and the
  // next is 4th. Showing one of them as 3rd would be wrong.
  let lastPoints = null
  let lastRank = 0
  return table.map((r, i) => {
    const rank = r.points === lastPoints ? lastRank : i + 1
    lastPoints = r.points
    lastRank = rank
    const gap = table[0] ? Number((table[0].points - r.points).toFixed(1)) : 0
    return { ...r, rank, gap }
  })
}

/**
 * Rank change between two standings tables.
 * @returns {Map} userId -> { delta, from, to } — positive delta means climbed
 */
export function rankMovement(current, previous) {
  const before = new Map(previous.map((r) => [r.userId, r.rank]))
  const out = new Map()
  for (const r of current) {
    const from = before.get(r.userId)
    // Nobody "climbed" in their first week; they simply arrived.
    out.set(r.userId, from == null
      ? { delta: 0, from: null, to: r.rank, isNew: true }
      : { delta: from - r.rank, from, to: r.rank, isNew: false })
  }
  return out
}

/**
 * How many consecutive scored weeks, ending at the latest, a player has
 * finished on the top score.
 */
export function winStreaks(scores, weekIds) {
  const winnersByWeek = weekIds.map((id) => {
    const wk = scores.filter((s) => s.week_id === id)
    if (!wk.length) return null
    const best = Math.max(...wk.map(pts))
    if (best <= 0) return null
    return new Set(wk.filter((s) => pts(s) === best).map((s) => s.user_id))
  })

  const streaks = new Map()
  const everyone = new Set(scores.map((s) => s.user_id))
  for (const userId of everyone) {
    let n = 0
    for (let i = winnersByWeek.length - 1; i >= 0; i--) {
      const w = winnersByWeek[i]
      if (!w) continue           // unscored week, skip without breaking the run
      if (w.has(userId)) n += 1
      else break
    }
    streaks.set(userId, n)
  }
  return streaks
}

/**
 * Per-game pick breakdown for a week: how the room split, and whether it was
 * right. The most-missed game is the one worth writing about.
 *
 * @param {Array} games  games with a settled `result`
 * @param {Array} picks  picks rows for the same week
 */
export function gameBreakdown(games, picks) {
  return games
    .filter((g) => g.result)
    .map((g) => {
      const on = picks.filter((p) => p.game_id === g.id)
      const home = on.filter((p) => p.picked_team === 'home').length
      const away = on.length - home
      const correct = g.result === 'push'
        ? on.length
        : g.result === 'home_covers' ? home : away

      const winner = g.result === 'home_covers' ? g.home_team
        : g.result === 'away_covers' ? g.away_team : 'Push'

      return {
        game: g,
        total: on.length,
        home,
        away,
        correct,
        // Share of the room that got it right; 1 when nobody picked it, so an
        // unpicked game never masquerades as the week's trap.
        hitRate: on.length ? correct / on.length : 1,
        winner,
        margin: (g.home_score ?? 0) - (g.away_score ?? 0),
      }
    })
}

/**
 * Headline storylines for a week.
 *
 * @param {object} o
 * @param {Array}  o.weekTable    this week's scores, best first
 * @param {Array}  o.standings    season table after this week
 * @param {Map}    o.movement     from rankMovement()
 * @param {Map}    o.streaks      from winStreaks()
 * @param {Array}  o.breakdown    from gameBreakdown()
 */
export function notables({ weekTable, standings, movement, streaks, breakdown }) {
  const out = []

  // Biggest climb, only when someone actually moved.
  let mover = null
  for (const r of standings) {
    const m = movement.get(r.userId)
    if (!m || m.isNew || m.delta <= 0) continue
    if (!mover || m.delta > mover.delta) mover = { ...r, delta: m.delta, from: m.from }
  }
  if (mover) {
    out.push({
      label: 'Biggest Mover',
      value: mover.name,
      detail: `up ${mover.delta} to ${ordinal(mover.rank)}`,
    })
  }

  // A run only reads as a run at two or more.
  let streak = null
  for (const r of standings) {
    const n = streaks.get(r.userId) ?? 0
    if (n >= 2 && (!streak || n > streak.n)) streak = { name: r.name, n }
  }
  if (streak) {
    out.push({ label: 'On a Run', value: streak.name, detail: `${streak.n} weeks running` })
  }

  // The game that caught the room out.
  const trap = breakdown
    .filter((b) => b.total > 0)
    .sort((a, b) => a.hitRate - b.hitRate)[0]
  if (trap && trap.hitRate < 0.5) {
    out.push({
      label: 'Trap Game',
      value: `${trap.game.away_team.split(' ').slice(-1)[0]} / ${trap.game.home_team.split(' ').slice(-1)[0]}`,
      detail: `only ${trap.correct} of ${trap.total} got it`,
    })
  }

  // How close the race is at the top.
  if (standings.length >= 2) {
    const lead = Number((standings[0].points - standings[1].points).toFixed(1))
    out.push({
      label: 'Race for First',
      value: lead === 0 ? 'Dead heat' : `${lead} pt${lead === 1 ? '' : 's'}`,
      detail: lead === 0
        ? `${standings[0].name} & ${standings[1].name} tied`
        : `${standings[0].name} leads ${standings[1].name}`,
    })
  }

  // Margin of victory for the week itself.
  if (weekTable.length >= 2) {
    const margin = Number((weekTable[0].points - weekTable[1].points).toFixed(1))
    if (margin > 0) {
      out.push({ label: 'Won By', value: `${margin} pt${margin === 1 ? '' : 's'}`, detail: 'clear of the field' })
    }
  }

  return out
}

/** 1st, 2nd, 3rd, 4th… */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Arrow and sign for a rank change. */
export function movementGlyph(m) {
  if (!m || m.isNew) return { arrow: '', text: 'NEW' }
  if (m.delta > 0) return { arrow: '▲', text: String(m.delta) }
  if (m.delta < 0) return { arrow: '▼', text: String(Math.abs(m.delta)) }
  return { arrow: '–', text: '' }
}
