import { useMemo, useState } from 'react'
import type { TemplateMeta } from '@r4u/shared'
import { sampleFor } from '@/hooks/useTemplates'
import { cn } from '@/lib/cn'
import { Sheet } from '@/routes/landing/Sheet'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'

const ATS = {
  safe: { text: 'ATS safe', tone: 'text-success' },
  caution: { text: 'Check before ATS', tone: 'text-warning' },
  unsafe: { text: 'Best read by people', tone: 'text-ink-09' },
}

export function TemplateGrid({
  templates,
  selected,
  onSelect,
  actionLabel,
}: {
  templates: TemplateMeta[] | null
  selected?: string
  onSelect: (template: TemplateMeta) => void
  actionLabel: string
}) {
  const [category, setCategory] = useState('All')
  const [previewing, setPreviewing] = useState<TemplateMeta | null>(null)

  const categories = useMemo(
    () => ['All', ...new Set((templates ?? []).map((template) => template.category))],
    [templates]
  )
  const visible = (templates ?? []).filter((t) => category === 'All' || t.category === category)

  if (templates === null) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-96" />
        ))}
      </div>
    )
  }

  return (
    <>
      <Segmented
        label="Category"
        value={category}
        onChange={setCategory}
        options={categories.map((c) => ({ value: c, label: c }))}
      />

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((template) => {
          const ats = ATS[template.atsSafe]
          const chosen = selected === template.key
          return (
            <li
              key={template.key}
              className={cn(
                'lift t-xs flex flex-col overflow-hidden rounded-sm border bg-ink-00 transition-colors',
                chosen ? 'border-accent ring-3 ring-accent-subtle' : 'border-ink-04'
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewing(template)}
                aria-label={`Enlarge ${template.name}`}
                className="block h-64 overflow-hidden border-b border-ink-04 bg-ink-02 px-6 pt-6"
              >
                <Sheet resume={sampleFor(template)} />
              </button>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-md">{template.name}</h3>
                  <span className="text-xs text-ink-09">{template.category}</span>
                </div>
                <p className="mt-2 flex-1 text-sm text-ink-09">{template.description}</p>
                <p className={cn('mt-3 flex items-center gap-1.5 text-xs font-medium', ats.tone)}>
                  {template.atsSafe === 'safe' ? <Icon name="check" /> : null}
                  {ats.text}
                </p>
                <Button
                  className="mt-4"
                  variant={chosen ? 'primary' : 'secondary'}
                  aria-pressed={chosen}
                  onClick={() => onSelect(template)}
                >
                  {chosen ? 'Selected' : actionLabel}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <Modal
        open={Boolean(previewing)}
        size="lg"
        onClose={() => setPreviewing(null)}
        title={previewing?.name ?? ''}
        description={previewing?.description}
        footer={
          previewing ? (
            <Button
              variant="primary"
              onClick={() => {
                onSelect(previewing)
                setPreviewing(null)
              }}
            >
              {actionLabel}
            </Button>
          ) : null
        }
      >
        {previewing ? (
          <div className="mx-auto max-h-[62vh] max-w-xl overflow-y-auto bg-ink-02 p-4">
            <Sheet resume={sampleFor(previewing)} />
          </div>
        ) : null}
      </Modal>
    </>
  )
}
