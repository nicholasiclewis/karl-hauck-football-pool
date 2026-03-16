import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * Wraps routes that require commissioner role.
 * Non-commissioners are redirected to the home screen.
 */
export default function CommissionerRoute() {
  const { profile } = useAuth()
  return profile?.is_commissioner ? <Outlet /> : <Navigate to="/" replace />
}
