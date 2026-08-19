import { useMemo } from 'react'
import { PASSWORD_REQUIREMENTS, checkPassword } from '@r4u/shared'
import { cn } from '@/lib/cn'

/*
  Requirements are listed, not scored. A "strength: medium" bar is guesswork and tells a user
  nothing they can act on. These are the four rules the server actually enforces, read from the
  same shared module the validator uses, so the list can never promise what registration refuses.

  Met and unmet are distinguished by a filled versus hollow glyph, not by colour.
*/
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
