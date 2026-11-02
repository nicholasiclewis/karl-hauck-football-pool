import { useMemo } from 'react'
import { activeTheme } from '../../lib/seasonalTheme'

const LEAVES = ['🍁', '🍂', '🍁', '🍂', '🍃']
const COUNT = 12

/**
 * Thanksgiving week: a handful of autumn leaves drifting down the screen,
 * behind the navs and never in the way of a tap. index.css does the moving.
 */
export default function Leaves() {
  const thanksgiving = activeTheme() === 'thanksgiving'
  // Rolled once, so the leaves don't jump about on every render.
  const leaves = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        mark: LEAVES[i % LEAVES.length],
        left: Math.random() * 96,
        size: 14 + Math.random() * 14,
        fall: 11 + Math.random() * 10,
        sway: 2.5 + Math.random() * 2.5,
        // Negative delays start each leaf part-way down, so the screen isn't
        // empty for the first few seconds.
        delay: -Math.random() * 20,
      })),
    []
  )

  if (!thanksgiving) return null
  return leaves.map((l, i) => (
    <div
      key={i}
      className="leaf"
      aria-hidden="true"
      style={{
        left: `${l.left}vw`,
        fontSize: l.size,
        '--fall': `${l.fall}s`,
        '--sway': `${l.sway}s`,
        '--delay': `${l.delay}s`,
      }}
    >
      <span>{l.mark}</span>
    </div>
  ))
}
