/**
 * Which games are eligible for a week, and how many of them a player may pick.
 *
 * The pool works like this: every game matching the week's rules is eligible,
 * and each player chooses their own slate from that pool. So a Big Ten week
 * might offer twenty games and each player picks six of them — different
 * players can pick entirely different games.
 *
 * Eligibility is mechanical (window + sport + focus), not curated. The limit
 * lives on picks, not on the game list.
 */
import { getTeamConference } from './conferences.js'
import { rankOf } from './rankings.js'

/**
 * How many picks a player makes, by container type.
 * A mixed week is exactly 4 NFL and 2 college — the bonus scoring depends on
 * it, since "all 4 NFL correct" only means something if there are 4 to get.
 */
export const PICK_LIMITS = {
  nfl_college:  { nfl: 4, college: 2 },
  nfl_only:     { nfl: 6, college: 0 },
  college_only: { nfl: 0, college: 6 },
}

/** Total picks in a full slate. */
export const MAX_PICKS = 6

/** Limits for a week, falling back to the mixed shape. */
export function pickLimits(containerType) {
  return PICK_LIMITS[containerType] ?? PICK_LIMITS.nfl_college
}

/** Which sports a week uses at all. */
export function sportsFor(containerType) {
  const limits = pickLimits(containerType)
  return ['nfl', 'college'].filter((s) => limits[s] > 0)
}

/**
 * Narrow college games to those matching a week's focus.
 *
 * Focuses we cannot determine mechanically (rivalry, conference championships,
 * CFP) pass everything through — those are judgement calls, so every college
 * game in the window stays eligible.
 *
 * @param {Array}  games    college games in the week's window
 * @param {object} week     { college_focus, conference }
 * @param {Map}   [rankMap] from buildRankMap(), required for a 'top25' focus
 */
export function filterCollegeByFocus(games, week, rankMap = null) {
  const focus = week?.college_focus
  if (!focus) return games

  if (focus === 'power4' || focus === 'group5') {
    const conf = week.conference
    if (!conf) return games
    return games.filter(
      (g) => getTeamConference(g.home_team) === conf || getTeamConference(g.away_team) === conf
    )
  }

  if (focus === 'top25') {
    // No poll means we cannot tell which games qualify. Return nothing rather
    // than everything — treating an unranked slate as ranked would put an FCS
    // team in a Top 25 week. Callers must surface this instead of shipping it.
    if (!rankMap) return []
    return games.filter(
      (g) => rankOf(g.home_team, rankMap) !== null || rankOf(g.away_team, rankMap) !== null
    )
  }

  return games
}

/**
 * Every game a player may pick from this week.
 *
 * @param {Array}  candidates games already limited to the week's window
 * @param {object} week       { container_type, college_focus, conference }
 * @param {Map}   [rankMap]   from buildRankMap(), for 'top25' weeks
 * @returns {{ eligible: Array, bySport: object, limits: object, shortfall: object }}
 */
export function selectEligible(candidates, week, rankMap = null) {
  const limits = pickLimits(week?.container_type)
  const sports = sportsFor(week?.container_type)

  const withSpread = (s) => candidates.filter((g) => g.sport === s && g.spread != null)

  const nfl = sports.includes('nfl') ? withSpread('nfl') : []

  const college = sports.includes('college')
    ? filterCollegeByFocus(
        withSpread('college').filter((g) =>
          // At least one recognized FBS side. The Odds API also carries FCS
          // opponents (Tarleton State and the like), never pool games.
          getTeamConference(g.home_team) !== null || getTeamConference(g.away_team) !== null
        ),
        week,
        rankMap
      )
    : []

  const byKickoff = (a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time)

  return {
    eligible: [...nfl, ...college].sort(byKickoff),
    bySport:  { nfl: nfl.length, college: college.length },
    limits,
    // Fewer eligible games than a player must pick means the week cannot be
    // completed — worth surfacing rather than discovering on Sunday.
    shortfall: {
      nfl:     Math.max(0, limits.nfl - nfl.length),
      college: Math.max(0, limits.college - college.length),
    },
  }
}

/**
 * How many more picks a player may make in each sport.
 * @param {Array}  picked  the player's current picks, each with a `sport`
 * @param {string} containerType
 */
export function remainingPicks(picked, containerType) {
  const limits = pickLimits(containerType)
  const used = {
    nfl:     picked.filter((p) => p.sport === 'nfl').length,
    college: picked.filter((p) => p.sport === 'college').length,
  }
  return {
    used,
    limits,
    remaining: {
      nfl:     Math.max(0, limits.nfl - used.nfl),
      college: Math.max(0, limits.college - used.college),
    },
    complete: used.nfl === limits.nfl && used.college === limits.college,
  }
}
