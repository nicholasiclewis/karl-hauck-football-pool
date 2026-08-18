/**
 * The running joke made visual: a small flat badge for the season-long
 * last-place "trophy" — an actual box of raisins, awarded at year's end.
 * Not a full trophy render — see handoff README for the "real trophy" note.
 */
export default function RaisinCupBadge({ size = 16, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* box */}
        <rect x="4" y="10" width="16" height="11" rx="1" fill="#7c4a1e" stroke="#4a2c10" strokeWidth="1" />
        {/* box flap */}
        <path d="M4 10 L7 5 H17 L20 10 Z" fill="#9a5f28" stroke="#4a2c10" strokeWidth="1" />
        {/* label stripe */}
        <rect x="6" y="14" width="12" height="3" fill="#fbbf24" />
        {/* ribbon */}
        <path d="M9 5 L9 1 L12 2.5 L15 1 L15 5" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
      </svg>
      {label && <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#fbbf24' }}>{label}</span>}
    </span>
  )
}
