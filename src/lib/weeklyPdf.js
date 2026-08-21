/**
 * Drawing code for the weekly PDFs.
 *
 * Layout follows docs/report-design-brief.md and the design returned against
 * it: an 80px folio rail down the left carrying the week stamp and a sideways
 * RESULTS, then a solid primary poster for the winner, a numbered storyline
 * strip, and two tables on alternating row fills.
 *
 * Sections collapse rather than reserve space. No perfect week and no
 * storylines means those blocks are omitted outright and the next section
 * closes up against the one above — most weeks are the sparse case.
 *
 * Split from weeklyExports.js so it pulls in no database client, which keeps
 * it renderable outside the browser — the only practical way to look at the
 * output while working on it.
 *
 * A note on glyphs: jsPDF's built-in fonts are WinAnsi-encoded and have no
 * arrows, stars or box characters. Anything of that sort is drawn as vectors
 * rather than typed, or it comes out as garbage.
 */
import { jsPDF } from 'jspdf'
import { formatKickoff, formatSpread } from './gameUtils.js'
import { weekWindow, formatWeekWindow } from './weekWindow.js'
import { formatLabel, picksNeeded, MAX_WEEK_POINTS } from './weeklyEmail.js'
import {
  CARD, CARD2, BORDER, PRIMARY, PLIGHT, TEXT, MUTED, GOLD, GREEN, SILVER,
  BRONZE, ON_POSTER, ON_POSTER_TEXT, ON_POSTER_GOLD, PAGE_W, PAGE_H,
} from './pdfTheme.js'

const BG   = [255, 255, 255]  // page
const RAIL = [241, 245, 249]  // #f1f5f9 folio rail, a shade off the page
const RED  = [185,  28,  28]  // #b91c1c downward movement, 5.76:1 on white

// The design is 794×1123px — A4 at 96dpi — so px * 0.2646 = mm.
const RAIL_W  = 21.2          // 80px
const PAD     = 8             // 30px side padding inside the main column
const L       = RAIL_W + PAD  // content left edge
const R       = PAGE_W - PAD  // content right edge
const W       = R - L

// ── Primitives ───────────────────────────────────────────────────────────────

const rgb = (doc, c) => doc.setTextColor(c[0], c[1], c[2])
const fill = (doc, c) => doc.setFillColor(c[0], c[1], c[2])

/** Hairline rule, the 1px #1e3566 divider used throughout. */
function rule(doc, y, weight = 0.25, color = BORDER) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(weight)
  doc.line(L, y, R, y)
}

