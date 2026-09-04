/**
 * Where emailed links should send the player back to.
 *
 * This used to be `window.location.origin`, which meant a link pointed at
 * whichever build happened to send it. A commissioner using a Vercel preview
 * URL generated reset links aimed at that preview — and preview deployments
 * are disposable, so once Vercel removed it every link in every inbox started
 * answering "410 Gone". The link was fine; the address had ceased to exist.
 *
 * So deployed builds always name the production site, whoever sent the mail.
 * Localhost is the one exception: a reset link that jumps to production is
 * useless when the thing you are testing is on your own machine.
 */

/** Production site, used when VITE_SITE_URL is unset — same habit as supabase.js. */
const FALLBACK = 'https://karl-hauck-football-pool.vercel.app'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Normalise a configured origin, or give back '' if it cannot be used.
 *
 * `new URL().origin` does the whole job: it rejects nonsense, drops any path
 * or trailing slash, and lowercases the host. The leading `.trim()` matters
 * more than it looks — a Site URL pasted with a stray space in front is
 * exactly the kind of invisible typo that took the reset flow down before,
 * and Supabase matches redirect URLs by exact string.
 */
function normalize(value) {
  if (typeof value !== 'string') return ''
  try {
    return new URL(value.trim()).origin
  } catch {
    return ''
  }
}

/**
 * The pure decision, separated so it can be tested without a browser or a
 * bundler. `configured` is the raw VITE_SITE_URL, warts and all.
 */
export function resolveSiteUrl({ configured, hostname, origin }) {
  if (hostname && LOCAL_HOSTS.has(hostname)) return origin
  return normalize(configured) || FALLBACK
}

/** The origin to hand Supabase for any emailed link. */
export function siteUrl() {
  const loc = typeof window === 'undefined' ? null : window.location
  return resolveSiteUrl({
    configured: import.meta.env?.VITE_SITE_URL,
    hostname: loc?.hostname,
    origin: loc?.origin,
  })
}
