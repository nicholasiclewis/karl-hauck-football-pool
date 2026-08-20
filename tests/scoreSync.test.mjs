/**
 * Score sync: which games get looked up, and when a week closes.
 *
 * Run with:  node --test tests/
 *
 * The pool wanted scores to land at the end of each game rather than in a
 * couple of batches a day. That works by watching a game from kickoff until it
 * has a score and letting the scoreboard say when it is finished — so what
 * these check is that a game is watched exactly that long, and that a week
 * does not close over the top of a game still being played.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  watchedGames,
  nflKeysForKickoff,
  scoreKeysFor,
  weekSyncPlan,
  isScored,
} from '../src/lib/scoreSync.js'
import { weekWindow } from '../src/lib/weekWindow.js'

/** '2026-09-13 13:00' in Eastern -> the matching UTC instant. */
function et(local) {
  const [date, time] = local.split(' ')
  // Every fixture here sits in September, which is EDT (UTC-4).
  return new Date(`${date}T${time}:00-04:00`)
}

let seq = 0
const game = (etIso, over = {}) => ({
  id: `g${++seq}`,
  week_id: 'w1',
  sport: 'nfl',
  home_team: 'Home Team',
  away_team: 'Away Team',
  kickoff_time: et(etIso),
  home_score: null,
  away_score: null,
  ...over,
})

const scored = (etIso, over = {}) => game(etIso, { home_score: 24, away_score: 20, ...over })

describe('what a tick looks up', () => {
  test('nothing before kickoff', () => {
    const games = [game('2026-09-13 13:00')]
    assert.equal(watchedGames(games, { now: et('2026-09-13 12:59') }).length, 0)
  })

  test('the game itself, from kickoff on', () => {
    const games = [game('2026-09-13 13:00')]
    assert.equal(watchedGames(games, { now: et('2026-09-13 13:00') }).length, 1)
    assert.equal(watchedGames(games, { now: et('2026-09-13 15:30') }).length, 1)
  })

  test('and stops the moment it has a score', () => {
    const games = [scored('2026-09-13 13:00')]
    assert.equal(watchedGames(games, { now: et('2026-09-13 17:00') }).length, 0)
  })

  test('a game still unresolved the next morning is still watched', () => {
    // A lightning delay can suspend a college game overnight. Anything that
    // gives up after a fixed number of hours loses that game for good.
    const games = [game('2026-09-12 19:00', { sport: 'college' })]
    assert.equal(watchedGames(games, { now: et('2026-09-13 11:00') }).length, 1)
  })

  test('an ordinary Tuesday has nothing to look up at all', () => {
    const games = [game('2026-09-13 13:00'), game('2026-09-14 20:15')]
    assert.deepEqual(watchedGames(games, { now: et('2026-09-08 09:00') }), [])
  })
})

