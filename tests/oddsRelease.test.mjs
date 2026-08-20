/**
 * When odds post.
 *
 * Run with:  node --test tests/
 *
 * The week still starts Tuesday; the lines post Wednesday morning. The whole
 * risk in that split is a game kicking off before its own odds are up — a
 * Tuesday-night MAC game, or one of the Tuesday NFL games the league now
 * schedules — so that is what these cover.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  releaseDate,
  releaseDateFor,
  releaseInstant,
  isMacWeek,
  sportsReleasedBy,
  TUESDAY,
  WEDNESDAY,
} from '../src/lib/oddsRelease.js'

// Week 2 of 2026: Tuesday Sept 8 through Monday Sept 14.
const WEEK_START = '2026-09-08'
const TUE = '2026-09-08'
const WED = '2026-09-09'

const week = (over = {}) => ({
  week_start: WEEK_START,
  container_type: 'nfl_college',
  conference: null,
  ...over,
})

/** An Eastern wall-clock kickoff. September is EDT. */
const et = (local) => {
  const [date, time] = local.split(' ')
  return new Date(`${date}T${time}:00-04:00`).toISOString()
}

describe('the default', () => {
  test('both sports post Wednesday morning', () => {
    assert.equal(releaseDateFor('nfl', week()), WED)
    assert.equal(releaseDateFor('college', week()), WED)
  })

  test('9am Eastern, not midnight UTC', () => {
    assert.equal(releaseInstant(WEEK_START, WEDNESDAY).toISOString(), '2026-09-09T13:00:00.000Z')
  })

  test('the week itself still starts Tuesday', () => {
    assert.equal(releaseDate(WEEK_START, TUESDAY), TUE)
  })
})

describe('MAC weeks', () => {
  test('college posts Tuesday, because MACtion plays Tuesday night', () => {
    assert.equal(releaseDateFor('college', week({ conference: 'MAC' })), TUE)
  })

  test('NFL is unaffected by the college conference', () => {
    assert.equal(releaseDateFor('nfl', week({ conference: 'MAC' })), WED)
  })

  test('the conference check is not fussy about spelling', () => {
    assert.equal(isMacWeek({ conference: 'mac' }), true)
    assert.equal(isMacWeek({ conference: ' MAC ' }), true)
    assert.equal(isMacWeek({ conference: 'Mountain West' }), false)
    assert.equal(isMacWeek({}), false)
  })

  test('a MAC week posts Tuesday even with no schedule to check', () => {
    // The kickoff lookup can fail; the conference alone has to be enough.
    assert.equal(releaseDateFor('college', week({ conference: 'MAC' }), []), TUE)
  })
})

describe('Tuesday NFL games', () => {
  test('a Tuesday night kickoff pulls the NFL release forward', () => {
    const kickoffs = [et('2026-09-08 20:15'), et('2026-09-13 13:00')]
    assert.equal(releaseDateFor('nfl', week(), kickoffs), TUE)
  })

  test('a normal week with a Thursday opener still waits for Wednesday', () => {
    const kickoffs = [et('2026-09-10 20:15'), et('2026-09-13 13:00')]
    assert.equal(releaseDateFor('nfl', week(), kickoffs), WED)
  })

  test('the line is the release itself, not the calendar day', () => {
    // A game at 8am Wednesday would kick off before the 9am post.
    assert.equal(releaseDateFor('nfl', week(), [et('2026-09-09 08:00')]), TUE)
    assert.equal(releaseDateFor('nfl', week(), [et('2026-09-09 10:00')]), WED)
  })

  test('the same safety net covers a non-MAC college game on Tuesday', () => {
    assert.equal(releaseDateFor('college', week({ conference: 'Sun Belt' }), [et('2026-09-08 19:00')]), TUE)
  })
})

describe('what a scheduled run imports', () => {
  const sports = ['nfl', 'college']

  test('a plain week: nothing Tuesday, everything Wednesday', () => {
    assert.deepEqual(sportsReleasedBy(TUE, sports, week()), [])
    assert.deepEqual(sportsReleasedBy(WED, sports, week()), ['nfl', 'college'])
  })

  test('a MAC week: college Tuesday, NFL joins it Wednesday', () => {
    const mac = week({ conference: 'MAC' })
    assert.deepEqual(sportsReleasedBy(TUE, sports, mac), ['college'])
    assert.deepEqual(sportsReleasedBy(WED, sports, mac), ['nfl', 'college'])
  })

  test('a Tuesday NFL game: NFL Tuesday, college still Wednesday', () => {
    const kickoffs = { nfl: [et('2026-09-08 20:15')], college: [et('2026-09-12 12:00')] }
    assert.deepEqual(sportsReleasedBy(TUE, sports, week(), kickoffs), ['nfl'])
    assert.deepEqual(sportsReleasedBy(WED, sports, week(), kickoffs), ['nfl', 'college'])
  })

  test('Wednesday still covers a sport whose Tuesday run never happened', () => {
    // Release day is the earliest it may post, not the only day it may post —
    // otherwise a missed Tuesday would leave the week half open all week.
    const mac = week({ conference: 'MAC' })
    assert.ok(sportsReleasedBy(WED, sports, mac).includes('college'))
    assert.ok(sportsReleasedBy('2026-09-11', sports, mac).includes('college'))
  })
})
