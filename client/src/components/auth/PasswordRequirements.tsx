import { useMemo } from 'react'
import { PASSWORD_REQUIREMENTS, checkPassword } from '@r4u/shared'
import { cn } from '@/lib/cn'

// listed, not scored: a strength bar is guesswork. filled versus hollow glyph, never colour
export function PasswordRequirements({ value }: { value: string }) {
  const checks = useMemo(() => checkPassword(value), [value])

  return (
    <ul className="flex flex-col gap-1.5">
      {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
        const met = checks[key]
        return (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-xs border',
                met ? 'border-ink-09 bg-ink-09' : 'border-ink-07 bg-transparent'
              )}
            />
            <span className={met ? 'text-ink-11' : 'text-ink-09'}>{label}</span>
            <span className="sr-only">{met ? 'requirement met' : 'requirement not met'}</span>
          </li>
        )
      })}
    </ul>
  )
}
