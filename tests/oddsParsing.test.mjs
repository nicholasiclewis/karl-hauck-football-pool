/**
 * Reading a spread out of an Odds API event.
 *
 * Run with:  node --test tests/
 *
 * This is where a week could lose games without saying so. The old reader
 * looked at bookmakers[0] and gave up if that one book had no spreads market,
 * so a game every other book had priced was dropped — and since college prices
 * later than NFL, an entire sport could vanish from a week with nothing logged
 * but a shortfall count nobody reads.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { homeSpreadFrom } from '../api/sync-week-odds.js'

const HOME = 'Philadelphia Eagles'
const AWAY = 'Dallas Cowboys'

/** A bookmaker carrying whatever markets it is given. */
const book = (...markets) => ({ key: 'b', markets })
const spreads = (homePoint) => ({
  key: 'spreads',
  outcomes: [
    { name: HOME, point: homePoint },
    { name: AWAY, point: -homePoint },
  ],
})
const totals = () => ({ key: 'totals', outcomes: [{ name: 'Over', point: 44.5 }] })

const event = (...bookmakers) => ({ home_team: HOME, away_team: AWAY, bookmakers })

describe('homeSpreadFrom', () => {
  test('reads the home number from a book that has one', () => {
    assert.equal(homeSpreadFrom(event(book(spreads(-3.5)))), -3.5)
  })

  test('an away favorite comes back positive, as the column expects', () => {
    assert.equal(homeSpreadFrom(event(book(spreads(6.5)))), 6.5)
  })

  test('falls through to a later book when the first has no spreads market', () => {
    const e = event(book(totals()), book(spreads(-7)))
    assert.equal(homeSpreadFrom(e), -7, 'the bug: this used to be dropped entirely')
  })

  test('falls through when the first book has spreads but not this game', () => {
    const stale = { key: 'spreads', outcomes: [{ name: 'Chicago Bears', point: -1 }] }
    assert.equal(homeSpreadFrom(event(book(stale), book(spreads(-2.5)))), -2.5)
  })

  test('a pick’em is a real line, not a missing one', () => {
    assert.equal(homeSpreadFrom(event(book(spreads(0)))), 0)
  })

  test('no book with a line yet is null, so the game goes up without one', () => {
    assert.equal(homeSpreadFrom(event()), null)
    assert.equal(homeSpreadFrom(event(book(totals()))), null)
    assert.equal(homeSpreadFrom({ home_team: HOME }), null)
  })

  test('a null point is no line, not a zero', () => {
    const e = event(book({ key: 'spreads', outcomes: [{ name: HOME, point: null }] }))
    assert.equal(homeSpreadFrom(e), null)
  })
})
