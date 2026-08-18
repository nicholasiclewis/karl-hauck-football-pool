/**
 * Drawing code for the weekly PDFs.
 *
 * Split from weeklyExports.js so it pulls in no database client — that keeps
 * these renderable outside the browser, which is the only practical way to
 * look at the output while working on it.
 *
 * A note on glyphs: jsPDF's built-in fonts are WinAnsi-encoded and have no
 * arrows, stars or box characters. Anything of that sort is drawn as vectors
 * rather than typed, or it comes out as garbage.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatKickoff, formatSpread } from './gameUtils.js'
import { weekWindow, formatWeekWindow } from './weekWindow.js'
import { formatLabel, picksNeeded, MAX_WEEK_POINTS } from './weeklyEmail.js'
import {
  CARD, CARD2, BORDER, PRIMARY, PLIGHT, TEXT, MUTED, GOLD, GREEN,
  COL_L, COL_R, PAGE_W, fullBg, sectionBanner, rankColor,
} from './pdfTheme.js'

const NAVY = [10, 18, 38]

// ── Scoreboard furniture ─────────────────────────────────────────────────────

/** Full-bleed header band: big week number left, season and dates right. */
function scoreboardHeader(doc, { kicker, title, right, sub }) {
  fullBg(doc)
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 40, 'F')
  // Accent rule under the band, echoing the app's primary.
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 40, PAGE_W, 1.6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...PLIGHT)
  doc.text(kicker.toUpperCase(), COL_L, 14, { charSpace: 1.2 })

  doc.setFontSize(30)
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), COL_L, 30)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...TEXT)
  doc.text(right, COL_R, 16, { align: 'right' })
  if (sub) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(sub, COL_R, 23, { align: 'right' })
  }
  return 52
}

