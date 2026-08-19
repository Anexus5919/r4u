import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_TARGET, RESUME_TYPES } from '@r4u/shared'
import type { ResumeStatus, ResumeSummary, ResumeType } from '@r4u/shared'
import { api, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { useResumes } from '@/hooks/useResumes'
import type { ResumeQuery } from '@/hooks/useResumes'
import { useToast } from '@/context/ToastContext'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Rule, Skeleton } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const STATUS_LABEL: Record<ResumeStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  reviewed: 'Reviewed',
}

const TYPE_LABEL: Record<ResumeType, string> = {
  fresher: 'Fresher',
  professional: 'Professional',
  technical: 'Technical',
  academic: 'Academic CV',
}

/*
  Every tile carries identical internal anatomy regardless of its span: title, subtitle, hairline,
  then a metadata row in monospace figures. That is what keeps scanning predictable while the
  sizes deliberately vary.
*/
function ResumeCard({
  resume,
  wide,
  onDuplicate,
  onDelete,
}: {
  resume: ResumeSummary
  wide: boolean
  onDuplicate: (resume: ResumeSummary) => void
  onDelete: (resume: ResumeSummary) => void
}) {
  return (
    <Card interactive className={cn('flex flex-col p-5', wide && 'lg:col-span-2')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-md text-ink-12">{resume.title}</h3>
          <p className="mt-1 text-sm text-ink-09">
            {TYPE_LABEL[resume.resumeType]} · {STATUS_LABEL[resume.status]}
          </p>
        </div>

        {/* a hairline rule that fills, never a ring chart and never an animated counter */}
        <div className="shrink-0 text-right">
          <span className="font-mono text-2xs text-ink-09 tabular-nums">
            {resume.meta.completeness}%
          </span>
          <div className="mt-1 h-px w-16 bg-ink-04">
            <div className="h-px bg-ink-09" style={{ width: `${resume.meta.completeness}%` }} />
          </div>
        </div>
      </div>

      <Rule className="my-4" />

      <div className="flex items-center gap-4 font-mono text-2xs text-ink-07 tabular-nums">
        <span>Updated {formatRelative(resume.updatedAt)}</span>
        <span>{resume.meta.sectionCount} sections</span>
        <span>{resume.meta.wordCount} words</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink to={`/resume/${resume.id}/edit`} size="sm" variant="secondary">
          Edit
        </ButtonLink>
        <ButtonLink to={`/resume/${resume.id}`} size="sm" variant="ghost">
          Preview
        </ButtonLink>
        <Button size="sm" variant="ghost" onClick={() => onDuplicate(resume)}>
          Duplicate
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(resume)}>
          Delete
        </Button>
      </div>
    </Card>
  )
}

