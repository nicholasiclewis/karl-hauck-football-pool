/**
 * When a week is open for picks.
 *
 * Run with:  node --test tests/
 *
 * The rule that matters here is the one that used to be wrong: a week opens on
 * its own Tuesday, not when its odds arrive. Lines post Wednesday in an
 * ordinary week, so gating the open on a full board left every Tuesday showing
 * "No Active Week" while the pool was already running.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { isRunning, shouldOpen, shouldClose, currentWeek } from '../src/lib/weekState.js'

// Week 2 of 2026: Tuesday Sept 8 through Monday Sept 14.
const WEEK_START = '2026-09-08'

const week = (over = {}) => ({
  id: 'w2',
  week_number: 2,
  week_start: WEEK_START,
  picks_open: false,
  is_complete: false,
  ...over,
})

/** An Eastern wall-clock instant. September is EDT. */
const et = (local) => {
  const [date, time] = local.split(' ')
  return new Date(`${date}T${time}:00-04:00`)
}

const TUE_MORNING = et('2026-09-08 07:00')   // the daily state run
const SATURDAY    = et('2026-09-12 15:00')
const NEXT_TUE    = et('2026-09-15 07:00')

describe('is the week running', () => {
  test('the Tuesday it starts, from midnight', () => {
    assert.equal(isRunning(week(), et('2026-09-08 00:00')), true)
    assert.equal(isRunning(week(), TUE_MORNING), true)
  })

  test('through Monday night', () => {
    assert.equal(isRunning(week(), et('2026-09-14 23:59')), true)
    assert.equal(isRunning(week(), NEXT_TUE), false)
  })

  test('not before it starts', () => {
    assert.equal(isRunning(week(), et('2026-09-07 23:59')), false)
  })

  test('a week with no start date is not running', () => {
    assert.equal(isRunning({ week_number: 2 }, TUE_MORNING), false)
    assert.equal(isRunning(null, TUE_MORNING), false)
  })
})

describe('opening', () => {
  test('opens Tuesday morning, with no games on the board', () => {
    // The whole point: odds post Wednesday, and the week is live before them.
    assert.equal(shouldOpen(week(), TUE_MORNING), true)
  })

  test('an already-open week is left alone', () => {
    assert.equal(shouldOpen(week({ picks_open: true }), TUE_MORNING), false)
  })

  test('a completed week is never reopened', () => {
    assert.equal(shouldOpen(week({ is_complete: true }), TUE_MORNING), false)
  })

  test('next week does not go live early', () => {
    // A commissioner importing next week's odds from the dashboard hands that
    // week to the same code path.
    const next = week({ week_number: 3, week_start: '2026-09-15' })
    assert.equal(shouldOpen(next, TUE_MORNING), false)
    assert.equal(shouldOpen(next, NEXT_TUE), true)
  })

  test('last week does not reopen once its window has passed', () => {
    assert.equal(shouldOpen(week(), NEXT_TUE), false)
  })
})

describe('closing', () => {
  const open = week({ picks_open: true })

  test('stays open while a game is still to kick off', () => {
    assert.equal(shouldClose(open, et('2026-09-14 20:15'), SATURDAY), false)
  })

  test('closes once the last kickoff has passed', () => {
    assert.equal(shouldClose(open, et('2026-09-12 12:00'), SATURDAY), true)
  })

  test('an empty week that is still running is waiting on odds, not finished', () => {
    // Tuesday: open, no board yet. Closing this is exactly the bug that would
    // shut the live week the moment any other week was imported.
    assert.equal(shouldClose(open, null, TUE_MORNING), false)
  })

  test('an empty week closes once its window has passed', () => {
    assert.equal(shouldClose(open, null, NEXT_TUE), true)
  })

  test('a closed or completed week is not closed again', () => {
    assert.equal(shouldClose(week(), null, NEXT_TUE), false)
    assert.equal(shouldClose(week({ picks_open: true, is_complete: true }), null, NEXT_TUE), false)
  })

  test('an unreadable kickoff does not close the week', () => {
    assert.equal(shouldClose(open, 'sometime Saturday', SATURDAY), false)
  })
})

describe('a whole Tuesday morning run', () => {
  test('this week opens and last week closes in the same pass', () => {
    const current = week({ week_number: 3, week_start: '2026-09-15' })
    const previous = week({ week_number: 2, picks_open: true })

    assert.equal(shouldOpen(current, NEXT_TUE), true)
    assert.equal(shouldClose(previous, et('2026-09-14 20:15'), NEXT_TUE), true)
  })
})

/**
 * Which week a picker should land on.
 *
 * The season is planned out in full before it starts, so these lists are
 * nineteen rows deep from day one — and the bug this replaces was defaulting
 * to the newest row, which is the last week of the year.
 */
describe('currentWeek', () => {
  // Nineteen weeks, every Tuesday from 2026-09-01. Newest first, the order the
  // screens actually load them in.
  const season = Array.from({ length: 19 }, (_, i) => ({
    id: `w${i + 1}`,
    week_number: i + 1,
    week_start: new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10),
  })).reverse()

  test('lands on the week the calendar is inside, not the last one loaded', () => {
    // 2026-09-08 is the Tuesday week 2 starts.
    assert.equal(currentWeek(season, et('2026-09-08 09:00'))?.week_number, 2)
    assert.equal(currentWeek(season, et('2026-09-12 15:00'))?.week_number, 2)
  })

  test('a Monday night still belongs to the week that began the week before', () => {
    assert.equal(currentWeek(season, et('2026-09-14 22:00'))?.week_number, 2)
  })

  test('the next Tuesday moves it on', () => {
    assert.equal(currentWeek(season, et('2026-09-15 06:00'))?.week_number, 3)
  })

  test('before the season it shows the first week, not the last', () => {
    assert.equal(currentWeek(season, et('2026-08-01 12:00'))?.week_number, 1)
  })

  test('after the season it shows the last week, which by then is the recent one', () => {
    assert.equal(currentWeek(season, et('2027-06-01 12:00'))?.week_number, 19)
  })

  test('a gap in the planned weeks falls back to the most recent one begun', () => {
    const withGap = [
      { id: 'a', week_number: 1, week_start: '2026-09-01' },
      { id: 'c', week_number: 3, week_start: '2026-11-03' },
    ]
    assert.equal(currentWeek(withGap, et('2026-10-06 12:00'))?.week_number, 1)
  })

  test('row order does not decide it', () => {
    const shuffled = [...season].sort(() => 0.5 - Math.random())
    assert.equal(currentWeek(shuffled, et('2026-09-08 09:00'))?.week_number, 2)
  })

  test('no weeks is null, not a crash', () => {
    assert.equal(currentWeek([], TUE_MORNING), null)
    assert.equal(currentWeek(null, TUE_MORNING), null)
    assert.equal(currentWeek([{ id: 'x' }], TUE_MORNING), null)
  })
})
