/**
 * Preseason football test suite.
 *
 * Run with:  node --test tests/
 *
 * Preseason is the stress case for this app's spread logic:
 *   - lines are tiny (0 to ~3.5) so pushes and pick'ems are common
 *   - games can end in a tie (no OT in NFL preseason)
 *   - there is no college football in August, so weeks are `nfl_only`
 *
 * These exercise the real modules in src/lib — no backend required.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  calculatePickOutcome,
  resolveGameResult,
  calculateWeeklyScore,
  pointsForOutcome,
} from '../src/lib/scoring.js'

import {
  formatSpread,
  teamAbbr,
  weekChipLabel,
  calcProjectedPoints,
  bonusStatus,
} from '../src/lib/gameUtils.js'

/** Build a game row the way fetch-nfl-odds writes it. */
function game({ home = 'Green Bay Packers', away = 'New York Jets', spread, home_score = null, away_score = null }) {
  return {
    home_team: home,
    away_team: away,
    spread,
    favorite: spread < 0 ? 'home' : 'away', // mirrors the edge function
    home_score,
    away_score,
    sport: 'nfl',
  }
}

describe('spread resolution — preseason lines', () => {
  test('home favored by 2.5, wins by 7 → home covers', () => {
    const g = game({ spread: -2.5, home_score: 24, away_score: 17 })
    assert.equal(resolveGameResult(g), 'home_covers')
    assert.equal(calculatePickOutcome(g, 'home'), 'win')
    assert.equal(calculatePickOutcome(g, 'away'), 'loss')
  })

  test('home favored by 2.5, wins by 1 → away covers', () => {
    const g = game({ spread: -2.5, home_score: 17, away_score: 16 })
    assert.equal(resolveGameResult(g), 'away_covers')
    assert.equal(calculatePickOutcome(g, 'away'), 'win')
  })

  test('away favored by 3, wins by exactly 3 → push', () => {
    const g = game({ spread: 3, home_score: 13, away_score: 16 })
    assert.equal(g.favorite, 'away')
    assert.equal(resolveGameResult(g), 'push')
    assert.equal(calculatePickOutcome(g, 'home'), 'push')
    assert.equal(calculatePickOutcome(g, 'away'), 'push')
  })

  test('home favored by 3, wins by exactly 3 → push', () => {
    const g = game({ spread: -3, home_score: 20, away_score: 17 })
    assert.equal(resolveGameResult(g), 'push')
  })
})

describe("pick'em games (spread = 0) — very common in preseason", () => {
  test('pick\'em resolves on the straight-up winner, not the line', () => {
    const homeWins = game({ spread: 0, home_score: 20, away_score: 13 })
    assert.equal(resolveGameResult(homeWins), 'home_covers')

    const awayWins = game({ spread: 0, home_score: 10, away_score: 27 })
    assert.equal(resolveGameResult(awayWins), 'away_covers')
  })

  test('tied preseason game on a pick\'em → push (no OT in preseason)', () => {
    const tie = game({ spread: 0, home_score: 16, away_score: 16 })
    assert.equal(resolveGameResult(tie), 'push')
    assert.equal(calculatePickOutcome(tie, 'home'), 'push')
    assert.equal(calculatePickOutcome(tie, 'away'), 'push')
  })

  test('tied game against a real line → the favorite fails to cover', () => {
    const tie = game({ spread: -3, home_score: 21, away_score: 21 })
    assert.equal(resolveGameResult(tie), 'away_covers')
  })

  test("spread 0 is stored with favorite='away' but still scores symmetrically", () => {
    // The edge function's `spread < 0 ? 'home' : 'away'` labels a pick'em as
    // away-favored. absSpread is 0, so the label never changes the outcome.
    const g = game({ spread: 0, home_score: 24, away_score: 21 })
    assert.equal(g.favorite, 'away')
    assert.equal(resolveGameResult(g), 'home_covers')
  })

  test('formatSpread renders a pick\'em as PK', () => {
    assert.equal(formatSpread(0), 'PK')
    assert.equal(formatSpread(-2.5), '-2.5')
    assert.equal(formatSpread(3), '+3')
    assert.equal(formatSpread(1.5), '+1.5')
  })
})

describe('unplayed / in-progress games', () => {
  test('no scores yet → null outcome, not a loss', () => {
    const g = game({ spread: -1.5 })
    assert.equal(resolveGameResult(g), null)
    assert.equal(calculatePickOutcome(g, 'home'), null)
  })

  test('a 0-0 final is scored, not treated as missing', () => {
    const g = game({ spread: 0, home_score: 0, away_score: 0 })
    assert.equal(resolveGameResult(g), 'push')
  })
})

