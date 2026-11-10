import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

// one choice from a short closed set, shown all at once; a select hides the options it offers
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  stretch = false,
  className,
}: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  stretch?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'gap-1 rounded-xs bg-ink-02 p-1',
        stretch ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              't-xs rounded-xs font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'lift bg-ink-00 text-ink-12' : 'text-ink-09 hover:text-ink-12'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
