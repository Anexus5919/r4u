import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTemplate } from '@r4u/shared'
import type { ResumeStatus, ResumeSummary, ResumeType } from '@r4u/shared'
import { api, toApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { useResumeImport } from '@/hooks/useResumeImport'
import { useResumes } from '@/hooks/useResumes'
import type { ResumeQuery } from '@/hooks/useResumes'
import { useToast } from '@/context/ToastContext'
import { TemplateTile } from '@/components/resume/TemplateTile'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Skeleton, StatusLabel } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'

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

const STATUS_OPTIONS: { value: ResumeStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'reviewed', label: 'Reviewed' },
]

const SORT_OPTIONS: { value: ResumeQuery['sort']; label: string }[] = [
  { value: 'updated', label: 'Recent' },
  { value: 'created', label: 'Oldest' },
  { value: 'title', label: 'A to Z' },
]

function ResumeCard({
  resume,
  onDuplicate,
  onDelete,
}: {
  resume: ResumeSummary
  onDuplicate: (resume: ResumeSummary) => void
  onDelete: (resume: ResumeSummary) => void
}) {
  const template = getTemplate(resume.templateKey)
  const editPath = `/resume/${resume.id}/edit`

  return (
    <Card interactive className="flex flex-col overflow-hidden">
      <Link
        to={editPath}
        aria-label={`Edit ${resume.title}`}
        className="block h-40 overflow-hidden border-b border-ink-04 bg-ink-02 px-10 pt-6"
      >
        <TemplateTile templateKey={resume.templateKey} className="mx-auto max-w-40" />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-md text-ink-12">
              <Link to={editPath} className="no-underline hover:text-accent-text">
                {resume.title}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-ink-09">
              {TYPE_LABEL[resume.resumeType]} · {template.name}
            </p>
          </div>
          <StatusLabel on={resume.status !== 'draft'} className="mt-1 shrink-0">
            {STATUS_LABEL[resume.status]}
          </StatusLabel>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-ink-09">Completeness</span>
            <span className="font-mono font-medium text-ink-12 tabular-nums">
              {resume.meta.completeness}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-xs bg-ink-03">
            <div className="h-full bg-accent" style={{ width: `${resume.meta.completeness}%` }} />
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-09">
          Updated {formatRelative(resume.updatedAt)} · {resume.meta.sectionCount} sections ·{' '}
          {resume.meta.wordCount} words
        </p>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-04 pt-4">
          <ButtonLink to={editPath} size="sm" variant="secondary">
            Edit
          </ButtonLink>
          <ButtonLink to={`/resume/${resume.id}`} size="sm" variant="ghost">
            Preview
          </ButtonLink>
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(resume)}>
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto hover:text-danger"
            onClick={() => onDelete(resume)}
          >
            <Icon name="trash" />
            <span className="sr-only sm:not-sr-only">Delete</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}

