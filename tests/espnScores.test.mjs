/**
 * Reading finals off ESPN's scoreboard.
 *
 * Run with:  node --test tests/
 *
 * Two things here can quietly ruin a week. Grading a game that is still being
 * played — ESPN reports a score at halftime the same way it reports one at the
 * end — and failing to match a team because the two sources spell it
 * differently, which leaves a game unscored with nobody looking. Both get
 * their own cases below.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  espnDate,
  fetchFinals,
  findFinal,
  indexFinals,
  parseScoreboard,
  scoreboardUrl,
  teamKey,
} from '../src/lib/espnScores.js'

/** One scoreboard entry, shaped the way ESPN sends it. */
const event = ({ home, away, homeScore, awayScore, completed = true, id = '1' }) => ({
  id,
  date: '2026-09-12T16:00Z',
  competitions: [{
    status: { type: { completed, state: completed ? 'post' : 'in' } },
    competitors: [
      { homeAway: 'home', score: String(homeScore), team: { displayName: home, location: home.split(' ').slice(0, -1).join(' ') } },
      { homeAway: 'away', score: String(awayScore), team: { displayName: away, location: away.split(' ').slice(0, -1).join(' ') } },
    ],
  }],
})

const board = (...events) => ({ events })

describe('only finished games count', () => {
  test('a completed game comes through with its score', () => {
    const finals = parseScoreboard(
      board(event({ home: 'Toledo Rockets', away: 'Ohio Bobcats', homeScore: 31, awayScore: 24 })),
      'college'
    )
    assert.equal(finals.length, 1)
    assert.deepEqual(
      [finals[0].home_team, finals[0].home_score, finals[0].away_score],
      ['Toledo Rockets', 31, 24]
    )
  })

  test('a game in progress is ignored, score and all', () => {
    // This is the case that would grade everyone's picks off a halftime score.
    const finals = parseScoreboard(
      board(event({ home: 'Toledo Rockets', away: 'Ohio Bobcats', homeScore: 14, awayScore: 7, completed: false })),
      'college'
    )
    assert.deepEqual(finals, [])
  })

  test('an empty or malformed board yields nothing rather than throwing', () => {
    assert.deepEqual(parseScoreboard(null, 'nfl'), [])
    assert.deepEqual(parseScoreboard({ events: [{}] }, 'nfl'), [])
  })
})

describe('matching our rows to ESPN teams', () => {
  test('NFL names are identical in both feeds', () => {
    const index = indexFinals(parseScoreboard(
      board(event({ home: 'Kansas City Chiefs', away: 'Denver Broncos', homeScore: 27, awayScore: 20 })),
      'nfl'
    ))
    const found = findFinal(
      { sport: 'nfl', home_team: 'Kansas City Chiefs', away_team: 'Denver Broncos' },
      index
    )
    assert.equal(found?.home_score, 27)
  })

  test('college matches across the two spellings of a name', () => {
    // Our rows come from the Odds API ("Miami (OH) Redhawks"); ESPN says
    // "Miami (Ohio) RedHawks". conferences.js already knows both.
    const index = indexFinals(parseScoreboard(
      board(event({ home: 'Miami (Ohio) RedHawks', away: 'Ball State Cardinals', homeScore: 17, awayScore: 10 })),
      'college'
    ))
    const found = findFinal(
      { sport: 'college', home_team: 'Miami (OH) Redhawks', away_team: 'Ball State Cardinals' },
      index
    )
    assert.equal(found?.home_score, 17)
  })

  test('punctuation and diacritics do not break a match', () => {
    assert.equal(teamKey("Hawai'i Rainbow Warriors", 'college'), teamKey('Hawaii Rainbow Warriors', 'college'))
    assert.equal(teamKey('San José State Spartans', 'college'), teamKey('San Jose State Spartans', 'college'))
  })

  test('home and away are not interchangeable', () => {
    // Reading a final backwards would flip the result of every pick on it.
    const index = indexFinals(parseScoreboard(
      board(event({ home: 'Toledo Rockets', away: 'Ohio Bobcats', homeScore: 31, awayScore: 24 })),
      'college'
    ))
    const flipped = findFinal(
      { sport: 'college', home_team: 'Ohio Bobcats', away_team: 'Toledo Rockets' },
      index
    )
    assert.equal(flipped, null)
  })

  test('a sport mismatch never matches', () => {
    const index = indexFinals(parseScoreboard(
      board(event({ home: 'Toledo Rockets', away: 'Ohio Bobcats', homeScore: 31, awayScore: 24 })),
      'college'
    ))
    assert.equal(
      findFinal({ sport: 'nfl', home_team: 'Toledo Rockets', away_team: 'Ohio Bobcats' }, index),
      null
    )
  })
})

describe('which boards get asked', () => {
  test('the day is the Eastern day the game kicked off', () => {
    // 8:15pm Eastern Sunday is Monday in UTC; asking ESPN for Monday would
    // miss the game entirely.
    assert.equal(espnDate(new Date('2026-09-14T00:15:00Z')), '20260913')
  })

  test('college asks for FBS and a page big enough for a Saturday', () => {
    const url = scoreboardUrl('college', '20260912')
    assert.match(url, /college-football/)
    assert.match(url, /groups=80/)
    assert.match(url, /limit=400/)
  })

  test('one request per sport per day, however many games', () => {
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => board() }
    }
    const games = [
      { sport: 'nfl', kickoff_time: new Date('2026-09-13T17:00:00Z') },
      { sport: 'nfl', kickoff_time: new Date('2026-09-13T20:25:00Z') },
      { sport: 'nfl', kickoff_time: new Date('2026-09-15T00:15:00Z') },
    ]
    return fetchFinals(games, { fetchImpl }).then(() => {
      assert.equal(calls.length, 2, 'two days of NFL games, two requests')
    })
  })

  test('one dead request does not stop the other day resolving', () => {
    const fetchImpl = async (url) => url.includes('20260913')
      ? { ok: false, status: 503, json: async () => ({}) }
      : {
          ok: true,
          status: 200,
          json: async () => board(event({
            home: 'Kansas City Chiefs', away: 'Denver Broncos', homeScore: 27, awayScore: 20,
          })),
        }

    const games = [
      { sport: 'nfl', kickoff_time: new Date('2026-09-13T17:00:00Z') },
      { sport: 'nfl', kickoff_time: new Date('2026-09-15T00:15:00Z') },
    ]
    return fetchFinals(games, { fetchImpl }).then((out) => {
      assert.equal(out.ok, true, 'a partial answer is still an answer')
      assert.equal(out.finals.length, 1)
      assert.equal(out.failures.length, 1)
    })
  })

  test('every request failing is what sends the sync to the paid fallback', () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) })
    const games = [{ sport: 'nfl', kickoff_time: new Date('2026-09-13T17:00:00Z') }]
    return fetchFinals(games, { fetchImpl }).then((out) => {
      assert.equal(out.ok, false)
    })
  })

  test('a thrown request is caught, not propagated', () => {
    const fetchImpl = async () => { throw new Error('network down') }
    const games = [{ sport: 'nfl', kickoff_time: new Date('2026-09-13T17:00:00Z') }]
    return fetchFinals(games, { fetchImpl }).then((out) => {
      assert.equal(out.ok, false)
      assert.match(out.failures[0], /network down/)
    })
  })
})
