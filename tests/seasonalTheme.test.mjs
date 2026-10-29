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
})