function StatCards({ resumes }: { resumes: ResumeSummary[] }) {
  const stats = useMemo(() => {
    const drafts = resumes.filter((r) => r.status === 'draft').length
    const inReview = resumes.filter((r) => r.status === 'in_review').length
    const average = resumes.length
      ? Math.round(resumes.reduce((sum, r) => sum + r.meta.completeness, 0) / resumes.length)
      : 0

    return [
      { label: 'Total resumes', value: resumes.length },
      { label: 'Drafts', value: drafts },
      { label: 'In review', value: inReview },
      { label: 'Average completeness', value: `${average}%` },
    ]
  }, [resumes])

  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex flex-col gap-1 p-5">
          <dt className="text-sm text-ink-09">{stat.label}</dt>
          <dd className="text-[28px] leading-tight font-semibold tracking-tight text-ink-12 tabular-nums">
            {stat.value}
          </dd>
        </Card>
      ))}
    </dl>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const importer = useResumeImport()
  const fileInput = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ResumeStatus | ''>('')
  const [sort, setSort] = useState<ResumeQuery['sort']>('updated')
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

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // cleared so choosing the same file twice still fires a change
    event.target.value = ''
    if (file) void importer.fromFile(file)
  }

  const filtering = Boolean(debounced || status)
  const empty = listStatus === 'ready' && resumes.length === 0

  return (
    <div className="mx-auto max-w-7xl">
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={onFile}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl text-ink-12">My resumes</h1>
          <p className="mt-1.5 text-sm text-ink-09">
            One set of content, any template. Nothing here is behind a paywall.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={importer.busy}
            onClick={() => fileInput.current?.click()}
          >
            Import JSON
          </Button>
          <Button variant="primary" onClick={() => navigate('/resume/new')}>
            <Icon name="plus" />
            New resume
          </Button>
        </div>
      </div>

      {resumes.length > 0 && !filtering ? (
        <div className="mt-8">
          <StatCards resumes={resumes} />
        </div>
      ) : null}

      {empty && !filtering ? null : (
        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <Icon name="search" className="pointer-events-none absolute top-3 left-3 text-ink-08" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title"
              aria-label="Search resumes by title"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-3 lg:ml-auto">
            <Segmented
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
            <Segmented label="Sort" value={sort} onChange={setSort} options={SORT_OPTIONS} />
          </div>
        </div>
      )}

      <div className="mt-6">
        {error ? <Banner className="max-w-md">{error.message}</Banner> : null}

        {listStatus === 'loading' && resumes.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : null}

        {empty && filtering ? (
          <Card className="px-6 py-14 text-center">
            <h2 className="text-lg text-ink-12">Nothing matches that</h2>
            <p className="mx-auto mt-2 text-sm text-ink-09">
              Try a shorter search, or clear the status filter.
            </p>
          </Card>
        ) : null}

        {empty && !filtering ? (
          <ThreeDoors
            busy={importer.busy}
            onScratch={() => navigate('/resume/new')}
            onSample={() => void importer.fromSample()}
            onImport={() => fileInput.current?.click()}
          />
        ) : null}

        {resumes.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onDuplicate={(r) => void duplicate(r)}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        ) : null}
      </div>

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

// three doors, because editing a complete sample beats authoring from a blank page
function ThreeDoors({
  busy,
  onScratch,
  onSample,
  onImport,
}: {
  busy: boolean
  onScratch: () => void
  onSample: () => void
  onImport: () => void
}) {
  const doors = [
    {
      title: 'Start from scratch',
      body: 'A guided section order chosen for your career stage.',
      action: (
        <Button variant="primary" onClick={onScratch}>
          <Icon name="plus" />
          New resume
        </Button>
      ),
    },
    {
      title: 'Start from a sample',
      body: 'A complete example you overwrite. The fastest way to see what good looks like.',
      action: (
        <Button variant="secondary" loading={busy} onClick={onSample}>
          Use the sample
        </Button>
      ),
    },
    {
      title: 'Import a file',
      body: 'Bring a JSON Resume file, or an export from R4U. Anything it cannot place is named.',
      action: (
        <Button variant="secondary" loading={busy} onClick={onImport}>
          Choose a file
        </Button>
      ),
    },
  ]

  return (
    <div className="py-4">
      <h2 className="text-lg text-ink-12">Three ways to begin</h2>
      <p className="mt-2 max-w-lg text-sm text-ink-09">
        Your content is stored as structured data, so whichever you pick, you can change template
        later without touching a layout.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {doors.map((door, index) => (
          <Card key={door.title} className="flex flex-col gap-2 p-6">
            <span className="flex size-9 items-center justify-center rounded-xs bg-accent-subtle text-sm font-semibold text-accent-text">
              {index + 1}
            </span>
            <h3 className="mt-3 text-md text-ink-12">{door.title}</h3>
            <p className="flex-1 text-sm text-ink-09">{door.body}</p>
            <div className="pt-4">{door.action}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
