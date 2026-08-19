import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// The two modes available on this screen
const MODES = {
  signIn:        { label: 'Sign In',        short: 'Sign In'    },
  createAccount: { label: 'Create Account', short: 'Sign Up'    },
}

export default function Login() {
  const [mode, setMode] = useState('signIn')   // 'signIn' | 'createAccount' | 'resetPassword'
  const [serverError, setServerError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm()

  function switchMode(newMode) {
    setMode(newMode)
    setServerError('')
    setSuccessMsg('')
    reset()
  }

  async function onSubmit(data) {
    setServerError('')
    setSuccessMsg('')

    try {
      if (mode === 'signIn') {
        await signIn(data.email, data.password)
        navigate('/')
      } else if (mode === 'resetPassword') {
        await resetPassword(data.email)
        // Switch first: switchMode clears the messages, so setting the success
        // text before it would wipe the only instruction the user gets.
        // Phrased "if" — Supabase deliberately answers the same for unknown
        // emails, so we cannot (and should not) promise the mail exists.
        switchMode('signIn')
        setSuccessMsg(
          'If that email has an account, a reset link is on its way. ' +
          'Open it and choose a new password.'
        )
      } else {
        await signUp(data.email, data.password, data.displayName, data.joinCode)
        switchMode('signIn')
        setSuccessMsg(
          'Account created! Check your email for a confirmation link, then sign in.'
        )
      }
    } catch (err) {
      setServerError(err.message)
    }
  }

  const isNewUser = mode === 'createAccount'
  const isReset   = mode === 'resetPassword'

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-10">

      {/* ── Branding ─────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🏈</div>
        <h1 className="text-2xl font-extrabold text-text tracking-tight">
          Karl Hauck
        </h1>
        <h2 className="text-lg font-semibold text-primary-light">Football Pool</h2>
        <p className="text-xs text-muted mt-1 uppercase tracking-widest">
          ATS Pick'em Competition
        </p>
      </div>

      {/* ── Card ─────────────────────────────────────── */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Mode tab switcher */}
        <div className="flex border-b border-border">
          {Object.entries(MODES).map(([key, { short }]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              aria-pressed={mode === key}
              className={`flex-1 py-3 text-xs font-semibold transition-all ${
                mode === key
                  ? 'text-text bg-card2 border-b-2 border-primary-light'
                  : 'text-muted hover:text-accent-text'
              }`}
            >
              {short}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>

          {/* Each field wraps its control in the <label> so the name is
              associated implicitly — the same pattern the commissioner forms
              use. The old sibling labels pointed at nothing. */}

          {/* What the reset mode does — the tab strip has no tab for it */}
          {isReset && (
            <p className="text-xs text-muted leading-snug">
              Enter your account email and we'll send a link to reset your
              password.
            </p>
          )}

          {/* Display Name — new users only */}
          {isNewUser && (
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-accent-text mb-1.5">
                  Your Name
                </span>
                <input
                  {...register('displayName', { required: 'Name is required' })}
                  type="text"
                  placeholder="First Last"
                  autoComplete="name"
                  className="input-field"
                />
              </label>
              {errors.displayName && (
                <p className="text-red text-xs mt-1">{errors.displayName.message}</p>
              )}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-accent-text mb-1.5">
                Email Address
              </span>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="input-field"
              />
            </label>
            {errors.email && (
              <p className="text-red text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password — not part of requesting a reset link */}
          {!isReset && (
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-accent-text mb-1.5">
                Password
              </span>
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                type="password"
                placeholder={isNewUser ? 'Min. 6 characters' : '••••••••'}
                autoComplete={isNewUser ? 'new-password' : 'current-password'}
                className="input-field"
              />
            </label>
            {errors.password && (
              <p className="text-red text-xs mt-1">{errors.password.message}</p>
            )}
          </div>
          )}

          {/* Join / Invite Code — new users only */}
          {isNewUser && (
            <div>
              <label className="block">
                <span className="block text-xs font-medium text-accent-text mb-1.5">
                  Pool Invite Code
                </span>
                <input
                  {...register('joinCode', {
                    required: 'Invite code is required',
                    setValueAs: (v) => v?.trim().toUpperCase(),
                  })}
                  type="text"
                  placeholder="Get this from your commissioner"
                  autoComplete="off"
                  className="input-field uppercase tracking-widest"
                />
              </label>
              {errors.joinCode && (
                <p className="text-red text-xs mt-1">{errors.joinCode.message}</p>
              )}
              <p className="text-muted text-xs mt-1">
                Ask your commissioner for the current season code.
              </p>
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <div className="bg-red/10 border border-red/30 rounded-lg p-3">
              <p className="text-red text-sm leading-snug">{serverError}</p>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="bg-green/10 border border-green/30 rounded-lg p-3">
              <p className="text-green text-sm leading-snug">{successMsg}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors mt-1"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'signIn'
              ? 'Sign In'
              : mode === 'createAccount'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>

          {/* Helper links */}
          {mode === 'signIn' && (
            <>
              <p className="text-center text-xs text-muted pt-1">
                New to the pool?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('createAccount')}
                  className="text-accent-text hover:text-primary-light underline"
                >
                  Create an account
                </button>
              </p>
              <p className="text-center text-xs text-muted">
                <button
                  type="button"
                  onClick={() => switchMode('resetPassword')}
                  className="text-accent-text hover:text-primary-light underline"
                >
                  Forgot your password?
                </button>
              </p>
            </>
          )}
          {isReset && (
            <p className="text-center text-xs text-muted pt-1">
              Remembered it?{' '}
              <button
                type="button"
                onClick={() => switchMode('signIn')}
                className="text-accent-text hover:text-primary-light underline"
              >
                Back to sign in
              </button>
            </p>
          )}
        </form>
      </div>

    </div>
  )
}
