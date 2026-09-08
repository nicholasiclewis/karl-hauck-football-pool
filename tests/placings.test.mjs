/**
 * Positions when players are level.
 *
 * Run with:  node --test tests/
 *
 * The pool has no tiebreaker until the final week, so the thing being pinned
 * here is that the table never invents one.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { assignRanks } from '../src/lib/placings.js'

/** A standings table, best first, named by points. */
const table = (...points) =>
  points.map((total_points, i) => ({ user_id: `u${i}`, total_points }))

const ranks = (...points) => assignRanks(table(...points)).map((r) => r.rank)
const tied  = (...points) => assignRanks(table(...points)).map((r) => r.tied)

describe('assignRanks', () => {
  test('no ties is just the order', () => {
    assert.deepEqual(ranks(30, 24.5, 19, 12), [1, 2, 3, 4])
  })

  test('level players share the position, and the next one skips', () => {
    assert.deepEqual(ranks(30, 24.5, 24.5, 19), [1, 2, 2, 4])
  })

  test('a tie at the top is two firsts, and the next is third', () => {
    assert.deepEqual(ranks(30, 30, 19), [1, 1, 3])
  })

  test('three level players take up three positions between them', () => {
    assert.deepEqual(ranks(30, 24.5, 24.5, 24.5, 19), [1, 2, 2, 2, 5])
  })

  test('everybody level is everybody first', () => {
    assert.deepEqual(ranks(12, 12, 12, 12), [1, 1, 1, 1])
  })

  test('separate ties do not run into each other', () => {
    assert.deepEqual(ranks(30, 30, 24.5, 24.5, 19), [1, 1, 3, 3, 5])
  })

  test('half points compare exactly', () => {
    assert.deepEqual(ranks(19.5, 19.5, 19), [1, 1, 3])
  })

  test('tied marks everyone sharing a position, and nobody who is not', () => {
    assert.deepEqual(tied(30, 24.5, 24.5, 19), [false, true, true, false])
    assert.deepEqual(tied(30, 24.5, 19), [false, false, false])
  })

  test('a lone player is first, and not tied with themselves', () => {
    assert.deepEqual(ranks(30), [1])
    assert.deepEqual(tied(30), [false])
  })

  test('zeroes tie like any other score', () => {
    assert.deepEqual(ranks(0, 0), [1, 1])
  })

  test('an empty table is an empty table', () => {
    assert.deepEqual(assignRanks([]), [])
    assert.deepEqual(assignRanks(null), [])
  })

  test('the original rows are not mutated', () => {
    const rows = table(30, 30)
    const out = assignRanks(rows)
    assert.equal(rows[0].rank, undefined, 'the caller keeps its own objects')
    assert.equal(out[0].rank, 1)
  })

  test('a different score accessor works, for tables shaped otherwise', () => {
    const out = assignRanks(
      [{ points: 9 }, { points: 9 }, { points: 4 }],
      (r) => r.points
    )
    assert.deepEqual(out.map((r) => r.rank), [1, 1, 3])
  })
})