describe('weekly scoring — nfl_only (August has no college football)', () => {
  test('4 of 6 correct earns the any-four bonus', () => {
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 4 })
    assert.deepEqual(s, { basePoints: 4, bonusPoints: 1, totalPoints: 5 })
  })

  test('all 6 correct earns both bonuses and caps at 8', () => {
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 6 })
    assert.deepEqual(s, { basePoints: 6, bonusPoints: 2, totalPoints: 8 })
  })

  test('3 correct earns no bonus', () => {
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 3 })
    assert.equal(s.bonusPoints, 0)
    assert.equal(s.totalPoints, 3)
  })

  test('pushes are worth half a point each', () => {
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 3, pushCount: 2 })
    assert.equal(s.basePoints, 4)
  })

  test('a push-heavy preseason week cannot exceed the 8 point cap', () => {
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 6, pushCount: 4 })
    assert.equal(s.totalPoints, 8)
  })

  test('pushes do NOT count toward the bonus thresholds', () => {
    // 3 correct + 3 pushes = 4.5 base points, but only 3 "correct" — no bonus.
    const s = calculateWeeklyScore('nfl_only', { totalCorrect: 3, pushCount: 3 })
    assert.equal(s.basePoints, 4.5)
    assert.equal(s.bonusPoints, 0)
    assert.equal(s.totalPoints, 4.5)
  })

  test('pointsForOutcome maps outcomes to points', () => {
    assert.equal(pointsForOutcome('win'), 1)
    assert.equal(pointsForOutcome('push'), 0.5)
    assert.equal(pointsForOutcome('loss'), 0)
    assert.equal(pointsForOutcome(null), 0)
  })
})

describe('projected points + bonus status for an nfl_only preseason week', () => {
  const games = [
    { id: 'g1', sport: 'nfl' }, { id: 'g2', sport: 'nfl' }, { id: 'g3', sport: 'nfl' },
    { id: 'g4', sport: 'nfl' }, { id: 'g5', sport: 'nfl' }, { id: 'g6', sport: 'nfl' },
  ]
  const picksFor = (n) =>
    Object.fromEntries(games.slice(0, n).map((g, i) => [g.id, { game_id: g.id, picked: 'home', i }]))

  test('no picks → 0 projected', () => {
    assert.equal(calcProjectedPoints({}, games, 'nfl_only'), 0)
  })

  test('4 picks → 4 + any-four bonus = 5', () => {
    assert.equal(calcProjectedPoints(picksFor(4), games, 'nfl_only'), 5)
  })

  test('6 picks → 6 + both bonuses = 8 (the cap)', () => {
    assert.equal(calcProjectedPoints(picksFor(6), games, 'nfl_only'), 8)
  })

  test('bonus status counts down remaining picks', () => {
    const s2 = bonusStatus(picksFor(2), games, 'nfl_only')
    assert.equal(s2.nflBonus, null)
    assert.equal(s2.anyFourBonus, '2 picks to go')
    assert.equal(s2.allSixBonus, '4 picks to go')

    const s5 = bonusStatus(picksFor(5), games, 'nfl_only')
    assert.equal(s5.anyFourBonus, 'achieved')
    assert.equal(s5.allSixBonus, '1 pick to go') // singular
  })
})

describe('display helpers with real NFL team names', () => {
  test('weekChipLabel shows an NFL-only preseason week', () => {
    const six = Array.from({ length: 6 }, () => ({ sport: 'nfl' }))
    assert.equal(weekChipLabel(six), '6 NFL')
  })

  test('teamAbbr uses ESPN abbreviations for NFL clubs', () => {
    assert.equal(teamAbbr('Green Bay Packers'), 'GB')
    assert.equal(teamAbbr('New York Jets'), 'NYJ')
    assert.equal(teamAbbr('Tampa Bay Buccaneers'), 'TB')
    assert.equal(teamAbbr('Washington Commanders'), 'WSH')
  })

  test('teamAbbr uses ESPN abbreviations for college teams', () => {
    assert.equal(teamAbbr('Ohio State Buckeyes'), 'OSU')
    assert.equal(teamAbbr('Ole Miss Rebels'), 'MISS')
    // Alternate spellings resolve through conferences.js first.
    assert.equal(teamAbbr('Mississippi Rebels'), 'MISS')
    assert.equal(teamAbbr('Texas A&M Aggies'), 'TA&M')
    assert.equal(teamAbbr('Miami (OH) Redhawks'), 'M-OH')
  })

  test('teamAbbr falls back to derived initials for unknown teams', () => {
    // FCS opponents and typos still show something rather than nothing.
    assert.equal(teamAbbr('Commanders'), 'COM')
    assert.equal(teamAbbr('Tarleton State Texans'), 'TST')
  })
})

