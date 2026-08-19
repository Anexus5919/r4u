import { cn } from '@/lib/cn'

/*
  radius 2px, 1px edge, no shadow, no scale on hover, no pill shapes.
  The only coloured ground in the system is accent-solid on the primary variant.
*/

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-on border-transparent hover:opacity-90',
  secondary: 'bg-transparent text-ink-11 border-ink-05 hover:bg-ink-02 hover:border-ink-06',
  ghost: 'bg-transparent text-ink-09 border-transparent hover:bg-ink-02 hover:text-ink-11',
  danger: 'bg-transparent text-danger border-ink-05 hover:bg-ink-02 hover:border-danger',
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xs border font-medium whitespace-nowrap',
        't-xs transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        SIZES[size],
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {/* the label is swapped rather than joined by a spinner, so width does not jump */}
      {loading ? <span className="text-ink-09">Working</span> : children}
    </button>
  )
}
