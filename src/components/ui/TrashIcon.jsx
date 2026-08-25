/**
 * Trash icon, drawn rather than typed.
 *
 * The delete buttons used the 🗑 character, which is U+1F5D1 with no emoji
 * variation selector — so most platforms render it as a flat monochrome glyph
 * and some show a box. Either way it looked nothing like the rest of the
 * interface, and it was the one control in the dashboard that cannot be undone.
 *
 * Strokes use currentColor, so a button colours the icon by setting its own
 * text colour and the two never drift apart.
 */
export default function TrashIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
