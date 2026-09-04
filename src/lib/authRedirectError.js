/**
 * Why a password-reset (or confirmation) link dropped the player back on the
 * sign-in screen.
 *
 * Supabase reports a failed link by redirecting here with `error`,
 * `error_code` and `error_description` attached — in the hash for the implicit
 * flow, in the query string for PKCE. supabase-js reads those, throws, and
 * returns the error to `initialize()`, which has no caller. So the app was
 * showing a bare login form and the player had no idea why their link "did
 * nothing". This module keeps that reason so Login can say it out loud.
 *
 * Read at module load rather than in a component: it runs exactly once per
 * page load, which a lazy `useState` initializer does not (StrictMode calls
 * those twice in development, and the second call would find a cleared URL).
 *
 * Clearing the params is safe. supabase-js throws on them before it reaches
 * its own `replaceState`, so they are still there whenever this runs, and
 * removing them only stops it treating the page as a callback at all — it has
 * nothing to recover from one of these URLs anyway. Nothing touches
 * `access_token` or `code`; a link that actually worked is left alone.
 */

/** Reset links are one-time and short-lived, so these two are the common pair. */
const MESSAGES = {
  otp_expired:
    'That password reset link has expired. Links are good for one hour and ' +
    'can only be used once — request a fresh one below.',
  access_denied:
    'That password reset link is no longer valid. It may have already been ' +
    'used, or expired — request a fresh one below.',
}

function read() {
  if (typeof window === 'undefined') return ''

  const url = new URL(window.location.href)
  // The hash carries a query string of its own; both stores use `+` for
  // spaces, which URLSearchParams decodes and a manual split would not.
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const found = (key) => hash.get(key) ?? url.searchParams.get(key)

  const error = found('error')
  const code = found('error_code')
  const description = found('error_description')

  if (!error && !code && !description) return ''

  for (const params of [hash, url.searchParams]) {
    params.delete('error')
    params.delete('error_code')
    params.delete('error_description')
  }
  url.hash = hash.toString() ? `#${hash}` : ''
  window.history.replaceState(window.history.state, '', url.toString())

  return (
    MESSAGES[code] ??
    MESSAGES[error] ??
    description ??
    'That link could not be opened. Request a fresh one below.'
  )
}

/** Empty unless this page load came from a link Supabase rejected. */
export const authRedirectError = read()
