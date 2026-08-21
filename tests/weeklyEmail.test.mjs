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
  pickLine,
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

describe('every pick, in the recap', () => {
  const pick = (over = {}) => ({
    sport: 'nfl',
    team: 'Kansas City Chiefs',
    opponent: 'Denver Broncos',
    atHome: true,
    spread: -3.5,
    scoreFor: 27,
    scoreAgainst: 20,
    outcome: 'win',
    points: 1,
    ...over,
  })

  const cards = [
    {
      userId: 'u1', name: 'Dana', points: 1.5, bonus: 0, correct: 1, losses: 1, pushes: 1,
      picks: [
        pick(),
        pick({ outcome: 'loss', points: 0, team: 'Buffalo Bills', opponent: 'Miami Dolphins',
               atHome: false, spread: 6.5, scoreFor: 14, scoreAgainst: 30 }),
        pick({ sport: 'college', outcome: 'push', points: 0.5, team: 'Toledo Rockets',
               opponent: 'Ohio Bobcats', spread: -3.5, scoreFor: 24, scoreAgainst: 21 }),
      ],
    },
  ]

  const build = (over = {}) => buildResultsEmail({
    week: { week_number: 5, container_type: 'nfl_college' },
    season,
    weekTable: [{ userId: 'u1', name: 'Dana', correct: 1, losses: 1, pushes: 1, bonus: 0, points: 1.5 }],
    winners: [{ name: 'Dana', points: 1.5 }],
    perfect: [],
    season_table: [{ rank: 1, userId: 'u1', name: 'Dana', points: 1.5, weeksWon: 1, gap: 0 }],
    cards,
    ...over,
  }).body

  test('the section lists each player and their picks', () => {
    const body = build()
    assert.match(body, /EVERY PICK/)
    assert.match(body, /Dana — 1\.5 pts/)
    assert.match(body, /KC -3\.5 vs DEN/)
    assert.match(body, /BUF \+6\.5 @ MIA/)
    assert.match(body, /TOL -3\.5 vs OHIO/)
  })

  test('every pick shows what it paid', () => {
    const lines = build().split('\n').filter((l) => /KC|BUF|TOL/.test(l))
    assert.match(lines[0], /W\s+1\s+NFL/)
    assert.match(lines[1], /L\s+0\s+NFL/)
    assert.match(lines[2], /P\s+0\.5\s+CFB/)
  })

  test('the pick points add up to the total reported above them', () => {
    // If these ever disagree the email is arguing with itself in public.
    const paid = cards[0].picks.reduce((sum, p) => sum + (p.points ?? 0), 0)
    assert.equal(paid, cards[0].points)
  })

  test('a game still to be graded shows a dash, not a zero', () => {
    const body = build({
      cards: [{ ...cards[0], picks: [pick({ outcome: null, points: null, scoreFor: null, scoreAgainst: null })] }],
    })
    const line = body.split('\n').find((l) => l.includes('KC -3.5'))
    assert.match(line, /·\s+—/)
    assert.match(line, /not played/)
    assert.doesNotMatch(line, /\s0\s/)
  })

  test('a player who submitted nothing is named rather than dropped', () => {
    const body = build({ cards: [{ ...cards[0], picks: [] }] })
    assert.match(body, /Dana/)
    assert.match(body, /no picks submitted/)
  })

  test('the section disappears when there are no cards', () => {
    assert.doesNotMatch(build({ cards: [] }), /EVERY PICK/)
  })

  test('scores read the picker\'s points first', () => {
    // The away pick lost 14-30; printing 30-14 would read as a win.
    const line = pickLine(cards[0].picks[1])
    assert.match(line, /14-30/)
  })

  test('columns line up down the page', () => {
    const lines = cards[0].picks.map(pickLine)
    const sportAt = lines.map((l) => l.indexOf(l.includes('NFL') ? 'NFL' : 'CFB'))
    assert.equal(new Set(sportAt).size, 1, `sport column drifts: ${sportAt}`)
  })
})
