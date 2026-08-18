/**
 * Team logo lookups, keyed by the names The Odds API sends.
 *
 * Logos are served from ESPN's CDN, addressed by a stable per-team slug (NFL)
 * or numeric id (college). Generated against the 2026 alignment in
 * conferences.js — regenerate if that file changes.
 *
 * Every lookup can return null, and callers must fall back to the text
 * abbreviation: teams get added, ids occasionally move, and a broken image is
 * worse than initials.
 */
import { resolveTeam } from './conferences.js'

/** NFL team name -> ESPN abbreviation slug. */
export const NFL_LOGO_SLUGS = {
  'Arizona Cardinals': 'ari',
  'Atlanta Falcons': 'atl',
  'Baltimore Ravens': 'bal',
  'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car',
  'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin',
  'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den',
  'Detroit Lions': 'det',
  'Green Bay Packers': 'gb',
  'Houston Texans': 'hou',
  'Indianapolis Colts': 'ind',
  'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kc',
  'Las Vegas Raiders': 'lv',
  'Los Angeles Chargers': 'lac',
  'Los Angeles Rams': 'lar',
  'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min',
  'New England Patriots': 'ne',
  'New Orleans Saints': 'no',
  'New York Giants': 'nyg',
  'New York Jets': 'nyj',
  'Philadelphia Eagles': 'phi',
  'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sf',
  'Seattle Seahawks': 'sea',
  'Tampa Bay Buccaneers': 'tb',
  'Tennessee Titans': 'ten',
  'Washington Commanders': 'wsh'
}

