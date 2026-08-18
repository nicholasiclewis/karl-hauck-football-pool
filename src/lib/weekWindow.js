/**
 * Pool week windows.
 *
 * A pool week runs Tuesday 00:00:00 ET through the following Monday
 * 23:59:59.999 ET. That single span covers midweek games (MACtion), the
 * Saturday college slate, the Sunday NFL slate, and closes on Monday Night
 * Football — so every game belongs to exactly one week.
 *
 * All boundaries are evaluated in America/New_York and are DST-safe: the
 * window is defined in wall-clock terms, so the week containing a spring-
 * forward Sunday is 7 calendar days but 167 real hours, which is correct.
 */

export const POOL_TZ = 'America/New_York'
export const WEEK_START_DOW = 2   // Tuesday, using JS 0=Sun..6=Sat

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: POOL_TZ,
  hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Wall-clock calendar parts of an instant, as seen in the pool timezone. */
export function partsInPoolTz(date) {
  const out = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value
  }
  return {
    year:   Number(out.year),
    month:  Number(out.month),
    day:    Number(out.day),
    // Some engines render midnight as hour "24" under hour12:false.
    hour:   Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
  }
}

/** Offset in ms between the pool timezone and UTC at a given instant. */
function offsetMsAt(date) {
  const p = partsInPoolTz(date)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Convert a wall-clock time in the pool timezone to the matching UTC instant.
 * Two-pass so that times near a DST transition land on the right side of it.
 */
export function poolTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  let inst = new Date(naive - offsetMsAt(new Date(naive)))
  inst = new Date(naive - offsetMsAt(inst))
  return inst
}

/**
 * Parse a date-only value without timezone drift.
 * Accepts 'YYYY-MM-DD', a Date (read in the pool timezone), or the
 * { year, month, day } form these helpers return — so they compose freely.
 */
export function parseDateOnly(value) {
  if (value instanceof Date) {
    const p = partsInPoolTz(value)
    return { year: p.year, month: p.month, day: p.day }
  }
  if (value && typeof value === 'object' && 'year' in value && 'month' in value && 'day' in value) {
    return { year: Number(value.year), month: Number(value.month), day: Number(value.day) }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) throw new Error(`Expected a YYYY-MM-DD date, got: ${value}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

/** Day of week (0=Sun..6=Sat) for a date-only value. */
export function dayOfWeek(value) {
  const { year, month, day } = parseDateOnly(value)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** True when a planned week's start date actually falls on a Tuesday. */
export function isValidWeekStart(value) {
  try {
    return dayOfWeek(value) === WEEK_START_DOW
  } catch {
    return false
  }
}

/** Shift a date-only value by n days. */
export function addDays(value, n) {
  const { year, month, day } = parseDateOnly(value)
  const d = new Date(Date.UTC(year, month - 1, day + n))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Format a date-only object back to 'YYYY-MM-DD'. */
export function toDateString({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * The Tuesday-through-Monday span for a week whose week_start is `weekStart`.
 * @param {string|Date} weekStart - the Tuesday the week begins (YYYY-MM-DD)
 * @returns {{ start: Date, end: Date, startDate: string, endDate: string }}
 */
export function weekWindow(weekStart) {
  const from = parseDateOnly(weekStart)
  const to = addDays(from, 6)   // Tuesday + 6 = the following Monday
  return {
    start:     poolTimeToUtc(from.year, from.month, from.day, 0, 0, 0, 0),
    end:       poolTimeToUtc(to.year, to.month, to.day, 23, 59, 59, 999),
    startDate: toDateString(from),
    endDate:   toDateString(to),
  }
}

/** True when a kickoff falls inside the given week window. */
export function isInWeekWindow(kickoff, window) {
  const t = (kickoff instanceof Date ? kickoff : new Date(kickoff)).getTime()
  return t >= window.start.getTime() && t <= window.end.getTime()
}

/**
 * The pool week start (the Tuesday) containing `date`.
 * A Monday belongs to the week that began the previous Tuesday.
 */
export function poolWeekStartFor(date = new Date()) {
  const p = partsInPoolTz(date instanceof Date ? date : new Date(date))
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  const back = (dow - WEEK_START_DOW + 7) % 7
  return toDateString(addDays({ year: p.year, month: p.month, day: p.day }, -back))
}

/** Today's date in the pool timezone, as 'YYYY-MM-DD'. */
export function poolToday(now = new Date()) {
  const p = partsInPoolTz(now)
  return toDateString({ year: p.year, month: p.month, day: p.day })
}

/** Human label for a window, e.g. "Tue Sep 8 – Mon Sep 14". */
export function formatWeekWindow(window) {
  const fmt = (d) => new Intl.DateTimeFormat('en-US', {
    timeZone: POOL_TZ, weekday: 'short', month: 'short', day: 'numeric',
  }).format(d)
  return `${fmt(window.start)} – ${fmt(window.end)}`
}
