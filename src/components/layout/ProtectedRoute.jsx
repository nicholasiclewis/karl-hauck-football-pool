import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LoadingScreen from './LoadingScreen'

/**
 * Wraps routes that require a logged-in user.
 * If not logged in → redirect to /login.
 * While checking login status → show a loading spinner.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
