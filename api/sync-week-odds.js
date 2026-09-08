/**
 * Scheduled odds import.
 *
 * Weeks are planned out ahead of time. This finds the current week in the
 * active season, pulls every game whose kickoff falls in that week's
 * Tuesday→Monday-night window, and imports them as playable games.
 *
 * A week opens on its own first day — the Tuesday it starts — and closes once
 * its last game has kicked off. Opening does not wait for odds: the week is
 * live from day one and the board fills in underneath it.
 *
 * Odds themselves post Wednesday morning — a day of line movement settles the
 * numbers and the slate arrives as one piece. The exception is a week with a
 * midweek game: MAC weeks post college on Tuesday (MACtion plays Tuesday
 * night), and either sport posts Tuesday in a week carrying a Tuesday or
 * Wednesday kickoff, so no game lands with only hours left to pick it.
 * src/lib/oddsRelease.js holds those rules; the scheduler runs this both
 * mornings and each run imports only what has reached its release day.
 *
 * Schedule lives in .github/workflows/pool-scheduler.yml.
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
import { fetchTop25ForWeek, buildRankMap } from '../src/lib/rankings.js'
import { releaseDateFor, sportsReleasedBy } from '../src/lib/oddsRelease.js'
import { shouldOpen, shouldClose } from '../src/lib/weekState.js'
import { COLLEGE_KEY, nflKeysForKickoff } from '../src/lib/scoreSync.js'
import { authorize } from './_shared.js'

/** Public project URL, used when no env var is configured. Not a secret. */
const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

/**
 * Odds API keys covering a sport for a given week.
 *
 * Preseason lives under its own key, so August weeks come back empty without
 * it — but every call costs a credit, and that key returns nothing from
 * September on. The week's own month picks the list. Keys that are out of
 * season 404 and are skipped.
 */
