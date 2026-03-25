/**
 * PodiumSlot — one of the three top-3 podium cards.
 *
 * Props:
 *   entry       — standings entry (or null if fewer than 3 players)
 *   place       — 1 | 2 | 3
 *   blockHeight — height in px for the coloured podium block (70 | 52 | 38)
 *   duesIcon    — emoji string: ✅ | 🔴 | 🎓
 */
export default function PodiumSlot({ entry, place, blockHeight, duesIcon = '🔴', payout = null }) {
  if (!entry) return <div className="flex-1" />

  const initials = (entry.display_name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Per-place styles
  const styles = {
    1: {
      avatarGrad: 'linear-gradient(135deg, #2563eb, #374e6b)',
      blockGrad:  'linear-gradient(180deg, #2563eb, #374e6b)',
      labelColor: '#fbbf24',
      placeLabel: '1st',
    },
    2: {
      avatarGrad: 'linear-gradient(135deg, #60a5fa, #2a5aaa)',
      blockGrad:  'linear-gradient(180deg, #60a5fa, #2a5aaa)',
      labelColor: '#94a3b8',
      placeLabel: '2nd',
    },
    3: {
      avatarGrad: 'linear-gradient(135deg, #b45309, #92400e)',
      blockGrad:  'linear-gradient(180deg, #b45309, #92400e)',
      labelColor: '#b45309',
      placeLabel: '3rd',
    },
  }

  const s = styles[place]
  const firstName = (entry.display_name ?? '').split(' ')[0]
  const lastName  = (entry.display_name ?? '').split(' ')[1]
  const shortName = lastName ? `${firstName} ${lastName[0]}.` : firstName

  return (
    <div className="flex-1 flex flex-col items-center justify-end">
      {/* Place label */}
      <span
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color: s.labelColor }}
      >
        {s.placeLabel}
      </span>

      {/* Avatar with dues badge */}
      <div className="relative mb-1">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-lg"
          style={{ background: s.avatarGrad }}
        >
          {initials}
        </div>
        {/* Dues overlay */}
        <span
          className="absolute -bottom-1 -right-1 text-base leading-none bg-white rounded-full w-5 h-5 flex items-center justify-center shadow"
          title={duesIcon === '✅' ? 'Dues paid' : duesIcon === '🤡' ? 'Dues not paid 🤡' : 'Dues not paid'}
        >
          {duesIcon}
        </span>
      </div>

      {/* Name */}
      <p
        className="text-[11px] font-semibold text-center leading-tight mb-0.5 max-w-[72px] truncate"
        style={{ color: '#f0f6ff' }}
      >
        {shortName}
      </p>

      {/* Points */}
      <p
        className="text-sm font-bold mb-0.5"
        style={{ color: '#60a5fa' }}
      >
        {entry.total_points ?? 0} pts
      </p>

      {/* Payout */}
      {payout != null && (
        <p
          className="text-[11px] font-bold mb-1.5 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
        >
          ${Number(payout).toFixed(0)}
        </p>
      )}

      {/* Podium block */}
      <div
        className="w-full rounded-t-lg flex items-center justify-center"
        style={{
          height: blockHeight,
          background: s.blockGrad,
        }}
      >
        <span className="text-white font-black text-xl opacity-30">
          {place}
        </span>
      </div>
    </div>
  )
}
