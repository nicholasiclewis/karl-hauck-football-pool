import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { activeTheme } from '../../lib/seasonalTheme'

// Each page visit rolls once: this share of visits are haunted, and on those
// the ghost turns up somewhere in this window (ms) after the page opens.
const HAUNT_CHANCE = 0.4
const DELAY = [3_000, 15_000]
const HAUNT_MS = 6_000 // matches the ghost-haunt animation in index.css

const between = ([lo, hi]) => lo + Math.random() * (hi - lo)

/**
 * A ghost that drifts up somewhere on a random page during Halloween week.
 * Tap it and it says boo and vanishes. Renders nothing outside the theme.
 */
export default function Ghost() {
  const { pathname } = useLocation()
  const [ghost, setGhost] = useState(null)
  const [booed, setBooed] = useState(false)
  const haunting = activeTheme() === 'halloween'

  useEffect(() => {
    // A new page clears any ghost left over from the last one.
    setGhost(null)
    if (!haunting || Math.random() >= HAUNT_CHANCE) return

    let gone
    const appear = setTimeout(() => {
      // Nobody to scare in a background tab.
      if (document.hidden) return
      setBooed(false)
      setGhost({
        id: Date.now(),
        left: between([5, 80]),
        top: between([18, 65]),
        flip: Math.random() < 0.5,
      })
      gone = setTimeout(() => setGhost(null), HAUNT_MS)
    }, between(DELAY))

    return () => {
      clearTimeout(appear)
      clearTimeout(gone)
    }
  }, [pathname, haunting])

  if (!ghost) return null

  return (
    <button
      key={ghost.id}
      type="button"
      aria-label="A ghost! Tap to scare it off"
      onClick={() => {
        setBooed(true)
        setTimeout(() => setGhost(null), 700)
      }}
      className={`ghost ${booed ? 'ghost-booed' : ''}`}
      style={{ left: `${ghost.left}vw`, top: `${ghost.top}vh` }}
    >
      <svg
        viewBox="0 0 64 72"
        width="56"
        height="63"
        aria-hidden="true"
        style={{ transform: ghost.flip ? 'scaleX(-1)' : undefined }}
      >
        <path
          d="M32 2C16 2 6 14 6 30v38l8-6 9 6 9-6 9 6 9-6 8 6V30C58 14 48 2 32 2z"
          fill="#f8f5ff"
          stroke="#d8cdea"
          strokeWidth="1.5"
        />
        <ellipse cx="23" cy="28" rx="4.5" ry="6.5" fill="#1d1429" />
        <ellipse cx="41" cy="28" rx="4.5" ry="6.5" fill="#1d1429" />
        <ellipse cx="32" cy="44" rx="5" ry="6" fill="#1d1429" />
      </svg>
      {booed && <span className="ghost-boo">Boo!</span>}
    </button>
  )
}
