/**
 * What a week's college half is called.
 *
 * Run with:  node --test tests/
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { collegeFocusLabel, focusName } from '../src/lib/weekLabels.js'

describe('collegeFocusLabel', () => {
  test('a conference week is called by its conference', () => {
    assert.equal(
      collegeFocusLabel({ college_focus: 'group5', conference: 'Pac-12' }),
      'Pac-12',
      'the bug: this week was captioned Top 25'
    )
    assert.equal(
      collegeFocusLabel({ college_focus: 'power4', conference: 'Big Ten' }),
      'Big Ten'
    )
  })

  test('without a conference it falls back to the focus name', () => {
    assert.equal(collegeFocusLabel({ college_focus: 'top25' }), 'Top 25')
    assert.equal(collegeFocusLabel({ college_focus: 'cfp' }), 'CFP')
    assert.equal(collegeFocusLabel({ college_focus: 'rivalry' }), 'Rivalry')
  })

  test('a blank conference does not win over the focus', () => {
    assert.equal(collegeFocusLabel({ college_focus: 'top25', conference: '   ' }), 'Top 25')
    assert.equal(collegeFocusLabel({ college_focus: 'top25', conference: null }), 'Top 25')
  })

  test('a week with neither says nothing rather than something wrong', () => {
    assert.equal(collegeFocusLabel({}), '')
    assert.equal(collegeFocusLabel(null), '')
  })

  test('an unknown focus is shown as it is, not swallowed', () => {
    assert.equal(focusName('someNewFocus'), 'someNewFocus')
    assert.equal(focusName(null), '')
  })
})
