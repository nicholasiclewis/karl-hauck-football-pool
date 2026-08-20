/**
 * Score sync — writes finals as games end.
 *
 * The scheduler ticks every 15 minutes through the hours games are played
 * (.github/workflows/pool-scheduler.yml). Each tick asks ESPN's scoreboard
 * about the pool's games that have kicked off and have no score yet, and
 * writes the ones ESPN reports finished. Nothing is on a timer: a game that
 * goes to double overtime lands when it actually ends, and a game called early
 * for weather lands then. A tick with no game in progress makes no request at
 * all.
 *
 * Each write is followed straight away by re-resolving that week, so points
 * move a few minutes after the whistle instead of after the commissioner sits
 * down on Tuesday. Once a week's window is over and its games are all in, the
 * week closes itself.
 *
 * ESPN's scoreboard is free and needs no key, which is what makes checking
 * this often reasonable. The Odds API is kept as a fallback for a tick where
 * ESPN does not answer at all, and only then does this spend credits.
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL   Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY          service role — writes scores, bypasses RLS
 *   ODDS_API_KEY                       The Odds API key (fallback path only)
 *   CRON_SECRET                        scheduler secret; senders must pass
 *                                      Authorization: Bearer <CRON_SECRET>
 *
 * Query params (for manual runs):
 *   ?dry=1        report what it is watching and what would close, call nothing
 *   ?week_id=...  restrict to one week
 */
import { weekWindow } from '../src/lib/weekWindow.js'
import { espnDate, fetchFinals, findFinal, indexFinals } from '../src/lib/espnScores.js'
import { COLLEGE_KEY, isScored, scoreKeysFor, weekSyncPlan } from '../src/lib/scoreSync.js'
import {
  calculateWeeklyScore, pointsForOutcome, resolveGameResult,
} from '../src/lib/scoring.js'
import { authorize } from './_shared.js'

/** Public project URL, used when no env var is configured. Not a secret. */
const SUPABASE_URL_DEFAULT = 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

