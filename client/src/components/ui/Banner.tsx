import { cn } from '@/lib/cn'

// neutral surface, only a hairline left rule carries the tone, never a tinted panel
const RULE = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
  info: 'border-l-info',
} as const

export type BannerTone = keyof typeof RULE

export function Banner({
  tone = 'danger',
  children,
  className,
}: {
  tone?: BannerTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-xs border border-l-2 border-ink-05 bg-ink-00 px-3 py-2.5 text-sm text-ink-11',
        RULE[tone],
        className
      )}
    >
      {children}
    </div>
  )
}
