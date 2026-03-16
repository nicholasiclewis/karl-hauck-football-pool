/**
 * Reusable button component.
 * variant: 'primary' | 'secondary' | 'danger' | 'ghost'
 * size:    'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:   'bg-primary hover:bg-primary-light text-white',
    secondary: 'bg-card2 hover:bg-border border border-border2 text-text',
    danger:    'bg-red/20 hover:bg-red/30 border border-red/40 text-red',
    ghost:     'text-accent-text hover:text-primary-light',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-sm px-5 py-3',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait...' : children}
    </button>
  )
}
