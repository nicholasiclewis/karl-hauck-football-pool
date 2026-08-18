/**
 * Weekly handouts: results and upcoming games.
 *
 * These go out as two separate messages — results after a week closes, the new
 * slate when it opens — so each is built independently. Every generator returns
 * both a PDF and plain email text, because the commissioner sends these by hand
 * and wants something to paste into the message body alongside the attachment.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'
import { formatKickoff, formatSpread } from './gameUtils'
import { weekWindow, formatWeekWindow } from './weekWindow'
import { pickLimits } from './gameSelection'
import { formatLabel, picksNeeded, MAX_WEEK_POINTS, buildResultsEmail, buildGamesEmail } from './weeklyEmail'
import {
  CARD, CARD2, BORDER, PRIMARY, PLIGHT, TEXT, MUTED, GOLD, GREEN,
  COL_L, COL_R, PAGE_W, fullBg, sectionBanner, rankColor,
} from './pdfTheme'

// ── Data ─────────────────────────────────────────────────────────────────────

/**
 * Everything the results handout needs: the week's scores, who won it, who was
 * perfect, and the season table as it stands after this week.
 */
export async function loadResultsData(weekId) {
  const { data: week } = await supabase.from('weeks').select('*').eq('id', weekId).single()
  if (!week) throw new Error('Week not found')

  const { data: season } = await supabase
    .from('seasons').select('id,year').eq('id', week.season_id).single()

  const { data: allWeeks } = await supabase
    .from('weeks').select('id,week_number').eq('season_id', week.season_id).order('week_number')

  const { data: scores } = await supabase
    .from('weekly_scores').select('*, users:user_id(display_name)')
    .in('week_id', (allWeeks ?? []).map(w => w.id))

  const rows = scores ?? []
  const thisWeek = rows.filter(s => s.week_id === weekId)

  // Week table, best first.
  const weekTable = thisWeek
    .map(s => ({
      name:    s.users?.display_name ?? 'Unknown',
      correct: s.correct_picks ?? 0,
      pushes:  s.push_count ?? 0,
      bonus:   Number(s.bonus_points ?? 0),
      points:  Number(s.total_points ?? 0),
    }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct)

  // Ties are real and shared — the winner is everyone on the top score.
  const top = weekTable[0]?.points ?? 0
  const winners = weekTable.filter(r => r.points === top && top > 0)
  const perfect = weekTable.filter(r => r.points >= MAX_WEEK_POINTS)

  // Season totals across every week so far.
  const totals = {}
  for (const s of rows) {
    const name = s.users?.display_name ?? 'Unknown'
    totals[name] ??= { name, points: 0, correct: 0, weeksWon: 0, played: 0 }
    totals[name].points  += Number(s.total_points ?? 0)
    totals[name].correct += s.correct_picks ?? 0
    totals[name].played  += 1
  }

  // Weeks won, counting shared wins for everyone tied.
  for (const w of allWeeks ?? []) {
    const wk = rows.filter(s => s.week_id === w.id)
    if (!wk.length) continue
    const best = Math.max(...wk.map(s => Number(s.total_points ?? 0)))
    if (best <= 0) continue
    for (const s of wk.filter(s => Number(s.total_points ?? 0) === best)) {
      const name = s.users?.display_name ?? 'Unknown'
      if (totals[name]) totals[name].weeksWon += 1
    }
  }

  const season_table = Object.values(totals)
    .sort((a, b) => b.points - a.points || b.correct - a.correct)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return { week, season, weekTable, winners, perfect, season_table }
}

/** The upcoming week's playable games. */
export async function loadGamesData(weekId) {
  const { data: week } = await supabase.from('weeks').select('*').eq('id', weekId).single()
  if (!week) throw new Error('Week not found')

  const { data: season } = await supabase
    .from('seasons').select('id,year').eq('id', week.season_id).single()

  const { data: games } = await supabase
    .from('games').select('*').eq('week_id', weekId).eq('is_featured', true).order('kickoff_time')

  return { week, season, games: games ?? [], limits: pickLimits(week.container_type) }
}

// ── PDFs ─────────────────────────────────────────────────────────────────────

function header(doc, title, subtitle) {
  fullBg(doc)
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, PAGE_W, 26, 'F')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(title, COL_L, 13)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(210, 228, 255)
  doc.text(subtitle, COL_L, 20)
  return 36
}

const tableTheme = {
  theme: 'grid',
  styles:      { fontSize: 9, cellPadding: 2.5, textColor: TEXT, fillColor: CARD, lineColor: BORDER, lineWidth: 0.1 },
  headStyles:  { fillColor: CARD2, textColor: PLIGHT, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: CARD2 },
  margin: { left: COL_L, right: COL_L },
}

