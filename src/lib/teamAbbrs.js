/**
 * ESPN-style team abbreviations, keyed the way the game rows store names.
 *
 * The old derived initials ("Green Bay Packers" → GBP, "Ohio State Buckeyes"
 * → OSB) matched nothing anyone reads on a scoreboard. These are the
 * abbreviations ESPN prints, so "GB @ CHI" and "MISS @ OSU" look like the
 * ticker everyone already knows.
 *
 * NFL comes free: the ESPN logo slugs in teamLogos.js are the lowercase form
 * of ESPN's own abbreviations, so uppercasing them is the mapping. College is
 * spelled out below against the 2026 alignment in conferences.js — keyed by
 * canonical full name and looked up through resolveTeam, so any spelling that
 * file recognizes finds its abbreviation. Regenerate if that file changes.
 *
 * Every lookup can return null; callers fall back to derived initials so an
 * unknown team still shows something.
 */
import { resolveTeam } from './conferences.js'
import { NFL_LOGO_SLUGS } from './teamLogos.js'

/** Canonical college team name -> ESPN abbreviation. */
export const CFB_ABBREVS = {
  // ── SEC ──
  'Alabama Crimson Tide': 'ALA',
  'Arkansas Razorbacks': 'ARK',
  'Auburn Tigers': 'AUB',
  'Florida Gators': 'FLA',
  'Georgia Bulldogs': 'UGA',
  'Kentucky Wildcats': 'UK',
  'LSU Tigers': 'LSU',
  'Ole Miss Rebels': 'MISS',
  'Mississippi State Bulldogs': 'MSST',
  'Missouri Tigers': 'MIZ',
  'Oklahoma Sooners': 'OU',
  'South Carolina Gamecocks': 'SC',
  'Tennessee Volunteers': 'TENN',
  'Texas Longhorns': 'TEX',
  'Texas A&M Aggies': 'TA&M',
  'Vanderbilt Commodores': 'VAN',
  // ── Big Ten ──
  'Illinois Fighting Illini': 'ILL',
  'Indiana Hoosiers': 'IND',
  'Iowa Hawkeyes': 'IOWA',
  'Maryland Terrapins': 'MD',
  'Michigan Wolverines': 'MICH',
  'Michigan State Spartans': 'MSU',
  'Minnesota Golden Gophers': 'MINN',
  'Nebraska Cornhuskers': 'NEB',
  'Northwestern Wildcats': 'NW',
  'Ohio State Buckeyes': 'OSU',
  'Oregon Ducks': 'ORE',
  'Penn State Nittany Lions': 'PSU',
  'Purdue Boilermakers': 'PUR',
  'Rutgers Scarlet Knights': 'RUTG',
  'UCLA Bruins': 'UCLA',
  'USC Trojans': 'USC',
  'Washington Huskies': 'WASH',
  'Wisconsin Badgers': 'WIS',
  // ── Big 12 ──
  'Arizona Wildcats': 'ARIZ',
  'Arizona State Sun Devils': 'ASU',
  'Baylor Bears': 'BAY',
  'BYU Cougars': 'BYU',
  'Cincinnati Bearcats': 'CIN',
  'Colorado Buffaloes': 'COLO',
  'Houston Cougars': 'HOU',
  'Iowa State Cyclones': 'ISU',
  'Kansas Jayhawks': 'KU',
  'Kansas State Wildcats': 'KSU',
  'Oklahoma State Cowboys': 'OKST',
  'TCU Horned Frogs': 'TCU',
  'Texas Tech Red Raiders': 'TTU',
  'UCF Knights': 'UCF',
  'Utah Utes': 'UTAH',
  'West Virginia Mountaineers': 'WVU',
  // ── ACC ──
  'Boston College Eagles': 'BC',
  'California Golden Bears': 'CAL',
  'Clemson Tigers': 'CLEM',
  'Duke Blue Devils': 'DUKE',
  'Florida State Seminoles': 'FSU',
  'Georgia Tech Yellow Jackets': 'GT',
  'Louisville Cardinals': 'LOU',
  'Miami Hurricanes': 'MIA',
  'NC State Wolfpack': 'NCST',
  'North Carolina Tar Heels': 'UNC',
  'Pittsburgh Panthers': 'PITT',
  'SMU Mustangs': 'SMU',
  'Stanford Cardinal': 'STAN',
  'Syracuse Orange': 'SYR',
  'Virginia Cavaliers': 'UVA',
  'Virginia Tech Hokies': 'VT',
  'Wake Forest Demon Deacons': 'WAKE',
  // ── AAC ──
  'Army Black Knights': 'ARMY',
  'Charlotte 49ers': 'CLT',
  'East Carolina Pirates': 'ECU',
  'Florida Atlantic Owls': 'FAU',
  'Memphis Tigers': 'MEM',
  'Navy Midshipmen': 'NAVY',
  'North Texas Mean Green': 'UNT',
  'Rice Owls': 'RICE',
  'South Florida Bulls': 'USF',
  'Temple Owls': 'TEM',
  'Tulane Green Wave': 'TULN',
  'Tulsa Golden Hurricane': 'TLSA',
  'UAB Blazers': 'UAB',
  'UTSA Roadrunners': 'UTSA',
  // ── Pac-12 ──
  'Boise State Broncos': 'BSU',
  'Colorado State Rams': 'CSU',
  'Fresno State Bulldogs': 'FRES',
  'Oregon State Beavers': 'ORST',
  'San Diego State Aztecs': 'SDSU',
  'Texas State Bobcats': 'TXST',
  'Utah State Aggies': 'USU',
  'Washington State Cougars': 'WSU',
  // ── Mountain West ──
  'Air Force Falcons': 'AFA',
  'Hawaii Rainbow Warriors': 'HAW',
  'Nevada Wolf Pack': 'NEV',
  'New Mexico Lobos': 'UNM',
  'North Dakota State Bison': 'NDSU',
  'Northern Illinois Huskies': 'NIU',
  'San Jose State Spartans': 'SJSU',
  'UNLV Rebels': 'UNLV',
  'UTEP Miners': 'UTEP',
  'Wyoming Cowboys': 'WYO',
  // ── Conference USA ──
  'Delaware Blue Hens': 'DEL',
  'Florida International Panthers': 'FIU',
  'Jacksonville State Gamecocks': 'JVST',
  'Kennesaw State Owls': 'KENN',
  'Liberty Flames': 'LIB',
  'Middle Tennessee Blue Raiders': 'MTSU',
  'Missouri State Bears': 'MOST',
  'New Mexico State Aggies': 'NMSU',
  'Sam Houston Bearkats': 'SHSU',
  'Western Kentucky Hilltoppers': 'WKU',
  // ── MAC ──
  'Akron Zips': 'AKR',
  'Ball State Cardinals': 'BALL',
  'Bowling Green Falcons': 'BGSU',
  'Buffalo Bulls': 'BUFF',
  'Central Michigan Chippewas': 'CMU',
  'Eastern Michigan Eagles': 'EMU',
  'Kent State Golden Flashes': 'KENT',
  'Miami (OH) Redhawks': 'M-OH',
  'Ohio Bobcats': 'OHIO',
  'Sacramento State Hornets': 'SAC',
  'Toledo Rockets': 'TOL',
  'Massachusetts Minutemen': 'MASS',
  'Western Michigan Broncos': 'WMU',
  // ── Sun Belt ──
  'Appalachian State Mountaineers': 'APP',
  'Arkansas State Red Wolves': 'ARST',
  'Coastal Carolina Chanticleers': 'CCU',
  'Georgia Southern Eagles': 'GASO',
  'Georgia State Panthers': 'GAST',
  'James Madison Dukes': 'JMU',
  'Louisiana Ragin Cajuns': 'UL',
  'Louisiana Monroe Warhawks': 'ULM',
  'Louisiana Tech Bulldogs': 'LT',
  'Marshall Thundering Herd': 'MRSH',
  'Old Dominion Monarchs': 'ODU',
  'South Alabama Jaguars': 'USA',
  'Southern Miss Golden Eagles': 'USM',
  'Troy Trojans': 'TROY',
  // ── Independents ──
  'Notre Dame Fighting Irish': 'ND',
  'Connecticut Huskies': 'CONN',
}

/**
 * ESPN abbreviation for a team, or null when we have no mapping.
 * Accepts any spelling conferences.js recognizes; NFL names must match the
 * game row exactly, same as the logo lookup.
 */
export function espnAbbr(teamName) {
  if (!teamName) return null

  const slug = NFL_LOGO_SLUGS[teamName]
  if (slug) return slug.toUpperCase()

  const canon = resolveTeam(teamName)
  return CFB_ABBREVS[canon?.name ?? teamName] ?? null
}
