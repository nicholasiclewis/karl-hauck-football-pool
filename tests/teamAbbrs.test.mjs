/**
 * Team abbreviations, and the column budget that depends on them.
 *
 * Run with:  node --test tests/
 *
 * The weekly slate PDF names teams by abbreviation because the spelled-out
 * versions outgrew their columns — the favourite ran past its box and took the
 * spread with it, so "Mississippi State Bulldogs -10.5" printed without the
 * number the row exists to carry. That layout holds only while the
 * abbreviations stay short and every team actually has one, which is what
 * these check. Nothing here needs a PDF engine: character count is the proxy,
 * measured against a column sized for it.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { CFB_ABBREVS, espnAbbr } from '../src/lib/teamAbbrs.js'
import { CONFERENCE_TEAMS } from '../src/lib/conferences.js'
import { NFL_LOGO_SLUGS } from '../src/lib/teamLogos.js'
import { teamAbbr } from '../src/lib/gameUtils.js'

/**
 * The slate's matchup column fits "WWWW  at  WWWW" with room over. Five
 * characters is the ceiling that keeps it true for both sides at once.
 */
const MAX_LEN = 5

const collegeTeams = Object.values(CONFERENCE_TEAMS).flat()

describe('coverage', () => {
  test('every college team in the pool has an abbreviation', () => {
    // A team without one falls back to derived initials — "Ohio State
    // Buckeyes" becomes OSB, which is on no scoreboard anywhere.
    const missing = collegeTeams.filter((t) => espnAbbr(t) === null)
    assert.deepEqual(missing, [])
  })

  test('NFL comes from the logo slugs, so it needs no table of its own', () => {
    assert.equal(espnAbbr('Kansas City Chiefs'), 'KC')
    assert.equal(espnAbbr('Washington Commanders'), 'WSH')
  })
})

describe('the slate column budget', () => {
  test('no abbreviation is longer than the matchup column allows', () => {
    const tooLong = Object.entries(CFB_ABBREVS)
      .filter(([, abbr]) => abbr.length > MAX_LEN)
      .map(([team, abbr]) => `${team} -> ${abbr}`)
    assert.deepEqual(tooLong, [])
  })

  test('the derived fallback is bounded too', () => {
    // Unknown teams are the case the table cannot cover, so the fallback has
    // to be short by construction rather than by luck.
    assert.ok(teamAbbr('Some Unmapped Football Team').length <= 3)
    assert.ok(teamAbbr('Tarleton State Texans').length <= 3)
  })

  test('NFL is inside the budget too', () => {
    // These come from the logo slugs rather than the table above, so the
    // length check has to reach them separately.
    const tooLong = Object.keys(NFL_LOGO_SLUGS)
      .map((team) => [team, espnAbbr(team)])
      .filter(([, abbr]) => abbr.length > MAX_LEN)
      .map(([team, abbr]) => `${team} -> ${abbr}`)
    assert.deepEqual(tooLong, [])
  })
})
