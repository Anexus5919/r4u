import { cn } from '@/lib/cn'

/*
  radius 2px, 1px edge, no shadow, no scale on hover, no pill shapes.
  The only coloured ground in the system is accent-solid on the primary variant.

  Kept out of Button.tsx so that file exports components only, which is what React Fast Refresh
  needs to preserve state on edit.
*/

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-on border-transparent hover:opacity-90',
  secondary: 'bg-transparent text-ink-11 border-ink-05 hover:bg-ink-02 hover:border-ink-06',
  ghost: 'bg-transparent text-ink-09 border-transparent hover:bg-ink-02 hover:text-ink-11',
  danger: 'bg-transparent text-danger border-ink-05 hover:bg-ink-02 hover:border-danger',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
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
