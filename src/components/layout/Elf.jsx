import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { activeTheme } from '../../lib/seasonalTheme'
import ElfGame from './ElfGame'

// Each page visit rolls once: this share of visits get an elf, and on those he
// peeks out somewhere in this window (ms) after the page opens.
const PEEK_CHANCE = 0.6
const DELAY = [3_000, 10_000]
const PEEK_MS = 5_000 // matches the elf-peek animation in index.css
const WINDOW = { w: 44, h: 52 } // matches .elf-window

const between = ([lo, hi]) => lo + Math.random() * (hi - lo)

/**
 * Somewhere to hide: a button or link on the page, clear of both navs and
 * fully on screen with room above it for the elf to climb into.
 */
function pickHidingSpot() {
  const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 56
  const footer = document.querySelector('nav')?.getBoundingClientRect().top ?? window.innerHeight
  const spots = [...document.querySelectorAll('button, a[href]')]
    .filter((el) => !el.closest('header, nav, [role="dialog"]'))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width >= WINDOW.w + 8 && r.top - WINDOW.h > header + 4 && r.bottom < footer)

  if (spots.length) {
    const r = spots[Math.floor(Math.random() * spots.length)]
    return {
      left: r.left + 4 + Math.random() * (r.width - WINDOW.w - 8),
      top: r.top - WINDOW.h,
    }
  }
  // Nothing to hide behind: climb up from behind the bottom nav instead.
  return {
    left: between([16, window.innerWidth - WINDOW.w - 16]),
    top: footer - WINDOW.h,
  }
}

/**
 * During Christmas week an elf sometimes peeks out from behind a button. Catch
 * him before he ducks back down and he lets you into his game.
 */
export default function Elf() {
  const { pathname } = useLocation()
  const [elf, setElf] = useState(null)
  const [caught, setCaught] = useState(false)
  const [playing, setPlaying] = useState(false)
  const christmas = activeTheme() === 'christmas'

  useEffect(() => {
    setElf(null)
    // Always turns up on the dev server, so a preview never has to wait on luck.
    const chance = import.meta.env.DEV ? 1 : PEEK_CHANCE
    if (!christmas || playing || Math.random() >= chance) return

    let gone
    const hide = () => setElf(null)
    const peek = setTimeout(() => {
      if (document.hidden) return
      setCaught(false)
      setElf({ id: Date.now(), ...pickHidingSpot() })
      gone = setTimeout(hide, PEEK_MS)
      // He's pinned to where the button was; if the page moves, he's gone.
      window.addEventListener('scroll', hide, { once: true, capture: true })
    }, between(DELAY))

    return () => {
      clearTimeout(peek)
      clearTimeout(gone)
      window.removeEventListener('scroll', hide, { capture: true })
    }
  }, [pathname, christmas, playing])

  return (
    <>
      {elf && (
        <div key={elf.id} className="elf-window" style={{ left: elf.left, top: elf.top }}>
          <button
            type="button"
            aria-label="An elf! Tap to catch him"
            className={`elf ${caught ? 'elf-caught' : ''}`}
            onClick={() => {
              setCaught(true)
              setTimeout(() => {
                setElf(null)
                setPlaying(true)
              }, 450)
            }}
          >
            <ElfFace />
          </button>
        </div>
      )}
      {playing && <ElfGame onClose={() => setPlaying(false)} />}
    </>
  )
}

/** Hat, ears, and a face — just enough to peek over a button. */
function ElfFace() {
  return (
    <svg viewBox="0 0 44 52" width="44" height="52" aria-hidden="true">
      {/* hat */}
      <path d="M8 22 C10 10 20 2 34 4 C30 8 30 14 36 22 Z" fill="#16a34a" />
      <circle cx="35" cy="4" r="3.5" fill="#fef3c7" />
      <rect x="6" y="20" width="32" height="6" rx="3" fill="#dc2626" />
      {/* ears */}
      <path d="M8 30 L1 24 L9 36 Z" fill="#f5c9a3" />
      <path d="M36 30 L43 24 L35 36 Z" fill="#f5c9a3" />
      {/* face */}
      <ellipse cx="22" cy="36" rx="14" ry="13" fill="#f9d7b8" />
      <circle cx="17" cy="34" r="2" fill="#1f2937" />
      <circle cx="27" cy="34" r="2" fill="#1f2937" />
      <circle cx="13" cy="39" r="2.5" fill="#fca5a5" opacity="0.7" />
      <circle cx="31" cy="39" r="2.5" fill="#fca5a5" opacity="0.7" />
      <path d="M18 41 Q22 44 26 41" stroke="#7c2d12" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