describe('scores land at the end of the game', () => {
  /**
   * Replay a day of 15-minute ticks against a scoreboard that reports a game
   * finished at `endsAt` — which is what ESPN's completed flag amounts to.
   */
  function replay(games, { endings, from, to }) {
    const state = games.map((g) => ({ ...g }))
    const wrote = new Map()

    for (let t = et(from).getTime(); t <= et(to).getTime(); t += 15 * 60 * 1000) {
      for (const g of watchedGames(state, { now: new Date(t) })) {
        const endsAt = et(endings[g.id]).getTime()
        if (t < endsAt) continue                 // still playing: no final yet
        Object.assign(g, { home_score: 24, away_score: 20 })
        wrote.set(g.id, new Date(t))
      }
    }

    return { wrote, state }
  }

  test('within fifteen minutes of the whistle, not hours later', () => {
    const g = game('2026-09-13 13:00')
    const { wrote } = replay([g], {
      endings: { [g.id]: '2026-09-13 16:12' },
      from: '2026-09-13 12:00',
      to: '2026-09-13 23:00',
    })
    assert.equal(wrote.get(g.id).toISOString(), et('2026-09-13 16:15').toISOString())
  })

  test('a game that runs long is picked up when it actually ends', () => {
    // Double overtime. A four-hour rule would have asked at 17:00 and found
    // nothing, then waited for the next batch.
    const g = game('2026-09-13 13:00')
    const { wrote } = replay([g], {
      endings: { [g.id]: '2026-09-13 17:20' },
      from: '2026-09-13 12:00',
      to: '2026-09-13 23:00',
    })
    assert.equal(wrote.get(g.id).toISOString(), et('2026-09-13 17:30').toISOString())
  })

  test('a game called early for weather is picked up early', () => {
    const g = game('2026-09-13 13:00')
    const { wrote } = replay([g], {
      endings: { [g.id]: '2026-09-13 14:30' },
      from: '2026-09-13 12:00',
      to: '2026-09-13 23:00',
    })
    assert.equal(wrote.get(g.id).toISOString(), et('2026-09-13 14:30').toISOString())
  })

  test('a full Sunday settles game by game as each one ends', () => {
    const early = Array.from({ length: 9 }, () => game('2026-09-13 13:00'))
    const late = Array.from({ length: 4 }, () => game('2026-09-13 16:25'))
    const night = game('2026-09-13 20:20')
    const all = [...early, ...late, night]

    const endings = {}
    for (const g of early) endings[g.id] = '2026-09-13 16:10'
    for (const g of late) endings[g.id] = '2026-09-13 19:35'
    endings[night.id] = '2026-09-13 23:40'

    const { wrote, state } = replay(all, {
      endings,
      from: '2026-09-13 12:00',
      to: '2026-09-14 06:00',
    })

    assert.ok(state.every(isScored), 'every game ends the night with a score')
    assert.equal(wrote.get(early[0].id).toISOString(), et('2026-09-13 16:15').toISOString())
    assert.equal(wrote.get(late[0].id).toISOString(), et('2026-09-13 19:45').toISOString())
    assert.equal(wrote.get(night.id).toISOString(), et('2026-09-13 23:45').toISOString())
  })
})

describe('which feeds the paid fallback would need', () => {
  test('only the sports actually being watched', () => {
    assert.deepEqual(scoreKeysFor([game('2026-10-11 13:00')]), ['americanfootball_nfl'])
    assert.deepEqual(
      scoreKeysFor([game('2026-10-10 13:00', { sport: 'college' })]),
      ['americanfootball_ncaaf']
    )
  })

  test('August also asks the preseason key, September does not', () => {
    assert.equal(nflKeysForKickoff(new Date('2026-08-15T23:00:00Z')).length, 2)
    assert.deepEqual(nflKeysForKickoff(new Date('2026-10-11T17:00:00Z')), ['americanfootball_nfl'])
  })

  test('a late-August night game is preseason, not September', () => {
    // 9pm Eastern on August 31 is already September 1 in UTC.
    assert.equal(nflKeysForKickoff(new Date('2026-09-01T01:00:00Z')).length, 2)
  })
})

describe('closing the books on a week', () => {
  const week = { id: 'w1', week_number: 3, week_start: '2026-09-08' }
  const window = weekWindow(week.week_start)
  const plan = (games, nowEt) =>
    weekSyncPlan({ week, games, window, now: et(nowEt) })

  test('stays open while the window is still running', () => {
    const p = plan([scored('2026-09-13 13:00')], '2026-09-13 18:00')
    assert.equal(p.ended, false)
    assert.equal(p.closeReady, false)
  })

  test('closes once the window is over and every game is in', () => {
    const p = plan([scored('2026-09-13 13:00'), scored('2026-09-14 20:15')], '2026-09-15 02:00')
    assert.equal(p.closeReady, true)
  })

  test('does not close at midnight over a Monday night game still playing', () => {
    // The window ends Monday 23:59; the game kicked off at 20:15 and is not
    // final yet. Closing on the calendar would bury it.
    const p = plan([scored('2026-09-13 13:00'), game('2026-09-14 20:15')], '2026-09-15 00:30')
    assert.equal(p.ended, true)
    assert.equal(p.closeReady, false)
    assert.equal(p.watching.length, 1, 'and it is still being watched')
  })

  test('closes anyway once a score is clearly never coming', () => {
    const p = plan([scored('2026-09-13 13:00'), game('2026-09-14 20:15')], '2026-09-15 09:00')
    assert.equal(p.closeReady, true)
    assert.equal(p.unscored.length, 1, 'and says which game it gave up on')
  })

  test('a week nobody ever filled in closes when its window ends', () => {
    const p = plan([], '2026-09-15 09:00')
    assert.equal(p.closeReady, true)
  })
})
