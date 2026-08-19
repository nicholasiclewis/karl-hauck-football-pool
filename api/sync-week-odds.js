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
import {
  weekWindow, poolToday, poolWeekStartFor, isInWeekWindow, formatWeekWindow,
} from '../src/lib/weekWindow.js'
import { selectEligible, sportsFor } from '../src/lib/gameSelection.js'
import { fetchTop25, buildRankMap, resolveWeekForDate } from '../src/lib/rankings.js'
import { authorize } from './_shared.js'

/** Public project URL, used when no env var is configured. Not a secret. */
const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

// Preseason lives under its own Odds API key, so August weeks come back empty
// if only the regular-season key is queried. fetch-scores merges both for the
// same reason. Keys that are out of season 404 and are skipped.
const SPORT_KEYS = {
  nfl:     ['americanfootball_nfl', 'americanfootball_nfl_preseason'],
  college: ['americanfootball_ncaaf'],
}

// The auth check (scheduler secret or signed-in commissioner) lives in
// _shared.js now that add-player needs the identical gate. The commissioner
// path exists so a week added after its Tuesday can still be filled from the
// dashboard.

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
  // list mode powers the dashboard picker: same window and focus rules as the
  // import, but it returns the games instead of writing them. Browsing must
  // never modify the week.
  const listOnly = req.query?.list === '1' || req.query?.list === 'true'
  // state mode only opens/closes weeks; it never calls the Odds API, so it is
  // safe to run daily without spending credits.
  const stateOnly = req.query?.state === '1' || req.query?.state === 'true'

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

    // State-only mode: open/close weeks without touching the Odds API. Runs
    // daily so a week closes the morning after its last game rather than
    // waiting for the next Tuesday import.
    if (stateOnly) {
      const current = await readJson(
        await db(`weeks?select=*&season_id=eq.${season.id}&week_start=eq.${poolWeekStartFor()}&limit=1`),
        'current week'
      )
      const weekState = await manageWeekState({ db, readJson, season, week: current[0] ?? null })
      return res.status(200).json({ ok: true, mode: 'state', season: season.year, weekState })
    }

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

    // ── Narrow to the games players may actually pick ─────────────────────
    // There is no curation step, so what gets imported is exactly what the
    // players see. The focus filter has to run here, not as a suggestion.
    let rankMap = null
    let pollUsed = null
    let warning = null
    if (week.college_focus === 'top25' && sports.includes('college')) {
      try {
        const poll = await fetchTop25ForWeekStart(week.week_start)
        rankMap = buildRankMap(poll)
        pollUsed = poll.headline
      } catch (err) {
        // Without a poll we cannot tell which games qualify. selectEligible
        // returns no college games in that case, so the week imports short
        // and says why rather than quietly offering unranked ones.
        warning = `Top 25 week but no poll available (${err.message}) — no college games imported`
      }
    }

    const { eligible, bySport, limits, shortfall } = selectEligible(candidates, week, rankMap)

    // ── What's already in the table for this week ─────────────────────────
    const existing = await readJson(
      await db(`games?select=id,odds_api_id,is_featured&week_id=eq.${week.id}`),
      'existing games'
    )
    const byEventId = new Map(existing.filter((g) => g.odds_api_id).map((g) => [g.odds_api_id, g]))

    const fresh = eligible.filter((c) => !byEventId.has(c.odds_api_id))
    const stale = eligible.filter((c) => byEventId.has(c.odds_api_id))

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
      pickLimits:  limits,
      inWindow:    candidates.length,
      eligible:    eligible.length,
      bySport,
      inserted:    fresh.length,
      refreshed:   stale.length,
      shortfall,
      poll:        pollUsed,
      warning,
      apiCalls,
    }

    if (listOnly) {
      // Every game in the window, flagged with whether the week's rules make
      // it pickable, so the picker can show near-misses without importing them.
      const eligibleIds = new Set(eligible.map((g) => g.odds_api_id))
      const known = new Set(existing.map((g) => g.odds_api_id))
      return res.status(200).json({
        ...summary,
        games: candidates.map((g) => ({
          ...g,
          eligible: eligibleIds.has(g.odds_api_id),
          alreadyAdded: known.has(g.odds_api_id),
        })),
      })
    }

    if (dryRun) {
      return res.status(200).json({
        ...summary,
        sample: eligible.slice(0, 12).map((g) => `${g.away_team} @ ${g.home_team} (${g.spread})`),
      })
    }

    // ── Write ─────────────────────────────────────────────────────────────
    // Everything eligible goes in as playable. Players choose their own slate
    // from these, so there is nothing to curate down to.
    if (fresh.length) {
      const r = await db('games', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(fresh.map((g) => ({ ...g, is_featured: true }))),
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

    // ── Week state ────────────────────────────────────────────────────────
    // Opening happens here because this runs the morning a week begins, and a
    // week with games ready should not sit closed waiting to be switched on.
    // Closing keys off the last kickoff rather than the calendar: once every
    // game has started there is nothing left to pick.
    const weekState = await manageWeekState({
      db, readJson, season, week, gameCount: eligible.length,
    })

    return res.status(200).json({ ...summary, weekState })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}

/**
 * Open the current week and close any week that has run its course.
 *
 * A week closes once its last game has kicked off — not when the calendar week
 * ends — so a slate that finishes Saturday does not sit open until Tuesday.
 * Completed weeks are never reopened.
 */
async function manageWeekState({ db, readJson, season, week, gameCount = null }) {
  const now = Date.now()
  const opened = []
  const closed = []

  // Open the current week once it actually has games to pick from. Opening an
  // empty week would just show players a blank slate.
  if (week && !week.is_complete && !week.picks_open) {
    let count = gameCount
    if (count === null) {
      const rows = await readJson(
        await db(`games?select=id&week_id=eq.${week.id}&is_featured=eq.true&limit=1`),
        'week games'
      )
      count = rows.length
    }
    if (count > 0) {
      const r = await db(`weeks?id=eq.${week.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ picks_open: true }),
      })
      if (r.ok) opened.push(week.week_number)
    }
  }

  // Any other open week in this season whose games have all started.
  const skip = week ? `&id=neq.${week.id}` : ''
  const others = await readJson(
    await db(`weeks?select=id,week_number&season_id=eq.${season.id}&picks_open=eq.true&is_complete=eq.false${skip}`),
    'open weeks'
  )

  for (const w of others) {
    const games = await readJson(
      await db(`games?select=kickoff_time&week_id=eq.${w.id}&is_featured=eq.true&order=kickoff_time.desc&limit=1`),
      'last kickoff'
    )
    const last = games[0]?.kickoff_time
    // No games at all also means nothing left to pick.
    if (last && new Date(last).getTime() > now) continue

    const r = await db(`weeks?id=eq.${w.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ picks_open: false }),
    })
    if (r.ok) closed.push(w.week_number)
  }

  return { opened, closed }
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
