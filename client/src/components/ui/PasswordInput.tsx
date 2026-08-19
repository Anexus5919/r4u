import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Input } from './Input'
import type { InputProps } from './Input'

export function PasswordInput({ className, ...rest }: InputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        autoComplete={rest.autoComplete ?? 'current-password'}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="t-xs absolute top-0 right-0 flex h-9 w-9 items-center justify-center text-ink-07 transition-colors hover:text-ink-11"
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  )
}
