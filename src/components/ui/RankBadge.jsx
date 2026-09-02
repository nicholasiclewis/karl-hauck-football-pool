/**
 * A team's poll rank, shown ahead of its name.
 *
 * Renders nothing when the team is unranked, so callers pass a rank through
 * unconditionally rather than guarding every call site. `trailing` adds the
 * space that separates it from the name in a run of inline text; a flex row
 * that already has a gap leaves it off.
 */
export default function RankBadge({ rank, trailing = true, className = '' }) {
  if (rank == null) return null
  return (
    <span className={`font-bold ${className}`} style={{ color: '#f5b301' }}>
      #{rank}{trailing ? ' ' : ''}
    </span>
  )
}