// The Odds API scores endpoint costs the same 2 credits for any daysFrom in
// 1..3, so the fallback asks for the widest window it can.
const DAYS_FROM = 3

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? SUPABASE_URL_DEFAULT
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const oddsKey = process.env.ODDS_API_KEY

  if (!key) {
    return res.status(500).json({ ok: false, error: 'Missing env: SUPABASE_SERVICE_ROLE_KEY' })
  }

  const auth = await authorize(req, { url, serviceKey: key })
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const dryRun = req.query?.dry === '1' || req.query?.dry === 'true'
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
    // ── Weeks still in play ───────────────────────────────────────────────
    const seasons = await readJson(
      await db('seasons?select=id,year&is_active=eq.true&limit=1'),
      'seasons'
    )
    const season = seasons[0]
    if (!season) return res.status(200).json({ ok: true, skipped: 'No active season' })

    const weekFilter = req.query?.week_id
      ? `id=eq.${req.query.week_id}`
      : `season_id=eq.${season.id}&is_complete=eq.false`
    const weeks = await readJson(await db(`weeks?select=*&${weekFilter}`), 'weeks')
    if (!weeks.length) return res.status(200).json({ ok: true, skipped: 'No open weeks' })

    // Featured only: the rest are import candidates nobody can pick.
    const ids = weeks.map((w) => w.id).join(',')
    const allGames = await readJson(
      await db(
        `games?select=id,week_id,sport,home_team,away_team,spread,favorite,kickoff_time,` +
        `odds_api_id,home_score,away_score,result&week_id=in.(${ids})&is_featured=eq.true`
      ),
      'games'
    )

    // ── What this tick is watching ────────────────────────────────────────
    const gamesByWeek = new Map(weeks.map((w) => [w.id, []]))
    for (const g of allGames) gamesByWeek.get(g.week_id)?.push(g)

    const plans = weeks.map((week) =>
      weekSyncPlan({
        week,
        games:  gamesByWeek.get(week.id) ?? [],
        window: weekWindow(week.week_start),
        now,
      })
    )

    const watching = plans.flatMap((p) => p.watching)
    const closing = plans.filter((p) => p.closeReady)

    const summary = {
      ok: true,
      season: season.year,
      checked: plans.map((p) => ({
        week:     p.weekNumber,
        watching: p.watching.length,
        unscored: p.unscored.length,
        ended:    p.ended,
        closing:  p.closeReady,
      })),
    }

    // Nothing in progress and nothing to close: the common case between game
    // days, and it costs one database read.
    if (!watching.length && !closing.length) {
      return res.status(200).json({ ...summary, skipped: 'No games in progress', updated: 0 })
    }

    if (dryRun) {
      return res.status(200).json({
        ...summary,
        dryRun: true,
        // The free boards a real run would read, and the metered keys it would
        // fall back to if none of them answered.
        scoreboards: [...new Set(watching.map((g) => `${g.sport} ${espnDate(g.kickoff_time)}`))],
        fallbackKeys: scoreKeysFor(watching),
        sample: watching.slice(0, 12).map((g) => `${g.away_team} @ ${g.home_team}`),
      })
    }

    // ── Read the scoreboard ──────────────────────────────────────────────
    // ESPN first, because it costs nothing. Only a board that does not answer
    // at all sends this to the metered feed — a board that answers and simply
    // has no final yet is the normal mid-game case, and the next tick asks
    // again fifteen minutes later.
    const apiCalls = []
    const espn = await fetchFinals(watching)
    const failures = [...espn.failures]

    let index = espn.index
    let byOddsId = new Map()
    let source = 'espn'

    if (watching.length && !espn.ok) {
      source = 'odds-api'
      const paid = await fetchFinalsFromOddsApi({ games: watching, oddsKey, apiCalls, failures })
      index = paid.index
      byOddsId = paid.byOddsId
      if (apiCalls.length && apiCalls.every((c) => c.status !== 200)) {
        throw new Error(`No scores source answered: ${failures.join(' | ')}`)
      }
    }

    // ── Write the finals ─────────────────────────────────────────────────
    // Only finished games are in the index — parseScoreboard drops anything
    // still playing, because a score at halftime would grade the whole week.
    const touchedWeeks = new Set(closing.map((p) => p.weekId))
    const stillOpen = []
    let updated = 0

    for (const game of watching) {
      // The Odds API's own event id is the surest match when that is the
      // source; ESPN has never heard of it, so names carry the ESPN path.
      const match =
        (game.odds_api_id ? byOddsId.get(game.odds_api_id) : null) ?? findFinal(game, index)

      if (!match) {
        stillOpen.push(`${game.away_team} @ ${game.home_team}`)
        continue
      }
      const { home_score, away_score } = match

      const r = await db(`games?id=eq.${game.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ home_score, away_score }),
      })
      if (!r.ok) throw new Error(`write score: ${r.status} ${(await r.text()).slice(0, 200)}`)

      Object.assign(game, { home_score, away_score })
      touchedWeeks.add(game.week_id)
      updated++
    }

    // ── Push the points ──────────────────────────────────────────────────
    // Every week that gained a final gets re-resolved now rather than waiting
    // for the commissioner, which is the whole point of running this often.
    const resolved = []
    for (const weekId of touchedWeeks) {
      const week = weeks.find((w) => w.id === weekId)
      resolved.push(await resolveWeek({ db, readJson, week, games: gamesByWeek.get(weekId) ?? [] }))
    }

    // ── Close out finished weeks ─────────────────────────────────────────
    const closed = []
    for (const plan of closing) {
      const r = await db(`weeks?id=eq.${plan.weekId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_complete: true, picks_open: false }),
      })
      if (!r.ok) throw new Error(`close week: ${r.status} ${(await r.text()).slice(0, 200)}`)
      closed.push({
        week: plan.weekNumber,
        // Named so a game the board never reported is visible rather than
        // silently graded as a loss for everyone who picked it.
        missing: plan.unscored
          .filter((g) => !isScored(g))
          .map((g) => `${g.away_team} @ ${g.home_team}`),
      })
    }

    return res.status(200).json({
      ...summary,
      source,
      updated,
      // Watched games with no final on the board — normally just the ones
      // still being played.
      stillOpen,
      resolved,
      closed,
      espn: espn.requests,
      apiCalls,
      failures,
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}

/**
 * Grade one week: game results, then pick outcomes, then weekly totals.
 *
 * Same rules as the resolve-picks edge function and the Results tab, taken
 * from src/lib/scoring.js so all three cannot drift apart. Only rows whose
 * value actually changes are written, so running this every fifteen minutes
 * is cheap and leaves already-graded picks alone.
 */
async function resolveWeek({ db, readJson, week, games }) {
  const scored = games.filter(isScored)
  if (!scored.length) return { week: week.week_number, players: 0, games: 0 }

  // Results first — the rest of the app reads games.result for Final badges.
  for (const game of scored) {
    const result = resolveGameResult(game)
    if (!result || result === game.result) continue
    const r = await db(`games?id=eq.${game.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ result }),
    })
    if (!r.ok) throw new Error(`write result: ${r.status} ${(await r.text()).slice(0, 200)}`)
    game.result = result
  }

  const picks = await readJson(
    await db(`picks?select=id,user_id,game_id,picked_team,outcome,points_earned&week_id=eq.${week.id}`),
    'picks'
  )
  if (!picks.length) return { week: week.week_number, players: 0, games: scored.length }

  const byId = Object.fromEntries(games.map((g) => [g.id, g]))

  for (const pick of picks) {
    const game = byId[pick.game_id]
    if (!game?.result) continue

    const outcome =
      game.result === 'push' ? 'push'
      : (game.result === 'home_covers') === (pick.picked_team === 'home') ? 'win'
      : 'loss'
    const points = pointsForOutcome(outcome)

    if (pick.outcome === outcome && Number(pick.points_earned) === points) continue

    const r = await db(`picks?id=eq.${pick.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ outcome, points_earned: points, is_locked: true }),
    })
    if (!r.ok) throw new Error(`write pick: ${r.status} ${(await r.text()).slice(0, 200)}`)
    pick.outcome = outcome
  }

  // Weekly totals, rebuilt from scratch for everyone who played this week.
  const rows = []
  for (const userId of new Set(picks.map((p) => p.user_id))) {
    const mine = picks.filter((p) => p.user_id === userId)
    let totalCorrect = 0
    let nflCorrect = 0
    let pushCount = 0

    for (const pick of mine) {
      const game = byId[pick.game_id]
      if (!game?.result) continue
      if (game.result === 'push') {
        pushCount++
      } else if ((game.result === 'home_covers') === (pick.picked_team === 'home')) {
        totalCorrect++
        if (game.sport === 'nfl') nflCorrect++
      }
    }

    const { basePoints, bonusPoints, totalPoints } =
      calculateWeeklyScore(week.container_type, { totalCorrect, nflCorrect, pushCount })

    rows.push({
      user_id:       userId,
      week_id:       week.id,
      correct_picks: totalCorrect,
      nfl_correct:   nflCorrect,
      push_count:    pushCount,
      base_points:   basePoints,
      bonus_points:  bonusPoints,
      total_points:  totalPoints,
    })
  }

  if (rows.length) {
    const r = await db('weekly_scores?on_conflict=user_id,week_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!r.ok) throw new Error(`write weekly_scores: ${r.status} ${(await r.text()).slice(0, 200)}`)
  }

  return { week: week.week_number, players: rows.length, games: scored.length }
}