function sportKeysFor(sport, window) {
  return sport === 'college' ? [COLLEGE_KEY] : nflKeysForKickoff(window.start)
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
  // A run aimed at one specific week is the commissioner working in the Games
  // tab. Those are never held back for a release day — only the scheduled
  // sweep waits.
  const targeted = Boolean(req.query?.week_id || req.query?.week_start)
  const now = new Date()

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

    // Scheduled runs land on Tuesday and again on Wednesday, and both belong
    // to the week that began this Tuesday — no week is ever planned to start
    // on a Wednesday, so today's date alone would find nothing.
    const weekStart = req.query?.week_start ?? poolWeekStartFor()
    const filter = req.query?.week_id
      ? `id=eq.${req.query.week_id}`
      : `season_id=eq.${season.id}&week_start=eq.${weekStart}`

    // State-only mode: open/close weeks without touching the Odds API. This is
    // what puts a week live on its own Tuesday, hours before its odds are due,
    // and it runs daily so a finished week closes the morning after its last
    // game rather than waiting for the next Tuesday import.
    if (stateOnly) {
      const current = await readJson(
        await db(`weeks?select=*&season_id=eq.${season.id}&week_start=eq.${poolWeekStartFor()}&limit=1`),
        'current week'
      )
      const weekState = await manageWeekState({ db, readJson, season, week: current[0] ?? null, now })
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

    // ── Which sports release today ────────────────────────────────────────
    // Wednesday morning for everything, pulled forward to Tuesday for a sport
    // that kicks off before then. Wednesday's run also covers anything that
    // should have posted Tuesday and did not, so a missed release repairs
    // itself instead of leaving the week half open.
    const allSports = sportsFor(week.container_type)
    let sports = allSports
    let release = null
    let schedule = null

    if (!targeted && !listOnly) {
      schedule = await fetchSchedule({ sports: allSports, window, oddsKey })
      const kickoffs = kickoffsFrom(schedule)
      const today = poolToday(now)
      release = Object.fromEntries(
        allSports.map((s) => [s, releaseDateFor(s, week, kickoffs[s] ?? [])])
      )
      sports = sportsReleasedBy(today, allSports, week, kickoffs)

      if (!sports.length) {
        // No odds due today. The schedule is still knowable and costs nothing,
        // so the board shows who is playing while the numbers are being set —
        // and the week itself may still need opening. This is exactly the
        // shape of a Tuesday whose lines post Wednesday.
        // A preview is a nicety. Opening the week and, next morning, importing
        // the odds are not — so this never takes the run down with it, whether
        // the cause is a schema that has not caught up or the schedule
        // endpoint having a bad day.
        let preview
        try {
          preview = await importPreview({
            db, readJson, week, schedule, allSports, now, dryRun,
          })
        } catch (err) {
          preview = { added: 0, error: err.message }
        }
        const weekState = await manageWeekState({ db, readJson, season, week, now })
        return res.status(200).json({
          ok: true,
          season:  season.year,
          week:    week.week_number,
          skipped: `No odds release on ${today}`,
          preview,
          release,
          weekState,
        })
      }
    }

    // ── Fetch odds for the sports releasing today ─────────────────────────
    const candidates = []
    const apiCalls = []

    const seenEvents = new Set()

    for (const sport of sports) {
      let sportOk = false

      for (const sportKey of sportKeysFor(sport, window)) {
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

          const point = homeSpreadFrom(event)

          seenEvents.add(event.id)
          candidates.push({
            week_id:      week.id,
            sport,
            home_team:    event.home_team,
            away_team:    event.away_team,
            // null until somebody posts a number. The game still goes on the
            // board; it simply cannot be picked yet.
            spread:       point,                    // negative = home favored
            favorite:     point == null ? null : point < 0 ? 'home' : 'away',
            kickoff_time: event.commence_time,
            odds_api_id:  event.id,
          })
        }
      }

      if (!sportOk) {
        throw new Error(`Odds API: every key failed for ${sport} (${sportKeysFor(sport, window).join(' | ')})`)
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
        const poll = await fetchTop25ForWeek(week.week_start, { poll: 'ap' })
        rankMap = buildRankMap(poll)
        pollUsed = poll.headline
      } catch (err) {
        // Without a poll we cannot tell which games qualify. selectEligible
        // returns no college games in that case, so the week imports short
        // and says why rather than quietly offering unranked ones.
        warning = `Top 25 week but no poll available (${err.message}) — no college games imported`
      }
    }

    // requireSpread false on purpose: a game with no line yet belongs on the
    // board, marked "Line to come", rather than disappearing until some book
    // gets round to pricing it. The next run fills the number in.
    const { eligible, bySport, limits, shortfall } =
      selectEligible(candidates, week, rankMap, { requireSpread: false })

    // ── What's already in the table for this week ─────────────────────────
    const existing = await readJson(
      await db(`games?select=id,odds_api_id,is_featured&week_id=eq.${week.id}`),
      'existing games'
    )
    const byEventId = new Map(existing.filter((g) => g.odds_api_id).map((g) => [g.odds_api_id, g]))

    // Two runs a week means a game can already have been played by the time a
    // later run sees it. A line is only a line until kickoff: after that it is
    // the number the week is graded against, so a played game is neither
    // refreshed nor newly added by a scheduled run.
    const started = (c) => new Date(c.kickoff_time) <= now

    const fresh = eligible.filter(
      (c) => !byEventId.has(c.odds_api_id) && !(started(c) && !targeted)
    )
    const stale = eligible.filter((c) => byEventId.has(c.odds_api_id) && !started(c))

    // How much of the board is still waiting on a book. Zero is the ordinary
    // answer; a number that does not fall on the next run is the thing worth
    // noticing, and it is now in the response rather than invisible.
    const withoutLine = eligible.filter((g) => g.spread == null).length

    const summary = {
      ok: true,
      withoutLine,
      dryRun,
      season:      season.year,
      week:        week.week_number,
      window:      formatWeekWindow(window),
      windowUtc:   { start: window.start.toISOString(), end: window.end.toISOString() },
      container:   week.container_type,
      focus:       week.college_focus ?? null,
      conference:  week.conference ?? null,
      // Which sports this run covered, and the day each was due to post.
      released:    sports,
      release,
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
        sample: eligible.slice(0, 12).map(
        (g) => `${g.away_team} @ ${g.home_team} (${g.spread ?? 'no line yet'})`
      ),
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
    //
    // A line only ever gets written when there is one. This is what turns a
    // game that went up without a number into a playable one as soon as a book
    // prices it — and it is also why a book pulling a line cannot blank a
    // spread the week is already being picked against.
    for (const g of stale) {
      const patch = { kickoff_time: g.kickoff_time }
      if (g.spread != null && g.favorite) {
        patch.spread = g.spread
        patch.favorite = g.favorite
      }
      const r = await db(`games?odds_api_id=eq.${encodeURIComponent(g.odds_api_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(`refresh game: ${r.status} ${(await r.text()).slice(0, 200)}`)
    }

    // ── Week state ────────────────────────────────────────────────────────
    // Opening keys off the calendar — a week is live from the Tuesday it
    // starts. Closing keys off the last kickoff rather than the calendar:
    // once every game has started there is nothing left to pick.
    const weekState = await manageWeekState({ db, readJson, season, week, now })

    return res.status(200).json({ ...summary, weekState })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}

/**
 * Open the week that is currently running and close any week that has run its
 * course.
 *
 * A week opens on day one — the Tuesday it starts — and not when its games
 * arrive. Odds post Wednesday in most weeks, so waiting for a full board left
 * the week shut for its first day and players staring at "No Active Week"
 * while the pool was in fact underway. An open week with an empty board says
 * "lines post Wednesday morning"; a closed one says nothing at all.
 *
 * Closing sweeps every open week except the one currently running, and keys
 * off the last kickoff rather than the calendar: once every game has started
 * there is nothing left to pick. A week that never got a board is the one
 * exception — it is waiting on its odds, not finished, so it closes only once
 * its window has passed. Completed weeks are never reopened.
 */
async function manageWeekState({ db, readJson, season, week, now = new Date() }) {
  const opened = []
  const closed = []

  if (shouldOpen(week, now)) {
    const r = await db(`weeks?id=eq.${week.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ picks_open: true }),
    })
    if (r.ok) opened.push(week.week_number)
  }

  // Every other open week in the season. The one this run is about is left
  // alone: it was just opened, or it is the week currently being played.
  const skip = week ? `&id=neq.${week.id}` : ''
  const others = await readJson(
    await db(
      `weeks?select=id,week_number,week_start,picks_open,is_complete` +
      `&season_id=eq.${season.id}&picks_open=eq.true&is_complete=eq.false${skip}`
    ),
    'open weeks'
  )

  for (const w of others) {
    const games = await readJson(
      await db(`games?select=kickoff_time&week_id=eq.${w.id}&is_featured=eq.true&order=kickoff_time.desc&limit=1`),
      'last kickoff'
    )
    if (!shouldClose(w, games[0]?.kickoff_time ?? null, now)) continue

    const r = await db(`weeks?id=eq.${w.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ picks_open: false }),
    })
    if (r.ok) closed.push(w.week_number)
  }

  return { opened, closed }
}

/**
 * Kickoff times per sport inside a week's window.
 *
 * The Odds API's events endpoint returns the schedule without any odds, and it
 * does not count against the usage quota — asking "does this week have a
 * Tuesday game?" is free. That is what lets the release day come from the real
 * schedule rather than a guess about which weeks the league moves games in.
 *
 * A failed lookup returns no kickoffs, which leaves the sport on its Wednesday
 * release. The MAC rule needs no schedule at all, so a MACtion week still
 * posts Tuesday even if this comes back empty.
 */
/**
 * The home spread for an event, from whichever book has posted one.
 *
 * This used to read bookmakers[0] and give up if that book had no spreads
 * market — so a game every other book had priced was dropped for the sake of
 * the one that had not got to it yet. Books post at their own pace, and
 * college later than NFL, which is how a whole sport could go missing from a
 * week without anything being logged.
 *
 * @returns {number|null} null when no book has a line yet
 */
export function homeSpreadFrom(event) {
  for (const book of event.bookmakers ?? []) {
    const market = book.markets?.find((m) => m.key === 'spreads')
    const home = market?.outcomes?.find((o) => o.name === event.home_team)
    if (home?.point != null) return home.point
  }
  return null
}

/**
 * Put the week's schedule on the board before its lines exist.
 *
 * Runs on the mornings when no odds are due — in practice the Tuesday of an
 * ordinary week. The games go in with no spread and no favorite, which the
 * app renders as a preview and the database refuses to accept picks against.
 *
 * They carry the same odds_api_id the odds import uses, and that is the whole
 * mechanism: Wednesday's run finds these rows already present, treats them as
 * games it already had, and PATCHes the real spread onto them. The preview
 * becomes the game rather than competing with it.
 *
 * Only ever inserts. The odds import merges duplicates, which here would write
 * a null spread over a real one — so a game already on the board, with a line
 * or without, is left exactly as it is.
 */
async function importPreview({ db, readJson, week, schedule, allSports, now, dryRun }) {
  if (!schedule) return { added: 0, note: 'no schedule looked up' }

  const candidates = []
  for (const sport of allSports) {
    for (const event of schedule[sport] ?? []) {
      if (!event?.id || !event.home_team || !event.away_team) continue
      candidates.push(previewRow(week, sport, event))
    }
  }
  if (!candidates.length) return { added: 0, note: 'schedule came back empty' }

  let rankMap = null
  if (week.college_focus === 'top25' && allSports.includes('college')) {
    try {
      rankMap = buildRankMap(await fetchTop25ForWeek(week.week_start, { poll: 'ap' }))
    } catch {
      // No poll means we cannot tell which games qualify, and selectEligible
      // answers with no college games. Previewing the wrong ones would be
      // worse than previewing none.
    }
  }

  // The same eligibility the odds import applies, minus the line it does not
  // have yet — so a preview shows the games that will actually be pickable,
  // not every fixture in the window.
  const { eligible } = selectEligible(candidates, week, rankMap, { requireSpread: false })

  const existing = await readJson(
    await db(`games?select=odds_api_id&week_id=eq.${week.id}`),
    'existing games'
  )
  const have = new Set(existing.map((g) => g.odds_api_id).filter(Boolean))

  const fresh = eligible.filter(
    (g) => !have.has(g.odds_api_id) && new Date(g.kickoff_time) > now
  )

  const sample = fresh.slice(0, 8).map((g) => `${g.away_team} @ ${g.home_team}`)
  if (dryRun) return { added: 0, wouldAdd: fresh.length, sample }
  if (!fresh.length) return { added: 0, note: 'board already up to date' }

  const r = await db('games', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fresh.map((g) => ({ ...g, is_featured: true }))),
  })
  if (!r.ok) {
    throw new Error(`insert preview games: ${r.status} ${(await r.text()).slice(0, 300)}`)
  }

  return { added: fresh.length, sample }
}

async function fetchSchedule({ sports, window, oddsKey }) {
  const out = {}

  for (const sport of sports) {
    const events = []
    for (const sportKey of sportKeysFor(sport, window)) {
      try {
        const r = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sportKey}/events` +
          `?apiKey=${oddsKey}&dateFormat=iso`
        )
        if (!r.ok) continue
        for (const event of await r.json()) {
          if (isInWeekWindow(event.commence_time, window)) events.push(event)
        }
      } catch {
        // Never let a schedule lookup take the import down with it.
      }
    }
    out[sport] = events
  }

  return out
}

/** Just the kickoff times, which is all the release-day rules need. */
function kickoffsFrom(schedule) {
  return Object.fromEntries(
    Object.entries(schedule).map(([sport, events]) => [
      sport,
      events.map((e) => e.commence_time),
    ])
  )
}

/**
 * A game row for the board before its line exists.
 *
 * Same odds_api_id the odds import uses, which is the whole trick: Wednesday's
 * run finds these rows already present and PATCHes the spread onto them, so
 * the preview becomes the real game rather than a duplicate of it.
 */
function previewRow(week, sport, event) {
  return {
    week_id:      week.id,
    sport,
    home_team:    event.home_team,
    away_team:    event.away_team,
    kickoff_time: event.commence_time,
    odds_api_id:  event.id,
    spread:       null,
    favorite:     null,
  }
}
