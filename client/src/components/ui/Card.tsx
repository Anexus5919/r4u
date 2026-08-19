import { cn } from '@/lib/cn'

/*
  radius 6px, 1px edge, no shadow at rest. Hover darkens the edge only: no lift, no scale.
  Never nest a Card inside a Card. If a region needs separation inside one, use whitespace
  and a Rule.
*/

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-sm border border-ink-05 bg-ink-00',
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

/*
  A static block, never a shimmer sweep. The sweep is a catalogued tell and it also draws the
  eye to nothing.
*/
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('rounded-xs bg-ink-03', className)} {...rest} />
}

/*
  Status reads as a text label preceded by a filled or hollow glyph, never a coloured pill.
  Coloured pills across a table are the fastest way to destroy a monochrome system.
*/
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

/*
  Empty states are instructions with one action. No illustration, no icon, no "nothing here yet".
*/
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
