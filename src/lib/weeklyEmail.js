/**
 * Plain-text bodies for the weekly emails.
 *
 * Kept apart from weeklyExports.js, which reaches for the database and jsPDF —
 * these are pure string builders so they can be tested directly. The
 * commissioner sends these by hand, so the output has to read well pasted
 * straight into a mail client with no formatting applied.
 */
import { formatKickoff, formatSpread } from './gameUtils.js'
import { weekWindow, formatWeekWindow } from './weekWindow.js'

export const MAX_WEEK_POINTS = 8
const SITE = 'https://www.kbhfootballpool.com'
const RULE = '='.repeat(58)
const THIN = '-'.repeat(58)

/** Human label for a week's format, e.g. "4 NFL + 2 College · Top 25". */
export function formatLabel(week) {
  const ct = week.container_type
  const base = ct === 'nfl_college' ? '4 NFL + 2 College'
    : ct === 'nfl_only' ? '6 NFL' : '6 College'
  if (!week.college_focus) return base
  const focus = {
    power4: 'Power 4', group5: 'Group of 5', top25: 'Top 25',
    rivalry: 'Rivalry', confchamp: 'Conf. Championships', cfp: 'CFP',
  }[week.college_focus] ?? week.college_focus
  return `${base} · ${week.conference ? `${focus} (${week.conference})` : focus}`
}

/** How many picks a week asks for, as words. */
export function picksNeeded(limits, joiner = 'and') {
  return [
    limits.nfl ? `${limits.nfl} NFL` : null,
    limits.college ? `${limits.college} college` : null,
  ].filter(Boolean).join(` ${joiner} `)
}

/**
 * Results email.
 * @returns {{ subject: string, body: string }}
 */
export function buildResultsEmail({
  week, season, weekTable, winners, perfect, season_table,
  stories = [], movement = null,
}) {
  const L = []
  const winnerNames = winners.map((w) => w.name).join(' & ')

  L.push(`WEEK ${week.week_number} RESULTS — ${season.year} Karl Hauck Football Pool`)
  L.push(RULE)
  L.push('')

  if (winners.length > 1) {
    L.push(`WEEK ${week.week_number} CO-WINNERS: ${winnerNames} — ${winners[0].points} pts each`)
  } else if (winners.length === 1) {
    L.push(`WEEK ${week.week_number} WINNER: ${winnerNames} — ${winners[0].points} pts`)
  } else {
    L.push('No scores recorded for this week yet.')
  }
  L.push('')

  if (perfect.length) {
    L.push('*** PERFECT WEEK ***')
    for (const p of perfect) {
      L.push(`    ${p.name} — ${p.points}/${MAX_WEEK_POINTS}, a clean sweep`)
    }
    L.push('')
  }

  // The bit people actually reply to.
  if (stories.length) {
    L.push('TALKING POINTS')
    L.push(THIN)
    for (const s of stories) L.push(`  ${(s.label + ':').padEnd(17)}${s.value} (${s.detail})`)
    L.push('')
  }

  L.push(`THIS WEEK (${formatLabel(week)})`)
  L.push(THIN)
  weekTable.forEach((r, i) => {
    const record = r.losses == null
      ? `${r.correct} correct`
      : `${r.correct}-${r.losses}-${r.pushes}`
    L.push(
      `${String(i + 1).padStart(2)}. ${r.name.padEnd(20)}` +
      `${record.padEnd(12)}` +
      `${(r.bonus ? `+${r.bonus} bonus` : '').padEnd(12)}` +
      `${String(r.points).padStart(5)} pts`
    )
  })
  L.push('')

  L.push('SEASON STANDINGS')
  L.push(THIN)
  season_table.forEach((r) => {
    // Plain-text movement: arrows are safe here, unlike in the PDF's fonts.
    const m = movement?.get?.(r.userId)
    const move = !m || m.isNew ? '   ' : m.delta > 0 ? `+${m.delta} ` : m.delta < 0 ? `${m.delta} ` : '   '
    L.push(
      `${String(r.rank).padStart(2)}. ${r.name.padEnd(20)}` +
      `${String(r.points).padStart(6)} pts  ${move.padStart(4)}  ` +
      `(${r.weeksWon} week${r.weeksWon === 1 ? '' : 's'} won` +
      `${r.gap > 0 ? `, ${r.gap} back` : ''})`
    )
  })
  L.push('')
  L.push(`Full standings and pick history: ${SITE}`)

  return {
    subject: winners.length
      ? `Week ${week.week_number} Results — ${winnerNames} take${winners.length > 1 ? '' : 's'} it`
      : `Week ${week.week_number} Results`,
    body: L.join('\n'),
  }
}

/**
 * Upcoming games email.
 * @returns {{ subject: string, body: string }}
 */
export function buildGamesEmail({ week, season, games, limits }) {
  const L = []
  const need = picksNeeded(limits)

  L.push(`WEEK ${week.week_number} IS OPEN — ${season.year} Karl Hauck Football Pool`)
  L.push(RULE)
  L.push('')
  L.push(`Format : ${formatLabel(week)}`)
  L.push(`Dates  : ${formatWeekWindow(weekWindow(week.week_start))}`)
  L.push(`Pick   : ${need} from the games below`)
  L.push('')

  const first = games[0]
  if (first) L.push(`First kickoff: ${formatKickoff(first.kickoff_time)}`)
  L.push('')

  for (const sport of ['nfl', 'college']) {
    const list = games.filter((g) => g.sport === sport)
    if (!list.length) continue
    L.push(sport === 'nfl' ? 'NFL' : 'COLLEGE')
    L.push(THIN)
    for (const g of list) {
      const fav = g.favorite === 'home' ? g.home_team : g.away_team
      L.push(`  ${g.away_team} @ ${g.home_team}`)
      L.push(`      ${fav} ${formatSpread(-Math.abs(g.spread))}   ${formatKickoff(g.kickoff_time)}`)
    }
    L.push('')
  }

  L.push(`Make your picks: ${SITE}`)
  L.push('Each game locks at its own kickoff — no picks after that.')

  return {
    subject: `Week ${week.week_number} is open — pick ${need}`,
    body: L.join('\n'),
  }
}
