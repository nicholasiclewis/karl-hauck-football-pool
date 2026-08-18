/**
 * Weekly email bodies.
 *
 * Run with:  node --test tests/
 *
 * These get pasted straight into a mail client with no formatting applied, so
 * the things worth pinning are the ones a reader would notice: shared wins
 * named as shared, perfect weeks called out, and nobody silently dropped.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildResultsEmail,
  buildGamesEmail,
  formatLabel,
  picksNeeded,
} from '../src/lib/weeklyEmail.js'

const season = { year: 2026 }
const week = {
  week_number: 3, container_type: 'nfl_college',
  college_focus: 'power4', conference: 'SEC', week_start: '2026-09-15',
}

const row = (name, points, correct, pushes = 0, bonus = 0) => ({ name, points, correct, pushes, bonus })

const results = {
  week, season,
  weekTable: [row('Dana', 7, 6, 0, 1), row('Alex', 5, 5), row('Sam', 3, 3)],
  winners:   [row('Dana', 7, 6, 0, 1)],
  perfect:   [],
  season_table: [
    { rank: 1, name: 'Dana', points: 19, correct: 16, weeksWon: 2, played: 3 },
    { rank: 2, name: 'Alex', points: 14, correct: 12, weeksWon: 1, played: 3 },
    { rank: 3, name: 'Sam',  points: 9,  correct: 8,  weeksWon: 0, played: 3 },
  ],
}

describe('results email', () => {
  test('names the winner in the subject and body', () => {
    const { subject, body } = buildResultsEmail(results)
    assert.match(subject, /Week 3 Results/)
    assert.match(subject, /Dana takes it/)
    assert.match(body, /WEEK 3 WINNER: Dana — 7 pts/)
  })

  test('a tie is reported as shared, not as one winner', () => {
    const tied = [row('Dana', 7, 6), row('Alex', 7, 6)]
    const { subject, body } = buildResultsEmail({ ...results, weekTable: tied, winners: tied })
    assert.match(body, /CO-WINNERS: Dana & Alex — 7 pts each/)
    assert.match(subject, /Dana & Alex take it/)
    assert.doesNotMatch(body, /WEEK 3 WINNER/)
  })

  test('a perfect week gets its own callout', () => {
    const perfect = [row('Dana', 8, 6, 0, 2)]
    const { body } = buildResultsEmail({ ...results, winners: perfect, perfect })
    assert.match(body, /\*\*\* PERFECT WEEK \*\*\*/)
    assert.match(body, /Dana — 8\/8, a clean sweep/)
  })

  test('no callout when nobody was perfect', () => {
    assert.doesNotMatch(buildResultsEmail(results).body, /PERFECT WEEK/)
  })

  test('every player appears in both tables', () => {
    const { body } = buildResultsEmail(results)
    for (const name of ['Dana', 'Alex', 'Sam']) {
      const hits = body.split('\n').filter((l) => l.includes(name)).length
      assert.ok(hits >= 2, `${name} should appear in the week and season tables`)
    }
  })

  test('an unscored week says so instead of naming a winner', () => {
    const { subject, body } = buildResultsEmail({ ...results, weekTable: [], winners: [] })
    assert.match(body, /No scores recorded/)
    assert.equal(subject, 'Week 3 Results')
  })

  test('pushes and bonuses are only mentioned when earned', () => {
    const { body } = buildResultsEmail(results)
    const dana = body.split('\n').find((l) => l.includes('Dana') && l.includes('correct'))
    const sam  = body.split('\n').find((l) => l.includes('Sam') && l.includes('correct'))
    assert.match(dana, /\+1 bonus/)
    assert.doesNotMatch(sam, /bonus|push/)
  })
})

describe('games email', () => {
  const games = [
    { sport: 'nfl', home_team: 'Baltimore Ravens', away_team: 'Kansas City Chiefs',
      spread: -3.5, favorite: 'home', kickoff_time: '2026-09-18T00:15:00Z' },
    { sport: 'college', home_team: 'Alabama Crimson Tide', away_team: 'Georgia Bulldogs',
      spread: 2.5, favorite: 'away', kickoff_time: '2026-09-19T23:30:00Z' },
  ]
  const data = { week, season, games, limits: { nfl: 4, college: 2 } }

  test('states the format, dates and what is owed', () => {
    const { subject, body } = buildGamesEmail(data)
    assert.match(subject, /Week 3 is open — pick 4 NFL and 2 college/)
    assert.match(body, /Format : 4 NFL \+ 2 College · Power 4 \(SEC\)/)
    assert.match(body, /Dates  : Tue, Sep 15 – Mon, Sep 21/)
    assert.match(body, /Pick   : 4 NFL and 2 college/)
  })

  test('groups by sport and lists every game', () => {
    const { body } = buildGamesEmail(data)
    assert.match(body, /^NFL$/m)
    assert.match(body, /^COLLEGE$/m)
    assert.match(body, /Kansas City Chiefs @ Baltimore Ravens/)
    assert.match(body, /Georgia Bulldogs @ Alabama Crimson Tide/)
  })

  test('shows the favourite laying the points, not the raw stored spread', () => {
    const { body } = buildGamesEmail(data)
    // Home favoured by 3.5 → the Ravens lay it.
    assert.match(body, /Baltimore Ravens -3\.5/)
    // Away favoured → Georgia lays it, even though spread is stored positive.
    assert.match(body, /Georgia Bulldogs -2\.5/)
  })

  test('a single-sport week only mentions that sport', () => {
    const { subject, body } = buildGamesEmail({
      ...data,
      week: { ...week, container_type: 'nfl_only', college_focus: null, conference: null },
      games: games.filter((g) => g.sport === 'nfl'),
      limits: { nfl: 6, college: 0 },
    })
    assert.match(subject, /pick 6 NFL$/)
    assert.doesNotMatch(body, /^COLLEGE$/m)
  })
})

describe('shared labels', () => {
  test('format label reflects container and focus', () => {
    assert.equal(formatLabel({ container_type: 'nfl_only' }), '6 NFL')
    assert.equal(formatLabel({ container_type: 'college_only', college_focus: 'top25' }),
      '6 College · Top 25')
    assert.equal(formatLabel({ container_type: 'nfl_college', college_focus: 'group5', conference: 'MAC' }),
      '4 NFL + 2 College · Group of 5 (MAC)')
  })

  test('picks needed omits a sport the week does not use', () => {
    assert.equal(picksNeeded({ nfl: 4, college: 2 }), '4 NFL and 2 college')
    assert.equal(picksNeeded({ nfl: 6, college: 0 }), '6 NFL')
    assert.equal(picksNeeded({ nfl: 0, college: 6 }), '6 college')
  })
})
