/**
 * Commissioner-only: create a player account directly.
 *
 * Some players never sign themselves up, so the commissioner creates the
 * account and hands over the credentials. Account creation needs the GoTrue
 * admin API and therefore the service-role key — the reason this cannot live
 * in the browser bundle.
 *
 * POST { display_name, email }
 * → { ok, email, display_name, tempPassword }
 *
 * The auth user is created with the email pre-confirmed (the commissioner is
 * vouching for it; no confirmation mail goes out) and a generated temporary
 * password, returned once for the commissioner to pass along. The
 * handle_new_user trigger fills public.users from user_metadata.display_name,
 * exactly as self-signup does. The player signs in with the temp password and
 * changes it in Profile — or uses "Forgot your password?" to pick their own.
 */
import crypto from 'node:crypto'
import { authorize } from './_shared.js'

/** Public project URL, used when no env var is configured. Not a secret. */
const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

// Same unambiguous alphabet the join code uses — these get read aloud and
// typed on phones, so no 0/O or 1/I.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function tempPassword(len = 10) {
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' })
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? SUPABASE_URL_DEFAULT
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    return res.status(500).json({ ok: false, error: 'Missing env: SUPABASE_SERVICE_ROLE_KEY' })
  }

  const auth = await authorize(req, { url, serviceKey: key })
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  // The cron secret can run imports; creating accounts is a person's job.
  if (auth.as !== 'commissioner') {
    return res.status(403).json({ ok: false, error: 'Forbidden: commissioner role required' })
  }

  const { display_name, email } = req.body ?? {}
  const name = String(display_name ?? '').trim()
  const mail = String(email ?? '').trim().toLowerCase()
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return res.status(400).json({ ok: false, error: 'A name and a valid email are required' })
  }

  const password = tempPassword()

  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: mail,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  })

  const out = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = out?.msg ?? out?.message ?? out?.error_description ?? `HTTP ${r.status}`
    // GoTrue answers 422 for an email that already has an account.
    return res.status(r.status === 422 ? 409 : 500).json({ ok: false, error: msg })
  }

  return res.status(200).json({
    ok: true,
    email: mail,
    display_name: name,
    tempPassword: password,
  })
}
