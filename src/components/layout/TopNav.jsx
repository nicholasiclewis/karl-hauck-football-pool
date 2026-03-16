import { useAuth } from '../../hooks/useAuth'

export default function TopNav() {
  const { profile } = useAuth()

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const lastName = profile?.display_name?.split(' ')[1]
  const shortName = lastName ? `${firstName} ${lastName[0]}.` : firstName

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <div className="text-lg font-bold tracking-wider">
          <span className="text-primary-light">KH</span>
          <span className="text-white">FP</span>
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