/** The winner, sized like it matters. */
function winnerHero(doc, y, { winners, perfect, week }) {
  const h = 30
  doc.setFillColor(...CARD)
  doc.roundedRect(COL_L, y, COL_R - COL_L, h, 2, 2, 'F')
  // Gold spine down the left edge.
  doc.setFillColor(...GOLD)
  doc.rect(COL_L, y, 2.4, h, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GOLD)
  doc.text(winners.length > 1 ? 'CO-WINNERS' : 'WEEK WINNER', COL_L + 8, y + 9, { charSpace: 1 })

  doc.setFontSize(winners.length > 1 ? 17 : 22)
  doc.setTextColor(255, 255, 255)
  doc.text(winners.map((w) => w.name).join('  &  '), COL_L + 8, y + 21)

  // Points as a numeral block on the right.
  doc.setFontSize(26)
  doc.setTextColor(...GOLD)
  doc.text(String(winners[0].points), COL_R - 8, y + 20, { align: 'right' })
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text('PTS', COL_R - 8, y + 26, { align: 'right' })

  let out = y + h + 5

  if (perfect.length) {
    const ph = 11
    doc.setFillColor(16, 60, 44)
    doc.roundedRect(COL_L, out, COL_R - COL_L, ph, 1.5, 1.5, 'F')
    doc.setFillColor(...GREEN)
    doc.rect(COL_L, out, 2.4, ph, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...GREEN)
    doc.text('PERFECT WEEK', COL_L + 8, out + 7, { charSpace: 1 })
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${perfect.map((p) => p.name).join(', ')} — ${perfect[0].points}/${MAX_WEEK_POINTS}, clean sweep`,
      COL_L + 46, out + 7
    )
    out += ph + 5
  }
  return out
}

/** Storyline tiles across the page. */
function storyTiles(doc, y, stories) {
  const items = stories.slice(0, 4)
  if (!items.length) return y

  const gap = 3
  const w = (COL_R - COL_L - gap * (items.length - 1)) / items.length
  const h = 22

  items.forEach((s, i) => {
    const x = COL_L + i * (w + gap)
    doc.setFillColor(...CARD2)
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...PLIGHT)
    doc.text(s.label.toUpperCase(), x + 4, y + 6, { charSpace: 0.6 })

    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text(fit(doc, s.value, w - 8, 12), x + 4, y + 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(fit(doc, s.detail, w - 8, 6.5), x + 4, y + 19)
  })

  return y + h + 8
}

/** Shrink text until it fits the given width, so tiles never overflow. */
function fit(doc, text, maxW, size) {
  doc.setFontSize(size)
  let s = String(text ?? '')
  while (s.length > 4 && doc.getTextWidth(s) > maxW) s = s.slice(0, -1)
  return s === String(text ?? '') ? s : `${s.slice(0, -1)}…`
}

/**
 * Movement indicator drawn as vectors — the font has no arrow glyphs.
 * Returns nothing; draws in place.
 */
function movementMark(doc, x, y, m) {
  if (!m || m.isNew) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...PLIGHT)
    doc.text('NEW', x, y + 0.5)
    return
  }
  if (m.delta === 0) {
    doc.setDrawColor(...MUTED)
    doc.setLineWidth(0.4)
    doc.line(x, y - 0.6, x + 3, y - 0.6)
    return
  }
  const up = m.delta > 0
  doc.setFillColor(...(up ? GREEN : [239, 68, 68]))
  if (up) doc.triangle(x + 1.5, y - 3, x, y, x + 3, y, 'F')
  else    doc.triangle(x + 1.5, y, x, y - 3, x + 3, y - 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...(up ? GREEN : [239, 68, 68]))
  doc.text(String(Math.abs(m.delta)), x + 4.5, y)
}

const tableTheme = {
  theme: 'plain',
  styles: {
    fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
    textColor: TEXT, fillColor: CARD, lineColor: BORDER, lineWidth: 0,
  },
  headStyles: {
    fillColor: NAVY, textColor: PLIGHT, fontStyle: 'bold', fontSize: 7,
    cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
  },
  alternateRowStyles: { fillColor: CARD2 },
  margin: { left: COL_L, right: COL_L },
}

// ── Results PDF ──────────────────────────────────────────────────────────────

export function buildResultsPdf(data) {
  const { week, season, weekTable, winners, perfect, standings, movement, stories } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = scoreboardHeader(doc, {
    kicker: `${season.year} Season`,
    title:  `Week ${week.week_number}`,
    right:  'RESULTS',
    sub:    formatLabel(week),
  })

  if (winners.length) {
    y = winnerHero(doc, y, { winners, perfect, week })
  } else {
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('No scores recorded for this week yet.', COL_L, y)
    y += 12
  }

  y = storyTiles(doc, y, stories)

  // ── This week ──
  y = sectionBanner(doc, `Week ${week.week_number} scoreboard`, y)
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['', 'PLAYER', 'W-L-P', 'BONUS', 'PTS']],
    body: weekTable.map((r, i) => [
      i + 1,
      r.name,
      `${r.correct}-${r.losses}-${r.pushes}`,
      r.bonus ? `+${r.bonus}` : '',
      r.points.toFixed(1),
    ]),
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 18, halign: 'center', textColor: GOLD },
      4: { cellWidth: 18, halign: 'right', fontStyle: 'bold', fontSize: 11 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index < 3 && d.column.index <= 1) {
        d.cell.styles.textColor = rankColor(d.row.index + 1)
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = doc.lastAutoTable.finalY + 9

  // ── Season standings ──
  if (y > 215) { doc.addPage(); y = scoreboardHeader(doc, {
    kicker: `${season.year} Season`, title: `Week ${week.week_number}`, right: 'STANDINGS',
  }) }

  y = sectionBanner(doc, 'Season standings', y, PRIMARY)
  const startY = y
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['', '', 'PLAYER', 'WEEKS', 'WON', 'BACK', 'TOTAL']],
    body: standings.map((r) => [
      r.rank,
      '',                                   // movement drawn as vectors below
      r.name,
      r.played,
      r.weeksWon || '',
      r.gap > 0 ? `-${r.gap.toFixed(1)}` : '',
      r.points.toFixed(1),
    ]),
    columnStyles: {
      0: { cellWidth: 9,  halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 12 },
      3: { cellWidth: 16, halign: 'center', textColor: MUTED },
      4: { cellWidth: 14, halign: 'center', textColor: GOLD },
      5: { cellWidth: 16, halign: 'right',  textColor: MUTED },
      6: { cellWidth: 20, halign: 'right',  fontStyle: 'bold', fontSize: 11 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index < 3 && d.column.index === 2) {
        d.cell.styles.textColor = rankColor(d.row.index + 1)
        d.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawCell: (d) => {
      // Column 1 is left empty so the arrow can be drawn as vectors.
      if (d.section === 'body' && d.column.index === 1) {
        const row = standings[d.row.index]
        movementMark(doc, d.cell.x + 3, d.cell.y + d.cell.height / 2 + 1, movement.get(row.userId))
      }
    },
  })

  footer(doc)
  return doc
}

// ── Games PDF ────────────────────────────────────────────────────────────────

export function buildGamesPdf({ week, season, games, limits }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const win = weekWindow(week.week_start)

  let y = scoreboardHeader(doc, {
    kicker: `${season.year} Season`,
    title:  `Week ${week.week_number}`,
    right:  'THE SLATE',
    sub:    formatWeekWindow(win),
  })

  // What each player owes, stated once and loudly.
  const h = 22
  doc.setFillColor(...CARD)
  doc.roundedRect(COL_L, y, COL_R - COL_L, h, 2, 2, 'F')
  doc.setFillColor(...PLIGHT)
  doc.rect(COL_L, y, 2.4, h, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PLIGHT)
  doc.text('YOUR PICKS', COL_L + 8, y + 8, { charSpace: 1 })
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text(picksNeeded(limits, '+'), COL_L + 8, y + 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`from ${games.length} games  ·  ${formatLabel(week)}`, COL_R - 8, y + 17, { align: 'right' })
  y += h + 8

  for (const sport of ['nfl', 'college']) {
    const list = games.filter((g) => g.sport === sport)
    if (!list.length) continue

    if (y > 240) {
      doc.addPage()
      y = scoreboardHeader(doc, {
        kicker: `${season.year} Season`, title: `Week ${week.week_number}`, right: 'THE SLATE',
      })
    }

    y = sectionBanner(doc, sport === 'nfl' ? 'NFL' : 'College', y,
      sport === 'nfl' ? PRIMARY : [16, 110, 84])

    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['MATCHUP', 'LINE', 'KICKOFF']],
      body: list.map((g) => [
        `${g.away_team}  at  ${g.home_team}`,
        `${g.favorite === 'home' ? g.home_team : g.away_team} ${formatSpread(-Math.abs(g.spread))}`,
        formatKickoff(g.kickoff_time),
      ]),
      columnStyles: {
        0: { cellWidth: 82, fontStyle: 'bold' },
        1: { cellWidth: 52, textColor: GOLD },
        2: { halign: 'right', textColor: MUTED, fontSize: 8 },
      },
    })
    y = doc.lastAutoTable.finalY + 9
  }

  footer(doc, 'Each game locks at its own kickoff')
  return doc
}

function footer(doc, note = '') {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.line(COL_L, 283, COL_R, 283)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(note ? `Karl Hauck Football Pool  ·  ${note}` : 'Karl Hauck Football Pool', COL_L, 288)
    doc.text('www.kbhfootballpool.com', COL_R, 288, { align: 'right' })
  }
}
