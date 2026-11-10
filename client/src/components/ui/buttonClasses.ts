import { cn } from '@/lib/cn'

// kept out of Button.tsx so that file exports components only, which Fast Refresh needs

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-on border-transparent hover:bg-accent-hover lift',
  secondary: 'bg-ink-00 text-ink-12 border-ink-05 hover:bg-ink-02 hover:border-ink-06 lift',
  ghost: 'bg-transparent text-ink-10 border-transparent hover:bg-ink-03 hover:text-ink-12',
  danger: 'bg-ink-00 text-danger border-ink-05 hover:bg-ink-02 hover:border-danger',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-md gap-2',
}

const BASE =
  'inline-flex items-center justify-center rounded-xs border font-medium whitespace-nowrap ' +
  't-xs transition-colors no-underline'

export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra?: string
) {
  return cn(BASE, SIZES[size], VARIANTS[variant], extra)
}
