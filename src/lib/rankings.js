/**
 * Top 25 lookup for any given week, via ESPN's public rankings API.
 *
 * No API key and the endpoint sends `access-control-allow-origin: *`, so this
 * runs straight from the browser — no edge function needed.
 *
 * Important: the `site.api` rankings endpoint ignores year/week params and
 * always returns the current poll. Only the `sports.core.api` path below
 * honours a specific week, which is what "any given week" requires.
 */
// Explicit .js extension: Vite doesn't need it, but it lets these lib modules
// be imported directly by the node --test suite without a custom resolver.
import { resolveTeam, normalizeTeamName } from './conferences.js'

const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football'
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football'

/** ESPN poll ids. */
export const POLLS = {
  ap:      { id: 1,  label: 'AP Top 25' },
  coaches: { id: 2,  label: 'Coaches Poll' },
  cfp:     { id: 21, label: 'CFP Rankings' },
}

/** ESPN season types. */
export const SEASON_TYPE = { preseason: 1, regular: 2, postseason: 3 }

// Team $refs are stable and immutable for a season — cache them for the session
// so flipping between weeks doesn't refetch the same 25 teams every time.
const teamCache = new Map()

async function getJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`)
  return res.json()
}

async function resolveTeamRef(ref, signal) {
  // Refs come back over http and sometimes point at an internal host.
  const url = ref.replace(/^http:/, 'https:').replace('.pvt/', '.com/')
  if (teamCache.has(url)) return teamCache.get(url)
  const data = await getJson(url, signal)
  const team = {
    espnId:      data.id,
    location:    data.location,
    displayName: data.displayName,
    abbreviation: data.abbreviation,
  }
  teamCache.set(url, team)
  return team
}

/**
 * Fetch a poll for a specific week.
 *
 * @param {object}  opts
 * @param {number}  opts.year        e.g. 2026
 * @param {number}  opts.week        week number within the season type
 * @param {number} [opts.seasonType] 1=preseason, 2=regular, 3=post (default regular)
 * @param {string} [opts.poll]       'ap' | 'coaches' | 'cfp' (default 'ap')
 * @param {boolean}[opts.fallback]   if the requested poll is unavailable, try
 *                                   the next one (default true). The AP
 *                                   preseason poll posts later than the
 *                                   Coaches poll, so early-season lookups for
 *                                   'ap' would otherwise come back empty.
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{poll:string, pollLabel:string, headline:string, year:number,
 *                    week:number, seasonType:number, teams:Array}>}
 */
export async function fetchTop25({
  year,
  week,
  seasonType = SEASON_TYPE.regular,
  poll = 'ap',
  fallback = true,
  signal,
} = {}) {
  const pollOrder = fallback ? [poll, ...Object.keys(POLLS).filter((p) => p !== poll)] : [poll]

  // A poll is published *before* the week it applies to, so early in the
  // season the week being asked about has no poll of its own yet — regular
  // week 1 in particular never does, because the preseason poll covers it.
  // Walk back to the most recent poll that exists, ending at preseason.
  const weekOrder = [{ seasonType, week }]
  if (fallback) {
    for (let w = week - 1; w >= 1 && w >= week - 3; w--) weekOrder.push({ seasonType, week: w })
    if (seasonType !== SEASON_TYPE.preseason) {
      weekOrder.push({ seasonType: SEASON_TYPE.preseason, week: 1 })
    }
  }

  let lastErr = null
  for (const slot of weekOrder) {
  for (const key of pollOrder) {
    const spec = POLLS[key]
    if (!spec) continue
    try {
      const url = `${CORE}/seasons/${year}/types/${slot.seasonType}/weeks/${slot.week}/rankings/${spec.id}`
      const data = await getJson(url, signal)
      const ranks = data?.ranks ?? []
      if (ranks.length === 0) { lastErr = new Error(`${spec.label} empty`); continue }

      const teams = await Promise.all(ranks.map(async (r) => {
        const espn = r.team?.$ref ? await resolveTeamRef(r.team.$ref, signal) : null
        // Match on displayName first, then bare location — conferences.js
        // indexes both, plus known alternate spellings.
        const canon = (espn && (resolveTeam(espn.displayName) || resolveTeam(espn.location))) || null
        return {
          rank:            r.current,
          previous:        r.previous ?? null,
          points:          r.points ?? null,
          firstPlaceVotes: r.firstPlaceVotes ?? 0,
          trend:           r.trend ?? '-',
          record:          r.record?.summary ?? null,
          // Canonical Odds API style name when we recognize the school, else
          // whatever ESPN called it so the UI still has something to show.
          name:            canon?.name ?? espn?.displayName ?? 'Unknown',
          espnName:        espn?.displayName ?? null,
          conference:      canon?.conference ?? null,
          matched:         Boolean(canon),
        }
      }))

      return {
        poll:       key,
        pollLabel:  spec.label,
        headline:   data.shortHeadline ?? data.headline ?? spec.label,
        year,
        // What was asked for vs. what actually backed the answer — these
        // differ whenever the walk-back above kicked in.
        week:           slot.week,
        seasonType:     slot.seasonType,
        requestedWeek:  week,
        requestedType:  seasonType,
        teams:      teams.sort((a, b) => a.rank - b.rank),
      }
    } catch (err) {
      lastErr = err
    }
  }
  }
  throw lastErr ?? new Error('No poll available for that week')
}

/**
 * Map a calendar date onto ESPN's season/week numbering, so a pool week's
 * `week_start` can be turned into the right poll to fetch.
 * @param {string|Date} date
 */
export async function resolveWeekForDate(date, signal) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${date}`)

  const stamp = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('')

  const data = await getJson(`${SITE}/scoreboard?dates=${stamp}`, signal)

  // Read the season off an event on that date, not off `leagues[0].season` —
  // the latter reports the season type as of *today*, so an October lookup
  // during the off-season comes back "postseason". Events carry the real
  // season/week for the date that was queried.
  const event = data?.events?.[0]
  const league = data?.leagues?.[0]

  return {
    year:       event?.season?.year ?? league?.season?.year ?? d.getUTCFullYear(),
    week:       event?.week?.number ?? data?.week?.number ?? 1,
    seasonType: event?.season?.type ?? SEASON_TYPE.regular,
  }
}

/** Convenience: the Top 25 covering a given date. */
export async function fetchTop25ForDate(date, opts = {}) {
  const { year, week, seasonType } = await resolveWeekForDate(date, opts.signal)
  return fetchTop25({ year, week, seasonType, ...opts })
}

// ── Helpers for filtering games ──────────────────────────────────────────────

/**
 * Build a normalized-name -> rank map for O(1) lookups.
 * @param {{teams:Array}|Array} top25
 */
export function buildRankMap(top25) {
  const teams = Array.isArray(top25) ? top25 : top25?.teams ?? []
  const map = new Map()
  for (const t of teams) {
    map.set(normalizeTeamName(t.name), t.rank)
    if (t.espnName) map.set(normalizeTeamName(t.espnName), t.rank)
  }
  return map
}

/** Rank of a team name, or null if unranked. */
export function rankOf(teamName, rankMap) {
  if (!rankMap) return null
  const direct = rankMap.get(normalizeTeamName(teamName))
  if (direct != null) return direct
  // Fall back through the canonical name in case the sources spelled it differently.
  const canon = resolveTeam(teamName)
  return canon ? rankMap.get(normalizeTeamName(canon.name)) ?? null : null
}

/** True when either side of the matchup is ranked. */
export function isTop25Game(game, rankMap) {
  return rankOf(game.home_team, rankMap) !== null || rankOf(game.away_team, rankMap) !== null
}
