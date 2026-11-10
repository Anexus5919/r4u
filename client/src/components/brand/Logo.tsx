import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

// the 4 is the pivot of RESUME 4 YOU, so it alone carries the accent
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('text-[22px] leading-none font-bold tracking-[-0.04em] text-ink-12', className)}
    >
      R<span className="text-accent">4</span>U
    </span>
  )
}

export function Logo({
  to = '/',
  tagline = false,
  className,
}: {
  to?: string
  tagline?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label="R4U, Resume For You"
      className={cn('inline-flex items-center gap-3 no-underline', className)}
    >
      <Wordmark />
      {tagline ? (
        <span className="hidden border-l border-ink-05 pl-3 text-2xs font-medium tracking-[0.08em] text-ink-09 uppercase sm:inline">
          Resume For You
        </span>
      ) : null}
    </Link>
  )
}
