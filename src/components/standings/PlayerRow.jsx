import WeekBreakdown from './WeekBreakdown'

/**
 * PlayerRow — a single row in the Season Standings list.
 * Tapping it toggles the WeekBreakdown accordion below it.
 *
 * Props:
 *   entry       — standings entry object from useStandings
 *   rank        — 1-based rank number
 *   isCurrentUser — true if this row belongs to the logged-in user
 *   isExpanded  — whether the breakdown is open
 *   onToggle    — callback to toggle expansion
 *   weeks       — array of week rows for the WeekBreakdown label lookup
 *   duesIcon    — emoji string: ✅ | 🔴 | 🎓
 */
export default function PlayerRow({
  entry,
  rank,
  isCurrentUser,
  isExpanded,
  onToggle,
  weeks = [],
  duesIcon = '🔴',
}) {
  const initials = (entry.display_name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Rank number colour
  let rankColor = '#f0f6ff'
  if (rank === 1) rankColor = '#fbbf24'   // gold
  if (rank === 2) rankColor = '#94a3b8'   // silver
  if (rank === 3) rankColor = '#b45309'   // bronze

  // Win-loss record derived from weeks_played and correct_picks
  // We don't have individual game wins — show weeks_played as a simple stat
  const weeksPlayed = entry.weeks_played ?? 0

  return (
    <div
      className="border-b"
      style={{ borderColor: '#253347' }}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
        style={{
          background: isCurrentUser
            ? 'linear-gradient(90deg, #2563eb 0%, #253347 100%)'
            : isExpanded
            ? '#1e293b'
            : 'transparent',
          borderLeft: isCurrentUser ? '2px solid #60a5fa' : '2px solid transparent',
        }}
      >
        {/* Rank */}
        <span
          className="w-6 text-center text-sm font-bold flex-shrink-0"
          style={{ color: rankColor }}
        >
          {rank}
        </span>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
            style={{
              background:
                rank === 1
                  ? 'linear-gradient(135deg, #2563eb, #374e6b)'
                  : rank === 2
                  ? 'linear-gradient(135deg, #60a5fa, #2a5aaa)'
                  : rank === 3
                  ? 'linear-gradient(135deg, #b45309, #92400e)'
                  : '#374e6b',
              color: '#ffffff',
            }}
          >
            {initials}
          </div>
          {/* Dues overlay badge */}
          <span
            className="absolute -bottom-1 -right-1 text-base leading-none bg-white rounded-full w-5 h-5 flex items-center justify-center shadow"
            title="Dues status"
          >
            {duesIcon}
          </span>
        </div>

        {/* Name + weeks played */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isCurrentUser ? '#ffffff' : '#f0f6ff' }}
            >
              {entry.display_name ?? 'Unknown'}
            </span>
            {isCurrentUser && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: '#60a5fa', color: '#1e293b' }}
              >
                You
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: '#94afd4' }}>
            {weeksPlayed} wk{weeksPlayed !== 1 ? 's' : ''} played
            &nbsp;·&nbsp;{entry.correct_picks ?? 0} correct
          </div>
        </div>

        {/* Points + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-base font-bold" style={{ color: '#60a5fa' }}>
              {entry.total_points ?? 0}
            </div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: '#94afd4' }}>
              pts
            </div>
          </div>
          <span
            className="text-muted text-xs transition-transform duration-200"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              color: '#94afd4',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expandable breakdown */}
      {isExpanded && (
        <WeekBreakdown weekly={entry.weekly ?? []} weeks={weeks} />
      )}
    </div>
  )
}
