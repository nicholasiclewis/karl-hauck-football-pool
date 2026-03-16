/**
 * WeekBreakdown — accordion detail panel shown when a player row is tapped.
 * Renders one row per week: week label chip + pts + correct picks.
 *
 * Props:
 *   weekly  — array of weekly score objects from useStandings
 *   weeks   — array of week rows from the DB (to look up week_number labels)
 */
export default function WeekBreakdown({ weekly = [], weeks = [] }) {
  // Build a lookup: week_id → week_number
  const weekMap = {}
  weeks.forEach((w) => {
    weekMap[w.id] = w
  })

  // Sort by week number ascending so the breakdown reads top-to-bottom chronologically
  const sorted = [...weekly].sort((a, b) => {
    const wa = weekMap[a.week_id]?.week_number ?? 0
    const wb = weekMap[b.week_id]?.week_number ?? 0
    return wa - wb
  })

  if (sorted.length === 0) {
    return (
      <div className="px-4 py-3 text-center text-muted text-sm">
        No weekly data yet.
      </div>
    )
  }

  return (
    <div
      className="border-t border-border bg-bg"
      style={{ borderTop: '1px solid #001a5c' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted flex-1">Week</span>
        <span className="text-[10px] uppercase tracking-widest text-muted w-14 text-right">Correct</span>
        <span className="text-[10px] uppercase tracking-widest text-muted w-14 text-right">Pts</span>
      </div>

      {sorted.map((row) => {
        const weekInfo = weekMap[row.week_id]
        const weekNum = weekInfo?.week_number ?? '?'
        const nflCount = row.nfl_correct ?? 0
        const totalCorrect = row.correct_picks ?? 0
        const pts = row.total_points ?? 0
        const bonus = row.bonus_points ?? 0

        return (
          <div
            key={row.week_id}
            className="flex items-center gap-2 px-4 py-2.5 border-t border-border"
            style={{ borderTop: '1px solid #001040' }}
          >
            {/* Week chip */}
            <div className="flex-1 flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center rounded-full text-[10px] font-bold px-2.5 py-0.5 border"
                style={{
                  background: '#001040',
                  borderColor: '#002480',
                  color: '#a8c8ff',
                  minWidth: '3rem',
                }}
              >
                Wk {weekNum}
              </span>

              {/* Bonus indicator */}
              {bonus > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: '#10b98122', color: '#10b981' }}
                >
                  +{bonus} bonus
                </span>
              )}
            </div>

            {/* Correct picks */}
            <span
              className="w-14 text-right text-sm font-medium"
              style={{ color: '#d4e4ff' }}
            >
              {totalCorrect}
              {nflCount > 0 && (
                <span className="text-[10px] text-muted ml-1">({nflCount} NFL)</span>
              )}
            </span>

            {/* Points */}
            <span
              className="w-14 text-right text-sm font-bold"
              style={{ color: '#4a7fd4' }}
            >
              {pts}
            </span>
          </div>
        )
      })}

      {/* Season total footer */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-t"
        style={{ borderTop: '1px solid #001a5c', background: '#000d2e' }}
      >
        <span className="flex-1 text-[11px] uppercase tracking-widest text-muted">Season Total</span>
        <span className="w-14 text-right text-sm font-medium" style={{ color: '#d4e4ff' }}>
          {sorted.reduce((sum, r) => sum + (r.correct_picks ?? 0), 0)}
        </span>
        <span className="w-14 text-right text-sm font-bold" style={{ color: '#4a7fd4' }}>
          {sorted.reduce((sum, r) => sum + (r.total_points ?? 0), 0)}
        </span>
      </div>
    </div>
  )
}
