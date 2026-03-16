import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const BASE_ITEMS = [
  { path: '/',          icon: '🏈', label: 'PICKS'     },
  { path: '/standings', icon: '🏆', label: 'STANDINGS' },
  { path: '/history',   icon: '📋', label: 'HISTORY'   },
  { path: '/profile',   icon: '👤', label: 'PROFILE'   },
]
const ADMIN_ITEM = { path: '/commissioner', icon: '⚙️', label: 'ADMIN' }

export default function BottomNav() {
  const location = useLocation()
  const { profile } = useAuth()

  const items = profile?.is_commissioner
    ? [...BASE_ITEMS.slice(0, 3), ADMIN_ITEM, BASE_ITEMS[3]]
    : BASE_ITEMS

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 min-h-[52px] transition-colors ${
                isActive ? 'text-primary-light' : 'text-border2 hover:text-muted'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium tracking-widest leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