function StatsStrip({ resumes }: { resumes: ResumeSummary[] }) {
  const stats = useMemo(() => {
    const drafts = resumes.filter((r) => r.status === 'draft').length
    const inReview = resumes.filter((r) => r.status === 'in_review').length
    const average = resumes.length
      ? Math.round(resumes.reduce((sum, r) => sum + r.meta.completeness, 0) / resumes.length)
      : 0

    return [
      { label: 'Resumes', value: resumes.length },
      { label: 'Drafts', value: drafts },
      { label: 'In review', value: inReview },
      { label: 'Average completeness', value: `${average}%` },
    ]
  }, [resumes])

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-3 border-t border-ink-04 pt-5">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="font-mono text-lg text-ink-12 tabular-nums">{stat.value}</p>
          <p className="text-xs text-ink-09">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function CreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [resumeType, setResumeType] = useState<ResumeType>('professional')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    setBusy(true)
    setError(null)

    try {
      const res = await api.post('/resumes', { title: title.trim(), resumeType })
      onCreated(res.data.data.resume.id)
    } catch (caught) {
      setError(toApiFailure(caught).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New resume"
      description="Name it for the role you are targeting. You can rename it later."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={(e) => void submit(e)}>
            Create and open
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        {error ? <Banner>{error}</Banner> : null}

        <Field label="Title" value={title} max={80} required>
          {({ id }) => (
            <Input
              id={id}
              /*
                The rule guards against autofocus on page load. This dialog only exists because
                the user just clicked "New resume", and without it showModal() lands focus on
                the close button, which is the opposite of what they asked for.
              */
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              placeholder="Backend Developer CV"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs text-ink-09">Career stage</legend>
          <p className="mb-1 text-xs text-ink-09">
            This sets the section order and the length to aim for. Section order is a function of
            career stage, not of taste.
          </p>

          <div className="flex flex-wrap gap-2">
            {RESUME_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={resumeType === type ? 'secondary' : 'ghost'}
                aria-pressed={resumeType === type}
                onClick={() => setResumeType(type)}
              >
                {TYPE_LABEL[type]}
              </Button>
            ))}
          </div>

          <p className="mt-1 font-mono text-2xs text-ink-07">
            Target length: {PAGE_TARGET[resumeType]}
          </p>
        </fieldset>
      </form>
    </Modal>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ResumeStatus | ''>('')
  const [sort, setSort] = useState<ResumeQuery['sort']>('updated')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ResumeSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debounced = useDebounce(search)
  const { resumes, status: listStatus, error, reload } = useResumes({ q: debounced, status, sort })

  async function duplicate(resume: ResumeSummary) {
    try {
      await api.post(`/resumes/${resume.id}/duplicate`, {})
      toast('success', `Duplicated ${resume.title}`)
      reload()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)

    try {
      await api.delete(`/resumes/${pendingDelete.id}`)
      toast('success', `Deleted ${pendingDelete.title}`)
      setPendingDelete(null)
      reload()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setDeleting(false)
    }
  }

  const filtering = Boolean(debounced || status)
  const empty = listStatus === 'ready' && resumes.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl text-ink-12">My resumes</h1>
          <p className="mt-1 text-sm text-ink-09">
            One dataset, any template. Nothing here is behind a paywall.
          </p>
        </div>

        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          New resume
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Icon
            name="search"
            className="pointer-events-none absolute top-2.5 left-2.5 text-ink-07"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            aria-label="Search resumes by title"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
          <Button
            size="sm"
            variant={status === '' ? 'secondary' : 'ghost'}
            aria-pressed={status === ''}
            onClick={() => setStatus('')}
          >
            All
          </Button>
          {(['draft', 'in_review', 'reviewed'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'secondary' : 'ghost'}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {STATUS_LABEL[value]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Sort">
          {(['updated', 'created', 'title'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={sort === value ? 'secondary' : 'ghost'}
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
            >
              {value === 'updated' ? 'Recent' : value === 'created' ? 'Oldest' : 'A to Z'}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {error ? <Banner className="max-w-md">{error.message}</Banner> : null}

        {listStatus === 'loading' && resumes.length === 0 ? (
          <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
            <Skeleton className="h-44 lg:col-span-2" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : null}

        {empty && filtering ? (
          <div className="py-12">
            <h2 className="text-lg text-ink-12">Nothing matches that</h2>
            <p className="mt-2 text-sm text-ink-09">
              Try a shorter search, or clear the status filter.
            </p>
          </div>
        ) : null}

        {empty && !filtering ? <ThreeDoors onScratch={() => setCreating(true)} /> : null}

        {resumes.length > 0 ? (
          <>
            {/*
              The first tile spans two columns on purpose. A symmetric three-up grid of identical
              siblings is the single most recognisable generated layout, and the dashboard is one
              of the three places a reviewer looks first.
            */}
            <div className="grid gap-4 lg:grid-cols-3">
              {resumes.map((resume, index) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  wide={index === 0 && sort === 'updated' && !filtering}
                  onDuplicate={(r) => void duplicate(r)}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>

            <div className="mt-10">
              <StatsStrip resumes={resumes} />
            </div>
          </>
        ) : null}
      </div>

      <CreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          navigate(`/resume/${id}/edit`)
        }}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Delete ${pendingDelete?.title ?? 'this resume'}?`}
        description="This removes the resume, its share links and its review history. It cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
              Delete resume
            </Button>
          </>
        }
      />
    </div>
  )
}

/*
  Three doors rather than one button. Getting from an empty account to a filled resume is the
  single biggest drop-off in this category, and "start from a sample" is consistently the fastest
  path because editing beats authoring from nothing.
*/
function ThreeDoors({ onScratch }: { onScratch: () => void }) {
  const doors = [
    {
      title: 'Start from scratch',
      body: 'A guided section order chosen for your career stage.',
      action: <Button onClick={onScratch}>New resume</Button>,
    },
    {
      title: 'Start from a sample',
      body: 'A complete example you overwrite. Fastest way to see what good looks like.',
      action: (
        <Button variant="ghost" disabled>
          Arrives in phase 6
        </Button>
      ),
    },
    {
      title: 'Import',
      body: 'JSON Resume, an R4U export, or a LinkedIn data archive.',
      action: (
        <Button variant="ghost" disabled>
          Arrives in phase 6
        </Button>
      ),
    },
  ]

  return (
    <div className="py-6">
      <h2 className="text-lg text-ink-12">Three ways to begin</h2>
      <p className="mt-2 max-w-md text-sm text-ink-09">
        Your content is stored as structured data, so whichever you pick, you can change template
        later without touching a layout.
      </p>

      <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-ink-05 bg-ink-04 md:grid-cols-3">
        {doors.map((door) => (
          <div key={door.title} className="flex flex-col gap-2 bg-ink-00 p-6">
            <h3 className="text-md text-ink-12">{door.title}</h3>
            <p className="flex-1 text-sm text-ink-09">{door.body}</p>
            <div className="pt-3">{door.action}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
