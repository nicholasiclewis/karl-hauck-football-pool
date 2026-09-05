/**
 * Which picks carry an "entered after kickoff" receipt.
 *
 * Run with:  node --test tests/
 *
 * The rule has to be exact in both directions. A missed late entry defeats the
 * point; a false one accuses somebody of something they did not do, which is
 * worse. The silences matter as much as the flags, so each is pinned here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { lateEntry } from '../src/lib/pickAudit.js'

const KICKOFF = '2026-09-13T17:00:00Z'
const game = { kickoff_time: KICKOFF }

const BEFORE = '2026-09-13T16:30:00Z'
const AFTER  = '2026-09-13T18:30:00Z'

const DAN = 'user-dan'
const KARL = 'user-karl'

/** A pick on Dan's slate, entered by whoever and whenever. */
const pick = (over = {}) => ({
  user_id: DAN,
  entered_by: KARL,
  entered_at: AFTER,
  entered_by_user: { display_name: 'Karl Hauck' },
  ...over,
})

describe('lateEntry', () => {
  test('someone else entering it after kickoff is reported, and named', () => {
    const found = lateEntry(pick(), game)
    assert.ok(found, 'this is the case the whole feature exists for')
    assert.equal(found.by, 'Karl Hauck')
    assert.equal(found.at, AFTER)
  })

  test('the player entering their own is ordinary, whenever they did it', () => {
    for (const at of [BEFORE, AFTER]) {
      assert.equal(lateEntry(pick({ entered_by: DAN, entered_at: at }), game), null)
    }
  })

  test('someone else entering it before kickoff is the tab doing its job', () => {
    assert.equal(lateEntry(pick({ entered_at: BEFORE }), game), null)
  })

  test('a pick entered exactly at kickoff is not late', () => {
    assert.equal(lateEntry(pick({ entered_at: KICKOFF }), game), null)
  })

  test('a pick from before the audit columns says nothing, rather than clean', () => {
    assert.equal(lateEntry(pick({ entered_by: null, entered_at: null }), game), null)
    assert.equal(lateEntry(pick({ entered_by: undefined }), game), null)
  })

  test('an unstamped entered_at cannot imply a time', () => {
    assert.equal(lateEntry(pick({ entered_at: null }), game), null)
  })

  test('no game, no kickoff to measure against, so no claim', () => {
    assert.equal(lateEntry(pick(), null), null)
    assert.equal(lateEntry(pick(), { kickoff_time: null }), null)
  })

  test('a missing pick is not an accusation', () => {
    assert.equal(lateEntry(null, game), null)
    assert.equal(lateEntry(undefined, game), null)
  })

  test('the receipt survives a name that failed to load', () => {
    for (const who of [undefined, null, { display_name: '' }, { display_name: '   ' }]) {
      const found = lateEntry(pick({ entered_by_user: who }), game)
      assert.ok(found, 'a missing name must not erase the fact')
      assert.equal(found.by, 'another player')
    }
  })
})
