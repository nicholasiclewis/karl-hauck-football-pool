/**
 * Container card with the deep navy background and blue border.
 * variant: 'default' | 'elevated' (slightly lighter bg)
 */
export default function Card({ children, variant = 'default', className = '', ...props }) {
  const variants = {
    default:  'bg-card border border-border',
    elevated: 'bg-card2 border border-border2',
  }

  return (
    <div
      className={`rounded-xl ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
