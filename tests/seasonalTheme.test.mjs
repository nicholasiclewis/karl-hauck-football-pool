/**
 * When the seasonal theme is on.
 *
 * Run with:  node --test tests/
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { activeTheme } from '../src/lib/seasonalTheme.js'

describe('activeTheme', () => {
  test('Halloween runs from Thursday 29 October', () => {
    assert.equal(activeTheme(new Date(2026, 9, 28, 23, 59)), null)
    assert.equal(activeTheme(new Date(2026, 9, 29, 0, 0)), 'halloween')
    assert.equal(activeTheme(new Date(2026, 9, 31, 20, 0)), 'halloween')
  })

  test('and is gone by Tuesday 3 November', () => {
    assert.equal(activeTheme(new Date(2026, 10, 2, 23, 59)), 'halloween')
    assert.equal(activeTheme(new Date(2026, 10, 3, 0, 0)), null)
    assert.equal(activeTheme(new Date(2026, 10, 10)), null)
  })

  test('Thanksgiving week runs Monday 23 Nov through Monday night football', () => {
    assert.equal(activeTheme(new Date(2026, 10, 22, 23, 59)), null)
    assert.equal(activeTheme(new Date(2026, 10, 23, 0, 0)), 'thanksgiving')
    assert.equal(activeTheme(new Date(2026, 10, 26, 16, 30)), 'thanksgiving')
    assert.equal(activeTheme(new Date(2026, 10, 30, 23, 59)), 'thanksgiving')
    assert.equal(activeTheme(new Date(2026, 11, 1, 0, 0)), null)
  })

  test("Karl's tribute is 7 December only", () => {
    assert.equal(activeTheme(new Date(2026, 11, 6, 23, 59)), null)
    assert.equal(activeTheme(new Date(2026, 11, 7, 0, 0)), 'karl')
    assert.equal(activeTheme(new Date(2026, 11, 7, 23, 59)), 'karl')
    assert.equal(activeTheme(new Date(2026, 11, 8, 0, 0)), null)
  })

  test('Christmas week hands straight over to New Year', () => {
    assert.equal(activeTheme(new Date(2026, 11, 20, 23, 59)), null)
    assert.equal(activeTheme(new Date(2026, 11, 21, 0, 0)), 'christmas')
    assert.equal(activeTheme(new Date(2026, 11, 25, 9, 0)), 'christmas')
    assert.equal(activeTheme(new Date(2026, 11, 28, 23, 59)), 'christmas')
    assert.equal(activeTheme(new Date(2026, 11, 29, 0, 0)), 'newyear')
  })

  test('New Year runs through the last weekend and is gone on 5 January', () => {
    assert.equal(activeTheme(new Date(2026, 11, 31, 23, 59)), 'newyear')
    assert.equal(activeTheme(new Date(2027, 0, 4, 23, 59)), 'newyear')
    assert.equal(activeTheme(new Date(2027, 0, 5, 0, 0)), null)
  })
})
