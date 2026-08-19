import { cn } from '@/lib/cn'

/*
  Invalid state is a 1px danger edge plus a text line below, never a tinted field.
  Focus is a ring, never a glow and never a colour change.
*/

const SHELL =
  'w-full rounded-xs border bg-ink-00 text-ink-12 transition-colors t-xs ' +
  'placeholder:text-ink-07 disabled:opacity-45 disabled:pointer-events-none ' +
  'border-ink-05 hover:border-ink-06'

const INVALID = 'border-danger hover:border-danger'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(SHELL, 'h-9 px-2.5 text-sm', invalid && INVALID, className)}
      {...rest}
    />
  )
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        SHELL,
        'resize-y px-2.5 py-2 text-sm leading-relaxed',
        invalid && INVALID,
        className
      )}
      {...rest}
    />
  )
}
