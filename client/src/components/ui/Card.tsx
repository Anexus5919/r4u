import { cn } from '@/lib/cn'

// 6px radius, 1px edge, no shadow, hover darkens the edge only; never nest a Card

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'lift rounded-sm border border-ink-04 bg-ink-00',
        interactive && 't-xs transition-colors hover:border-ink-06',
        className
      )}
      {...rest}
    />
  )
}

export function Rule({ className, ...rest }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-ink-04', className)} {...rest} />
}

// a static block, never a shimmer sweep: the sweep is a catalogued tell
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('rounded-xs bg-ink-03', className)} {...rest} />
}

// status is a text label with a glyph, never a coloured pill
export function StatusLabel({
  on,
  children,
  className,
}: {
  on: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-09', className)}>
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-xs border border-ink-08',
          on ? 'bg-ink-08' : 'bg-transparent'
        )}
      />
      {children}
    </span>
  )
}

// an empty state is an instruction with one action, no illustration or icon
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-12', className)}>
      <h3 className="text-lg">{title}</h3>
      <p className="text-sm text-ink-09">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
