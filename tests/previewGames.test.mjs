/**
 * Games on the board before their lines post.
 *
 * Run with:  node --test tests/
 *
 * A week opens on its Tuesday and its odds land Wednesday, so for a day the
 * schedule is known and the numbers are not. These pin the two rules that make
 * showing that safe: a preview game is offered to the eye but not to the pick
 * list, and it can never be graded.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { selectEligible } from '../src/lib/gameSelection.js'
import { resolveGameResult, calculatePickOutcome } from '../src/lib/scoring.js'

const week = { container_type: 'nfl_only' }

const game = (over = {}) => ({
  sport: 'nfl',
  home_team: 'Philadelphia Eagles',
  away_team: 'Dallas Cowboys',
  kickoff_time: '2026-09-13T17:00:00Z',
  spread: -3.5,
  favorite: 'home',
  ...over,
})

describe('selectEligible with games that have no line', () => {
  const mixed = [
    game({ odds_api_id: 'a' }),
    game({ odds_api_id: 'b', spread: null, favorite: null }),
    game({ odds_api_id: 'c', spread: null, favorite: null }),
  ]

  test('the odds import still takes only games that have a line', () => {
    const { eligible } = selectEligible(mixed, week)
    assert.deepEqual(eligible.map((g) => g.odds_api_id), ['a'])
  })

  test('the preview takes them all, because it is choosing what to show', () => {
    const { eligible } = selectEligible(mixed, week, null, { requireSpread: false })
    assert.deepEqual(eligible.map((g) => g.odds_api_id).sort(), ['a', 'b', 'c'])
  })

  test('requiring a spread is the default, so no caller gets it by accident', () => {
    assert.equal(selectEligible(mixed, week).eligible.length, 1)
    assert.equal(selectEligible(mixed, week, null, {}).eligible.length, 1)
  })

  test('a preview still has to be a game the week would offer', () => {
    // A college game in an NFL-only week is not previewable either.
    const { eligible } = selectEligible(
      [game({ odds_api_id: 'x', sport: 'college', spread: null, favorite: null })],
      week,
      null,
      { requireSpread: false }
    )
    assert.deepEqual(eligible, [])
  })

  test('the shortfall count sees previews, so a week reads as filling up', () => {
    const { shortfall } = selectEligible(mixed, week, null, { requireSpread: false })
    assert.equal(shortfall.nfl, 3, 'six needed, three on the board')
  })
})

describe('a game with no line can never be graded', () => {
  const scored = { home_score: 31, away_score: 20 }

  test('a real line still resolves as before', () => {
    assert.equal(resolveGameResult({ ...game(), ...scored }), 'home_covers')
  })

  test('a null spread resolves to nothing, not to a pick’em', () => {
    // Math.abs(null) is 0, so without the guard this would grade as if the
    // line were 0 and hand out points nobody played for.
    assert.equal(
      resolveGameResult({ ...game({ spread: null, favorite: null }), ...scored }),
      null
    )
    assert.equal(
      resolveGameResult({ ...game({ spread: undefined, favorite: undefined }), ...scored }),
      null
    )
  })

  test('a spread with no favorite is not enough either', () => {
    assert.equal(
      resolveGameResult({ ...game({ favorite: null }), ...scored }),
      null
    )
  })

  test('a pick against a lineless game has no outcome', () => {
    assert.equal(
      calculatePickOutcome({ ...game({ spread: null, favorite: null }), ...scored }, 'home'),
      null
    )
  })

  test('an actual pick’em is still a real line and still resolves', () => {
    assert.equal(
      resolveGameResult({ ...game({ spread: 0, favorite: 'home' }), ...scored }),
      'home_covers'
    )
  })
})
