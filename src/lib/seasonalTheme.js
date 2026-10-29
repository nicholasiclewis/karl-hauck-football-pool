/**
 * Seasonal themes.
 *
 * A theme is a class on <html> that src/index.css repaints the palette for. Each
 * one runs between fixed dates in the viewer's local time, so it starts and
 * stops on its own: nothing has to be deployed to take it down again.
 */

const THEMES = [
  {
    name: 'halloween',
    // Halloween week: on from Thursday 29 Oct 2026, back to normal at the
    // start of Tuesday 3 Nov.
    start: new Date(2026, 9, 29),
    end: new Date(2026, 10, 3),
  },
]

/** The theme running at `now`, or null. */
export function activeTheme(now = new Date()) {
  const theme = THEMES.find((t) => now >= t.start && now < t.end)
  return theme ? theme.name : null
}

/** Puts the running theme's class on <html>. */
export function applySeasonalTheme(root = document.documentElement, now = new Date()) {
  const theme = activeTheme(now)
  if (!theme) return null

  root.classList.add(theme)
  // Match the phone's status bar to the themed background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && bg) meta.setAttribute('content', bg)
  return theme
}
