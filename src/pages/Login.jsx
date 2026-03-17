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
  const [mode, setMode] = useState('signIn')
  const [serverError, setServerError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const { signIn, signUp } = useAuth()
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
      } else {
        // createAccount and joinByCode both create a new account
        await signUp(data.email, data.password, data.displayName, data.joinCode)
        setSuccessMsg(
          'Account created! Check your email for a confirmation link, then sign in.'
        )
        switchMode('signIn')
      }
    } catch (err) {
      setServerError(err.message)
    }
  }

  const isNewUser = mode !== 'signIn'

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

          {/* Display Name — new users only */}
          {isNewUser && (
            <div>
              <label className="block text-xs font-medium text-accent-text mb-1.5">
                Your Name
              </label>
              <input
                {...register('displayName', { required: 'Name is required' })}
                type="text"
                placeholder="First Last"
                autoComplete="name"
                className="input-field"
              />
              {errors.displayName && (
                <p className="text-red text-xs mt-1">{errors.displayName.message}</p>
              )}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-accent-text mb-1.5">
              Email Address
            </label>
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
            {errors.email && (
              <p className="text-red text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-accent-text mb-1.5">
              Password
            </label>
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
            {errors.password && (
              <p className="text-red text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Join / Invite Code — new users only */}
          {isNewUser && (
            <div>
              <label className="block text-xs font-medium text-accent-text mb-1.5">
                Pool Invite Code
              </label>
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
              : 'Join Pool'}
          </button>

          {/* Helper link */}
          {mode === 'signIn' && (
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
          )}
        </form>
      </div>

    </div>
  )
}
