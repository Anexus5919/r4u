import { PAGE_TARGET } from '@r4u/shared'
import type { Finding, ResumeType } from '@r4u/shared'
import { cn } from '@/lib/cn'
import type { SaveStatus } from '@/editor/reducer'

/*
  Completeness renders as a hairline rule that fills, with tabular figures. Never a ring chart
  and never an animated counter: both draw attention to the number rather than to what would
  move it.
*/
export function Completeness({ value }: { value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-09">Completeness</span>
        <span className="font-mono text-sm text-ink-12 tabular-nums">{value}%</span>
      </div>
      <div className="h-px w-full bg-ink-04">
        <div className="h-px bg-ink-09" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// idle means nothing in flight, which on a fresh load is a clean document, not an unsaved one
const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: 'All changes saved',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Could not save',
}

// states as text, never a spinner: the user needs to know which state, not that something moves
export function SaveIndicator({ status, dirty }: { status: SaveStatus; dirty: boolean }) {
  const label =
    dirty && status !== 'saving' && status !== 'error' ? 'Unsaved changes' : SAVE_LABEL[status]

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('text-xs', status === 'error' ? 'text-danger' : 'text-ink-09')}
    >
      {label}
    </span>
  )
}

const SEVERITY_RULE = {
  error: 'border-l-danger',
  warning: 'border-l-warning',
  hint: 'border-l-ink-05',
} as const

export function CoachPanel({
  findings,
  completeness,
  wordCount,
  resumeType,
  onJump,
}: {
  findings: Finding[]
  completeness: number
  wordCount: number
  resumeType: ResumeType
  onJump: (sectionId: string) => void
}) {
  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  const hints = findings.filter((f) => f.severity === 'hint')

  const groups = [
    { label: 'Fix', items: errors },
    { label: 'Consider', items: warnings },
    { label: 'Ideas', items: hints },
  ].filter((group) => group.items.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <Completeness value={completeness} />

      <dl className="flex flex-col gap-2 border-t border-ink-04 pt-5 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-09">Words</dt>
          <dd className="font-mono text-ink-11 tabular-nums">{wordCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-09">Target length</dt>
          <dd className="font-mono text-ink-11">{PAGE_TARGET[resumeType]}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-4 border-t border-ink-04 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm text-ink-12">Writing</h2>
          <span className="font-mono text-2xs text-ink-07 tabular-nums">
            {findings.length} note{findings.length === 1 ? '' : 's'}
          </span>
        </div>

        {findings.length === 0 ? (
          <p className="text-xs text-ink-09">
            Nothing to flag. Every bullet opens with a verb and carries a measurable result.
          </p>
        ) : null}

        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h3 className="font-mono text-2xs tracking-wide text-ink-07 uppercase">
              {group.label}
            </h3>

            <ul className="flex flex-col gap-2">
              {group.items.slice(0, 12).map((finding, index) => (
                <li key={`${finding.rule}-${finding.entryId ?? ''}-${finding.index ?? index}`}>
                  {/*
                    Every note deep links to the section that caused it. A list of complaints the
                    user cannot act on is worse than no list.
                  */}
                  <button
                    type="button"
                    onClick={() => finding.sectionId && onJump(finding.sectionId)}
                    disabled={!finding.sectionId}
                    className={cn(
                      't-xs w-full border-l-2 pl-2.5 text-left text-xs transition-colors',
                      SEVERITY_RULE[finding.severity],
                      finding.sectionId ? 'text-ink-11 hover:text-ink-12' : 'text-ink-09'
                    )}
                  >
                    {finding.message}
                  </button>
                </li>
              ))}
            </ul>

            {group.items.length > 12 ? (
              <p className="text-2xs text-ink-07">
                and {group.items.length - 12} more of the same kind
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
