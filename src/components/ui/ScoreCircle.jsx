/**
 * Circular display for a player's score or record.
 * Used on the leaderboard and pick history.
 */
export default function ScoreCircle({ value, label, variant = 'default', size = 'md' }) {
  const variants = {
    default: 'border-border2 text-text',
    good:    'border-green text-green',
    bad:     'border-red text-red',
    muted:   'border-muted text-muted',
  }

  const sizes = {
    sm: 'w-10 h-10 text-sm border',
    md: 'w-14 h-14 text-lg border-2',
    lg: 'w-20 h-20 text-2xl border-2',
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-full ${variants[variant]} ${sizes[size]}`}>
      <span className="font-bold leading-none">{value}</span>
      {label && <span className="text-[9px] text-muted leading-none mt-0.5">{label}</span>}
    </div>
  )
}
