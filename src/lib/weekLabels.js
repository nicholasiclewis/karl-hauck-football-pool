/**
 * What to call a week's college half.
 *
 * The picks page was captioning the college section with the poll the rank
 * badges came from — "AP Top 25" — which reads as the week's category and is
 * wrong whenever the week is built round a conference. A Pac-12 week said
 * Top 25 while showing Pac-12 games.
 *
 * The poll caption is about the little numbers beside team names. The category
 * is about which games are in the week. They are different facts and only one
 * of them belongs in the heading.
 */

const FOCUS_NAMES = {
  power4:    'Power 4',
  group5:    'Group of 5',
  top25:     'Top 25',
  rivalry:   'Rivalry',
  confchamp: 'Conf. Champs',
  cfp:       'CFP',
}

/** A college focus by its display name, or the raw value if we don't know it. */
export function focusName(focus) {
  if (!focus) return ''
  return FOCUS_NAMES[focus] ?? focus
}

/**
 * The short caption for a week's college games.
 *
 * A named conference wins, because it is the more specific truth: "Pac-12"
 * tells a player what they are looking at, where "Group of 5" only says which
 * shelf it came off.
 */
export function collegeFocusLabel(week) {
  const conference = week?.conference?.trim()
  if (conference) return conference
  return focusName(week?.college_focus)
}
