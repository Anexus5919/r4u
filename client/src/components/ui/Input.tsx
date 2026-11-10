import { cn } from '@/lib/cn'

// invalid is a 1px danger edge plus a text line; focus is a ring, never a glow

const SHELL =
  'w-full rounded-xs border bg-ink-00 text-ink-12 transition-colors t-xs lift ' +
  'placeholder:text-ink-07 disabled:opacity-45 disabled:pointer-events-none ' +
  'border-ink-05 hover:border-ink-06 ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-subtle'

const INVALID = 'border-danger hover:border-danger focus-visible:border-danger'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(SHELL, 'h-10 px-3 text-sm', invalid && INVALID, className)}
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
        'resize-y px-3 py-2.5 text-sm leading-relaxed',
        invalid && INVALID,
        className
      )}
      {...rest}
    />
  )
}
