/**
 * Single source of truth for FBS conference alignment — 2026 season.
 *
 * Every team is stored as { loc, mascot } so we can match two different ways:
 *   - The Odds API sends full names ......... "Ohio State Buckeyes"  (loc + mascot)
 *   - ESPN's rankings API sends locations ... "Ohio State"           (loc alone)
 * `alt` holds extra spellings either source is known to use.
 *
 * 2026 realignment (effective July 1, 2026):
 *   - Pac-12 rebuilt to 8: Boise State, Colorado State, Fresno State, San Diego
 *     State + Utah State (from MWC) and Texas State (from Sun Belt) join the
 *     holdovers Oregon State and Washington State.
 *   - Mountain West backfills with Northern Illinois (MAC), UTEP (CUSA) and
 *     North Dakota State (FCS).
 *   - MAC adds UMass and Sacramento State (FCS), loses Northern Illinois.
 *   - Sun Belt swaps Texas State out for Louisiana Tech.
 *   - Conference USA drops to 10 after losing UTEP and Louisiana Tech.
 */

// tier drives the weekly rotation: 'power4' and 'group5' are the two draw pools.
export const CONFERENCES = [
  // ── Power 4 ───────────────────────────────────────────────────────────────
  {
    key: 'SEC', label: 'SEC', tier: 'power4',
    teams: [
      { loc: 'Alabama',          mascot: 'Crimson Tide' },
      { loc: 'Arkansas',         mascot: 'Razorbacks' },
      { loc: 'Auburn',           mascot: 'Tigers' },
      { loc: 'Florida',          mascot: 'Gators' },
      { loc: 'Georgia',          mascot: 'Bulldogs' },
      { loc: 'Kentucky',         mascot: 'Wildcats' },
      { loc: 'LSU',              mascot: 'Tigers' },
      { loc: 'Ole Miss',         mascot: 'Rebels', alt: ['Mississippi', 'Mississippi Rebels'] },
      { loc: 'Mississippi State', mascot: 'Bulldogs' },
      { loc: 'Missouri',         mascot: 'Tigers' },
      { loc: 'Oklahoma',         mascot: 'Sooners' },
      { loc: 'South Carolina',   mascot: 'Gamecocks' },
      { loc: 'Tennessee',        mascot: 'Volunteers' },
      { loc: 'Texas',            mascot: 'Longhorns' },
      { loc: 'Texas A&M',        mascot: 'Aggies' },
      { loc: 'Vanderbilt',       mascot: 'Commodores' },
    ],
  },
  {
    key: 'Big Ten', label: 'Big Ten', tier: 'power4',
    teams: [
      { loc: 'Illinois',       mascot: 'Fighting Illini' },
      { loc: 'Indiana',        mascot: 'Hoosiers' },
      { loc: 'Iowa',           mascot: 'Hawkeyes' },
      { loc: 'Maryland',       mascot: 'Terrapins' },
      { loc: 'Michigan',       mascot: 'Wolverines' },
      { loc: 'Michigan State', mascot: 'Spartans' },
      { loc: 'Minnesota',      mascot: 'Golden Gophers' },
      { loc: 'Nebraska',       mascot: 'Cornhuskers' },
      { loc: 'Northwestern',   mascot: 'Wildcats' },
      { loc: 'Ohio State',     mascot: 'Buckeyes' },
      { loc: 'Oregon',         mascot: 'Ducks' },
      { loc: 'Penn State',     mascot: 'Nittany Lions' },
      { loc: 'Purdue',         mascot: 'Boilermakers' },
      { loc: 'Rutgers',        mascot: 'Scarlet Knights' },
      { loc: 'UCLA',           mascot: 'Bruins' },
      { loc: 'USC',            mascot: 'Trojans', alt: ['Southern California'] },
      { loc: 'Washington',     mascot: 'Huskies' },
      { loc: 'Wisconsin',      mascot: 'Badgers' },
    ],
  },
  {
    key: 'Big 12', label: 'Big 12', tier: 'power4',
    teams: [
      { loc: 'Arizona',       mascot: 'Wildcats' },
      { loc: 'Arizona State', mascot: 'Sun Devils' },
      { loc: 'Baylor',        mascot: 'Bears' },
      { loc: 'BYU',           mascot: 'Cougars', alt: ['Brigham Young'] },
      { loc: 'Cincinnati',    mascot: 'Bearcats' },
      { loc: 'Colorado',      mascot: 'Buffaloes' },
      { loc: 'Houston',       mascot: 'Cougars' },
      { loc: 'Iowa State',    mascot: 'Cyclones' },
      { loc: 'Kansas',        mascot: 'Jayhawks' },
      { loc: 'Kansas State',  mascot: 'Wildcats' },
      { loc: 'Oklahoma State', mascot: 'Cowboys' },
      { loc: 'TCU',           mascot: 'Horned Frogs', alt: ['Texas Christian'] },
      { loc: 'Texas Tech',    mascot: 'Red Raiders' },
      { loc: 'UCF',           mascot: 'Knights', alt: ['Central Florida'] },
      { loc: 'Utah',          mascot: 'Utes' },
      { loc: 'West Virginia', mascot: 'Mountaineers' },
    ],
  },
  {
    key: 'ACC', label: 'ACC', tier: 'power4',
    teams: [
      { loc: 'Boston College', mascot: 'Eagles' },
      { loc: 'California',     mascot: 'Golden Bears', alt: ['Cal'] },
      { loc: 'Clemson',        mascot: 'Tigers' },
      { loc: 'Duke',           mascot: 'Blue Devils' },
      { loc: 'Florida State',  mascot: 'Seminoles' },
      { loc: 'Georgia Tech',   mascot: 'Yellow Jackets' },
      { loc: 'Louisville',     mascot: 'Cardinals' },
      { loc: 'Miami',          mascot: 'Hurricanes', alt: ['Miami (FL)'] },
      { loc: 'NC State',       mascot: 'Wolfpack', alt: ['North Carolina State'] },
      { loc: 'North Carolina', mascot: 'Tar Heels' },
      { loc: 'Pittsburgh',     mascot: 'Panthers', alt: ['Pitt'] },
      { loc: 'SMU',            mascot: 'Mustangs', alt: ['Southern Methodist'] },
      { loc: 'Stanford',       mascot: 'Cardinal' },
      { loc: 'Syracuse',       mascot: 'Orange' },
      { loc: 'Virginia',       mascot: 'Cavaliers' },
      { loc: 'Virginia Tech',  mascot: 'Hokies' },
      { loc: 'Wake Forest',    mascot: 'Demon Deacons' },
    ],
  },

  // ── Group of 5 ────────────────────────────────────────────────────────────
  {
    key: 'AAC', label: 'AAC', tier: 'group5',
    teams: [
      { loc: 'Army',            mascot: 'Black Knights', alt: ['Army West Point'] },
      { loc: 'Charlotte',       mascot: '49ers' },
      { loc: 'East Carolina',   mascot: 'Pirates' },
      { loc: 'Florida Atlantic', mascot: 'Owls', alt: ['FAU'] },
      { loc: 'Memphis',         mascot: 'Tigers' },
      { loc: 'Navy',            mascot: 'Midshipmen' },
      { loc: 'North Texas',     mascot: 'Mean Green' },
      { loc: 'Rice',            mascot: 'Owls' },
      { loc: 'South Florida',   mascot: 'Bulls', alt: ['USF'] },
      { loc: 'Temple',          mascot: 'Owls' },
      { loc: 'Tulane',          mascot: 'Green Wave' },
      { loc: 'Tulsa',           mascot: 'Golden Hurricane' },
      { loc: 'UAB',             mascot: 'Blazers' },
      { loc: 'UTSA',            mascot: 'Roadrunners' },
    ],
  },
  {
    key: 'Pac-12', label: 'Pac-12', tier: 'group5',
    teams: [
      { loc: 'Boise State',      mascot: 'Broncos' },
      { loc: 'Colorado State',   mascot: 'Rams' },
      { loc: 'Fresno State',     mascot: 'Bulldogs' },
      { loc: 'Oregon State',     mascot: 'Beavers' },
      { loc: 'San Diego State',  mascot: 'Aztecs' },
      { loc: 'Texas State',      mascot: 'Bobcats' },
      { loc: 'Utah State',       mascot: 'Aggies' },
      { loc: 'Washington State', mascot: 'Cougars' },
    ],
  },
  {
    key: 'Mountain West', label: 'Mountain West', tier: 'group5',
    teams: [
      { loc: 'Air Force',         mascot: 'Falcons' },
      { loc: 'Hawaii',            mascot: 'Rainbow Warriors', alt: ["Hawai'i"] },
      { loc: 'Nevada',            mascot: 'Wolf Pack' },
      { loc: 'New Mexico',        mascot: 'Lobos' },
      { loc: 'North Dakota State', mascot: 'Bison' },
      { loc: 'Northern Illinois', mascot: 'Huskies', alt: ['NIU'] },
      { loc: 'San Jose State',    mascot: 'Spartans', alt: ['San José State'] },
      { loc: 'UNLV',              mascot: 'Rebels' },
      { loc: 'UTEP',              mascot: 'Miners' },
      { loc: 'Wyoming',           mascot: 'Cowboys' },
    ],
  },
  {
    key: 'Conference USA', label: 'Conference USA', tier: 'group5',
    teams: [
      { loc: 'Delaware',            mascot: 'Blue Hens' },
      { loc: 'Florida International', mascot: 'Panthers', alt: ['FIU'] },
      { loc: 'Jacksonville State',  mascot: 'Gamecocks' },
      { loc: 'Kennesaw State',      mascot: 'Owls' },
      { loc: 'Liberty',             mascot: 'Flames' },
      { loc: 'Middle Tennessee',    mascot: 'Blue Raiders' },
      { loc: 'Missouri State',      mascot: 'Bears' },
      { loc: 'New Mexico State',    mascot: 'Aggies' },
      { loc: 'Sam Houston',         mascot: 'Bearkats', alt: ['Sam Houston State'] },
      { loc: 'Western Kentucky',    mascot: 'Hilltoppers' },
    ],
  },
  {
    key: 'MAC', label: 'MAC', tier: 'group5',
    teams: [
      { loc: 'Akron',            mascot: 'Zips' },
      { loc: 'Ball State',       mascot: 'Cardinals' },
      { loc: 'Bowling Green',    mascot: 'Falcons' },
      { loc: 'Buffalo',          mascot: 'Bulls' },
      { loc: 'Central Michigan', mascot: 'Chippewas' },
      { loc: 'Eastern Michigan', mascot: 'Eagles' },
      { loc: 'Kent State',       mascot: 'Golden Flashes' },
      { loc: 'Miami (OH)',       mascot: 'Redhawks', alt: ['Miami (Ohio)', 'Miami (OH) RedHawks'] },
      { loc: 'Ohio',             mascot: 'Bobcats' },
      { loc: 'Sacramento State', mascot: 'Hornets' },
      { loc: 'Toledo',           mascot: 'Rockets' },
      { loc: 'Massachusetts',    mascot: 'Minutemen', alt: ['UMass'] },
      { loc: 'Western Michigan', mascot: 'Broncos' },
    ],
  },
  {
    key: 'Sun Belt', label: 'Sun Belt', tier: 'group5',
    teams: [
      { loc: 'Appalachian State', mascot: 'Mountaineers', alt: ['App State'] },
      { loc: 'Arkansas State',    mascot: 'Red Wolves' },
      { loc: 'Coastal Carolina',  mascot: 'Chanticleers' },
      { loc: 'Georgia Southern',  mascot: 'Eagles' },
      { loc: 'Georgia State',     mascot: 'Panthers' },
      { loc: 'James Madison',     mascot: 'Dukes' },
      { loc: 'Louisiana',         mascot: 'Ragin Cajuns', alt: ["Louisiana Ragin' Cajuns", 'Louisiana-Lafayette'] },
      { loc: 'Louisiana Monroe',  mascot: 'Warhawks', alt: ['UL Monroe', 'Louisiana-Monroe'] },
      { loc: 'Louisiana Tech',    mascot: 'Bulldogs' },
      { loc: 'Marshall',          mascot: 'Thundering Herd' },
      { loc: 'Old Dominion',      mascot: 'Monarchs' },
      { loc: 'South Alabama',     mascot: 'Jaguars' },
      { loc: 'Southern Miss',     mascot: 'Golden Eagles', alt: ['Southern Mississippi'] },
      { loc: 'Troy',              mascot: 'Trojans' },
    ],
  },

  // ── Independents ──────────────────────────────────────────────────────────
  {
    key: 'Independent', label: 'Independent', tier: 'independent',
    teams: [
      { loc: 'Notre Dame',  mascot: 'Fighting Irish' },
      { loc: 'Connecticut', mascot: 'Huskies', alt: ['UConn'] },
    ],
  },
]

