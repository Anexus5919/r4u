import { useId } from 'react'
import { cn } from '@/lib/cn'

/*
  Labels are sentence case at 12px, not uppercase. An uppercase label at this size needs
  tracking to be legible, and tracked uppercase is reserved for section eyebrows.
*/

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  // the rule cannot see through a passthrough wrapper. Field always supplies htmlFor, and
  // every direct use of Label must do the same.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('block text-xs text-ink-09', className)} {...rest} />
}

export interface FieldProps {
  label: string
  /** Rendered under the label, before the control. One line, ink-09. */
  hint?: string
  error?: string
  /** Soft warning fires at 80 percent, matching the character limits in TEMPLATES.md. */
  value?: string
  max?: number
  required?: boolean
  className?: string
  children: (props: {
    id: string
    describedBy: string | undefined
    invalid: boolean
  }) => React.ReactNode
}

export function Field({
  label,
  hint,
  error,
  value,
  max,
  required,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const invalid = Boolean(error)
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  const count = value?.length ?? 0
  const nearLimit = max !== undefined && count >= max * 0.8
  const overLimit = max !== undefined && count > max

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-ink-07"> (required)</span> : null}
        </Label>

        {max !== undefined ? (
          <span
            className={cn(
              'font-mono text-2xs tabular-nums',
              overLimit ? 'text-danger' : nearLimit ? 'text-ink-09' : 'text-ink-07'
            )}
          >
            {count}/{max}
          </span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-ink-09">
          {hint}
        </p>
      ) : null}

      {children({ id, describedBy, invalid })}

      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
