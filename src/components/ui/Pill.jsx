/**
 * Rounded pill label — used for week type chips, conference labels, etc.
 * color: 'blue' | 'green' | 'red' | 'gray'
 */
export default function Pill({ children, color = 'blue', className = '' }) {
  const colors = {
    blue:  'bg-primary/20 text-accent-text border border-primary/30',
    green: 'bg-green/15 text-green border border-green/25',
    red:   'bg-red/15 text-red border border-red/25',
    gray:  'bg-muted/15 text-muted border border-muted/25',
  }

  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${colors[color]} ${className}`}>
      {children}
    </span>
  )
}
