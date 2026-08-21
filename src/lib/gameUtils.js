/**
 * Shared utility functions for displaying game data.
 */
import { POOL_TZ } from './weekWindow.js'
import { espnAbbr } from './teamAbbrs.js'

// Kickoffs are quoted in Eastern because that is how the schedule is published
// and how the pool's weeks are defined. This has to be forced: the previous
// implementation read the viewer's local clock and appended "ET" regardless,
// so a player in Denver saw an 8:15 ET kickoff labelled "5:15 PM ET".
const KICKOFF_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: POOL_TZ,
  weekday: 'short', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
})

/** Format a kickoff timestamp → "THU · OCT 17 · 8:15 PM ET" */
export function formatKickoff(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''

  const p = {}
  for (const part of KICKOFF_FMT.formatToParts(d)) p[part.type] = part.value

  return `${p.weekday.toUpperCase()} · ${p.month.toUpperCase()} ${p.day} · ` +
         `${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()} ET`
}

/** "Locks in 2d 14h" countdown string, or null if already locked */
export function countdownToKickoff(dateStr) {
  const diff = new Date(dateStr) - new Date()
  if (diff <= 0) return null
  const days  = Math.floor(diff / 864e5)
  const hours = Math.floor((diff % 864e5) / 36e5)
  const mins  = Math.floor((diff % 36e5)  / 6e4)
  if (days  > 0) return `Locks in ${days}d ${hours}h`
  if (hours > 0) return `Locks in ${hours}h ${mins}m`
  if (mins  > 0) return `Locks in ${mins}m`
  return 'Locking soon'
}

/**
 * Sort comparator for mixed slates: college games first, then NFL, each
 * ordered by kickoff. The pool reads its slates college-first.
 */
export function collegeFirst(a, b) {
  if (a.sport !== b.sport) return a.sport === 'college' ? -1 : 1
  return new Date(a.kickoff_time) - new Date(b.kickoff_time)
}

/** Format a spread number → "+6.5", "-3.5", "PK" */
export function formatSpread(spread) {
  if (spread === 0) return 'PK'
  const abs = Math.abs(spread)
  const val = abs % 1 === 0 ? String(abs) : abs.toFixed(1)
  return spread > 0 ? `+${val}` : `-${val}`
}

/**
 * Team abbreviation, ESPN's where the team is known.
 *
 * The derived initials this used to return ("Green Bay Packers" → GBP,
 * "Ohio State Buckeyes" → OSB) matched no scoreboard anyone reads. Known
 * teams now come from the ESPN table in teamAbbrs.js — GB, OSU — and the
 * initials survive only as the fallback for names we cannot place.
 */
export function teamAbbr(name = '') {
  const espn = espnAbbr(name)
  if (espn) return espn
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3)
}

/** Week chip label: "4 NFL · 2 CFB", "6 NFL", etc. */
export function weekChipLabel(games = []) {
  const nfl = games.filter((g) => g.sport === 'nfl').length
  const cfb = games.filter((g) => g.sport === 'college').length
  if (nfl > 0 && cfb > 0) return `${nfl} NFL · ${cfb} CFB`
  if (nfl > 0) return `${nfl} NFL`
  return `${cfb} CFB`
}

