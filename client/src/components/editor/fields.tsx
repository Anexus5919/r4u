import { useId, useState } from 'react'
import type { FieldSpec } from '@r4u/shared'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui/Icon'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Field'

// one control per FieldType, so a new field is a data change rather than a component

function Counter({ value, spec }: { value: string; spec: FieldSpec }) {
  if (!spec.max) return null

  const warn = spec.warn ?? Math.floor(spec.max * 0.8)
  const over = value.length > spec.max

  return (
    <span
      className={cn(
        'font-mono text-2xs tabular-nums',
        over ? 'text-danger' : value.length >= warn ? 'text-ink-09' : 'text-ink-07'
      )}
    >
      {value.length}/{spec.max}
    </span>
  )
}

export function FieldRow({
  spec,
  children,
  value,
}: {
  spec: FieldSpec
  children: (id: string) => React.ReactNode
  value?: string
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {spec.label}
          {spec.required ? <span className="text-ink-07"> (required)</span> : null}
        </Label>
        {value !== undefined ? <Counter value={value} spec={spec} /> : null}
      </div>

      {children(id)}

      {spec.hint ? <p className="text-xs text-ink-09">{spec.hint}</p> : null}
    </div>
  )
}

// squared chips, not pills. no rating bar: unparseable, and an unverifiable claim
export function TagInput({
  spec,
  values,
  onChange,
}: {
  spec: FieldSpec
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const value = draft.trim()
    if (!value || values.includes(value)) return setDraft('')
    onChange([...values, value])
    setDraft('')
  }

  return (
    <FieldRow spec={spec}>
      {(id) => (
        <div className="flex flex-col gap-2">
          {values.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {values.map((value) => (
                <li
                  key={value}
                  className="flex items-center gap-1.5 rounded-xs border border-ink-05 py-1 pr-1 pl-2 text-xs text-ink-11"
                >
                  {value}
                  <button
                    type="button"
                    aria-label={`Remove ${value}`}
                    onClick={() => onChange(values.filter((v) => v !== value))}
                    className="t-xs text-ink-07 transition-colors hover:text-ink-11"
                  >
                    <Icon name="close" className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <Input
            id={id}
            value={draft}
            placeholder="Type and press Enter"
            maxLength={spec.max}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Backspace' && !draft && values.length) {
                onChange(values.slice(0, -1))
              }
            }}
            onBlur={commit}
          />
        </div>
      )}
    </FieldRow>
  )
}

// findings sit inline on each bullet rather than in a list somewhere else
export function BulletList({
  spec,
  values,
  onChange,
  findingsFor,
}: {
  spec: FieldSpec
  values: string[]
  onChange: (next: string[]) => void
  findingsFor: (index: number) => { rule: string; severity: string; message: string }[]
}) {
  function update(index: number, value: string) {
    onChange(values.map((item, i) => (i === index ? value : item)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <Label>{spec.label}</Label>
        <span className="font-mono text-2xs text-ink-07 tabular-nums">{values.length} bullets</span>
      </div>

      {spec.hint ? <p className="-mt-1.5 text-xs text-ink-09">{spec.hint}</p> : null}

      <ul className="flex flex-col gap-3">
        {values.map((bullet, index) => {
          const findings = findingsFor(index)

          return (
            <li key={index} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <span aria-hidden className="mt-2.5 text-ink-07">
                  &ndash;
                </span>

                <div className="flex-1">
                  <Textarea
                    rows={2}
                    value={bullet}
                    maxLength={spec.max}
                    aria-label={`Bullet ${index + 1}`}
                    onChange={(e) => update(index, e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Remove bullet ${index + 1}`}
                  onClick={() => onChange(values.filter((_, i) => i !== index))}
                  className="t-xs mt-1.5 text-ink-07 transition-colors hover:text-danger"
                >
                  <Icon name="close" />
                </button>
              </div>

              {findings.length > 0 ? (
                <ul className="ml-5 flex flex-col gap-1">
                  {findings.map((finding) => (
                    <li
                      key={finding.rule}
                      className={cn(
                        'border-l-2 pl-2 text-xs',
                        finding.severity === 'error'
                          ? 'border-l-danger text-ink-11'
                          : finding.severity === 'warning'
                            ? 'border-l-warning text-ink-09'
                            : 'border-l-ink-05 text-ink-09'
                      )}
                    >
                      {finding.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="t-xs flex items-center gap-1.5 self-start text-sm text-ink-09 transition-colors hover:text-ink-11"
      >
        <Icon name="plus" />
        Add a bullet
      </button>
    </div>
  )
}

export function FieldControl({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec
  value: unknown
  onChange: (next: unknown) => void
}) {
  if (spec.type === 'boolean') {
    const id = `check-${spec.key}`
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded-xs border-ink-05 accent-accent"
        />
        <Label htmlFor={id} className="text-ink-11">
          {spec.label}
        </Label>
      </div>
    )
  }

  if (spec.type === 'tags') {
    return (
      <TagInput
        spec={spec}
        values={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
      />
    )
  }

  const text = typeof value === 'string' ? value : ''

  if (spec.type === 'textarea') {
    return (
      <FieldRow spec={spec} value={text}>
        {(id) => (
          <Textarea
            id={id}
            rows={5}
            value={text}
            maxLength={spec.max}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </FieldRow>
    )
  }

  return (
    <FieldRow spec={spec} value={spec.type === 'month' ? undefined : text}>
      {(id) => (
        <Input
          id={id}
          // a native month control gives the YYYY-MM the schema and the templates both expect
          type={spec.type === 'month' ? 'month' : spec.type === 'url' ? 'url' : 'text'}
          value={text}
          maxLength={spec.max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldRow>
  )
}
