/**
 * Picking the featured slate for a week.
 *
 * The Tuesday import brings in every game in the week's window as a candidate;
 * these helpers decide which ones to suggest as the featured six. The
 * commissioner can always override from the Games tab — this only sets the
 * starting point.
 *
 * Suggestion rule: closest spread first. Near-even matchups are the most
 * competitive and the hardest to call against the spread, which is what makes
 * a pool week interesting.
 */
import { getTeamConference } from './conferences.js'
import { rankOf } from './rankings.js'

/** How many of each sport a week needs, by container type. */
export const SLATE_SHAPE = {
  nfl_college:  { nfl: 4, college: 2 },
  nfl_only:     { nfl: 6, college: 0 },
  college_only: { nfl: 0, college: 6 },
}

/** Total games in a full slate (always 6 — the scoring rules assume it). */
export const SLATE_SIZE = 6

/**
 * Narrow college candidates to the ones matching a week's college focus.
 * Focuses we can't determine mechanically (rivalry, conference championships,
 * CFP) pass everything through for the commissioner to choose from.
 *
 * @param {Array}  games    candidate college games
 * @param {object} week     week row: { college_focus, conference }
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
    if (!rankMap) return games
    return games.filter(
      (g) => rankOf(g.home_team, rankMap) !== null || rankOf(g.away_team, rankMap) !== null
    )
  }

  return games
}

/** Ascending by how close the spread is to a pick'em. */
function byClosestSpread(a, b) {
  const d = Math.abs(Number(a.spread)) - Math.abs(Number(b.spread))
  if (d !== 0) return d
  // Stable tiebreak so the same slate produces the same suggestion every run.
  return new Date(a.kickoff_time) - new Date(b.kickoff_time)
}

/**
 * Suggest the featured slate for a week.
 *
 * @param {Array}  candidates all in-window games ({ sport, spread, kickoff_time, ... })
 * @param {object} week       week row: { container_type, college_focus, conference }
 * @param {Map}   [rankMap]   from buildRankMap(), for 'top25' weeks
 * @returns {{ featured: Array, shape: object, shortfall: object }}
 */
export function suggestFeatured(candidates, week, rankMap = null) {
  const shape = SLATE_SHAPE[week?.container_type] ?? SLATE_SHAPE.nfl_college

  const nfl = candidates
    .filter((g) => g.sport === 'nfl' && g.spread != null)
    .sort(byClosestSpread)

  const college = filterCollegeByFocus(
    candidates.filter((g) => g.sport === 'college' && g.spread != null),
    week,
    rankMap
  ).sort(byClosestSpread)

  const pickedNfl = nfl.slice(0, shape.nfl)
  const pickedCollege = college.slice(0, shape.college)

  return {
    featured: [...pickedNfl, ...pickedCollege],
    shape,
    // Non-zero means the window didn't have enough qualifying games; the
    // caller should surface this rather than silently ship a short week.
    shortfall: {
      nfl:     Math.max(0, shape.nfl - pickedNfl.length),
      college: Math.max(0, shape.college - pickedCollege.length),
    },
  }
}
