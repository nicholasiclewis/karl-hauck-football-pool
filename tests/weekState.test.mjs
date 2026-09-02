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

import { isRunning, shouldOpen, shouldClose } from '../src/lib/weekState.js'

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