/** Full Odds API style display name for a team entry. */
const fullName = (t) => `${t.loc} ${t.mascot}`

// ── Name normalization ───────────────────────────────────────────────────────
// Sources disagree on punctuation, diacritics and abbreviations. Strip it all
// down so "Hawai'i", "Hawaii" and "HAWAII" collapse to the same key.
const ABBREV = [
  [/\bst\.?\b/g, 'state'],
  [/\buniv(ersity)?\b/g, ''],
  [/\bthe\b/g, ''],
]

// U+0300–U+036F: combining diacritical marks, left over after NFD decomposition.
// Built from an escape string so the literal marks never appear in source.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

// Apostrophes are dropped rather than turned into a space, so "Hawai'i"
// normalizes to "hawaii" and matches "Hawaii". Covers straight, curly and
// backtick forms. Written as escapes so the source stays ASCII.
const APOSTROPHES = new RegExp("['\\u2019\\u02bb\\u0060]", 'g')

export function normalizeTeamName(name) {
  if (!name) return ''
  let s = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')       // José -> Jose
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(APOSTROPHES, '')           // Hawai'i -> hawaii
    .replace(/[^a-z0-9]+/g, ' ')        // remaining punctuation -> space
    .trim()
  for (const [re, to] of ABBREV) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ').trim()
}

