import { cn } from '@/lib/cn'

// twelve glyphs on one 16px grid and stroke; no library, and none added without a removal

const PATHS = {
  plus: 'M8 3.5v9M3.5 8h9',
  close: 'M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5',
  check: 'M3.5 8.5l3 3 6-6.5',
  chevron: 'M4.5 6.5L8 10l3.5-3.5',
  arrow: 'M3 8h9.5M8.75 4.25L12.5 8l-3.75 3.75',
  search: 'M10.25 10.25L13 13M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z',
  grip: 'M4 5.25h8M4 8h8M4 10.75h8',
  eye: 'M1.75 8S4.25 4 8 4s6.25 4 6.25 4-2.5 4-6.25 4S1.75 8 1.75 8zM9.75 8a1.75 1.75 0 11-3.5 0 1.75 1.75 0 013.5 0z',
  eyeOff:
    'M6.5 4.25A6.6 6.6 0 018 4.13c3.75 0 6.25 3.87 6.25 3.87a12 12 0 01-2 2.35M3.6 5.6A11.7 11.7 0 001.75 8S4.25 11.87 8 11.87c1 0 1.9-.27 2.68-.68M2.75 2.75l10.5 10.5',
  trash: 'M3.25 4.5h9.5M6.25 4.5V3.25h3.5V4.5M4.75 4.5l.6 8.25h5.3l.6-8.25',
  download: 'M8 2.75v7.5M5.25 7.5L8 10.25l2.75-2.75M3.25 13.25h9.5',
  link: 'M6.75 9.25l2.5-2.5M7.25 5.5l1.4-1.4a2.62 2.62 0 013.7 3.7L11 9.15M9.15 11l-1.25 1.25a2.62 2.62 0 01-3.7-3.7L5.5 7.25',
} as const

export type IconName = keyof typeof PATHS

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName
  /** Give a label only when the icon carries meaning no adjacent text already conveys. */
  label?: string
}

export function Icon({ name, label, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

// two-letter monospace marks rather than pictograms: more legible at 12px
export function SectionMark({ children, className }: { children: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-mono text-2xs tracking-wide text-ink-07 uppercase tabular-nums select-none',
        className
      )}
    >
      {children.slice(0, 2)}
    </span>
  )
}
