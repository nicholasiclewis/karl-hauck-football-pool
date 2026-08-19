import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LoadingScreen from './LoadingScreen'

/**
 * Wraps the routes only a signed-out visitor should see.
 *
 * This exists because of the way iPhones bookmark things. "Add to Home Screen"
 * saves whatever URL is on screen, and the first page anybody ever sees is
 * /login — so every home-screen icon in the pool points straight at it.
 * Without this guard the app rendered the sign-in form on every launch no
 * matter how good the stored session was, which reads as "it forgot me again"
 * even though nothing was ever forgotten.
 *
 * Waiting out `loading` matters as much as the redirect does: the session is
 * read back from storage asynchronously, so answering before it lands would
 * show the form to someone who is already signed in.
 */
export default function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return user ? <Navigate to="/" replace /> : <Outlet />
}