// ── Derived lookup indices ───────────────────────────────────────────────────
// Built once at module load from CONFERENCES above.
const byName = new Map()   // normalized name/alias/location -> { name, loc, conference }

function index(key, entry) {
  const k = normalizeTeamName(key)
  if (k && !byName.has(k)) byName.set(k, entry)
}

for (const conf of CONFERENCES) {
  for (const t of conf.teams) {
    const entry = { name: fullName(t), loc: t.loc, mascot: t.mascot, conference: conf.key }
    index(fullName(t), entry)          // "Ohio State Buckeyes"
    index(t.loc, entry)                // "Ohio State"
    for (const a of t.alt ?? []) {
      index(a, entry)                  // "Mississippi"
      if (!a.includes(t.mascot)) index(`${a} ${t.mascot}`, entry)  // "Mississippi Rebels"
    }
  }
}

/**
 * Resolve any spelling of a team to its canonical record.
 * Accepts full names ("Ohio State Buckeyes") or bare locations ("Ohio State").
 * @returns {{name:string, loc:string, mascot:string, conference:string} | null}
 */
export function resolveTeam(name) {
  return byName.get(normalizeTeamName(name)) ?? null
}

/** Get the conference key for a team name, or null if unrecognized. */
export function getTeamConference(teamName) {
  return resolveTeam(teamName)?.conference ?? null
}

