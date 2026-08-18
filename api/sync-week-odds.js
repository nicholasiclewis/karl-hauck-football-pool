/**
 * Vercel Cron: Tuesday odds import.
 *
 * Weeks are planned out ahead of time. Each Tuesday this finds the planned
 * week starting that day in the active season, pulls every game whose kickoff
 * falls in that week's Tuesday→Monday-night window, and imports them as
 * candidates. It then suggests a featured six (closest spreads) so the week is
 * usable immediately — the commissioner confirms or swaps them in the Games
 * tab.
 *
 * Schedule lives in vercel.json.
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL   Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY          service role — writes games, bypasses RLS
 *   ODDS_API_KEY                       The Odds API key
 *   CRON_SECRET                        optional; when set, requests must send
 *                                      Authorization: Bearer <CRON_SECRET>
 *                                      (Vercel Cron does this automatically)
 *
 * Query params (for manual runs):
 *   ?week_start=YYYY-MM-DD   import a specific week instead of today's
 *   ?week_id=<uuid>          import a specific week by id
 *   ?dry=1                   report what would happen, write nothing
 */
import { weekWindow, poolToday, isInWeekWindow, formatWeekWindow } from '../src/lib/weekWindow.js'
import { suggestFeatured } from '../src/lib/gameSelection.js'
import { fetchTop25, buildRankMap, resolveWeekForDate } from '../src/lib/rankings.js'

/** Public project URL, used when no env var is configured. Not a secret. */
const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

// Preseason lives under its own Odds API key, so August weeks come back empty
// if only the regular-season key is queried. fetch-scores merges both for the
// same reason. Keys that are out of season 404 and are skipped.
const SPORT_KEYS = {
  nfl:     ['americanfootball_nfl', 'americanfootball_nfl_preseason'],
  college: ['americanfootball_ncaaf'],
}

/** Which sports a week needs odds for. */
function sportsFor(containerType) {
  if (containerType === 'nfl_only') return ['nfl']
  if (containerType === 'college_only') return ['college']
  return ['nfl', 'college']
}

/** Constant-time compare, so a wrong secret leaks nothing via timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Accept either the scheduler's secret or a signed-in commissioner, mirroring
 * requireCronOrCommissioner in the edge functions.
 *
 * The commissioner path exists so a week added after its Tuesday can still be
 * filled from the dashboard. It deliberately does not trust the request body:
 * the caller is identified from their own token and the role is read from the
 * database. An unset CRON_SECRET refuses the secret path rather than silently
 * meaning "open".
 */
