import { SAMPLE_RESUME, lintResume } from '@r4u/shared'
import type { Finding, Resume } from '@r4u/shared'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { Sheet } from './Sheet'

const WEAK_BULLET = 'Responsible for the payments API and I helped with fixing bugs.'

const experience = SAMPLE_RESUME.sections.find((section) => section.type === 'experience')
const firstEntry = experience?.entries[0]
const fixtureBullets: unknown = firstEntry?.data.bullets
const STRONG_BULLET = Array.isArray(fixtureBullets) ? String(fixtureBullets[0] ?? '') : ''

// both verdicts come from the shipped linter, so the demo cannot drift from the product
function lintBulletAlone(bullet: string): Finding[] {
  if (!experience || !firstEntry) return []
  const probe: Partial<Resume> = {
    resumeType: 'technical',
    sections: [
      {
        ...experience,
        entries: [{ ...firstEntry, data: { ...firstEntry.data, bullets: [bullet] } }],
      },
    ],
  }
  return lintResume(probe).filter((finding) => finding.field === 'bullets')
}

const weakFindings = lintBulletAlone(WEAK_BULLET)
const strongFindings = lintBulletAlone(STRONG_BULLET)

const QUIRE_SAMPLE: Partial<Resume> = { ...SAMPLE_RESUME, templateKey: 'quire' }

function Chip({ icon }: { icon: IconName }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-xs bg-accent-subtle text-accent-text">
      <Icon name={icon} />
    </span>
  )
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <article
      className={cn('lift flex flex-col rounded-sm border border-ink-04 bg-ink-00 p-6', className)}
    >
      {children}
    </article>
  )
}

function CoachDemo() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="rounded-xs border border-ink-04 bg-ink-01 p-4">
        <p className="text-xs font-medium text-ink-09">Before</p>
        <p className="mt-1.5 text-sm text-ink-12">{WEAK_BULLET}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {weakFindings.slice(0, 3).map((finding) => (
            <li key={finding.rule} className="flex gap-2 text-xs leading-relaxed text-ink-10">
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-xs',
                  finding.severity === 'error' ? 'bg-danger' : 'bg-warning'
                )}
              />
              {finding.message}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xs border border-accent-edge bg-accent-subtle p-4">
        <p className="text-xs font-medium text-accent-text">After</p>
        <p className="mt-1.5 text-sm text-ink-12">{STRONG_BULLET}</p>
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-success">
          <Icon name="check" />
          {strongFindings.length === 0
            ? 'No suggestions. Action verb, a measurable result, scannable length.'
            : `${strongFindings.length} suggestion left`}
        </p>
      </div>
    </div>
  )
}

const ROADMAP = [
  'PDF export with a real text layer',
  'Shareable links with view counts',
  'Mentor review with live chat',
  'ATS readiness score',
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-ink-04 bg-ink-01">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent-text">Features</p>
          <h2 className="mt-3 text-d4 text-ink-12">
            Everything a strong resume needs, in one place
          </h2>
          <p className="mt-4 text-lg text-ink-09">
            A guided editor, a coach that reads every line, and a page that shows exactly how the
            final document will look.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="overflow-hidden lg:col-span-2">
            <Chip icon="eye" />
            <h3 className="mt-5 text-lg">A live page, not a long form</h3>
            <p className="mt-2 max-w-lg text-sm text-ink-09">
              Every keystroke re-renders a true 210 by 297 mm page. When content runs past the
              bottom, R4U tells you by how many millimetres and what to trim first.
            </p>
            <div className="relative mt-8 -mb-6 h-56 overflow-hidden rounded-t-xs border-x border-t border-ink-04 bg-ink-02 px-8 pt-8">
              <Sheet resume={QUIRE_SAMPLE} className="mx-auto max-w-md" />
            </div>
          </Panel>

          <Panel className="lg:row-span-2">
            <Chip icon="search" />
            <h3 className="mt-5 text-lg">A coach that reads every bullet</h3>
            <p className="mt-2 text-sm text-ink-09">
              Weak openers, filler verbs, pronouns and missing results are flagged as you type, with
              a concrete fix rather than a score.
            </p>
            <CoachDemo />
          </Panel>

          <Panel>
            <Chip icon="arrow" />
            <h3 className="mt-5 text-lg">Switch templates freely</h3>
            <p className="mt-2 text-sm text-ink-09">
              Content is stored once, so moving from Foundry to Verso keeps every section and every
              entry exactly where you left it.
            </p>
          </Panel>

          <Panel>
            <Chip icon="download" />
            <h3 className="mt-5 text-lg">Versions you can return to</h3>
            <p className="mt-2 text-sm text-ink-09">
              Save a milestone before a big rewrite and restore it in one step. Import and export
              the open JSON Resume format.
            </p>
          </Panel>

          <Panel className="lg:col-span-3 lg:flex-row lg:items-center lg:gap-8">
            <Chip icon="eyeOff" />
            <div className="mt-5 lg:mt-0">
              <h3 className="text-lg">Private by design</h3>
              <p className="mt-2 max-w-3xl text-sm text-ink-09">
                Your resume content is never visible to administrators. The rule is enforced where
                the data is read, in the database layer, not hidden behind a button in the
                interface.
              </p>
            </div>
          </Panel>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-04 pt-8 sm:flex-row sm:items-baseline sm:gap-8">
          <p className="shrink-0 text-sm font-semibold text-ink-12">Coming next</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {ROADMAP.map((item) => (
              <li key={item} className="text-sm text-ink-09">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
