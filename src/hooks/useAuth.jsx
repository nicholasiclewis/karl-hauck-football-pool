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
  // True while the session came from an emailed password-reset link. The app
  // gates on this: such a session exists to set a new password, nothing else.
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  // Listen for auth state changes — only update user, never call DB here
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
        if (!session?.user) {
          setProfile(null)
          setLoading(false)
          setPasswordRecovery(false)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // Load profile whenever user changes.
  // The timer is cancelled on unmount or when the user changes again, and the
  // fetch checks before writing: onAuthStateChange can fire several times in
  // quick succession, and without this an earlier request could resolve last
  // and overwrite the current profile.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const timer = setTimeout(() => loadProfile(user.id, () => cancelled), 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [user])

  /** Load the player's profile row from our users table */
  async function loadProfile(userId, isCancelled = () => false) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      if (!isCancelled()) setProfile(data ?? null)
    } catch (err) {
      console.error('loadProfile error:', err)
      if (!isCancelled()) setProfile(null)
    } finally {
      if (!isCancelled()) setLoading(false)
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
    // Validate the invite code server-side. This used to SELECT from seasons,
    // which required anon read on that table — and since the anon key ships in
    // this bundle, anyone could read join_code and let themselves in. The RPC
    // answers yes/no without ever returning the code.
    const { data: isValid, error: codeErr } = await supabase.rpc(
      'verify_season_join_code',
      { p_code: joinCode }
    )

    if (codeErr) throw new Error('Could not verify invite code. Please try again.')

    if (!isValid) {
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

  /**
   * Email a password-reset link. Opening it signs the user in with a
   * recovery session, which App routes into the set-new-password screen.
   * The redirect URL must be on the Supabase project's allowed list.
   */
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) throw error
  }

  /** Called once a recovery session has finished setting its new password. */
  function finishPasswordRecovery() {
    setPasswordRecovery(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        passwordRecovery,
        signIn,
        signUp,
        signOut,
        updateDisplayName,
        updatePassword,
        resetPassword,
        finishPasswordRecovery,
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