// ── Conference-level helpers ─────────────────────────────────────────────────

export const POWER4 = CONFERENCES.filter((c) => c.tier === 'power4').map((c) => ({ key: c.key, label: c.label }))
export const GROUP5 = CONFERENCES.filter((c) => c.tier === 'group5').map((c) => ({ key: c.key, label: c.label }))
export const ALL_CONFERENCES = CONFERENCES.map((c) => ({ key: c.key, label: c.label }))

/** Display order for filter chips — Power 4, then Group of 5, then independents. */
export const CONFERENCE_ORDER = CONFERENCES.map((c) => c.key)

/** Conference key -> array of full team names. */
export const CONFERENCE_TEAMS = Object.fromEntries(
  CONFERENCES.map((c) => [c.key, c.teams.map(fullName)])
)

/** Flat team name -> conference key map (kept for convenience/back-compat). */
export const TEAM_CONFERENCE = Object.fromEntries(
  CONFERENCES.flatMap((c) => c.teams.map((t) => [fullName(t), c.key]))
)

/**
 * Return conferences of a given tier that haven't been used yet this season.
 * @param {string[]} usedKeys - conference keys already used
 * @param {'power4' | 'group5'} tier
 */
export function getAvailableConferences(usedKeys = [], tier = 'power4') {
  return CONFERENCES
    .filter((c) => c.tier === tier && !usedKeys.includes(c.key))
    .map((c) => ({ key: c.key, label: c.label }))
}

/** Get the display label for a conference key. */
export function getConferenceLabel(key) {
  return CONFERENCES.find((c) => c.key === key)?.label ?? key
}
