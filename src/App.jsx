import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/layout/ProtectedRoute'
import CommissionerRoute from './components/layout/CommissionerRoute'
import Login from './pages/Login'
import Picks from './pages/Picks'
import Standings from './pages/Standings'
import History from './pages/History'
import Commissioner from './pages/Commissioner'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'

function AppRoutes() {
  const { passwordRecovery } = useAuth()

  // A session from an emailed reset link exists to do exactly one thing.
  // Gate the whole app on it so the new password gets set before the user
  // lands anywhere else.
  if (passwordRecovery) return <ResetPassword />

  return (
    <Routes>
      {/* Public route — anyone can visit /login */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes — must be logged in */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Picks />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />

        {/* Commissioner-only route */}
        <Route element={<CommissionerRoute />}>
          <Route path="/commissioner" element={<Commissioner />} />
        </Route>
      </Route>

      {/* Catch-all — redirect anything unknown to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
