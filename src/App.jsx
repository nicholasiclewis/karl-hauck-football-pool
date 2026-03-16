import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/layout/ProtectedRoute'
import CommissionerRoute from './components/layout/CommissionerRoute'
import Login from './pages/Login'
import Picks from './pages/Picks'
import Standings from './pages/Standings'
import History from './pages/History'
import Commissioner from './pages/Commissioner'
import Profile from './pages/Profile'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}
