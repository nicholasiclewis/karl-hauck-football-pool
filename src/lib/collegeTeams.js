/**
 * Maps college football team names (as returned by The Odds API)
 * to their conference. Used to filter games in the commissioner picker.
 */

export const TEAM_CONFERENCE = {
  // ── SEC ──────────────────────────────────────────────────────────────────
  'Alabama Crimson Tide':       'SEC',
  'Arkansas Razorbacks':        'SEC',
  'Auburn Tigers':              'SEC',
  'Florida Gators':             'SEC',
  'Georgia Bulldogs':           'SEC',
  'Kentucky Wildcats':          'SEC',
  'LSU Tigers':                 'SEC',
  'Mississippi State Bulldogs': 'SEC',
  'Missouri Tigers':            'SEC',
  'Oklahoma Sooners':           'SEC',
  'Ole Miss Rebels':            'SEC',
  'South Carolina Gamecocks':   'SEC',
  'Tennessee Volunteers':       'SEC',
  'Texas Longhorns':            'SEC',
  'Texas A&M Aggies':           'SEC',
  'Vanderbilt Commodores':      'SEC',

  // ── Big Ten ───────────────────────────────────────────────────────────────
  'Illinois Fighting Illini':   'Big Ten',
  'Indiana Hoosiers':           'Big Ten',
  'Iowa Hawkeyes':              'Big Ten',
  'Maryland Terrapins':         'Big Ten',
  'Michigan Wolverines':        'Big Ten',
  'Michigan State Spartans':    'Big Ten',
  'Minnesota Golden Gophers':   'Big Ten',
  'Nebraska Cornhuskers':       'Big Ten',
  'Northwestern Wildcats':      'Big Ten',
  'Ohio State Buckeyes':        'Big Ten',
  'Oregon Ducks':               'Big Ten',
  'Penn State Nittany Lions':   'Big Ten',
  'Purdue Boilermakers':        'Big Ten',
  'Rutgers Scarlet Knights':    'Big Ten',
  'UCLA Bruins':                'Big Ten',
  'USC Trojans':                'Big Ten',
  'Washington Huskies':         'Big Ten',
  'Wisconsin Badgers':          'Big Ten',

  // ── Big 12 ───────────────────────────────────────────────────────────────
  'Arizona Wildcats':           'Big 12',
  'Arizona State Sun Devils':   'Big 12',
  'Baylor Bears':               'Big 12',
  'BYU Cougars':                'Big 12',
  'Cincinnati Bearcats':        'Big 12',
  'Colorado Buffaloes':         'Big 12',
  'Houston Cougars':            'Big 12',
  'Iowa State Cyclones':        'Big 12',
  'Kansas Jayhawks':            'Big 12',
  'Kansas State Wildcats':      'Big 12',
  'Oklahoma State Cowboys':     'Big 12',
  'TCU Horned Frogs':           'Big 12',
  'Texas Tech Red Raiders':     'Big 12',
  'UCF Knights':                'Big 12',
  'Utah Utes':                  'Big 12',
  'West Virginia Mountaineers': 'Big 12',

  // ── ACC ──────────────────────────────────────────────────────────────────
  'Boston College Eagles':      'ACC',
  'California Golden Bears':    'ACC',
  'Clemson Tigers':             'ACC',
  'Duke Blue Devils':           'ACC',
  'Florida State Seminoles':    'ACC',
  'Georgia Tech Yellow Jackets':'ACC',
  'Louisville Cardinals':       'ACC',
  'Miami Hurricanes':           'ACC',
  'NC State Wolfpack':          'ACC',
  'North Carolina Tar Heels':   'ACC',
  'Pittsburgh Panthers':        'ACC',
  'SMU Mustangs':               'ACC',
  'Stanford Cardinal':          'ACC',
  'Syracuse Orange':            'ACC',
  'Virginia Cavaliers':         'ACC',
  'Virginia Tech Hokies':       'ACC',
  'Wake Forest Demon Deacons':  'ACC',

  // ── AAC ──────────────────────────────────────────────────────────────────
  'Army Black Knights':         'AAC',
  'Charlotte 49ers':            'AAC',
  'East Carolina Pirates':      'AAC',
  'Florida Atlantic Owls':      'AAC',
  'Memphis Tigers':             'AAC',
  'Navy Midshipmen':            'AAC',
  'North Texas Mean Green':     'AAC',
  'Rice Owls':                  'AAC',
  'South Florida Bulls':        'AAC',
  'Temple Owls':                'AAC',
  'Tulane Green Wave':          'AAC',
  'Tulsa Golden Hurricane':     'AAC',
  'UAB Blazers':                'AAC',
  'UTSA Roadrunners':           'AAC',
  'Wichita State Shockers':     'AAC',

  // ── Mountain West ─────────────────────────────────────────────────────────
  'Air Force Falcons':          'Mountain West',
  'Boise State Broncos':        'Mountain West',
  'Colorado State Rams':        'Mountain West',
  'Fresno State Bulldogs':      'Mountain West',
  'Hawaii Rainbow Warriors':    'Mountain West',
  'Nevada Wolf Pack':           'Mountain West',
  'New Mexico Lobos':           'Mountain West',
  'San Diego State Aztecs':     'Mountain West',
  'San Jose State Spartans':    'Mountain West',
  'UNLV Rebels':                'Mountain West',
  'Utah State Aggies':          'Mountain West',
  'Wyoming Cowboys':            'Mountain West',

  // ── Conference USA ────────────────────────────────────────────────────────
  'Jacksonville State Gamecocks': 'Conference USA',
  'Kennesaw State Owls':          'Conference USA',
  'Liberty Flames':               'Conference USA',
  'Louisiana Tech Bulldogs':      'Conference USA',
  'Middle Tennessee Blue Raiders':'Conference USA',
  'New Mexico State Aggies':      'Conference USA',
  'Sam Houston Bearkats':         'Conference USA',
  'UTEP Miners':                  'Conference USA',
  'Western Kentucky Hilltoppers': 'Conference USA',

  // ── MAC ───────────────────────────────────────────────────────────────────
  'Akron Zips':                 'MAC',
  'Ball State Cardinals':       'MAC',
  'Bowling Green Falcons':      'MAC',
  'Buffalo Bulls':              'MAC',
  'Central Michigan Chippewas': 'MAC',
  'Eastern Michigan Eagles':    'MAC',
  'Kent State Golden Flashes':  'MAC',
  'Miami (OH) Redhawks':        'MAC',
  'Northern Illinois Huskies':  'MAC',
  'Ohio Bobcats':               'MAC',
  'Toledo Rockets':             'MAC',
  'Western Michigan Broncos':   'MAC',

  // ── Sun Belt ──────────────────────────────────────────────────────────────
  'Appalachian State Mountaineers': 'Sun Belt',
  'Arkansas State Red Wolves':      'Sun Belt',
  'Coastal Carolina Chanticleers':  'Sun Belt',
  'Georgia Southern Eagles':        'Sun Belt',
  'Georgia State Panthers':         'Sun Belt',
  'James Madison Dukes':            'Sun Belt',
  'Louisiana Ragin Cajuns':         'Sun Belt',
  'Marshall Thundering Herd':       'Sun Belt',
  'Old Dominion Monarchs':          'Sun Belt',
  'South Alabama Jaguars':          'Sun Belt',
  'Southern Miss Golden Eagles':    'Sun Belt',
  'Texas State Bobcats':            'Sun Belt',
  'Troy Trojans':                   'Sun Belt',

  // ── Independents ──────────────────────────────────────────────────────────
  'Notre Dame Fighting Irish':  'Independent',
  'Connecticut Huskies':        'Independent',
  'Massachusetts Minutemen':    'Independent',
}

/** Get the conference for a team name, or null if not found */
export function getTeamConference(teamName) {
  return TEAM_CONFERENCE[teamName] ?? null
}

/** All unique conferences in display order */
export const CONFERENCE_ORDER = [
  'SEC', 'Big Ten', 'Big 12', 'ACC',
  'AAC', 'Mountain West', 'Conference USA', 'MAC', 'Sun Belt',
  'Independent',
]