/** Canonical college team name -> ESPN numeric team id. */
export const CFB_LOGO_IDS = {
  'Air Force Falcons': 2005,
  'Akron Zips': 2006,
  'Alabama Crimson Tide': 333,
  'Appalachian State Mountaineers': 2026,
  'Arizona State Sun Devils': 9,
  'Arizona Wildcats': 12,
  'Arkansas Razorbacks': 8,
  'Arkansas State Red Wolves': 2032,
  'Army Black Knights': 349,
  'Auburn Tigers': 2,
  'BYU Cougars': 252,
  'Ball State Cardinals': 2050,
  'Baylor Bears': 239,
  'Boise State Broncos': 68,
  'Boston College Eagles': 103,
  'Bowling Green Falcons': 189,
  'Buffalo Bulls': 2084,
  'California Golden Bears': 25,
  'Central Michigan Chippewas': 2117,
  'Charlotte 49ers': 2429,
  'Cincinnati Bearcats': 2132,
  'Clemson Tigers': 228,
  'Coastal Carolina Chanticleers': 324,
  'Colorado Buffaloes': 38,
  'Colorado State Rams': 36,
  'Delaware Blue Hens': 48,
  'Duke Blue Devils': 150,
  'East Carolina Pirates': 151,
  'Eastern Michigan Eagles': 2199,
  'Florida Atlantic Owls': 2226,
  'Florida Gators': 57,
  'Florida International Panthers': 2229,
  'Florida State Seminoles': 52,
  'Fresno State Bulldogs': 278,
  'Georgia Bulldogs': 61,
  'Georgia Southern Eagles': 290,
  'Georgia State Panthers': 2247,
  'Georgia Tech Yellow Jackets': 59,
  'Hawaii Rainbow Warriors': 62,
  'Houston Cougars': 248,
  'Illinois Fighting Illini': 356,
  'Indiana Hoosiers': 84,
  'Iowa Hawkeyes': 2294,
  'Iowa State Cyclones': 66,
  'Jacksonville State Gamecocks': 55,
  'James Madison Dukes': 256,
  'Kansas Jayhawks': 2305,
  'Kansas State Wildcats': 2306,
  'Kennesaw State Owls': 338,
  'Kent State Golden Flashes': 2309,
  'Kentucky Wildcats': 96,
  'LSU Tigers': 99,
  'Liberty Flames': 2335,
  'Louisiana Ragin Cajuns': 309,
  'Louisiana Tech Bulldogs': 2348,
  'Louisville Cardinals': 97,
  'Marshall Thundering Herd': 276,
  'Maryland Terrapins': 120,
  'Massachusetts Minutemen': 113,
  'Memphis Tigers': 235,
  'Miami (OH) Redhawks': 193,
  'Miami Hurricanes': 2390,
  'Michigan State Spartans': 127,
  'Michigan Wolverines': 130,
  'Middle Tennessee Blue Raiders': 2393,
  'Minnesota Golden Gophers': 135,
  'Mississippi State Bulldogs': 344,
  'Missouri State Bears': 2623,
  'Missouri Tigers': 142,
  'NC State Wolfpack': 152,
  'Navy Midshipmen': 2426,
  'Nebraska Cornhuskers': 158,
  'Nevada Wolf Pack': 2440,
  'New Mexico Lobos': 167,
  'New Mexico State Aggies': 166,
  'North Carolina Tar Heels': 153,
  'North Dakota State Bison': 2449,
  'North Texas Mean Green': 249,
  'Northern Illinois Huskies': 2459,
  'Northwestern Wildcats': 77,
  'Notre Dame Fighting Irish': 87,
  'Ohio Bobcats': 195,
  'Ohio State Buckeyes': 194,
  'Oklahoma Sooners': 201,
  'Oklahoma State Cowboys': 197,
  'Old Dominion Monarchs': 295,
  'Ole Miss Rebels': 145,
  'Oregon Ducks': 2483,
  'Oregon State Beavers': 204,
  'Penn State Nittany Lions': 213,
  'Pittsburgh Panthers': 221,
  'Purdue Boilermakers': 2509,
  'Rice Owls': 242,
  'Rutgers Scarlet Knights': 164,
  'SMU Mustangs': 2567,
  'Sacramento State Hornets': 16,
  'Sam Houston Bearkats': 2534,
  'San Diego State Aztecs': 21,
  'San Jose State Spartans': 23,
  'South Alabama Jaguars': 6,
  'South Carolina Gamecocks': 2579,
  'South Florida Bulls': 58,
  'Southern Miss Golden Eagles': 2572,
  'Stanford Cardinal': 24,
  'Syracuse Orange': 183,
  'TCU Horned Frogs': 2628,
  'Temple Owls': 218,
  'Tennessee Volunteers': 2633,
  'Texas A&M Aggies': 245,
  'Texas Longhorns': 251,
  'Texas State Bobcats': 326,
  'Texas Tech Red Raiders': 2641,
  'Toledo Rockets': 2649,
  'Troy Trojans': 2653,
  'Tulane Green Wave': 2655,
  'Tulsa Golden Hurricane': 202,
  'UAB Blazers': 5,
  'UCF Knights': 2116,
  'UCLA Bruins': 26,
  'Connecticut Huskies': 41,
  'Louisiana Monroe Warhawks': 2433,
  'UNLV Rebels': 2439,
  'USC Trojans': 30,
  'UTEP Miners': 2638,
  'UTSA Roadrunners': 2636,
  'Utah State Aggies': 328,
  'Utah Utes': 254,
  'Vanderbilt Commodores': 238,
  'Virginia Cavaliers': 258,
  'Virginia Tech Hokies': 259,
  'Wake Forest Demon Deacons': 154,
  'Washington Huskies': 264,
  'Washington State Cougars': 265,
  'West Virginia Mountaineers': 277,
  'Western Kentucky Hilltoppers': 98,
  'Western Michigan Broncos': 2711,
  'Wisconsin Badgers': 275,
  'Wyoming Cowboys': 2751
}

/**
 * Logo URL for a team, or null when we have no mapping.
 * @param {string} teamName  name as stored on the game row
 * @param {'nfl'|'college'} sport
 */
export function teamLogoUrl(teamName, sport) {
  if (!teamName) return null

  if (sport === 'nfl') {
    const slug = NFL_LOGO_SLUGS[teamName]
    return slug ? `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png` : null
  }

  // College names vary between sources, so normalize through conferences.js
  // before looking up — "Mississippi Rebels" and "Ole Miss Rebels" are one team.
  const canon = resolveTeam(teamName)
  const id = CFB_LOGO_IDS[canon?.name ?? teamName]
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null
}