/** Truncate to fit a width at the current size, so nothing overruns a column. */
function clip(doc, text, maxW) {
  let s = String(text ?? '')
  if (doc.getTextWidth(s) <= maxW) return s
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * The folio rail: week stamp at the top, the document name set sideways in the
 * middle, the pool name at the foot. Repeated on every page so a printed run
 * reads as one series.
 */
function folioRail(doc, { year, weekNumber, kind }) {
  fill(doc, BG)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  fill(doc, RAIL)
  doc.rect(0, 0, RAIL_W, PAGE_H, 'F')
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
  doc.setLineWidth(0.25)
  doc.line(RAIL_W, 0, RAIL_W, PAGE_H)

  const mid = RAIL_W / 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  rgb(doc, MUTED)
  doc.text(String(year), mid, 14, { align: 'center', charSpace: 0.4 })

  fill(doc, PRIMARY)
  doc.rect(mid - 3.2, 17, 6.4, 0.5, 'F')

  doc.text(`WK ${String(weekNumber).padStart(2, '0')}`, mid, 22, { align: 'center', charSpace: 0.4 })

  // Sideways, reading bottom to top.
  doc.setFontSize(19)
  rgb(doc, PLIGHT)
  doc.text(kind.toUpperCase(), mid + 6.5, PAGE_H / 2 + 28, { angle: 90, charSpace: 1.2 })

  doc.setFontSize(6)
  rgb(doc, SILVER)
  doc.text('KBHFOOTBALLPOOL', mid + 2, PAGE_H - 16, { angle: 90, charSpace: 0.5 })
}

/**
 * The winner, set as a poster on a solid primary field.
 * Names wrap to two lines and shrink when a co-win puts two of them up there.
 */
function winnerPoster(doc, y, { winners, formatText }) {
  const names = winners.map((w) => w.name).join(' & ')
  const two = winners.length > 1

  // Measure first: the block grows with the name, it does not clip it.
  doc.setFont('helvetica', 'bold')
  let size = two ? 24 : 34
  const nameW = W - 58
  let lines = []
  for (;;) {
    doc.setFontSize(size)
    lines = doc.splitTextToSize(names, nameW)
    if (lines.length <= 2 || size <= 13) break
    size -= 2
  }
  lines = lines.slice(0, 2)

  const h = 26 + lines.length * (size * 0.36)
  fill(doc, PRIMARY)
  doc.rect(L, y, W, h, 'F')

  doc.setFontSize(6.5)
  rgb(doc, ON_POSTER)
  doc.text(formatText.toUpperCase(), L + 7, y + 8, { charSpace: 0.7 })

  doc.setFontSize(7)
  doc.text(two ? 'CO-WINNERS' : 'WINNER', L + 7, y + 16, { charSpace: 0.9 })

  doc.setFontSize(size)
  rgb(doc, ON_POSTER_TEXT)
  lines.forEach((line, i) => {
    doc.text(line, L + 7, y + 24 + i * (size * 0.36))
  })

  // Points, sized to dominate, baseline-aligned with the foot of the block.
  doc.setFontSize(two ? 38 : 46)
  rgb(doc, ON_POSTER_GOLD)
  const pts = String(winners[0].points)
  const ptsW = doc.getTextWidth(pts)
  doc.text(pts, R - 7 - 12, y + h - 7)
  doc.setFontSize(11)
  doc.text('PTS', R - 7 - 12 + ptsW + 1.5, y + h - 7)

  return y + h
}

/** Perfect-week strip: a green tick block, the label, then who and what. */
function perfectStrip(doc, y, perfect) {
  const top = y + 5
  fill(doc, GREEN)
  doc.rect(L, top + 1.6, 2.6, 2.6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  rgb(doc, GREEN)
  doc.text('PERFECT WEEK', L + 5, top + 4, { charSpace: 0.8 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  rgb(doc, MUTED)
  const names = perfect.map((p) => p.name).join(', ')
  doc.text(
    clip(doc, `— ${names}, a clean ${perfect[0].points}/${MAX_WEEK_POINTS} sweep`, W - 40),
    L + 38, top + 4
  )

  const bottom = top + 8
  rule(doc, bottom, 0.5)
  return bottom
}

/** Storylines as a numbered strip, dividing the row evenly by however many. */
function storylineStrip(doc, y, stories) {
  const items = stories.slice(0, 4)
  const top = y + 5
  const colW = W / items.length

  items.forEach((s, i) => {
    const x = L + i * colW
    if (i > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
      doc.setLineWidth(0.25)
      doc.line(x - 3, top - 1, x - 3, top + 15)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    rgb(doc, SILVER)
    doc.text(String(i + 1).padStart(2, '0'), x, top + 6)

    const tx = x + 11
    const tw = colW - 14

    doc.setFontSize(6)
    rgb(doc, MUTED)
    doc.text(clip(doc, s.label.toUpperCase(), tw), tx, top + 2.5, { charSpace: 0.5 })

    doc.setFontSize(10)
    rgb(doc, TEXT)
    doc.text(clip(doc, s.value, tw), tx, top + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    rgb(doc, MUTED)
    doc.text(clip(doc, s.detail, tw), tx, top + 12.5)
  })

  const bottom = top + 18
  rule(doc, bottom, 0.5)
  return bottom
}

/** Tracked section heading over a heavy rule. */
function sectionHead(doc, y, text, right = null) {
  const top = y + 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  rgb(doc, TEXT)
  doc.text(text.toUpperCase(), L, top, { charSpace: 0.5 })

  if (right) {
    doc.setFontSize(6.5)
    rgb(doc, MUTED)
    let x = R
    for (const col of [...right].reverse()) {
      doc.text(col.label, x, top, { align: 'right', charSpace: 0.4 })
      x -= col.w
    }
  }
  rule(doc, top + 2.5, 0.5)
  return top + 2.5
}

const medal = (rank) => (rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : TEXT)

// ── Results PDF ──────────────────────────────────────────────────────────────

export function buildResultsPdf(data) {
  const {
    week, season, weekTable, winners, perfect, standings, movement, stories,
    cards = [],
  } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  folioRail(doc, { year: season.year, weekNumber: week.week_number, kind: 'Results' })

  let y = 18
  if (winners.length) {
    y = winnerPoster(doc, y, { winners, formatText: formatLabel(week) })
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    rgb(doc, MUTED)
    doc.text('No scores recorded for this week yet.', L, y + 8)
    y += 12
  }

  // Both of these collapse when empty — most weeks have neither.
  if (perfect.length) y = perfectStrip(doc, y, perfect)
  if (stories.length) y = storylineStrip(doc, y, stories)

  // ── Week scoreboard ──
  y = sectionHead(doc, y, `Week ${week.week_number} Scoreboard`)
  weekTable.forEach((r, i) => {
    const lead = i === 0
    const h = lead ? 9 : 7
    fill(doc, i % 2 === 0 ? CARD : CARD2)
    doc.rect(L, y, W, h, 'F')

    const base = y + (lead ? 6.4 : 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(lead ? 15 : i < 3 ? 11 : 9)
    rgb(doc, medal(i + 1))
    doc.text(String(i + 1), L + 2, base)

    doc.setFontSize(lead ? 12 : i < 3 ? 10 : 9)
    if (i >= 3) doc.setFont('helvetica', 'normal')
    rgb(doc, i < 3 ? medal(i + 1) : TEXT)
    doc.text(clip(doc, r.name, W - 60), L + 11, base)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    rgb(doc, MUTED)
    doc.text(`${r.correct}-${r.losses}-${r.pushes}`, R - 34, base, { align: 'right' })
    doc.text(r.bonus ? `+${Number(r.bonus).toFixed(1)}` : '—', R - 20, base, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(lead ? 13 : 10)
    rgb(doc, lead ? GOLD : TEXT)
    doc.text(Number(r.points).toFixed(1), R - 2, base, { align: 'right' })

    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
    doc.setLineWidth(0.2)
    doc.line(L, y + h, R, y + h)
    y += h
  })

  // ── Season standings ──
  y = sectionHead(doc, y + 4, 'Season Standings', [
    { label: 'WK', w: 14 }, { label: 'WON', w: 14 },
    { label: 'BACK', w: 18 }, { label: 'TOTAL', w: 18 },
  ])

  standings.forEach((r, i) => {
    const h = 6.4
    fill(doc, i % 2 === 0 ? CARD : CARD2)
    doc.rect(L, y, W, h, 'F')
    const base = y + 4.4

    // Movement, drawn rather than typed — the font has no arrows.
    const m = movement.get(r.userId)
    const mx = L + 2.5
    if (!m || m.isNew) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      rgb(doc, PLIGHT)
      doc.text('NEW', mx - 0.5, base)
    } else if (m.delta > 0) {
      fill(doc, GREEN)
      doc.triangle(mx + 1.4, base - 3, mx, base - 0.4, mx + 2.8, base - 0.4, 'F')
    } else if (m.delta < 0) {
      fill(doc, RED)
      doc.triangle(mx + 1.4, base - 0.4, mx, base - 3, mx + 2.8, base - 3, 'F')
    } else {
      doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2])
      doc.setLineWidth(0.3)
      doc.line(mx, base - 1.6, mx + 2.8, base - 1.6)
    }

    doc.setFont('helvetica', i < 3 ? 'bold' : 'normal')
    doc.setFontSize(i < 3 ? 10 : 9)
    rgb(doc, i < 3 ? medal(r.rank) : MUTED)
    doc.text(String(r.rank), L + 8, base)

    doc.setFontSize(9)
    rgb(doc, i < 3 ? medal(r.rank) : TEXT)
    doc.text(clip(doc, r.name, W - 74), L + 14, base)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    rgb(doc, TEXT)
    doc.text(String(r.played), R - 50, base, { align: 'right' })
    doc.text(r.weeksWon ? String(r.weeksWon) : '—', R - 36, base, { align: 'right' })
    rgb(doc, MUTED)
    doc.text(r.gap > 0 ? `-${r.gap.toFixed(1)}` : '—', R - 18, base, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    rgb(doc, i === 0 ? GOLD : TEXT)
    doc.text(Number(r.points).toFixed(1), R, base, { align: 'right' })

    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
    doc.setLineWidth(0.2)
    doc.line(L, y + h, R, y + h)
    y += h
  })

  // ── Every pick ──
  // The tables above settle who won; this is the part that gets argued over,
  // so it runs to a second page rather than being trimmed to fit the first.
  if (cards.length) {
    const nextPage = () => {
      doc.addPage()
      folioRail(doc, { year: season.year, weekNumber: week.week_number, kind: 'Results' })
      return 18
    }

    if (y > 200) y = nextPage()
    y = sectionHead(doc, y + 4, 'Every Pick', [{ label: 'PTS', w: 14 }])

    for (const card of cards) {
      // Keep a player's name with at least their first pick: a heading alone
      // at the foot of a page reads as a card with no picks in it.
      if (y + 12 > PAGE_H - 14) y = nextPage()

      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      rgb(doc, TEXT)
      doc.text(clip(doc, card.name, W - 30), L, y)

      doc.setFontSize(8.5)
      rgb(doc, GOLD)
      doc.text(`${Number(card.points).toFixed(1)}`, R, y, { align: 'right' })
      y += 1.5

      if (!card.picks.length) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7.5)
        rgb(doc, MUTED)
        doc.text('no picks submitted', L + 3, y + 4)
        y += 6
        continue
      }

      card.picks.forEach((p, i) => {
        const rowH = 6
        if (y + rowH > PAGE_H - 14) y = nextPage()

        fill(doc, i % 2 === 0 ? CARD : CARD2)
        doc.rect(L, y, W, rowH, 'F')
        const base = y + 4.1

        // Points lead, coloured by how the pick went — which is why the row
        // needs no outcome letter of its own.
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        rgb(doc, p.outcome === 'win' ? GREEN : p.outcome === 'loss' ? RED : MUTED)
        doc.text(p.points == null ? '—' : String(p.points), L + 8, base, { align: 'right' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        rgb(doc, TEXT)
        doc.text(clip(doc, `${p.team} ${formatSpread(p.spread)}`, W - 16), L + 13, base)

        y += rowH
      })
    }
  }

  return doc
}

// ── Games PDF ────────────────────────────────────────────────────────────────

export function buildGamesPdf({ week, season, games, limits }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  folioRail(doc, { year: season.year, weekNumber: week.week_number, kind: 'The Slate' })

  let y = 18

  // What each player owes, on the same poster field the winner gets.
  const h = 30
  fill(doc, PRIMARY)
  doc.rect(L, y, W, h, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  rgb(doc, ON_POSTER)
  doc.text(formatLabel(week).toUpperCase(), L + 7, y + 8, { charSpace: 0.7 })
  doc.setFontSize(7)
  doc.text('YOUR PICKS', L + 7, y + 16, { charSpace: 0.9 })

  doc.setFontSize(20)
  rgb(doc, ON_POSTER_TEXT)
  doc.text(picksNeeded(limits, '+'), L + 7, y + 25)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  rgb(doc, ON_POSTER)
  doc.text(`${games.length} games`, R - 7, y + 25, { align: 'right' })
  doc.text(formatWeekWindow(weekWindow(week.week_start)), R - 7, y + 8, { align: 'right' })
  y += h

  for (const sport of ['nfl', 'college']) {
    const list = games.filter((g) => g.sport === sport)
    if (!list.length) continue

    if (y > 250) {
      doc.addPage()
      folioRail(doc, { year: season.year, weekNumber: week.week_number, kind: 'The Slate' })
      y = 18
    }

    y = sectionHead(doc, y + 4, sport === 'nfl' ? 'NFL' : 'College')

    list.forEach((g, i) => {
      const rowH = 8
      if (y + rowH > PAGE_H - 14) {
        doc.addPage()
        folioRail(doc, { year: season.year, weekNumber: week.week_number, kind: 'The Slate' })
        y = 18
      }
      fill(doc, i % 2 === 0 ? CARD : CARD2)
      doc.rect(L, y, W, rowH, 'F')
      const base = y + 5.4

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      rgb(doc, TEXT)
      doc.text(clip(doc, `${g.away_team}  at  ${g.home_team}`, W - 74), L + 3, base)

      doc.setFontSize(8.5)
      rgb(doc, GOLD)
      const fav = g.favorite === 'home' ? g.home_team : g.away_team
      doc.text(
        clip(doc, `${fav} ${formatSpread(-Math.abs(g.spread))}`, 40),
        R - 34, base, { align: 'right' }
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      rgb(doc, MUTED)
      doc.text(formatKickoff(g.kickoff_time), R - 2, base, { align: 'right' })

      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
      doc.setLineWidth(0.2)
      doc.line(L, y + rowH, R, y + rowH)
      y += rowH
    })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  rgb(doc, MUTED)
  doc.text('Each game locks at its own kickoff', L, PAGE_H - 10)
  return doc
}
