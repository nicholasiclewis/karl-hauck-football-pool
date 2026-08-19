/**
 * Shared auth for the Vercel API functions.
 *
 * The underscore prefix keeps Vercel from exposing this file as an endpoint.
 * Mirrors requireCronOrCommissioner in the Supabase edge functions.
 */

/** Constant-time compare, so a wrong secret leaks nothing via timing. */
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Accept either the scheduler's secret or a signed-in commissioner.
 *
 * The commissioner path deliberately does not trust the request body: the
 * caller is identified from their own token and the role is read from the
 * database. An unset CRON_SECRET refuses the secret path rather than silently
 * meaning "open".
 *
 * Callers that only make sense as a person (not a schedule) should also check
 * `as === 'commissioner'` on the result.
 */
export async function authorize(req, { url, serviceKey }) {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const expected = process.env.CRON_SECRET

  if (expected && bearer && timingSafeEqual(expected, bearer)) {
    return { ok: true, as: 'cron' }
  }
  if (!bearer) {
    return { ok: false, status: 401, error: 'Unauthorized: missing Authorization header' }
  }

  // Validate the token against the auth server. A bare anon key resolves to no
  // user here, which is exactly the case that has to be rejected.
  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${bearer}` },
  })
  if (!who.ok) return { ok: false, status: 401, error: 'Unauthorized: not a signed-in user' }
  const user = await who.json()
  if (!user?.id) return { ok: false, status: 401, error: 'Unauthorized: not a signed-in user' }

  // Role comes from the database, never from the request.
  const prof = await fetch(
    `${url}/rest/v1/users?select=is_commissioner&id=eq.${user.id}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = prof.ok ? await prof.json() : []
  if (!rows?.[0]?.is_commissioner) {
    return { ok: false, status: 403, error: 'Forbidden: commissioner role required' }
  }
  return { ok: true, as: 'commissioner', userId: user.id }
}
