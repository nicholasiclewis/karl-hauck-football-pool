import { weekPoints } from '../../lib/scoring'

/**
 * What the week is worth right now, and what it could still be worth.
 *
 * Everything here counts settled games only. The previous version marked a
 * bonus "achieved ✓" as soon as the player had *selected* four NFL games,
 * which read as points banked for making picks rather than for winning them.
 *
 * A bonus that can no longer be reached says so. Once a fifth pick is lost,
 * "All 6 correct" is gone, and pretending it is still pending is the same
 * flattery in a quieter form.
 */
export default function PointsPreview({ week, games, picks }) {
  const ct = week?.container_type
  const pts = weekPoints(picks, games, ct)

  const maxCorrect = pts.correct + pts.pending
  const maxNfl     = pts.nflCorrect + pts.pendingNfl

  const bonuses = ct === 'nfl_college'
    ? [
        bonusRow('All 4 NFL correct', pts.nflCorrect, maxNfl, 4),
        bonusRow('All 6 correct', pts.correct, maxCorrect, 6),
      ]
    : [
        bonusRow('Any 4 correct', pts.correct, maxCorrect, 4),
        bonusRow('All 6 correct', pts.correct, maxCorrect, 6),
      ]

  const basePoints = pts.correct + pts.pushes * 0.5

  return (
    <div className="mx-4 mb-6 bg-bg border border-border rounded-xl p-4">
      <p className="text-[10px] tracking-widest uppercase text-muted mb-3">
        Points This Week
      </p>

      {/* Base points — what the settled games have paid so far */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">
          Correct picks
          {pts.pushes > 0 && <span className="text-[11px]"> (+{pts.pushes} push)</span>}
        </span>
        <span className="text-sm text-accent-text font-bold">
          {pts.settled > 0 ? `${round1(basePoints)} pts` : 'nothing settled yet'}
        </span>
      </div>

      {bonuses.map((b) => (
        <div key={b.label} className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">{b.label}</span>
          <span className={`text-sm font-bold ${b.tone}`}>{b.text}</span>
        </div>
      ))}

      <div className="h-px bg-border my-3" />

      {/* Banked, then the ceiling. Two numbers, because either alone misleads:
          the first ignores a week still in play, the second flatters it. */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">Points so far</span>
        <span className="text-xl font-bold text-primary-light">{round1(pts.earned)} pts</span>
      </div>

      {pts.pending > 0 && (
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted">
            Most you can finish on · {pts.pending} still to play
          </span>
          <span className="text-sm font-semibold text-muted">{round1(pts.max)} pts</span>
        </div>
      )}

      {pts.earned >= 8 && (
        <div className="mt-3 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg">
          <p className="text-xs text-primary-light">🏆 Maximum points — perfect week!</p>
        </div>
      )}
    </div>
  )
}

/** Scores land on half points, so summing drifts; one decimal is exact. */
const round1 = (n) => Math.round(n * 10) / 10

/**
 * Where one bonus stands: won, still live, or mathematically gone.
 * `have` is correct picks so far, `ceiling` is that plus everything unplayed.
 */
function bonusRow(label, have, ceiling, need) {
  if (have >= need) {
    return { label, text: '+1 pt ✓', tone: 'text-green' }
  }
  if (ceiling < need) {
    return { label, text: 'out of reach', tone: 'text-muted line-through' }
  }
  return { label, text: `+1 · ${need - have} more correct`, tone: 'text-muted' }
}
