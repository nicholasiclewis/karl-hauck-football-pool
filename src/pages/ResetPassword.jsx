import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuth'

/**
 * Shown instead of the whole app while a password-recovery session is active.
 *
 * The emailed reset link signs the user in solely to do this, and the link
 * itself proved who they are — so unlike the Profile form, no current
 * password is asked for. (That re-auth requirement is exactly why Profile
 * was a dead end for someone who forgot theirs.)
 */
export default function ResetPassword() {
  const { updatePassword, finishPasswordRecovery, signOut } = useAuth()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  async function onSubmit(data) {
    setServerError('')
    try {
      await updatePassword(data.password)
      // Dropping the flag lets App render normally — the user lands in the
      // app already signed in with their new password.
      finishPasswordRecovery()
    } catch (err) {
      setServerError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-10">

      {/* ── Branding ─────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🏈</div>
        <h1 className="text-2xl font-extrabold text-text tracking-tight">
          Reset Password
        </h1>
        <p className="text-xs text-muted mt-1">
          Choose a new password for your account.
        </p>
      </div>

      {/* ── Card ─────────────────────────────────────── */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>

          <div>
            <label className="block">
              <span className="block text-xs font-medium text-accent-text mb-1.5">
                New Password
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
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                className="input-field"
              />
            </label>
            {errors.password && (
              <p className="text-red text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block">
              <span className="block text-xs font-medium text-accent-text mb-1.5">
                Confirm New Password
              </span>
              <input
                {...register('confirm', {
                  required: 'Confirm your new password',
                  validate: (value, values) =>
                    value === values.password || 'Passwords do not match',
                })}
                type="password"
                placeholder="Same again"
                autoComplete="new-password"
                className="input-field"
              />
            </label>
            {errors.confirm && (
              <p className="text-red text-xs mt-1">{errors.confirm.message}</p>
            )}
          </div>

          {serverError && (
            <div className="bg-red/10 border border-red/30 rounded-lg p-3">
              <p className="text-red text-sm leading-snug">{serverError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors mt-1"
          >
            {isSubmitting ? 'Please wait...' : 'Set New Password'}
          </button>

          <p className="text-center text-xs text-muted pt-1">
            Changed your mind?{' '}
            <button
              type="button"
              onClick={signOut}
              className="text-accent-text hover:text-primary-light underline"
            >
              Cancel and sign out
            </button>
          </p>
        </form>
      </div>

    </div>
  )
}
