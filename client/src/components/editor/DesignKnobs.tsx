import { ACCENT_CHOICES } from '@r4u/shared'
import type { ResumeDesign } from '@r4u/shared'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

// five knobs, closed: no font picker, no colour wheel, no free spacing value

const TYPE_SCALES = [9.5, 10, 10.5, 11, 11.5] as const
const LEADINGS = [
  { value: 1.2, label: 'Tight' },
  { value: 1.35, label: 'Normal' },
  { value: 1.45, label: 'Open' },
] as const
const SPACINGS = ['compact', 'normal', 'airy'] as const
const MARGINS = [16, 20, 25] as const

function Knob({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-09">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

export function DesignKnobs({
  design,
  onChange,
}: {
  design: ResumeDesign
  onChange: (field: keyof ResumeDesign, value: unknown) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Knob label="Accent">
        {ACCENT_CHOICES.map((choice) => (
          <button
            key={choice.key || 'none'}
            type="button"
            aria-label={choice.name}
            aria-pressed={design.accent === choice.key}
            onClick={() => onChange('accent', choice.key)}
            className={cn(
              't-xs flex h-7 items-center gap-1.5 rounded-xs border px-2 text-xs transition-colors',
              design.accent === choice.key
                ? 'border-ink-06 text-ink-12'
                : 'border-transparent text-ink-09 hover:bg-ink-02'
            )}
          >
            <span
              aria-hidden
              className="size-3 rounded-xs border border-ink-05"
              style={{ backgroundColor: choice.value }}
            />
            {choice.name}
          </button>
        ))}
      </Knob>

      <Knob label="Type size">
        {TYPE_SCALES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={design.typeScale === value ? 'secondary' : 'ghost'}
            aria-pressed={design.typeScale === value}
            onClick={() => onChange('typeScale', value)}
          >
            {value}
          </Button>
        ))}
      </Knob>

      <Knob label="Line height">
        {LEADINGS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={design.leading === option.value ? 'secondary' : 'ghost'}
            aria-pressed={design.leading === option.value}
            onClick={() => onChange('leading', option.value)}
          >
            {option.label}
          </Button>
        ))}
      </Knob>

      <Knob label="Section spacing">
        {SPACINGS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={design.sectionSpacing === value ? 'secondary' : 'ghost'}
            aria-pressed={design.sectionSpacing === value}
            onClick={() => onChange('sectionSpacing', value)}
          >
            {value}
          </Button>
        ))}
      </Knob>

      <Knob label="Margins">
        {MARGINS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={design.margins === value ? 'secondary' : 'ghost'}
            aria-pressed={design.margins === value}
            onClick={() => onChange('margins', value)}
          >
            {value} mm
          </Button>
        ))}
      </Knob>

      <p className="text-xs text-ink-09">
        The accent colours rules and section headings only, never body text. Coloured body text adds
        nothing a parser can read.
      </p>
    </div>
  )
}
