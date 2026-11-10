import { cn } from '@/lib/cn'

// the avatar is the one permitted circle in the product, per DESIGN-SYSTEM.md section 6
const SHAPE = 'shrink-0 rounded-full' // design-guard-allow

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (src) {
    return <img src={src} alt="" className={cn(SHAPE, SIZES[size], 'object-cover', className)} />
  }

  return (
    <span
      aria-hidden
      className={cn(
        SHAPE,
        SIZES[size],
        'flex items-center justify-center bg-accent-subtle font-semibold text-accent-text',
        className
      )}
    >
      {initials(name)}
    </span>
  )
}
