/**
 * Conference alignment, week windows and slate selection.
 *
 * Run with:  node --test tests/
 *
 * These are all offline — the hardcoded 2026 alignment and the Tuesday→Monday
 * window arithmetic are exactly the things that should never drift silently.
 * The live ESPN rankings fetch is deliberately not tested here; it needs the
 * network and its data changes weekly.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  CONFERENCES,
  POWER4,
  GROUP5,
  ALL_CONFERENCES,
  CONFERENCE_ORDER,
  TEAM_CONFERENCE,
  resolveTeam,
  getTeamConference,
  getAvailableConferences,
  getConferenceLabel,
  normalizeTeamName,
} from '../src/lib/conferences.js'

import {
  weekWindow,
  isInWeekWindow,
  isValidWeekStart,
  poolWeekStartFor,
  dayOfWeek,
  addDays,
  toDateString,
} from '../src/lib/weekWindow.js'

import {
  selectEligible,
  remainingPicks,
  pickLimits,
  sportsFor,
  MAX_PICKS,
} from '../src/lib/gameSelection.js'

// ── Alignment integrity ──────────────────────────────────────────────────────

describe('2026 conference alignment', () => {
  test('every team belongs to exactly one conference', () => {
    const seen = new Map()
    for (const conf of CONFERENCES) {
      for (const t of conf.teams) {
        const name = `${t.loc} ${t.mascot}`
        assert.equal(seen.has(name), false, `${name} appears in both ${seen.get(name)} and ${conf.key}`)
        seen.set(name, conf.key)
      }
    }
  })

  test('conference sizes match the 2026 alignment', () => {
    const sizes = Object.fromEntries(CONFERENCES.map((c) => [c.key, c.teams.length]))
    assert.deepEqual(sizes, {
      'SEC': 16, 'Big Ten': 18, 'Big 12': 16, 'ACC': 17,
      'AAC': 14, 'Pac-12': 8, 'Mountain West': 10,
      'Conference USA': 10, 'MAC': 13, 'Sun Belt': 14,
      'Independent': 2,
    })
  })

  test('the rebuilt Pac-12 has its 2026 membership', () => {
    const pac = CONFERENCES.find((c) => c.key === 'Pac-12')
    assert.deepEqual(pac.teams.map((t) => t.loc).sort(), [
      'Boise State', 'Colorado State', 'Fresno State', 'Oregon State',
      'San Diego State', 'Texas State', 'Utah State', 'Washington State',
    ])
  })

  test('2026 movers landed in the right place', () => {
    // Left the Mountain West for the Pac-12
    for (const t of ['Boise State', 'Colorado State', 'Fresno State', 'San Diego State', 'Utah State']) {
      assert.equal(getTeamConference(t), 'Pac-12', t)
    }
    assert.equal(getTeamConference('Texas State'), 'Pac-12')      // from the Sun Belt
    assert.equal(getTeamConference('Northern Illinois'), 'Mountain West') // from the MAC
    assert.equal(getTeamConference('UTEP'), 'Mountain West')       // from CUSA
    assert.equal(getTeamConference('Louisiana Tech'), 'Sun Belt')  // from CUSA
    assert.equal(getTeamConference('UMass'), 'MAC')                // from independent
    assert.equal(getTeamConference('Sacramento State'), 'MAC')     // up from FCS
    assert.equal(getTeamConference('North Dakota State'), 'Mountain West')
  })

  test('Wichita State is not present — it has no football program', () => {
    assert.equal(resolveTeam('Wichita State Shockers'), null)
    assert.equal(resolveTeam('Wichita State'), null)
  })

  test('tiers split into the two draw pools', () => {
    assert.deepEqual(POWER4.map((c) => c.key), ['SEC', 'Big Ten', 'Big 12', 'ACC'])
    assert.deepEqual(GROUP5.map((c) => c.key),
      ['AAC', 'Pac-12', 'Mountain West', 'Conference USA', 'MAC', 'Sun Belt'])
    assert.equal(ALL_CONFERENCES.length, CONFERENCE_ORDER.length)
  })
})

// ── Name resolution ──────────────────────────────────────────────────────────

describe('team name resolution', () => {
  test('resolves full Odds API names', () => {
    assert.equal(getTeamConference('Ohio State Buckeyes'), 'Big Ten')
    assert.equal(getTeamConference('Alabama Crimson Tide'), 'SEC')
  })

  test('resolves bare locations, which is what ESPN sends', () => {
    assert.equal(resolveTeam('Ohio State').name, 'Ohio State Buckeyes')
    assert.equal(resolveTeam('Boise State').conference, 'Pac-12')
  })

  test('resolves known alternate spellings across sources', () => {
    const cases = [
      ['Mississippi',          'Ole Miss Rebels'],
      ['Mississippi Rebels',   'Ole Miss Rebels'],
      ["Hawai'i",              'Hawaii Rainbow Warriors'],
      ['San José State',       'San Jose State Spartans'],
      ['UMass',                'Massachusetts Minutemen'],
      ['UConn',                'Connecticut Huskies'],
      ['FIU',                  'Florida International Panthers'],
      ['Pitt',                 'Pittsburgh Panthers'],
      ['Central Florida',      'UCF Knights'],
      ['Miami (Ohio)',         'Miami (OH) Redhawks'],
      ['Southern Mississippi', 'Southern Miss Golden Eagles'],
      ['UL Monroe',            'Louisiana Monroe Warhawks'],
      ['Brigham Young',        'BYU Cougars'],
    ]
    for (const [input, expected] of cases) {
      assert.equal(resolveTeam(input)?.name, expected, `${input} -> ${expected}`)
    }
  })

  test('normalization is punctuation, case and accent insensitive', () => {
    assert.equal(normalizeTeamName('San José State'), normalizeTeamName('san jose state'))
    assert.equal(normalizeTeamName("Hawai'i"), normalizeTeamName('Hawaii'))
    assert.equal(normalizeTeamName('Texas A&M Aggies'), normalizeTeamName('texas a and m aggies'))
  })

  test('unknown teams resolve to null rather than guessing', () => {
    assert.equal(resolveTeam('Springfield Atoms'), null)
    assert.equal(getTeamConference(''), null)
    assert.equal(getTeamConference(undefined), null)
  })

  test('TEAM_CONFERENCE covers every team exactly once', () => {
    const total = CONFERENCES.reduce((n, c) => n + c.teams.length, 0)
    assert.equal(Object.keys(TEAM_CONFERENCE).length, total)
  })
})

describe('conference rotation helpers', () => {
  test('used conferences drop out of the pool', () => {
    const left = getAvailableConferences(['SEC', 'ACC'], 'power4')
    assert.deepEqual(left.map((c) => c.key), ['Big Ten', 'Big 12'])
  })

  test('group5 pool includes the rebuilt Pac-12', () => {
    const keys = getAvailableConferences([], 'group5').map((c) => c.key)
    assert.ok(keys.includes('Pac-12'))
  })

  test('unknown keys fall back to themselves', () => {
    assert.equal(getConferenceLabel('SEC'), 'SEC')
    assert.equal(getConferenceLabel('Mythical'), 'Mythical')
  })
})

// ── Week windows ─────────────────────────────────────────────────────────────

describe('Tuesday-to-Monday week windows', () => {
  test('a week starts Tuesday and ends the following Monday', () => {
    const w = weekWindow('2026-09-08')          // a Tuesday
    assert.equal(w.startDate, '2026-09-08')
    assert.equal(w.endDate, '2026-09-14')       // the following Monday
    assert.equal(dayOfWeek(w.startDate), 2)
    assert.equal(dayOfWeek(w.endDate), 1)
  })

  test('covers midweek, Saturday, Sunday and Monday night games', () => {
    const w = weekWindow('2026-09-08')
    // Wednesday MACtion, Saturday college, Sunday NFL, Monday night
    assert.ok(isInWeekWindow('2026-09-09T23:00:00Z', w), 'Wednesday night')
    assert.ok(isInWeekWindow('2026-09-12T16:00:00Z', w), 'Saturday noon ET')
    assert.ok(isInWeekWindow('2026-09-13T17:00:00Z', w), 'Sunday 1pm ET')
    assert.ok(isInWeekWindow('2026-09-15T00:15:00Z', w), 'Mon 8:15pm ET = Tue 00:15 UTC')
  })

  test('excludes the game just before and just after', () => {
    const w = weekWindow('2026-09-08')
    // Monday 8:15pm ET the day *before* the window opens
    assert.equal(isInWeekWindow('2026-09-08T00:15:00Z', w), false)
    // The next Tuesday, one week on
    assert.equal(isInWeekWindow('2026-09-15T18:00:00Z', w), false)
  })

  test('adjacent weeks tile with no gap and no overlap', () => {
    const a = weekWindow('2026-09-08')
    const b = weekWindow('2026-09-15')
    assert.equal(b.start.getTime() - a.end.getTime(), 1, 'exactly 1ms apart')
  })

  test('window spans 7 days of wall clock across the DST change', () => {
    // US DST ends Sunday 2026-11-01, so this week is 7 calendar days but 169h.
    const w = weekWindow('2026-10-27')
    assert.equal(w.endDate, '2026-11-02')
    const hours = (w.end.getTime() - w.start.getTime()) / 3.6e6
    assert.ok(Math.abs(hours - 169) < 0.01, `expected ~169h, got ${hours}`)
  })

  test('a normal week is 168 hours', () => {
    const w = weekWindow('2026-09-08')
    const hours = (w.end.getTime() - w.start.getTime()) / 3.6e6
    assert.ok(Math.abs(hours - 168) < 0.01, `expected ~168h, got ${hours}`)
  })

  test('validates that a planned start lands on a Tuesday', () => {
    assert.equal(isValidWeekStart('2026-09-08'), true)
    assert.equal(isValidWeekStart('2026-09-09'), false)  // Wednesday
    assert.equal(isValidWeekStart('2026-09-13'), false)  // Sunday
    assert.equal(isValidWeekStart('not-a-date'), false)
  })

  test('any day maps back to the Tuesday its week began', () => {
    // Every day from Tue through the following Mon belongs to the same week.
    for (let i = 0; i < 7; i++) {
      const day = toDateString(addDays('2026-09-08', i))
      assert.equal(
        poolWeekStartFor(new Date(`${day}T18:00:00Z`)), '2026-09-08',
        `${day} should belong to the week starting 2026-09-08`
      )
    }
    // The next Tuesday starts a new week.
    assert.equal(poolWeekStartFor(new Date('2026-09-15T18:00:00Z')), '2026-09-15')
  })
})

// ── Slate selection ──────────────────────────────────────────────────────────

const cfb = (home, away, spread, kickoff = '2026-09-12T20:00:00Z') =>
  ({ sport: 'college', home_team: home, away_team: away, spread, kickoff_time: kickoff })
const nflGame = (home, away, spread, kickoff = '2026-09-13T17:00:00Z') =>
  ({ sport: 'nfl', home_team: home, away_team: away, spread, kickoff_time: kickoff })


describe('eligible games', () => {
  const candidates = [
    nflGame('Baltimore Ravens', 'Kansas City Chiefs', -13.5),
    nflGame('Los Angeles Rams', 'San Francisco 49ers', 1.5),
    nflGame('Miami Dolphins', 'Buffalo Bills', -2.5),
    nflGame('Philadelphia Eagles', 'Dallas Cowboys', -6.5),
    nflGame('New England Patriots', 'New York Jets', -7),
    cfb('Alabama Crimson Tide', 'Georgia Bulldogs', -4.5),
    cfb('Utah Utes', 'Oregon Ducks', 3),
    cfb('Akron Zips', 'Kent State Golden Flashes', -21),
  ]

  test('a mixed week offers every game in both sports', () => {
    // The whole point: players see all of them and choose their own six.
    const { eligible, bySport, limits } = selectEligible(candidates, { container_type: 'nfl_college' })
    assert.equal(eligible.length, 8)
    assert.deepEqual(bySport, { nfl: 5, college: 3 })
    assert.deepEqual(limits, { nfl: 4, college: 2 })
  })

  test('a single-sport week offers only that sport', () => {
    const nflOnly = selectEligible(candidates, { container_type: 'nfl_only' })
    assert.equal(nflOnly.bySport.college, 0)
    assert.equal(nflOnly.bySport.nfl, 5)

    const cfbOnly = selectEligible(candidates, { container_type: 'college_only' })
    assert.equal(cfbOnly.bySport.nfl, 0)
    assert.equal(cfbOnly.bySport.college, 3)
  })

  test('a shortfall is reported when the pool cannot fill a slate', () => {
    // 5 NFL games but a 6-pick NFL week: nobody could complete it.
    const { shortfall } = selectEligible(candidates, { container_type: 'nfl_only' })
    assert.deepEqual(shortfall, { nfl: 1, college: 0 })

    const fine = selectEligible(candidates, { container_type: 'nfl_college' })
    assert.deepEqual(fine.shortfall, { nfl: 0, college: 0 })
  })

  test('a conference week offers only that conference', () => {
    const { eligible } = selectEligible(candidates, {
      container_type: 'college_only', college_focus: 'power4', conference: 'Big Ten',
    })
    assert.deepEqual(eligible.map((g) => g.away_team), ['Oregon Ducks'])
  })

  test('a Top 25 week offers only games with a ranked side', () => {
    const rankMap = new Map([[normalizeTeamName('Georgia Bulldogs'), 3]])
    const { eligible } = selectEligible(
      candidates, { container_type: 'college_only', college_focus: 'top25' }, rankMap
    )
    assert.deepEqual(eligible.map((g) => g.away_team), ['Georgia Bulldogs'])
  })

  test('a Top 25 week with no poll offers nothing rather than everything', () => {
    // Regression: treating "no poll" as "no filter" put an FCS team in a
    // Top 25 week. Offering none makes the importer report the problem.
    const { eligible, shortfall } = selectEligible(
      candidates, { container_type: 'college_only', college_focus: 'top25' }, null
    )
    assert.equal(eligible.length, 0)
    assert.equal(shortfall.college, 6)
  })

  test('FCS matchups are never eligible', () => {
    const withFcs = [
      ...candidates,
      cfb('Somewhere State Cougars', 'Nowhere Tech Owls', 0.5),
    ]
    const { eligible } = selectEligible(withFcs, { container_type: 'college_only' })
    const names = eligible.flatMap((g) => [g.home_team, g.away_team])
    assert.equal(names.includes('Nowhere Tech Owls'), false)
  })

  test('focuses we cannot compute offer everything', () => {
    for (const focus of ['rivalry', 'confchamp', 'cfp']) {
      const { bySport } = selectEligible(candidates, { container_type: 'college_only', college_focus: focus })
      assert.equal(bySport.college, 3, focus)
    }
  })

  test('games without a spread are not offered', () => {
    const { eligible } = selectEligible(
      [...candidates, { sport: 'nfl', home_team: 'A', away_team: 'B', spread: null, kickoff_time: '2026-09-13T17:00:00Z' }],
      { container_type: 'nfl_only' }
    )
    assert.equal(eligible.length, 5)
  })
})

describe('per-sport pick limits', () => {
  const picked = (nfl, college) => [
    ...Array.from({ length: nfl }, () => ({ sport: 'nfl' })),
    ...Array.from({ length: college }, () => ({ sport: 'college' })),
  ]

  test('a mixed week caps at 4 NFL and 2 college independently', () => {
    const r = remainingPicks(picked(4, 0), 'nfl_college')
    assert.deepEqual(r.remaining, { nfl: 0, college: 2 })
    assert.equal(r.complete, false, 'NFL full but college still open')
  })

  test('complete requires exactly the full split', () => {
    assert.equal(remainingPicks(picked(4, 2), 'nfl_college').complete, true)
    assert.equal(remainingPicks(picked(4, 1), 'nfl_college').complete, false)
    assert.equal(remainingPicks(picked(3, 2), 'nfl_college').complete, false)
    assert.equal(remainingPicks(picked(6, 0), 'nfl_only').complete, true)
    assert.equal(remainingPicks(picked(0, 6), 'college_only').complete, true)
  })

  test('a single-sport week leaves no room in the other sport', () => {
    const r = remainingPicks(picked(0, 0), 'nfl_only')
    assert.deepEqual(r.remaining, { nfl: 6, college: 0 })
  })

  test('remaining never goes negative', () => {
    const r = remainingPicks(picked(9, 9), 'nfl_college')
    assert.deepEqual(r.remaining, { nfl: 0, college: 0 })
  })

  test('every week shape totals six picks', () => {
    for (const type of ['nfl_college', 'nfl_only', 'college_only']) {
      const l = pickLimits(type)
      assert.equal(l.nfl + l.college, MAX_PICKS, type)
    }
  })

  test('sportsFor lists only the sports a week uses', () => {
    assert.deepEqual(sportsFor('nfl_college'), ['nfl', 'college'])
    assert.deepEqual(sportsFor('nfl_only'), ['nfl'])
    assert.deepEqual(sportsFor('college_only'), ['college'])
  })
})
