/**
 * Shared look for generated PDFs, matching the app's palette.
 *
 * Extracted so the season report and the weekly exports stay visually
 * identical — these are documents players see side by side.
 */

export const BG      = [ 11,  17,  32]   // #0b1120
export const CARD    = [ 18,  29,  53]   // #121d35
export const CARD2   = [ 26,  40,  72]   // #1a2848
export const BORDER  = [ 30,  53, 102]   // #1e3566
export const PRIMARY = [ 26,  71, 184]   // #1a47b8
export const PLIGHT  = [ 96, 150, 232]   // #6096e8
export const TEXT    = [221, 238, 255]   // #ddeeff
export const MUTED   = [119, 153, 204]   // #7799cc
// Reversed-out label on the primary poster field — the only place text sits on
// a saturated blue, where MUTED would disappear.
export const ON_POSTER = [188, 211, 247] // #bcd3f7
export const GOLD    = [251, 191,  36]   // #fbbf24
export const SILVER  = [148, 163, 184]   // #94a3b8
export const BRONZE  = [180,  83,   9]   // #b45309
export const GREEN   = [ 34, 197,  94]   // #22c55e

export const PAGE_W = 210
export const PAGE_H = 297
export const COL_L  = 14
export const COL_R  = PAGE_W - 14

/** Paint the dark page background. Call before drawing anything on a page. */
export function fullBg(doc) {
  doc.setFillColor(...BG)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
}

/** Coloured section header bar. Returns the y to continue drawing from. */
export function sectionBanner(doc, text, y, color = PRIMARY) {
  doc.setFillColor(...color)
  doc.roundedRect(COL_L, y, COL_R - COL_L, 9, 1.5, 1.5, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text(text.toUpperCase(), COL_L + 4, y + 6.2)
  return y + 14
}

/** Medal colour for a finishing position. */
export function rankColor(rank) {
  if (rank === 1) return GOLD
  if (rank === 2) return SILVER
  if (rank === 3) return BRONZE
  return TEXT
}
