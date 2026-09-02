/**
 * When odds post.
 *
 * Run with:  node --test tests/
 *
 * The week still starts Tuesday; the lines post Wednesday morning. The whole
 * risk in that split is a midweek game — a Tuesday-night MAC game, one of the
 * Tuesday NFL games the league now schedules, a Wednesday MACtion opener —
 * arriving with no time left to pick it. Those weeks post Tuesday instead, and
 * that is what these cover.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  releaseDate,
  releaseDateFor,
  releaseInstant,
  midweekCutoff,
  hasMidweekGame,
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

describe('midweek games', () => {
  test('a Tuesday night kickoff pulls the release forward', () => {
    const kickoffs = [et('2026-09-08 20:15'), et('2026-09-13 13:00')]
    assert.equal(releaseDateFor('nfl', week(), kickoffs), TUE)
  })

  test('a Wednesday night kickoff does too — clearing the 9am post is not enough', () => {
    // 7pm Wednesday is nine hours after a Wednesday morning release, which is
    // technically in time and useless as a week to pick in.
    assert.equal(releaseDateFor('college', week(), [et('2026-09-09 19:00')]), TUE)
  })

  test('a normal week with a Thursday opener still waits for Wednesday', () => {
    const kickoffs = [et('2026-09-10 20:15'), et('2026-09-13 13:00')]
    assert.equal(releaseDateFor('nfl', week(), kickoffs), WED)
  })

  test('the cutoff is midnight opening Thursday', () => {
    assert.equal(releaseDateFor('nfl', week(), [et('2026-09-09 23:59')]), TUE)
    assert.equal(releaseDateFor('nfl', week(), [et('2026-09-10 00:01')]), WED)
    assert.equal(midweekCutoff(WEEK_START).toISOString(), '2026-09-10T04:00:00.000Z')
  })

  test('hasMidweekGame reads the same window on its own', () => {
    assert.equal(hasMidweekGame(WEEK_START, [et('2026-09-08 20:15')]), true)
    assert.equal(hasMidweekGame(WEEK_START, [et('2026-09-12 12:00')]), false)
    assert.equal(hasMidweekGame(WEEK_START, []), false)
    assert.equal(hasMidweekGame(WEEK_START, ['not a date']), false)
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

  test('a midweek NFL game: NFL Tuesday, college still Wednesday', () => {
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
