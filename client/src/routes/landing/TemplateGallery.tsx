import { useMemo, useState } from 'react'
import { SAMPLE_RESUME, TEMPLATE_LIST } from '@r4u/shared'
import type { ResumeTemplate } from '@r4u/shared'
import { Icon } from '@/components/ui/Icon'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/lib/cn'
import { Sheet } from './Sheet'

const ATS_LABEL: Record<ResumeTemplate['atsSafe'], { text: string; tone: string }> = {
  safe: { text: 'ATS safe', tone: 'text-success' },
  caution: { text: 'Check before ATS', tone: 'text-warning' },
  unsafe: { text: 'Best read by people', tone: 'text-ink-09' },
}

const FILTERS = [
  { key: 'all', label: 'All templates' },
  { key: 'safe', label: 'ATS safe' },
  { key: 'other', label: 'Designed layouts' },
] as const

type Filter = (typeof FILTERS)[number]['key']

function TemplateCard({ template }: { template: ResumeTemplate }) {
  const resume = useMemo(() => ({ ...SAMPLE_RESUME, templateKey: template.key }), [template.key])
  const ats = ATS_LABEL[template.atsSafe]

  return (
    <li className="lift flex flex-col overflow-hidden rounded-sm border border-ink-04 bg-ink-00">
      <div className="border-b border-ink-04 bg-ink-02 px-6 pt-6">
        <div className="h-64 overflow-hidden">
          <Sheet resume={resume} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-md">{template.name}</h3>
          <span className="text-xs text-ink-09">{template.category}</span>
        </div>
        <p className="mt-2 flex-1 text-sm text-ink-09">{template.audience}</p>
        <p className={cn('mt-4 flex items-center gap-1.5 text-xs font-medium', ats.tone)}>
          {template.atsSafe === 'safe' ? <Icon name="check" /> : null}
          {ats.text}
        </p>
      </div>
    </li>
  )
}

export function TemplateGallery() {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = TEMPLATE_LIST.filter((template) => {
    if (filter === 'safe') return template.atsSafe === 'safe'
    if (filter === 'other') return template.atsSafe !== 'safe'
    return true
  })

  return (
    <section id="templates" className="scroll-mt-20 border-b border-ink-04 bg-ink-00">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent-text">Templates</p>
            <h2 className="mt-3 text-d4 text-ink-12">
              {TEMPLATE_LIST.length} templates. One set of content.
            </h2>
            <p className="mt-4 text-lg text-ink-09">
              Every template reads the same structured data, rendered here from the same sample
              resume. Pick the one that suits your field and switch whenever you like.
            </p>
          </div>

          <Segmented
            label="Filter templates"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((option) => ({ value: option.key, label: option.label }))}
            className="shrink-0"
          />
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((template) => (
            <TemplateCard key={template.key} template={template} />
          ))}
        </ul>
      </div>
    </section>
  )
}
