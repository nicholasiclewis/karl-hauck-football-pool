/**
 * Circular avatar showing the player's initials.
 * size: 'sm' | 'md' | 'lg'
 */
export default function Avatar({ name = '?', size = 'md', className = '' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sizes = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary font-bold text-white flex-shrink-0 ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  )
}
