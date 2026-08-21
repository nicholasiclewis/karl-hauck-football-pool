/**
 * Weekly storylines.
 *
 * Run with:  node --test tests/
 *
 * These go in front of the whole pool, so the cases that matter are the ones
 * that would embarrass: a shared week counted as one person's win, a rank
 * "climb" invented for someone who just joined, or a trap game named when
 * nobody actually picked it.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  standingsAfter,
  rankMovement,
  winStreaks,
  gameBreakdown,
  notables,
  pickCards,
  ordinal,
  movementGlyph,
} from '../src/lib/weeklyInsights.js'

const names = new Map([['u1', 'Dana'], ['u2', 'Marcus'], ['u3', 'Alex'], ['u4', 'Sam']])
const score = (user_id, week_id, total_points, correct_picks = 0) =>
  ({ user_id, week_id, total_points, correct_picks })

describe('season standings', () => {
  const scores = [
    score('u1', 'w1', 6, 5), score('u2', 'w1', 4, 4), score('u3', 'w1', 3, 3),
    score('u1', 'w2', 5, 5), score('u2', 'w2', 7, 6), score('u3', 'w2', 3, 3),
  ]

  test('totals across weeks and ranks by points', () => {
    const t = standingsAfter(scores, ['w1', 'w2'], names)
    assert.deepEqual(t.map((r) => [r.name, r.points, r.rank]), [
      ['Dana', 11, 1], ['Marcus', 11, 1], ['Alex', 6, 3],
    ])
  })

  test('tied players share a rank and the next one skips', () => {
    // Dana and Marcus both on 11 are joint 1st, so Alex is 3rd, not 2nd.
    const t = standingsAfter(scores, ['w1', 'w2'], names)
    assert.equal(t[0].rank, 1)
    assert.equal(t[1].rank, 1)
    assert.equal(t[2].rank, 3)
  })

  test('gap to the leader is carried on every row', () => {
    const t = standingsAfter(scores, ['w1', 'w2'], names)
    assert.equal(t[0].gap, 0)
    assert.equal(t.find((r) => r.name === 'Alex').gap, 5)
  })

  test('a week won outright counts once, a shared week counts for both', () => {
    const shared = [score('u1', 'w1', 6), score('u2', 'w1', 6), score('u3', 'w1', 2)]
    const t = standingsAfter(shared, ['w1'], names)
    assert.equal(t.find((r) => r.name === 'Dana').weeksWon, 1)
    assert.equal(t.find((r) => r.name === 'Marcus').weeksWon, 1)
    assert.equal(t.find((r) => r.name === 'Alex').weeksWon, 0)
  })

  test('an unscored week is not a win for anyone', () => {
    const zeros = [score('u1', 'w1', 0), score('u2', 'w1', 0)]
    const t = standingsAfter(zeros, ['w1'], names)
    assert.ok(t.every((r) => r.weeksWon === 0))
  })
})

describe('rank movement', () => {
  test('reports climbs and falls from the previous week', () => {
    const prev = [
      { userId: 'u1', rank: 3 }, { userId: 'u2', rank: 1 }, { userId: 'u3', rank: 2 },
    ]
    const now = [
      { userId: 'u1', rank: 1 }, { userId: 'u2', rank: 2 }, { userId: 'u3', rank: 3 },
    ]
    const m = rankMovement(now, prev)
    assert.equal(m.get('u1').delta, 2)    // 3rd -> 1st
    assert.equal(m.get('u2').delta, -1)   // 1st -> 2nd
    assert.equal(m.get('u3').delta, -1)
  })

  test('a first appearance is new, not a climb', () => {
    const m = rankMovement([{ userId: 'u4', rank: 2 }], [])
    assert.equal(m.get('u4').isNew, true)
    assert.equal(m.get('u4').delta, 0)
  })
})

describe('win streaks', () => {
  test('counts consecutive weeks won, ending at the latest', () => {
    const scores = [
      score('u1', 'w1', 6), score('u2', 'w1', 4),
      score('u1', 'w2', 7), score('u2', 'w2', 5),
      score('u1', 'w3', 8), score('u2', 'w3', 3),
    ]
    assert.equal(winStreaks(scores, ['w1', 'w2', 'w3']).get('u1'), 3)
    assert.equal(winStreaks(scores, ['w1', 'w2', 'w3']).get('u2'), 0)
  })

  test('a run that ended is no longer a run', () => {
    const scores = [
      score('u1', 'w1', 6), score('u2', 'w1', 4),
      score('u1', 'w2', 2), score('u2', 'w2', 7),
    ]
    assert.equal(winStreaks(scores, ['w1', 'w2']).get('u1'), 0)
    assert.equal(winStreaks(scores, ['w1', 'w2']).get('u2'), 1)
  })

  test('an unscored week does not break a run', () => {
    const scores = [
      score('u1', 'w1', 6), score('u2', 'w1', 4),
      score('u1', 'w2', 0), score('u2', 'w2', 0),   // nothing scored
      score('u1', 'w3', 7), score('u2', 'w3', 3),
    ]
    assert.equal(winStreaks(scores, ['w1', 'w2', 'w3']).get('u1'), 2)
  })
})

describe('game breakdown', () => {
  const game = (id, result, home = 'Ravens', away = 'Chiefs') =>
    ({ id, result, home_team: home, away_team: away, home_score: 20, away_score: 17 })
  const pick = (game_id, picked_team, user_id) => ({ game_id, picked_team, user_id })

  test('counts the split and who got it right', () => {
    const b = gameBreakdown(
      [game('g1', 'home_covers')],
      [pick('g1', 'home', 'u1'), pick('g1', 'home', 'u2'), pick('g1', 'away', 'u3')]
    )[0]
    assert.equal(b.total, 3)
    assert.equal(b.home, 2)
    assert.equal(b.away, 1)
    assert.equal(b.correct, 2)
    assert.equal(b.winner, 'Ravens')
  })

  test('a push is correct for everyone who played it', () => {
    const b = gameBreakdown(
      [game('g1', 'push')],
      [pick('g1', 'home', 'u1'), pick('g1', 'away', 'u2')]
    )[0]
    assert.equal(b.correct, 2)
    assert.equal(b.winner, 'Push')
  })

  test('unsettled games are left out', () => {
    assert.equal(gameBreakdown([game('g1', null)], []).length, 0)
  })

  test('a game nobody picked is not treated as a trap', () => {
    // hitRate 1 keeps it away from the bottom of the most-missed sort.
    assert.equal(gameBreakdown([game('g1', 'home_covers')], [])[0].hitRate, 1)
  })
})

describe('notables', () => {
  const base = {
    weekTable: [{ name: 'Dana', points: 8 }, { name: 'Marcus', points: 5 }],
    standings: [
      { userId: 'u1', name: 'Dana', points: 19, rank: 1 },
      { userId: 'u2', name: 'Marcus', points: 15, rank: 2 },
    ],
    movement: new Map([
      ['u1', { delta: 2, from: 3, to: 1, isNew: false }],
      ['u2', { delta: -1, from: 1, to: 2, isNew: false }],
    ]),
    streaks: new Map([['u1', 3], ['u2', 0]]),
    breakdown: [],
  }

  test('names the biggest climber', () => {
    const n = notables(base)
    const mover = n.find((x) => x.label === 'Biggest Mover')
    assert.equal(mover.value, 'Dana')
    assert.match(mover.detail, /up 2 to 1st/)
  })

  test('reports a run only at two weeks or more', () => {
    assert.ok(notables(base).some((x) => x.label === 'On a Run'))
    const short = { ...base, streaks: new Map([['u1', 1], ['u2', 0]]) }
    assert.equal(notables(short).some((x) => x.label === 'On a Run'), false)
  })

  test('flags a trap game only when most of the room missed it', () => {
    const missed = {
      ...base,
      breakdown: [{
        game: { away_team: 'Kansas City Chiefs', home_team: 'Baltimore Ravens' },
        total: 10, correct: 2, hitRate: 0.2,
      }],
    }
    const trap = notables(missed).find((x) => x.label === 'Trap Game')
    assert.equal(trap.value, 'Chiefs / Ravens')
    assert.match(trap.detail, /only 2 of 10/)

    const easy = { ...base, breakdown: [{ ...missed.breakdown[0], correct: 9, hitRate: 0.9 }] }
    assert.equal(notables(easy).some((x) => x.label === 'Trap Game'), false)
  })

  test('a tie at the top reads as a dead heat', () => {
    const tied = {
      ...base,
      standings: [
        { userId: 'u1', name: 'Dana', points: 19, rank: 1 },
        { userId: 'u2', name: 'Marcus', points: 19, rank: 1 },
      ],
    }
    const race = notables(tied).find((x) => x.label === 'Race for First')
    assert.equal(race.value, 'Dead heat')
  })

  test('no invented storylines when nothing happened', () => {
    const flat = {
      weekTable: [{ name: 'Dana', points: 5 }],
      standings: [{ userId: 'u1', name: 'Dana', points: 5, rank: 1 }],
      movement: new Map([['u1', { delta: 0, from: 1, to: 1, isNew: false }]]),
      streaks: new Map([['u1', 1]]),
      breakdown: [],
    }
    const n = notables(flat)
    assert.equal(n.some((x) => x.label === 'Biggest Mover'), false)
    assert.equal(n.some((x) => x.label === 'On a Run'), false)
  })
})

describe('formatting', () => {
  test('ordinals read correctly, including the teens', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal),
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  })

  test('movement glyphs distinguish up, down, level and new', () => {
    assert.equal(movementGlyph({ delta: 2, isNew: false }).arrow, '▲')
    assert.equal(movementGlyph({ delta: -2, isNew: false }).arrow, '▼')
    assert.equal(movementGlyph({ delta: 0, isNew: false }).arrow, '–')
    assert.equal(movementGlyph({ isNew: true }).text, 'NEW')
  })
})

describe('everyone\'s picks for the recap', () => {
  const games = [
    { id: 'late',  sport: 'nfl',     home_team: 'Kansas City Chiefs', away_team: 'Denver Broncos',
      spread: -3.5, home_score: 27, away_score: 20, result: 'home_covers',
      kickoff_time: '2026-10-11T20:25:00Z' },
    { id: 'early', sport: 'college', home_team: 'Toledo Rockets', away_team: 'Ohio Bobcats',
      spread: -3.5, home_score: 24, away_score: 21, result: 'push',
      kickoff_time: '2026-10-10T16:00:00Z' },
    { id: 'unplayed', sport: 'nfl', home_team: 'Miami Dolphins', away_team: 'Buffalo Bills',
      spread: 6.5, home_score: null, away_score: null, result: null,
      kickoff_time: '2026-10-12T00:15:00Z' },
  ]
  const table = [{ userId: 'u1', name: 'Dana', points: 1.5 }]

  test('a pick reads from the picker\'s side, not the home team\'s', () => {
    const picks = [{ user_id: 'u1', game_id: 'late', picked_team: 'away', outcome: 'loss' }]
    const [card] = pickCards(table, games, picks)
    const p = card.picks[0]

    assert.equal(p.team, 'Denver Broncos')
    assert.equal(p.opponent, 'Kansas City Chiefs')
    assert.equal(p.atHome, false)
    // Home was -3.5, so taking the away side is +3.5.
    assert.equal(p.spread, 3.5)
    // Their 20 first, not the home team's 27.
    assert.equal(p.scoreFor, 20)
    assert.equal(p.scoreAgainst, 27)
  })

  test('each pick carries what it paid', () => {
    const picks = [
      { user_id: 'u1', game_id: 'late',  picked_team: 'home', outcome: 'win' },
      { user_id: 'u1', game_id: 'early', picked_team: 'home', outcome: 'push' },
    ]
    const [card] = pickCards(table, games, picks)
    const paid = Object.fromEntries(card.picks.map((p) => [p.outcome, p.points]))
    assert.deepEqual(paid, { win: 1, push: 0.5 })
  })

  test('a loss is zero, but a game not yet graded is not', () => {
    const picks = [
      { user_id: 'u1', game_id: 'late',     picked_team: 'away', outcome: 'loss' },
      { user_id: 'u1', game_id: 'unplayed', picked_team: 'home', outcome: null },
    ]
    const [card] = pickCards(table, games, picks)
    const byGame = Object.fromEntries(card.picks.map((p) => [p.team, p.points]))

    assert.equal(byGame['Denver Broncos'], 0, 'a loss really is zero')
    assert.equal(byGame['Miami Dolphins'], null, 'pending is not a zero')
  })

  test('picks are listed in the order the games kicked off', () => {
    const picks = [
      { user_id: 'u1', game_id: 'late',  picked_team: 'home', outcome: 'win' },
      { user_id: 'u1', game_id: 'early', picked_team: 'home', outcome: 'push' },
    ]
    const [card] = pickCards(table, games, picks)
    assert.deepEqual(card.picks.map((p) => p.sport), ['college', 'nfl'])
  })

  test('only the player\'s own picks, and only on real games', () => {
    const picks = [
      { user_id: 'u1', game_id: 'late',    picked_team: 'home', outcome: 'win' },
      { user_id: 'u2', game_id: 'late',    picked_team: 'away', outcome: 'loss' },
      { user_id: 'u1', game_id: 'deleted', picked_team: 'home', outcome: 'win' },
    ]
    const [card] = pickCards(table, games, picks)
    assert.equal(card.picks.length, 1)
  })

  test('a player who never submitted still gets a card', () => {
    const [card] = pickCards(table, games, [])
    assert.equal(card.name, 'Dana')
    assert.deepEqual(card.picks, [])
  })
})