/**
 * The Odds API → games-row transform.
 *
 * NOTE: this mirrors the mapping in supabase/functions/fetch-nfl-odds/index.ts.
 * That file is Deno/TypeScript and cannot be imported here, so this validates
 * the payload assumptions (shape, sign convention, favorite derivation) rather
 * than the deployed code itself.
 */
function mapEventToGame(event) {
  const book = event.bookmakers?.[0]
  const market = book?.markets?.find((m) => m.key === 'spreads')
  if (!market) return null
  const homeOut = market.outcomes.find((o) => o.name === event.home_team)
  const awayOut = market.outcomes.find((o) => o.name === event.away_team)
  if (!homeOut || !awayOut) return null
  const spread = homeOut.point
  return {
    home_team: event.home_team,
    away_team: event.away_team,
    spread,
    favorite: spread < 0 ? 'home' : 'away',
    kickoff_time: event.commence_time,
    odds_api_id: event.id,
  }
}

describe('Odds API payload → games row', () => {
  const preseasonEvent = {
    id: 'ps-evt-001',
    sport_key: 'americanfootball_nfl_preseason',
    commence_time: '2026-08-14T23:00:00Z',
    home_team: 'Green Bay Packers',
    away_team: 'New York Jets',
    bookmakers: [{
      key: 'draftkings',
      title: 'DraftKings',
      markets: [{
        key: 'spreads',
        outcomes: [
          { name: 'Green Bay Packers', point: -2.5, price: -110 },
          { name: 'New York Jets', point: 2.5, price: -110 },
        ],
      }],
    }],
  }

  test('maps a preseason spread event to a games row', () => {
    const g = mapEventToGame(preseasonEvent)
    assert.equal(g.home_team, 'Green Bay Packers')
    assert.equal(g.spread, -2.5)
    assert.equal(g.favorite, 'home')
    assert.equal(g.odds_api_id, 'ps-evt-001')
  })

  test("a pick'em event maps to spread 0", () => {
    const pk = structuredClone(preseasonEvent)
    pk.bookmakers[0].markets[0].outcomes.forEach((o) => { o.point = 0 })
    assert.equal(mapEventToGame(pk).spread, 0)
  })

  test('an event with no spreads market is skipped', () => {
    const noSpread = structuredClone(preseasonEvent)
    noSpread.bookmakers[0].markets = [{ key: 'h2h', outcomes: [] }]
    assert.equal(mapEventToGame(noSpread), null)
  })

  test('an event with no bookmakers is skipped', () => {
    const noBook = structuredClone(preseasonEvent)
    noBook.bookmakers = []
    assert.equal(mapEventToGame(noBook), null)
  })

  test('outcome names that do not match the team names are skipped', () => {
    // Guards against the API returning an abbreviation or alternate naming.
    const mismatch = structuredClone(preseasonEvent)
    mismatch.bookmakers[0].markets[0].outcomes[0].name = 'GB Packers'
    assert.equal(mapEventToGame(mismatch), null)
  })
})

/**
 * Score merging across NFL sport keys.
 *
 * Mirrors the logic in supabase/functions/fetch-scores/index.ts. Preseason
 * scores live only under americanfootball_nfl_preseason, so that function now
 * queries both NFL keys and merges. Same caveat as above: this validates the
 * merge/dedupe/match rules, not the deployed Deno code.
 */
