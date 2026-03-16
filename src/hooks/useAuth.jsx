import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Create a context — think of this as a global variable any component can read
const AuthContext = createContext(null)

/**
 * AuthProvider wraps the whole app so every page can access the current user.
 * Put this at the top level in App.jsx.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // the raw Supabase auth user
  const [profile, setProfile] = useState(null) // our custom users table row
  const [loading, setLoading] = useState(true)  // true while we check if logged in

  useEffect(() => {
    // Safety net — never stay stuck loading for more than 8 seconds
    const timeout = setTimeout(() => {
      console.warn('Auth timeout reached — forcing loading to false')
      setLoading(false)
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          // Pass the token directly — never call getSession() inside this callback
          await loadProfile(currentUser.id, session.access_token)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  /** Load the player's profile row from our users table */
  async function loadProfile(userId, accessToken) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*&limit=1`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      )
      const rows = await res.json()
      setProfile(rows[0] ?? null)
    } catch (err) {
      console.error('loadProfile error:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  /** Sign in with email + password */
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  /**
   * Create a new account.
   * Validates the season join code before creating the auth account.
   */
  async function signUp(email, password, displayName, joinCode) {
    // Check that the join code matches the active season
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .eq('join_code', joinCode.trim().toUpperCase())
      .maybeSingle()

    if (!season) {
      throw new Error('Invalid invite code. Ask your commissioner for the current code.')
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    })
    if (error) throw error
  }

  /** Sign out */
  async function signOut() {
    await supabase.auth.signOut()
  }

  /** Update the current user's display name */
  async function updateDisplayName(displayName) {
    if (!user) throw new Error('Not logged in')

    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)

    if (error) throw error
    await loadProfile(user.id)
  }

  /** Update the current user's password */
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateDisplayName,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** Hook — call this inside any component to get the current user */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
