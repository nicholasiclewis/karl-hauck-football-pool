import { useState } from 'react'
import { teamLogoUrl } from '../../lib/teamLogos'

/**
 * Team crest in a circle, falling back to the text abbreviation.
 *
 * Two things can go wrong and both land on the initials rather than a broken
 * image: we may have no mapping for the team, or the CDN request may fail
 * (offline, blocked, a retired team id). The circle keeps its size either way
 * so cards never shift as logos load.
 *
 * Props:
 *   team   — team name as stored on the game row
 *   sport  — 'nfl' | 'college'
 *   abbr   — fallback initials
 *   size   — pixel diameter (default 44, matching the w-11 h-11 it replaced)
 */
export default function TeamLogo({ team, sport, abbr, size = 44 }) {
  const [failed, setFailed] = useState(false)
  const url = teamLogoUrl(team, sport)
  const showLogo = url && !failed

  return (
    <div
      className="rounded-full bg-bg border-2 border-border2 flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {showLogo ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: size * 0.74, height: size * 0.74, objectFit: 'contain' }}
        />
      ) : (
        <span className="text-xs font-bold text-accent-text">{abbr}</span>
      )}
    </div>
  )
}
