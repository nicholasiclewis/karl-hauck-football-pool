/**
 * Vercel Cron: Supabase keep-alive.
 *
 * Free-tier Supabase projects pause after ~7 days without activity, and a
 * paused project takes the whole app down until someone notices.
 *
 * This replaces .github/workflows/keep-alive.yml as the primary ping. GitHub
 * disables scheduled workflows after 60 days without repository activity, so
 * that cron silently stopped in mid-June 2026 and the project paused a week
 * later. Vercel crons have no equivalent inactivity rule.
 *
 * Schedule lives in vercel.json. Reads the same env vars the frontend build
 * already uses, so there are no new secrets to configure.
 */
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Loud rather than silent — a misconfigured ping is the whole failure mode.
    return res.status(500).json({
      ok: false,
      error: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in the Vercel project',
    })
  }

  try {
    // RLS returns an empty array for anon, which is fine — the point is that
    // the query reaches Postgres and counts as activity.
    const r = await fetch(`${url}/rest/v1/weeks?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })

    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        status: r.status,
        error: (await r.text()).slice(0, 300),
      })
    }

    return res.status(200).json({ ok: true, status: r.status, pinged_at: new Date().toISOString() })
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message })
  }
}
