import WeekBreakdown from './WeekBreakdown'
import GiftBadge from './GiftBadge'

/**
 * PlayerRow — a single row in the Season Standings list.
 * Tapping it toggles the WeekBreakdown accordion below it.
 *
 * Props:
 *   entry       — standings entry object from useStandings
 *   rank        — shared position from assignRanks; entry.tied says whether
 *                 anybody else is on it
 *   isCurrentUser — true if this row belongs to the logged-in user
 *   isExpanded  — whether the breakdown is open
 *   onToggle    — callback to toggle expansion
 *   weeks       — array of week rows for the WeekBreakdown label lookup
 *   gift        — true for the elf game's champion, who gets a 🎁
 *   duesIcon    — 🤡 when dues are late, in which case it replaces the
 *                 player's initials entirely; null otherwise (paid, early in
 *                 the season, or status unknown) and the avatar is normal
 */
export default function PlayerRow({
  entry,
  rank,
  isCurrentUser,
  isExpanded,
  onToggle,
  weeks = [],
  duesIcon = null,
  payout = null,
  gift = false,
}) {
  const initials = (entry.display_name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Rank number colour
  let rankColor = 'var(--text)'
  if (rank === 1) rankColor = '#fbbf24'   // gold
  if (rank === 2) rankColor = '#94a3b8'   // silver
  if (rank === 3) rankColor = '#b45309'   // bronze

  // Win-loss record derived from weeks_played and correct_picks
  // We don't have individual game wins — show weeks_played as a simple stat
  const weeksPlayed = entry.weeks_played ?? 0

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--card2)' }}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${entry.display_name ?? 'Unknown'}, ${entry.tied ? 'tied for' : ''} rank ${rank}, ${entry.total_points ?? 0} points — week by week`}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
        style={{
          background: isCurrentUser
            ? 'linear-gradient(90deg, var(--primary) 0%, var(--card2) 100%)'
            : isExpanded
            ? 'var(--card)'
            : 'transparent',
          borderLeft: isCurrentUser ? '2px solid var(--primary-light)' : '2px solid transparent',
        }}
      >
        {/* Rank — T for a position shared with somebody on the same points,
            so two players reading the same number looks deliberate rather
            than like a bug. The pool breaks these in the final week. */}
        <span
          className="w-6 text-center text-sm font-bold flex-shrink-0"
          style={{ color: rankColor }}
        >
          {entry.tied ? `T${rank}` : rank}
        </span>

        {/* Avatar — the clown takes the whole circle when dues are late */}
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
            title={duesIcon ? 'Dues not paid — and it is getting late' : undefined}
            style={{
              background:
                rank === 1
                  ? 'linear-gradient(135deg, var(--primary), var(--border))'
                  : rank === 2
                  ? 'linear-gradient(135deg, var(--primary-light), var(--primary-dark))'
                  : rank === 3
                  ? 'linear-gradient(135deg, #b45309, #92400e)'
                  : 'var(--border)',
              color: '#ffffff',
            }}
          >
            {duesIcon ? (
              <span
                role="img"
                aria-label="Dues not paid"
                className="flex h-full w-full items-center justify-center text-lg leading-none"
              >
                {duesIcon}
              </span>
            ) : initials}
          </div>
          {gift && <GiftBadge />}
        </div>

        {/* Name + weeks played */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isCurrentUser ? '#ffffff' : 'var(--text)' }}
            >
              {entry.display_name ?? 'Unknown'}
            </span>
            {isCurrentUser && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: 'var(--primary-light)', color: 'var(--card)' }}
              >
                You
              </span>
            )}
            {payout != null && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }}
              >
                ${Number(payout).toFixed(0)}
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {weeksPlayed} wk{weeksPlayed !== 1 ? 's' : ''} played
            &nbsp;·&nbsp;{entry.correct_picks ?? 0} correct
          </div>
        </div>

        {/* Points + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-base font-bold" style={{ color: 'var(--primary-light)' }}>
              {entry.total_points ?? 0}
            </div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              pts
            </div>
          </div>
          <span
            aria-hidden="true"
            className="text-muted text-xs transition-transform duration-200"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--muted)',
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
