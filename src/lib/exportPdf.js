import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'

const BLUE   = [37, 99, 235]
const SLATE  = [55, 78, 107]
const LIGHT  = [245, 247, 250]

export async function downloadReport() {
  // ── Fetch active season ───────────────────────────────────────────────────
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (!season) throw new Error('No active season found')

  // ── Fetch weeks ───────────────────────────────────────────────────────────
  const { data: weeksData } = await supabase
    .from('weeks')
    .select('*')
    .eq('season_id', season.id)
    .order('week_number')
  const weeks = weeksData ?? []
  const weekIds = weeks.map((w) => w.id)

  if (weekIds.length === 0) throw new Error('No weeks found for this season')

  // ── Fetch weekly scores ───────────────────────────────────────────────────
  const { data: scoresData } = await supabase
    .from('weekly_scores')
    .select('*, users:user_id(display_name)')
    .in('week_id', weekIds)
  const allScores = scoresData ?? []

  // ── Fetch games ───────────────────────────────────────────────────────────
  const { data: gamesData } = await supabase
    .from('games')
    .select('*')
    .in('week_id', weekIds)
    .order('kickoff_time')
  const allGames = gamesData ?? []

  // ── Build season standings ────────────────────────────────────────────────
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

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc = new jsPDF()
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Page 1 — Season Standings
  doc.setFontSize(18)
  doc.setTextColor(0, 0, 0)
  doc.text(`Karl Hauck Football Pool — ${season.year}`, 14, 18)

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated ${date}`, 14, 25)

  doc.setFontSize(13)
  doc.setTextColor(0, 0, 0)
  doc.text('Season Standings', 14, 36)

  autoTable(doc, {
    startY: 40,
    head: [['Rank', 'Player', 'Points', 'Correct Picks', 'Weeks Played']],
    body: standings.map((s, i) => [i + 1, s.name, s.total_points, s.correct_picks, s.weeks_played]),
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
  })

  // One page per week that has been scored
  for (const week of weeks) {
    const weekScores = allScores
      .filter((s) => s.week_id === week.id)
      .sort((a, b) => b.total_points - a.total_points)

    if (weekScores.length === 0) continue // skip unresolved weeks

    const weekGames = allGames.filter((g) => g.week_id === week.id)
    const scoredGames = weekGames.filter((g) => g.home_score !== null && g.away_score !== null)

    doc.addPage()

    doc.setFontSize(15)
    doc.setTextColor(0, 0, 0)
    doc.text(`Week ${week.week_number} Results`, 14, 18)

    let y = 26

    // Games sub-table
    if (scoredGames.length > 0) {
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text('Final Scores', 14, y)

      autoTable(doc, {
        startY: y + 4,
        head: [['Matchup', 'Away', 'Home']],
        body: scoredGames.map((g) => [
          `${g.away_team} @ ${g.home_team}`,
          g.away_score,
          g.home_score,
        ]),
        headStyles: { fillColor: SLATE, textColor: 255 },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      })

      y = doc.lastAutoTable.finalY + 10
    }

    // Player scores sub-table
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text('Player Scores', 14, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Rank', 'Player', 'Correct', 'Points']],
      body: weekScores.map((s, i) => [
        i + 1,
        s.users?.display_name ?? 'Unknown',
        s.correct_picks,
        s.total_points,
      ]),
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 0: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    })
  }

  doc.save(`football-pool-${season.year}.pdf`)
}
