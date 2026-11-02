/**
 * The 🎁 tucked on the corner of an avatar for whoever won the Christmas elf
 * game (see src/lib/elfGame.js). Sits inside the avatar's relative wrapper.
 */
export default function GiftBadge({ size = 'text-sm' }) {
  return (
    <span
      role="img"
      aria-label="Elf game champion"
      title="Top score in the elf's Christmas game"
      className={`absolute -bottom-1 -right-1.5 leading-none ${size}`}
    >
      🎁
    </span>
  )
}