/**
 * Finals from The Odds API — the paid fallback for a tick where ESPN is down.
 *
 * Costs 2 credits per sport key, so it is deliberately reached only when the
 * free board gave nothing at all. Results are reshaped into the same records
 * ESPN produces so the caller has one matcher, plus an id index because the
 * event id stored at import time beats matching on names.
 */
async function fetchFinalsFromOddsApi({ games, oddsKey, apiCalls, failures }) {
  const records = []
  const byOddsId = new Map()

  if (!oddsKey) {
    failures.push('ODDS_API_KEY is not set — no fallback available')
    return { index: indexFinals(records), byOddsId }
  }

  for (const sportKey of scoreKeysFor(games)) {
    const r = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/` +
      `?apiKey=${oddsKey}&daysFrom=${DAYS_FROM}&dateFormat=iso`
    )
    apiCalls.push({ sportKey, status: r.status, remaining: r.headers.get('x-requests-remaining') })

    // An out-of-season key 404s; that is not a fault on its own.
    if (!r.ok) {
      failures.push(`${sportKey}: ${r.status} ${(await r.text()).slice(0, 200)}`)
      continue
    }

    const sport = sportKey === COLLEGE_KEY ? 'college' : 'nfl'
    for (const event of await r.json()) {
      if (!event.completed || event.scores?.length !== 2) continue
      const home = event.scores.find((s) => s.name === event.home_team)
      const away = event.scores.find((s) => s.name === event.away_team)
      const home_score = parseInt(home?.score, 10)
      const away_score = parseInt(away?.score, 10)
      if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) continue

      const record = {
        sport,
        home_team: event.home_team,
        away_team: event.away_team,
        home_score,
        away_score,
      }
      records.push(record)
      byOddsId.set(event.id, record)
    }
  }

  return { index: indexFinals(records), byOddsId }
}
