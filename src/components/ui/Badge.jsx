/**
 * Small inline label badge.
 * variant: 'win' | 'loss' | 'push' | 'locked' | 'open' | 'default'
 */
export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    win:     'bg-green/20 text-green border border-green/30',
    loss:    'bg-red/20 text-red border border-red/30',
    push:    'bg-muted/20 text-muted border border-muted/30',
    locked:  'bg-border2/60 text-muted border border-border2',
    open:    'bg-primary/20 text-primary-light border border-primary/40',
    default: 'bg-card2 text-accent-text border border-border2',
  }

  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
