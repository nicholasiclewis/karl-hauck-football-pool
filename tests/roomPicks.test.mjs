/**
 * Who took which side, game by game.
 *
 * Run with:  node --test tests/
 *
 * This is the view the pool will argue over, so the counts have to be right
 * and nobody may be silently dropped from a side.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { roomPicks } from '../src/lib/roomPicks.js'

const games = [
  { id: 'g1', home_team: 'Philadelphia Eagles', away_team: 'Dallas Cowboys', result: 'home_covers' },
  { id: 'g2', home_team: 'Chicago Bears', away_team: 'Green Bay Packers', result: 'away_covers' },
  { id: 'g3', home_team: 'Miami Dolphins', away_team: 'Buffalo Bills', result: 'push' },
  { id: 'g4', home_team: 'Denver Broncos', away_team: 'Las Vegas Raiders', result: null },
]

const names = { u1: 'Dan Hauck', u2: 'Karl Hauck', u3: 'Pat Hauck' }

const picks = [
  { game_id: 'g1', user_id: 'u2', picked_team: 'home' },
  { game_id: 'g1', user_id: 'u1', picked_team: 'home' },
  { game_id: 'g1', user_id: 'u3', picked_team: 'away' },
  { game_id: 'g2', user_id: 'u1', picked_team: 'away' },
  { game_id: 'g3', user_id: 'u3', picked_team: 'home' },
]

describe('roomPicks', () => {
  const rows = roomPicks(games, picks, names)
  const row = (id) => rows.find((r) => r.game.id === id)

  test('a row per game, in the order the games were given', () => {
    assert.deepEqual(rows.map((r) => r.game.id), ['g1', 'g2', 'g3', 'g4'])
  })

  test('each side lists who took it, alphabetically', () => {
    assert.deepEqual(row('g1').home, ['Dan Hauck', 'Karl Hauck'])
    assert.deepEqual(row('g1').away, ['Pat Hauck'])
  })

  test('the total counts both sides, so nobody is lost between them', () => {
    assert.equal(row('g1').total, 3)
    assert.equal(row('g2').total, 1)
    assert.equal(row('g4').total, 0)
  })

  test('a game nobody picked comes back empty rather than missing', () => {
    assert.deepEqual(row('g4').home, [])
    assert.deepEqual(row('g4').away, [])
  })

  test('which side covered is carried through, push included', () => {
    assert.equal(row('g1').covered, 'home')
    assert.equal(row('g2').covered, 'away')
    assert.equal(row('g3').covered, 'push')
  })

  test('an ungraded game declares nobody right', () => {
    assert.equal(row('g4').covered, null)
  })

  test('a name that did not load still occupies its side', () => {
    const [only] = roomPicks(
      [games[0]],
      [{ game_id: 'g1', user_id: 'ghost', picked_team: 'home' }],
      names
    )
    assert.deepEqual(only.home, ['Unknown player'])
    assert.equal(only.total, 1, 'the split must not understate the room')
  })

  test('a Map of names works as well as an object', () => {
    const [only] = roomPicks([games[0]], picks, new Map(Object.entries(names)))
    assert.deepEqual(only.home, ['Dan Hauck', 'Karl Hauck'])
  })

  test('empty inputs are answers, not crashes', () => {
    assert.deepEqual(roomPicks([], picks, names), [])
    assert.deepEqual(roomPicks(null, null, null), [])
    assert.equal(roomPicks(games, null, names)[0].total, 0)
  })
})