async function authorize(req, { url, serviceKey }) {
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

export default async function handler(req, res) {
  // VITE_-prefixed vars reach the frontend build but are not exposed to
  // functions at runtime. The project URL is public — it ships in every
  // browser bundle — so it falls back to a constant rather than failing when
  // Vercel's env config drifts. An env var still wins if one is set.
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? SUPABASE_URL_DEFAULT
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const oddsKey = process.env.ODDS_API_KEY

  const missing = [
    !url && 'SUPABASE_URL',
    !key && 'SUPABASE_SERVICE_ROLE_KEY',
    !oddsKey && 'ODDS_API_KEY',
  ].filter(Boolean)
  if (missing.length) {
    return res.status(500).json({ ok: false, error: `Missing env: ${missing.join(', ')}` })
  }

  const auth = await authorize(req, { url, serviceKey: key })
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const dryRun = req.query?.dry === '1' || req.query?.dry === 'true'

  const db = (path, init = {}) =>
    fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

  const readJson = async (r, what) => {
    if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text()).slice(0, 300)}`)
    return r.json()
  }

  try {
    // ── Find the week to import ───────────────────────────────────────────
    const seasons = await readJson(
      await db('seasons?select=id,year&is_active=eq.true&limit=1'),
      'seasons'
    )
    const season = seasons[0]
    if (!season) return res.status(200).json({ ok: true, skipped: 'No active season' })

    const weekStart = req.query?.week_start ?? poolToday()
    const filter = req.query?.week_id
      ? `id=eq.${req.query.week_id}`
      : `season_id=eq.${season.id}&week_start=eq.${weekStart}`

    const weeks = await readJson(
      await db(`weeks?select=*&${filter}&limit=1`),
      'weeks'
    )
    const week = weeks[0]
    if (!week) {
      // Not an error: most Tuesdays in the off-season have no week planned.
      return res.status(200).json({
        ok: true,
        skipped: `No week planned starting ${weekStart}`,
        season: season.year,
      })
    }

    const window = weekWindow(week.week_start)

    // ── Fetch odds for the sports this week needs ─────────────────────────
    const sports = sportsFor(week.container_type)
    const candidates = []
    const apiCalls = []

    const seenEvents = new Set()

    for (const sport of sports) {
      let sportOk = false

      for (const sportKey of SPORT_KEYS[sport]) {
        const endpoint =
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
          `?apiKey=${oddsKey}&regions=us&markets=spreads&oddsFormat=american&dateFormat=iso`

        const r = await fetch(endpoint)
        apiCalls.push({
          sport,
          sportKey,
          status: r.status,
          remaining: r.headers.get('x-requests-remaining'),
        })

        // An out-of-season key 404s. Tolerate it as long as another key for
        // this sport succeeds; only fail if every key did.
        if (!r.ok) continue
        sportOk = true

        for (const event of await r.json()) {
          // Only games inside this week's Tuesday→Monday window.
          if (!isInWeekWindow(event.commence_time, window)) continue
          // The same event can surface under more than one key.
          if (seenEvents.has(event.id)) continue

          const market = event.bookmakers?.[0]?.markets?.find((m) => m.key === 'spreads')
          const home = market?.outcomes?.find((o) => o.name === event.home_team)
          if (!market || !home || home.point == null) continue

          seenEvents.add(event.id)
          candidates.push({
            week_id:      week.id,
            sport,
            home_team:    event.home_team,
            away_team:    event.away_team,
            spread:       home.point,               // negative = home favored
            favorite:     home.point < 0 ? 'home' : 'away',
            kickoff_time: event.commence_time,
            odds_api_id:  event.id,
          })
        }
      }

      if (!sportOk) {
        throw new Error(`Odds API: every key failed for ${sport} (${SPORT_KEYS[sport].join(', ')})`)
      }
    }

    // ── Suggest the featured six ──────────────────────────────────────────
    // Only needed for a Top 25 week; skip the extra calls otherwise.
    let rankMap = null
    let pollUsed = null
    let warning = null
    if (week.college_focus === 'top25' && sports.includes('college')) {
      try {
        const poll = await fetchTop25ForWeekStart(week.week_start)
        rankMap = buildRankMap(poll)
        pollUsed = poll.headline
      } catch (err) {
        // Import the candidates regardless, but do not guess at a slate: with
        // no poll we cannot tell which games qualify, so suggest nothing and
        // say so rather than quietly featuring six unranked games.
        warning = `Top 25 week but no poll available (${err.message}) — imported candidates without suggesting a slate`
      }
    }

    const { featured, shape, shortfall } = suggestFeatured(candidates, week, rankMap)

    // ── What's already in the table for this week ─────────────────────────
    const existing = await readJson(
      await db(`games?select=id,odds_api_id,is_featured&week_id=eq.${week.id}`),
      'existing games'
    )
    const byEventId = new Map(existing.filter((g) => g.odds_api_id).map((g) => [g.odds_api_id, g]))
    const alreadyFeatured = existing.filter((g) => g.is_featured).length

    const fresh = candidates.filter((c) => !byEventId.has(c.odds_api_id))
    const stale = candidates.filter((c) => byEventId.has(c.odds_api_id))

    const summary = {
      ok: true,
      dryRun,
      season:      season.year,
      week:        week.week_number,
      window:      formatWeekWindow(window),
      windowUtc:   { start: window.start.toISOString(), end: window.end.toISOString() },
      container:   week.container_type,
      focus:       week.college_focus ?? null,
      conference:  week.conference ?? null,
      slate:       shape,
      candidates:  candidates.length,
      inserted:    fresh.length,
      refreshed:   stale.length,
      featured:    featured.length,
      shortfall,
      poll:        pollUsed,
      warning,
      apiCalls,
    }

    if (dryRun) {
      return res.status(200).json({
        ...summary,
        wouldFeature: featured.map((g) => `${g.away_team} @ ${g.home_team} (${g.spread})`),
      })
    }

    // ── Write ─────────────────────────────────────────────────────────────
    // New games go in as candidates. is_featured is deliberately omitted from
    // the refresh path so a re-run never clobbers the commissioner's picks.
    if (fresh.length) {
      const r = await db('games', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(fresh.map((g) => ({ ...g, is_featured: false }))),
      })
      if (!r.ok) throw new Error(`insert games: ${r.status} ${(await r.text()).slice(0, 300)}`)
    }

    // Refresh spreads/kickoffs on games we already had — lines move all week.
    for (const g of stale) {
      const r = await db(`games?odds_api_id=eq.${encodeURIComponent(g.odds_api_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          spread:       g.spread,
          favorite:     g.favorite,
          kickoff_time: g.kickoff_time,
        }),
      })
      if (!r.ok) throw new Error(`refresh game: ${r.status} ${(await r.text()).slice(0, 200)}`)
    }

    // Only seed the suggestion when the commissioner hasn't picked yet.
    let featuredApplied = 0
    if (alreadyFeatured === 0 && featured.length) {
      const ids = await readJson(
        await db(
          `games?select=id,odds_api_id&week_id=eq.${week.id}&odds_api_id=in.(${
            featured.map((g) => `"${g.odds_api_id}"`).join(',')
          })`
        ),
        'lookup featured'
      )
      if (ids.length) {
        const r = await db(`games?id=in.(${ids.map((g) => g.id).join(',')})`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ is_featured: true }),
        })
        if (!r.ok) throw new Error(`set featured: ${r.status} ${(await r.text()).slice(0, 200)}`)
        featuredApplied = ids.length
      }
    }

    return res.status(200).json({
      ...summary,
      featuredApplied,
      featuredSkipped: alreadyFeatured > 0
        ? `week already has ${alreadyFeatured} featured game(s); left untouched`
        : null,
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}

/** Top 25 covering the Saturday of a week that starts on `weekStart`. */
async function fetchTop25ForWeekStart(weekStart) {
  // Polls are published Sunday/Monday and keyed to the upcoming slate; ask
  // about the Saturday inside this window rather than the Tuesday it opens.
  const saturday = new Date(`${weekStart}T12:00:00Z`)
  saturday.setUTCDate(saturday.getUTCDate() + 4)
  const { year, week, seasonType } = await resolveWeekForDate(saturday)
  return fetchTop25({ year, week, seasonType, poll: 'ap' })
}