/** Results PDF: winner, any perfect weeks, the week table and the season table. */
export function buildResultsPdf({ week, season, weekTable, winners, perfect, season_table }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = header(doc, `Week ${week.week_number} Results`, `${season.year} Season  ·  ${formatLabel(week)}`)

  // ── Winner ──
  if (winners.length) {
    doc.setFillColor(...CARD)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.6)
    doc.roundedRect(COL_L, y, COL_R - COL_L, 26, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setTextColor(...GOLD)
    doc.setFont('helvetica', 'bold')
    doc.text(winners.length > 1 ? 'CO-WINNERS' : 'WEEK WINNER', COL_L + 5, y + 8)

    doc.setFontSize(17)
    doc.setTextColor(...TEXT)
    doc.text(winners.map(w => w.name).join('  &  '), COL_L + 5, y + 18)

    doc.setFontSize(15)
    doc.setTextColor(...GOLD)
    doc.text(`${winners[0].points} pts`, COL_R - 5, y + 18, { align: 'right' })
    y += 34
  }

  // ── Perfect weeks ──
  if (perfect.length) {
    doc.setFillColor(...CARD)
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.6)
    const h = 12 + perfect.length * 6
    doc.roundedRect(COL_L, y, COL_R - COL_L, h, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.text('PERFECT WEEK', COL_L + 5, y + 8)
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'normal')
    perfect.forEach((p, i) => {
      doc.text(`${p.name} — ${p.points}/${MAX_WEEK_POINTS}, a clean sweep`, COL_L + 5, y + 15 + i * 6)
    })
    y += h + 8
  }

  // ── This week ──
  y = sectionBanner(doc, `Week ${week.week_number}`, y)
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['#', 'Player', 'Correct', 'Push', 'Bonus', 'Points']],
    body: weekTable.map((r, i) => [
      i + 1, r.name, r.correct, r.pushes || '—', r.bonus ? `+${r.bonus}` : '—', r.points,
    ]),
    columnStyles: { 0: { cellWidth: 10 }, 5: { fontStyle: 'bold' } },
    didParseCell: (d) => {
      // Medal the top three in the week table.
      if (d.section === 'body' && d.column.index <= 1 && d.row.index < 3) {
        d.cell.styles.textColor = rankColor(d.row.index + 1)
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = doc.lastAutoTable.finalY + 10

  // ── Season standings ──
  if (y > 230) { doc.addPage(); y = header(doc, `Week ${week.week_number} Results`, `${season.year} Season`) }
  y = sectionBanner(doc, 'Season Standings', y, [26, 71, 184])
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['#', 'Player', 'Weeks', 'Won', 'Correct', 'Total']],
    body: season_table.map(r => [r.rank, r.name, r.played, r.weeksWon || '—', r.correct, r.points]),
    columnStyles: { 0: { cellWidth: 10 }, 5: { fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index <= 1 && d.row.index < 3) {
        d.cell.styles.textColor = rankColor(d.row.index + 1)
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('www.kbhfootballpool.com', COL_L, 288)
  return doc
}

/** Upcoming games PDF: what's playable and what each player owes. */
export function buildGamesPdf({ week, season, games, limits }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const window = weekWindow(week.week_start)
  let y = header(doc, `Week ${week.week_number} Games`, `${season.year} Season  ·  ${formatWeekWindow(window)}`)

  const need = [
    limits.nfl ? `${limits.nfl} NFL` : null,
    limits.college ? `${limits.college} college` : null,
  ].filter(Boolean).join(' + ')

  doc.setFillColor(...CARD)
  doc.setDrawColor(...PLIGHT)
  doc.setLineWidth(0.6)
  doc.roundedRect(COL_L, y, COL_R - COL_L, 20, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(...PLIGHT)
  doc.setFont('helvetica', 'bold')
  doc.text('YOUR PICKS', COL_L + 5, y + 7)
  doc.setFontSize(12)
  doc.setTextColor(...TEXT)
  doc.text(`Pick ${need} from the ${games.length} games below`, COL_L + 5, y + 15)
  y += 28

  for (const sport of ['nfl', 'college']) {
    const list = games.filter(g => g.sport === sport)
    if (!list.length) continue

    if (y > 250) { doc.addPage(); y = header(doc, `Week ${week.week_number} Games`, `${season.year} Season`) }
    y = sectionBanner(doc, sport === 'nfl' ? 'NFL' : 'College', y,
      sport === 'nfl' ? PRIMARY : [16, 120, 90])

    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Matchup', 'Line', 'Kickoff']],
      body: list.map(g => [
        `${g.away_team} @ ${g.home_team}`,
        `${g.favorite === 'home' ? g.home_team : g.away_team} ${formatSpread(-Math.abs(g.spread))}`,
        formatKickoff(g.kickoff_time),
      ]),
      columnStyles: { 0: { cellWidth: 78 } },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Each game locks at its own kickoff  ·  www.kbhfootballpool.com', COL_L, 288)
  return doc
}

// ── Entry points ─────────────────────────────────────────────────────────────

export async function downloadResultsPdf(weekId) {
  const data = await loadResultsData(weekId)
  buildResultsPdf(data).save(`week-${data.week.week_number}-results.pdf`)
}

export async function downloadGamesPdf(weekId) {
  const data = await loadGamesData(weekId)
  buildGamesPdf(data).save(`week-${data.week.week_number}-games.pdf`)
}

// Text builders live in weeklyEmail.js (pure, testable); re-exported here so
// callers have a single import for everything weekly.
export { buildResultsEmail, buildGamesEmail }
