/**
 * Final scores from ESPN's public scoreboard.
 *
 * The Odds API meters scores at 2 credits per sport per call, which on a
 * several-times-a-day schedule is by far the biggest draw on the budget.
 * ESPN's scoreboard is free, unmetered and needs no key — and this project
 * already reads ESPN for rankings, logos and abbreviations — so scores come
 * from there. The paid feed stays as a fallback for the day ESPN moves the
 * endpoint.
 *
 * Matching is by team name, because ESPN knows nothing about odds_api_id.
 * conferences.js already exists to reconcile the two sources' spellings (the
 * Odds API sends "Ohio State Buckeyes", ESPN sends "Ohio State"), so college
 * names resolve through resolveTeam and NFL names — identical in both feeds —
 * normalize directly.
 */
import { normalizeTeamName, resolveTeam } from './conferences.js'
import { partsInPoolTz } from './weekWindow.js'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football'

/** ESPN league paths, keyed by our sport column. */
export const LEAGUE_PATHS = {
  nfl:     'nfl',
  college: 'college-football',
}

// group 80 is FBS. Without it the college board returns every division and the
// default page size drops most of a Saturday; 400 clears the biggest slate.
const COLLEGE_QUERY = '&groups=80&limit=400'

/** ESPN's date format for a scoreboard day: YYYYMMDD, read in the pool zone. */
export function espnDate(when) {
  const { year, month, day } = partsInPoolTz(when instanceof Date ? when : new Date(when))
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
}

/** Scoreboard URL for one sport on one day. */
export function scoreboardUrl(sport, date) {
  const league = LEAGUE_PATHS[sport]
  if (!league) throw new Error(`Unknown sport: ${sport}`)
  return `${SITE}/${league}/scoreboard?dates=${date}` + (sport === 'college' ? COLLEGE_QUERY : '')
}

/**
 * The key a team name matches on.
 *
 * College goes through resolveTeam first so "Miami (OH)" and "Miami (Ohio)
 * RedHawks" land on the same key. Anything unrecognized — an FCS opponent,
 * a team missing from the 2026 alignment — still gets a normalized key, so
 * matching degrades to a plain name compare instead of failing outright.
 */
export function teamKey(name, sport) {
  if (sport === 'college') {
    const canon = resolveTeam(name)
    if (canon) return normalizeTeamName(canon.name)
  }
  return normalizeTeamName(name)
}

/** Both keys of a matchup, in one string. */
const matchupKey = (sport, home, away) => `${sport}|${teamKey(home, sport)}|${teamKey(away, sport)}`

/**
 * Pull the finished games out of a scoreboard payload.
 *
 * Only completed games are returned: a game at halftime carries a score that
 * would grade the whole week wrong.
 */
export function parseScoreboard(payload, sport) {
  const finals = []

  for (const event of payload?.events ?? []) {
    const competition = event.competitions?.[0]
    const status = competition?.status ?? event.status
    if (!status?.type?.completed) continue

    const home = competition.competitors?.find((c) => c.homeAway === 'home')
    const away = competition.competitors?.find((c) => c.homeAway === 'away')
    if (!home || !away) continue

    const home_score = parseInt(home.score, 10)
    const away_score = parseInt(away.score, 10)
    if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) continue

    // displayName is the full "Ohio State Buckeyes" form; location is the bare
    // "Ohio State". Keep both so teamKey can match whichever our row stores.
    finals.push({
      sport,
      espnId:    event.id,
      date:      event.date,
      home_team: home.team?.displayName ?? home.team?.location ?? '',
      away_team: away.team?.displayName ?? away.team?.location ?? '',
      home_location: home.team?.location ?? null,
      away_location: away.team?.location ?? null,
      home_score,
      away_score,
    })
  }

  return finals
}

/**
 * Pull the games currently on the field — and the just-finished — with their
 * running score and clock.
 *
 * This exists for display only. parseScoreboard above stays finals-only
 * because its output is graded; these entries never touch the database, so a
 * halftime score is safe here and is the whole point. Finished games are
 * included too: ESPN knows a final for up to fifteen minutes before the
 * scheduled sync writes it, and the card may as well show it during the gap.
 *
 * `detail` is ESPN's clock line as people read it on the ticker: "Q3 4:12",
 * "Halftime", "Final".
 */
export function parseLiveScores(payload, sport) {
  const live = []

  for (const event of payload?.events ?? []) {
    const competition = event.competitions?.[0]
    const status = competition?.status ?? event.status
    const state = status?.type?.state
    // 'pre' games have no score worth showing.
    if (state !== 'in' && state !== 'post') continue

    const home = competition.competitors?.find((c) => c.homeAway === 'home')
    const away = competition.competitors?.find((c) => c.homeAway === 'away')
    if (!home || !away) continue

    const home_score = parseInt(home.score, 10)
    const away_score = parseInt(away.score, 10)
    if (!Number.isFinite(home_score) || !Number.isFinite(away_score)) continue

    live.push({
      sport,
      state,                                   // 'in' = playing, 'post' = done
      detail: status?.type?.shortDetail ?? (state === 'post' ? 'Final' : 'Live'),
      home_team: home.team?.displayName ?? home.team?.location ?? '',
      away_team: away.team?.displayName ?? away.team?.location ?? '',
      home_location: home.team?.location ?? null,
      away_location: away.team?.location ?? null,
      home_score,
      away_score,
    })
  }

  return live
}

/** Index finals for lookup by matchup. */
export function indexFinals(finals) {
  const byMatchup = new Map()
  for (const f of finals) {
    byMatchup.set(matchupKey(f.sport, f.home_team, f.away_team), f)
    // Location-only spellings, for the rare row stored without a mascot.
    if (f.home_location && f.away_location) {
      byMatchup.set(matchupKey(f.sport, f.home_location, f.away_location), f)
    }
  }
  return byMatchup
}

/** The final for one of our game rows, or null if the board doesn't have it. */
export function findFinal(game, index) {
  return index.get(matchupKey(game.sport, game.home_team, game.away_team)) ?? null
}

/**
 * Fetch every scoreboard the given games span: one request per sport per day.
 *
 * Free, so this asks per day rather than trying to be clever. Individual
 * failures are collected instead of thrown — one dead request should not stop
 * the other day's games from resolving — and `ok` reports whether ESPN
 * answered at all, which is what decides if the paid fallback is needed.
 *
 * @param {Array} games    games to cover
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl]  injectable for tests
 */
export async function fetchFinals(games, { fetchImpl = fetch } = {}) {
  const slots = new Map()   // "sport|YYYYMMDD" -> { sport, date }
  for (const game of games) {
    const date = espnDate(game.kickoff_time)
    slots.set(`${game.sport}|${date}`, { sport: game.sport, date })
  }

  const finals = []
  const requests = []
  const failures = []

  for (const { sport, date } of slots.values()) {
    const url = scoreboardUrl(sport, date)
    try {
      const res = await fetchImpl(url)
      requests.push({ sport, date, status: res.status })
      if (!res.ok) {
        failures.push(`${sport} ${date}: ${res.status}`)
        continue
      }
      finals.push(...parseScoreboard(await res.json(), sport))
    } catch (err) {
      requests.push({ sport, date, status: 'error' })
      failures.push(`${sport} ${date}: ${err.message}`)
    }
  }

  return {
    finals,
    index: indexFinals(finals),
    requests,
    failures,
    // False only when every request failed, which is the case worth paying to
    // work around. A board that answers but is missing one game is not.
    ok: requests.length > 0 && failures.length < requests.length,
  }
}