function mergeAndMatch(eventsByKey, dbGames, { failedKeys = [], attemptedKeys = [] } = {}) {
  if (attemptedKeys.length > 0 && failedKeys.length === attemptedKeys.length) {
    throw new Error('Odds API scores failed')
  }

  const all = Object.values(eventsByKey).flat()

  const seen = new Set()
  const deduped = all.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  const completed = deduped.filter((e) => e.completed && e.scores?.length === 2)

  const updates = []
  for (const dbGame of dbGames) {
    const match = completed.find((e) => {
      if (dbGame.odds_api_id && e.id === dbGame.odds_api_id) return true
      if (e._sport !== dbGame.sport) return false
      return e.home_team === dbGame.home_team && e.away_team === dbGame.away_team
    })
    if (!match) continue
    const homeEntry = match.scores.find((s) => s.name === match.home_team)
    const awayEntry = match.scores.find((s) => s.name === match.away_team)
    if (!homeEntry || !awayEntry) continue
    const home_score = parseInt(homeEntry.score, 10)
    const away_score = parseInt(awayEntry.score, 10)
    if (Number.isNaN(home_score) || Number.isNaN(away_score)) continue
    updates.push({ id: dbGame.id, home_score, away_score })
  }
  return updates
}

const scoredEvent = (id, home, away, hs, as, completed = true) => ({
  id,
  _sport: 'nfl',
  completed,
  home_team: home,
  away_team: away,
  scores: [{ name: home, score: String(hs) }, { name: away, score: String(as) }],
})

describe('fetch-scores: merging NFL regular season + preseason keys', () => {
  const dbGames = [
    { id: 'db1', sport: 'nfl', home_team: 'Green Bay Packers', away_team: 'New York Jets', odds_api_id: 'ps-evt-001' },
  ]

  test('a preseason game resolves from the preseason key', () => {
    // The regular-season key returns nothing in August — this is the exact
    // case that silently failed before.
    const updates = mergeAndMatch({
      americanfootball_nfl: [],
      americanfootball_nfl_preseason: [scoredEvent('ps-evt-001', 'Green Bay Packers', 'New York Jets', 17, 13)],
    }, dbGames)

    assert.deepEqual(updates, [{ id: 'db1', home_score: 17, away_score: 13 }])
  })

  test('querying only the regular-season key leaves preseason games unresolved', () => {
    const updates = mergeAndMatch({
      americanfootball_nfl: [],
    }, dbGames)
    assert.deepEqual(updates, [])
  })

  test('an event appearing under both keys is only applied once', () => {
    const dupe = scoredEvent('ps-evt-001', 'Green Bay Packers', 'New York Jets', 17, 13)
    const updates = mergeAndMatch({
      americanfootball_nfl: [dupe],
      americanfootball_nfl_preseason: [structuredClone(dupe)],
    }, dbGames)
    assert.equal(updates.length, 1)
  })

  test('in-progress games are ignored until completed', () => {
    const updates = mergeAndMatch({
      americanfootball_nfl_preseason: [scoredEvent('ps-evt-001', 'Green Bay Packers', 'New York Jets', 7, 3, false)],
    }, dbGames)
    assert.deepEqual(updates, [])
  })

  test('a 0-0 preseason final is applied, not skipped as falsy', () => {
    const updates = mergeAndMatch({
      americanfootball_nfl_preseason: [scoredEvent('ps-evt-001', 'Green Bay Packers', 'New York Jets', 0, 0)],
    }, dbGames)
    assert.deepEqual(updates, [{ id: 'db1', home_score: 0, away_score: 0 }])
  })

  test('manually entered games match on team names when odds_api_id is null', () => {
    const manual = [{ id: 'db2', sport: 'nfl', home_team: 'Chicago Bears', away_team: 'Buffalo Bills', odds_api_id: null }]
    const updates = mergeAndMatch({
      americanfootball_nfl_preseason: [scoredEvent('other-id', 'Chicago Bears', 'Buffalo Bills', 20, 24)],
    }, manual)
    assert.deepEqual(updates, [{ id: 'db2', home_score: 20, away_score: 24 }])
  })

  test('one key failing is tolerated when another succeeds', () => {
    const updates = mergeAndMatch({
      americanfootball_nfl_preseason: [scoredEvent('ps-evt-001', 'Green Bay Packers', 'New York Jets', 17, 13)],
    }, dbGames, {
      attemptedKeys: ['americanfootball_nfl', 'americanfootball_nfl_preseason'],
      failedKeys: ['americanfootball_nfl'], // out of season, returns an error
    })
    assert.equal(updates.length, 1)
  })

  test('every key failing throws instead of reporting 0 updates', () => {
    // A bad API key or blown quota must not look like "no games finished yet".
    assert.throws(() => mergeAndMatch({}, dbGames, {
      attemptedKeys: ['americanfootball_nfl', 'americanfootball_nfl_preseason'],
      failedKeys: ['americanfootball_nfl', 'americanfootball_nfl_preseason'],
    }), /Odds API scores failed/)
  })
})
