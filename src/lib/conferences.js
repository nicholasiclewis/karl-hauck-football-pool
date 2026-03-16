// Power 4 conferences (used in NFL + College weeks)
export const POWER4 = [
  { key: 'SEC',     label: 'SEC' },
  { key: 'Big Ten', label: 'Big Ten' },
  { key: 'Big 12',  label: 'Big 12' },
  { key: 'ACC',     label: 'ACC' },
]

// Group of 5 conferences
export const GROUP5 = [
  { key: 'AAC',           label: 'AAC' },
  { key: 'Mountain West', label: 'Mountain West' },
  { key: 'Conference USA', label: 'Conference USA' },
  { key: 'MAC',           label: 'MAC' },
  { key: 'Sun Belt',      label: 'Sun Belt' },
]

export const ALL_CONFERENCES = [...POWER4, ...GROUP5]

/**
 * Return conferences of a given type that haven't been used yet this season.
 * @param {string[]} usedKeys - array of conference keys already used
 * @param {'power4' | 'group5'} type
 */
export function getAvailableConferences(usedKeys = [], type = 'power4') {
  const list = type === 'power4' ? POWER4 : GROUP5
  return list.filter((c) => !usedKeys.includes(c.key))
}

/**
 * Get the label for a conference key.
 */
export function getConferenceLabel(key) {
  return ALL_CONFERENCES.find((c) => c.key === key)?.label ?? key
}
