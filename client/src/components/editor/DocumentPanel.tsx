import { useMemo, useState } from 'react'
import { PAGE_TARGET, TEMPLATE_LIST, computeMeta } from '@r4u/shared'
import type { Resume } from '@r4u/shared'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { DesignKnobs } from './DesignKnobs'
import { ResumePreview } from '@/render/ResumePreview'
import type { PreviewMetrics } from '@/render/ResumePreview'
import type { EditorResume } from '@/editor/types'

// the paper is figure and the app is ground, which is why the chrome stays achromatic

const ATS_LABEL = {
  safe: 'ATS safe',
  caution: 'ATS caution',
  unsafe: 'Not ATS safe',
} as const

function longestBullet(resume: EditorResume) {
  let best: { sectionId: string; length: number } | null = null

  for (const section of resume.sections) {
    if (section.hidden) continue
    for (const entry of section.entries) {
      if (entry.hidden) continue
      const bullets = Array.isArray(entry.data.bullets) ? (entry.data.bullets as string[]) : []
      for (const bullet of bullets) {
        if (!best || bullet.length > best.length) {
          best = { sectionId: section._id, length: bullet.length }
        }
      }
    }
  }

  return best
}

// content before design: trimming is offered before shrinking the type to fit
function OverflowNotice({
  overflowMm,
  resume,
  onJump,
  onFit,
}: {
  overflowMm: number
  resume: EditorResume
  onJump: (sectionId: string) => void
  onFit: () => void
}) {
  const longest = longestBullet(resume)
  const canShrink = resume.design.typeScale > 9.5

  return (
    <div className="rounded-xs border border-l-2 border-ink-05 border-l-warning bg-ink-00 px-3 py-2.5">
      <p className="text-sm text-ink-11">Content exceeds the page by {overflowMm} mm.</p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {longest ? (
          <Button size="sm" onClick={() => onJump(longest.sectionId)}>
            Trim the longest bullet
          </Button>
        ) : null}

        <Button size="sm" variant="ghost" onClick={onFit} disabled={!canShrink}>
          {canShrink ? 'Fit to page' : 'Already at the smallest size'}
        </Button>
      </div>

      <p className="mt-2 text-xs text-ink-09">
        Trim first. Shrinking the type to keep a bullet you did not need is the wrong trade.
      </p>
    </div>
  )
}

export function DocumentPanel({
  resume,
  findingCount,
  onJump,
  onTemplate,
  onDesign,
  onFit,
}: {
  resume: EditorResume
  findingCount: number
  onJump: (sectionId: string) => void
  onTemplate: (key: string) => void
  onDesign: (field: string, value: unknown) => void
  onFit: () => void
}) {
  const [metrics, setMetrics] = useState<PreviewMetrics>({ overflowMm: 0, fill: 0 })

  const meta = useMemo(() => computeMeta(resume as unknown as Partial<Resume>), [resume])
  const active = TEMPLATE_LIST.find((template) => template.key === resume.templateKey)

  return (
    <div className="flex flex-col gap-5">
      <ResumePreview resume={resume as unknown as Partial<Resume>} onMetrics={setMetrics} />

      {metrics.overflowMm > 0 ? (
        <OverflowNotice
          overflowMm={metrics.overflowMm}
          resume={resume}
          onJump={onJump}
          onFit={onFit}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-xs text-ink-09">Template</span>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_LIST.map((template) => (
            <Button
              key={template.key}
              size="sm"
              variant={template.key === resume.templateKey ? 'secondary' : 'ghost'}
              aria-pressed={template.key === resume.templateKey}
              onClick={() => onTemplate(template.key)}
            >
              {template.name}
            </Button>
          ))}
        </div>

        {active ? (
          <p className="text-xs text-ink-09">
            {active.audience}{' '}
            {/* badged up front, or a zero layout score makes the checker look broken */}
            <span
              className={cn(
                'font-mono text-2xs',
                active.atsSafe === 'safe' ? 'text-ink-09' : 'text-warning'
              )}
            >
              {ATS_LABEL[active.atsSafe]}.
            </span>
          </p>
        ) : null}
      </div>

      <div className="border-t border-ink-04 pt-4">
        <DesignKnobs design={resume.design} onChange={onDesign} />
      </div>

      <dl className="flex flex-col gap-2 border-t border-ink-04 pt-4 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-09">Completeness</dt>
          <dd className="font-mono text-ink-11 tabular-nums">{meta.completeness}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-09">Page fill</dt>
          <dd className="font-mono text-ink-11 tabular-nums">{Math.round(metrics.fill * 100)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-09">Words</dt>
          <dd className="font-mono text-ink-11 tabular-nums">{meta.wordCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-09">Target length</dt>
          <dd className="font-mono text-ink-11">{PAGE_TARGET[resume.resumeType]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-09">Writing notes</dt>
          <dd className="font-mono text-ink-11 tabular-nums">{findingCount}</dd>
        </div>
      </dl>
    </div>
  )
}
