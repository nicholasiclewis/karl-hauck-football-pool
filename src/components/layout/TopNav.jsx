import { useAuth } from '../../hooks/useAuth'
import { activeTheme } from '../../lib/seasonalTheme'
import { OPEN_TRIBUTE } from './KarlTribute'

// What sits beside the logo while each theme runs.
const LOGO_MARKS = {
  halloween: { mark: '🎃', label: 'Happy Halloween' },
  thanksgiving: { mark: '🦃', label: 'Happy Thanksgiving' },
  christmas: { mark: '🎄', label: 'Merry Christmas' },
  newyear: { mark: '🎆', label: 'Happy New Year' },
}

export default function TopNav() {
  const { profile } = useAuth()
  const theme = activeTheme()

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const lastName = profile?.display_name?.split(' ')[1]
  const shortName = lastName ? `${firstName} ${lastName[0]}.` : firstName

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <div className="text-lg font-bold tracking-wider">
          <span className="text-primary-light">KH</span>
          <span className="text-white">FP</span>
          {theme === 'karl' ? (
            <button
              type="button"
              className="ml-1.5"
              aria-label="Remembering Karl Hauck"
              onClick={() => window.dispatchEvent(new Event(OPEN_TRIBUTE))}
            >
              🕯️
            </button>
          ) : (
            LOGO_MARKS[theme] && (
              <span className="ml-1.5" role="img" aria-label={LOGO_MARKS[theme].label}>
                {LOGO_MARKS[theme].mark}
              </span>
            )
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-accent-text">{shortName}</span>
          <div className="w-[34px] h-[34px] rounded-full bg-primary-light flex items-center justify-center text-black font-bold text-sm">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
