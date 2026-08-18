/**
 * Shared look for generated PDFs, matching the app's palette.
 *
 * Extracted so the season report and the weekly exports stay visually
 * identical — these are documents players see side by side.
 */

// These documents are printed and emailed as attachments, so the palette is
// light: a dark A4 sheet comes off an office printer as a solid block of ink.
//
// Every value below was measured against the three surfaces text can land on
// (#ffffff page, #f8fafc row, #eef2f7 alternate row) and clears 4.5:1 — the
// dark palette's accents did not survive the inversion, with gold at 1.67:1
// and green at 2.54:1 on white.
//
// The one exception is deliberate: the poster field keeps its saturated blue,
// because white on it measures 7.96:1 and gold 4.77:1, and it is the single
// block that carries the page.
export const BG      = [255, 255, 255]   // #ffffff page
export const CARD    = [248, 250, 252]   // #f8fafc row fill
export const CARD2   = [238, 242, 247]   // #eef2f7 alternate row
export const BORDER  = [203, 213, 225]   // #cbd5e1 hairline
export const PRIMARY = [ 26,  71, 184]   // #1a47b8 poster field, unchanged
export const PLIGHT  = [ 26,  71, 184]   // was #6096e8 — 2.4:1 on white
export const TEXT    = [ 15,  23,  42]   // #0f172a
export const MUTED   = [ 82, 103, 138]   // #52678a
// Reversed-out label on the primary poster field, the only place text sits on
// the saturated blue, where MUTED would disappear.
export const ON_POSTER = [188, 211, 247] // #bcd3f7
// The poster is the one dark surface left, so its text keeps the light values:
// the page colours would vanish on it.
export const ON_POSTER_TEXT = [255, 255, 255]  // 7.96:1 on the blue
export const ON_POSTER_GOLD = [251, 191,  36]  // #fbbf24, 4.77:1 on the blue
export const GOLD    = [148,  96,   8]   // #946008
export const SILVER  = [ 92, 107, 127]   // #5c6b7f
export const BRONZE  = [163,  74,   7]   // #a34a07
export const GREEN   = [  4, 120,  87]   // #047857

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
