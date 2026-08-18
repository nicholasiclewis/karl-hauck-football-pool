/**
 * Commissioner-only: ask Claude for a short, funny commentary paragraph to
 * paste atop a weekly email — hype for the games report, a recap for the
 * results report.
 *
 * Env:
 *   ANTHROPIC_API_KEY     required
 *   ANTHROPIC_MODEL       optional, defaults to claude-sonnet-4-5-20250929
 *   SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (already set
 *   for api/sync-week-odds.js — reused here for the same commissioner check)
 */
import { buildGamesPrompt, buildResultsPrompt } from '../src/lib/aiReport.js'

const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

/** Same shape as authorize() in sync-week-odds.js, minus the cron-secret path. */
async function authorizeCommissioner(req, { url, serviceKey }) {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return { ok: false, status: 401, error: 'Unauthorized: missing Authorization header' }

  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${bearer}` },
  })
  if (!who.ok) return { ok: false, status: 401, error: 'Unauthorized: not a signed-in user' }
  const user = await who.json()
  if (!user?.id) return { ok: false, status: 401, error: 'Unauthorized: not a signed-in user' }

  const prof = await fetch(
    `${url}/rest/v1/users?select=is_commissioner&id=eq.${user.id}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = prof.ok ? await prof.json() : []
  if (!rows?.[0]?.is_commissioner) {
    return { ok: false, status: 403, error: 'Forbidden: commissioner role required' }
  }
  return { ok: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? SUPABASE_URL_DEFAULT
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const missing = [
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !anthropicKey && 'ANTHROPIC_API_KEY',
  ].filter(Boolean)
  if (missing.length) return res.status(500).json({ ok: false, error: `Missing env: ${missing.join(', ')}` })

  const auth = await authorizeCommissioner(req, { url, serviceKey })
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const { kind, payload } = req.body ?? {}
  let prompt
  if (kind === 'games') prompt = buildGamesPrompt(payload)
  else if (kind === 'results') prompt = buildResultsPrompt(payload)
  else return res.status(400).json({ ok: false, error: 'kind must be "games" or "results"' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Anthropic: ${r.status} ${(await r.text()).slice(0, 300)}` })
    }
    const data = await r.json()
    const commentary = (data.content ?? []).map((b) => b.text ?? '').join('').trim()
    return res.status(200).json({ ok: true, commentary })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
