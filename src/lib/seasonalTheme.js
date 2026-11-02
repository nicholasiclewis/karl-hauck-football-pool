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
  {
    name: 'thanksgiving',
    // Thanksgiving week: Monday 23 Nov through Monday night's game on 30 Nov.
    start: new Date(2026, 10, 23),
    end: new Date(2026, 11, 1),
  },
  {
    name: 'karl',
    // Karl Hauck's birthday, Monday 7 Dec 2026 — the day only.
    start: new Date(2026, 11, 7),
    end: new Date(2026, 11, 8),
  },
  {
    name: 'christmas',
    // Christmas week: Monday 21 Dec through Monday night's game on 28 Dec.
    start: new Date(2026, 11, 21),
    end: new Date(2026, 11, 29),
  },
  {
    name: 'newyear',
    // New Year's: Tuesday 29 Dec through the last weekend, off on Tuesday 5 Jan.
    start: new Date(2026, 11, 29),
    end: new Date(2027, 0, 5),
  },
]

export const THEME_NAMES = THEMES.map((t) => t.name)

/** When a theme starts and ends: { start, end } as Dates. */
export function themeWindow(name) {
  const { start, end } = THEMES.find((t) => t.name === name)
  return { start, end }
}

/** The theme being previewed on the dev server, or undefined. */
export function previewing() {
  return previewTheme()
}

/*
 * Local preview: on the dev server only, ?theme=<name> forces a theme for the
 * rest of the tab's session (?theme=off clears it). Production builds drop
 * this, so nobody can open a theme early on the live site.
 */
function previewTheme() {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return undefined
  const asked = new URLSearchParams(window.location.search).get('theme')
  if (asked === 'off') sessionStorage.removeItem('preview-theme')
  else if (THEME_NAMES.includes(asked)) sessionStorage.setItem('preview-theme', asked)
  return sessionStorage.getItem('preview-theme') ?? undefined
}

/** The theme running at `now`, or null. */
export function activeTheme(now) {
  if (now === undefined) {
    const preview = previewTheme()
    if (preview) return preview
    now = new Date()
  }
  const theme = THEMES.find((t) => now >= t.start && now < t.end)
  return theme ? theme.name : null
}

/** Puts the running theme's class on <html>. */
export function applySeasonalTheme(root = document.documentElement) {
  const theme = activeTheme()
  if (!theme) return null

  root.classList.add(theme)
  // Match the phone's status bar to the themed background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && bg) meta.setAttribute('content', bg)
  return theme
}
