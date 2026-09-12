/**
 * Whether a player can still change their slate.
 *
 * Run with:  node --test tests/
 *
 * The case that matters here is the one that used to strand people: a player
 * picks a single midweek game, locks their slate in, and that game kicks off
 * while the other five picks are still to make. Judged on retractable picks
 * alone, that player looks finished — and the unlock button vanished on them.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { canChangePicks } from '../src/lib/gameSelection.js'

const et = (local) => {
  const [date, time] = local.split(' ')
  return new Date(`${date}T${time}:00-04:00`)
}

// Week 2 of 2026: a Wednesday nighter, then the usual weekend board.
const games = [
  { id: 'wed', sport: 'nfl',     kickoff_time: et('2026-09-09 20:15').toISOString() },
  { id: 'sun1', sport: 'nfl',    kickoff_time: et('2026-09-13 13:00').toISOString() },
  { id: 'sun2', sport: 'nfl',    kickoff_time: et('2026-09-13 13:00').toISOString() },
  { id: 'sun3', sport: 'nfl',    kickoff_time: et('2026-09-13 16:25').toISOString() },
  { id: 'sat1', sport: 'college', kickoff_time: et('2026-09-12 12:00').toISOString() },
  { id: 'sat2', sport: 'college', kickoff_time: et('2026-09-12 15:30').toISOString() },
]

const pick = (...ids) => Object.fromEntries(ids.map((id) => [id, { game_id: id }]))

const THURSDAY = et('2026-09-10 09:00')   // the Wednesday game is over
const TUESDAY  = et('2026-09-08 09:00')   // whole board still to come
const LATE     = et('2026-09-14 09:00')   // everything has kicked off

describe('can a player still change their slate', () => {
  test('one midweek pick made, the game played, the rest of the slate open', () => {
    // The bug: this read false, because no pick was retractable any more.
    assert.equal(canChangePicks(games, pick('wed'), 'nfl_college', THURSDAY), true)
  })

  test('nothing picked yet and the board still to come', () => {
    assert.equal(canChangePicks(games, {}, 'nfl_college', TUESDAY), true)
  })

  test('a full slate of games still to come — picks can be swapped', () => {
    const full = pick('sun1', 'sun2', 'sun3', 'sat1', 'sat2')
    assert.equal(canChangePicks(games, full, 'nfl_college', TUESDAY), true)
  })

  test('a full slate, every pick already played, games still on the board', () => {
    // Six midweek picks, all of them over, and Sunday still to come. Nothing
    // is retractable and there is no slot left to spend, so there is genuinely
    // nothing to change — the one case where the lock button rightly goes.
    const midweek = Array.from({ length: 6 }, (_, i) => ({
      id: `mid${i}`, sport: 'nfl', kickoff_time: et('2026-09-09 20:15').toISOString(),
    }))
    const board = [...midweek, games[1]]
    const full  = pick(...midweek.map((g) => g.id))
    assert.equal(canChangePicks(board, full, 'nfl_only', THURSDAY), false)
  })

  test('a full slate whose picks are still to play — they can be swapped', () => {
    const full = pick('sun1', 'sun2', 'sun3', 'wed', 'sat1', 'sat2')
    assert.equal(canChangePicks(games, full, 'nfl_college', THURSDAY), true)
  })

  test('every game has kicked off', () => {
    assert.equal(canChangePicks(games, pick('wed'), 'nfl_college', LATE), false)
  })

  test('no board imported yet', () => {
    assert.equal(canChangePicks([], {}, 'nfl_college', TUESDAY), false)
  })
})
