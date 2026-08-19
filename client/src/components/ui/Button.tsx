import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { buttonClasses } from './buttonClasses'
import type { ButtonSize, ButtonVariant } from './buttonClasses'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(
        variant,
        size,
        cn('disabled:pointer-events-none disabled:opacity-45', className)
      )}
      {...rest}
    >
      {/* the label is swapped rather than joined by a spinner, so width does not jump */}
      {loading ? <span className="text-ink-09">Working</span> : children}
    </button>
  )
}

/*
  A link that looks like a button. Navigation is an anchor, not a button: nesting a Link inside a
  button is invalid markup and breaks middle-click, copy link and keyboard expectations.
*/
export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />
}
