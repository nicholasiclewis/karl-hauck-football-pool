import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'

// ── Palette (matches app) ─────────────────────────────────────────────────────
const BG        = [11,  17,  32]   // #0b1120
const CARD      = [18,  29,  53]   // #121d35
const CARD2     = [26,  40,  72]   // #1a2848
const BORDER    = [30,  53, 102]   // #1e3566
const PRIMARY   = [26,  71, 184]   // #1a47b8
const PLIGHT    = [96, 150, 232]   // #6096e8
const TEXT      = [221,238,255]    // #ddeeff
const MUTED     = [119,153,204]    // #7799cc
const GOLD      = [251,191, 36]    // #fbbf24
const SILVER    = [148,163,184]    // #94a3b8
const BRONZE    = [180, 83,  9]    // #b45309
const GREEN     = [ 34,197, 94]    // #22c55e
const PAGE_W    = 210
const COL_L     = 14
const COL_R     = PAGE_W - 14

// ── Helpers ───────────────────────────────────────────────────────────────────
function fullBg(doc) {
  doc.setFillColor(...BG)
  doc.rect(0, 0, PAGE_W, 297, 'F')
}

function sectionBanner(doc, text, y, color = PRIMARY) {
  doc.setFillColor(...color)
  doc.roundedRect(COL_L, y, COL_R - COL_L, 9, 1.5, 1.5, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text(text.toUpperCase(), COL_L + 4, y + 6.2)
  return y + 14
}

function rankColor(rank) {
  if (rank === 1) return GOLD
  if (rank === 2) return SILVER
  if (rank === 3) return BRONZE
  return TEXT
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function downloadReport() {
  // ── Fetch data ──────────────────────────────────────────────────────────────
  const { data: season } = await supabase
    .from('seasons').select('*').eq('is_active', true).maybeSingle()
  if (!season) throw new Error('No active season found')

  const { data: weeksData } = await supabase
    .from('weeks').select('*').eq('season_id', season.id).order('week_number')
  const weeks = weeksData ?? []
  const weekIds = weeks.map((w) => w.id)
  if (weekIds.length === 0) throw new Error('No weeks found for this season')

  const { data: scoresData } = await supabase
    .from('weekly_scores').select('*, users:user_id(display_name)').in('week_id', weekIds)
  const allScores = scoresData ?? []

  const { data: gamesData } = await supabase
    .from('games').select('*').in('week_id', weekIds).order('kickoff_time')
  const allGames = gamesData ?? []

  // ── Build season standings ──────────────────────────────────────────────────
  const totals = {}
  for (const row of allScores) {
    if (!totals[row.user_id]) {
      totals[row.user_id] = {
        name: row.users?.display_name ?? 'Unknown',
        total_points: 0,
        correct_picks: 0,
        weeks_played: 0,
      }
    }
    totals[row.user_id].total_points  += row.total_points
    totals[row.user_id].correct_picks += row.correct_picks
    totals[row.user_id].weeks_played  += 1
  }
  const standings = Object.values(totals).sort((a, b) => b.total_points - a.total_points)

  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const doc  = new jsPDF()

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Cover + Season Standings
  // ════════════════════════════════════════════════════════════════════════════
  fullBg(doc)

  // Hero banner
  doc.setFillColor(...CARD)
  doc.rect(0, 0, PAGE_W, 52, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 50, PAGE_W, 3, 'F')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...TEXT)
  doc.text('Karl Hauck Football Pool', COL_L, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(`${season.year} Season  ·  Generated ${date}`, COL_L, 32)

  // Top-3 highlight cards
  const podium = standings.slice(0, 3)
  const cardW  = (COL_R - COL_L - 8) / 3
  podium.forEach((p, i) => {
    const cx = COL_L + i * (cardW + 4)
    const medals = ['1st', '2nd', '3rd']
    doc.setFillColor(...CARD2)
    doc.roundedRect(cx, 57, cardW, 22, 2, 2, 'F')
    doc.setFillColor(...rankColor(i + 1))
    doc.rect(cx, 57, 3, 22, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...rankColor(i + 1))
    doc.text(`${medals[i]} ${p.name}`, cx + 6, 65)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(...TEXT)
    doc.text(`${p.total_points} pts`, cx + 6, 74)
  })

  // Standings table
  let y = sectionBanner(doc, 'Season Standings', 86)

  autoTable(doc, {
    startY: y,
    head: [['#', 'Player', 'Points', 'Correct', 'Weeks']],
    body: standings.map((s, i) => [i + 1, s.name, s.total_points, s.correct_picks, s.weeks_played]),
    theme: 'plain',
    headStyles: {
      fillColor: CARD2,
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fillColor: CARD,
      textColor: TEXT,
      fontSize: 9,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [20, 34, 60] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 0) {
        const rank = data.row.index + 1
        data.cell.styles.textColor = rankColor(rank)
        data.cell.styles.fontStyle = rank <= 3 ? 'bold' : 'normal'
      }
      if (data.section === 'body' && data.column.index === 2) {
        data.cell.styles.textColor = PLIGHT
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // WEEKLY PAGES
  // ════════════════════════════════════════════════════════════════════════════
  for (const week of weeks) {
    const weekScores = allScores
      .filter((s) => s.week_id === week.id)
      .sort((a, b) => b.total_points - a.total_points)
    if (weekScores.length === 0) continue

    const weekGames   = allGames.filter((g) => g.week_id === week.id)
    const scoredGames = weekGames.filter((g) => g.home_score !== null && g.away_score !== null)

    doc.addPage()
    fullBg(doc)

    // Page header bar
    doc.setFillColor(...CARD)
    doc.rect(0, 0, PAGE_W, 28, 'F')
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 26, PAGE_W, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...TEXT)
    doc.text(`Week ${week.week_number} Results`, COL_L, 18)

    y = 36

    // Final Scores table
    if (scoredGames.length > 0) {
      y = sectionBanner(doc, 'Final Scores', y, CARD2)

      autoTable(doc, {
        startY: y,
        head: [['Matchup', 'Away', 'Home']],
        body: scoredGames.map((g) => [
          `${g.away_team} @ ${g.home_team}`,
          g.away_score,
          g.home_score,
        ]),
        theme: 'plain',
        headStyles: { fillColor: CARD2, textColor: MUTED, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fillColor: CARD, textColor: TEXT, fontSize: 9, lineColor: BORDER, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: [20, 34, 60] },
        columnStyles: {
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 },
        },
      })

      y = doc.lastAutoTable.finalY + 10
    }

    // Player Scores table
    y = sectionBanner(doc, 'Player Scores', y)

    autoTable(doc, {
      startY: y,
      head: [['#', 'Player', 'Correct', 'Points']],
      body: weekScores.map((s, i) => [
        i + 1,
        s.users?.display_name ?? 'Unknown',
        s.correct_picks,
        s.total_points,
      ]),
      theme: 'plain',
      headStyles: { fillColor: CARD2, textColor: MUTED, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fillColor: CARD, textColor: TEXT, fontSize: 9, lineColor: BORDER, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [20, 34, 60] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 22 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.textColor = rankColor(data.row.index + 1)
          data.cell.styles.fontStyle = data.row.index < 3 ? 'bold' : 'normal'
        }
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = data.row.index === 0 ? GOLD : PLIGHT
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  doc.save(`football-pool-${season.year}.pdf`)
}
