import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { DIMENSIONS } from '@r4u/shared'
import type { AtsCheckResult, AtsResult, ResumeDetail } from '@r4u/shared'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPost, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Input'

interface HistoryItem {
  total: number
  mode: 'full' | 'format_only'
  at: string
}

// where a failed check sends you: the section, then the entry, in the editor
function fixLink(resumeId: string, check: AtsCheckResult): string {
  const base = `/resume/${resumeId}/edit`
  const target = check.target
  if (!target || target.field === 'template' || target.field === 'design') return base
  const params = new URLSearchParams()
  if (target.sectionId && target.sectionId !== 'add') params.set('section', target.sectionId)
  if (target.entryId) params.set('entry', target.entryId)
  if (target.field) params.set('field', target.field)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

function fixLabel(check: AtsCheckResult): string {
  const field = check.target?.field
  if (field === 'template') return 'Change the template'
  if (field === 'design') return 'Adjust the design'
  if (check.target?.sectionId === 'add') return 'Add the section'
  return 'Fix in the editor'
}

function DimensionBar({
  id,
  title,
  earned,
  possible,
  muted,
}: {
  id: string
  title: string
  earned: number
  possible: number
  muted?: boolean
}) {
  const share = possible ? Math.min(100, (earned / possible) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-11">
          <span className="font-mono text-xs text-ink-09">{id}</span> {title}
        </span>
        <span className="text-ink-12 tabular-nums">
          {muted ? 'Paste a posting' : `${earned} / ${possible}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-xs bg-ink-03" aria-hidden>
        <div
          className={cn('h-full rounded-xs', muted ? 'bg-transparent' : 'bg-accent')}
          style={{ width: `${muted ? 0 : share}%` }}
        />
      </div>
    </div>
  )
}

function CheckRow({ resumeId, check }: { resumeId: string; check: AtsCheckResult }) {
  const lost = Math.round((check.possible - check.earned) * 10) / 10
  return (
    <li className="border-t border-ink-04 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink-12">
          <span className="mr-2 font-mono text-xs font-normal text-ink-09">{check.checkId}</span>
          {check.title}
        </p>
        <span className="text-xs text-ink-09 tabular-nums">
          {check.earned} of {check.possible}, {lost} lost
        </span>
      </div>
      <p className="mt-1.5 text-sm text-ink-10">{check.message}</p>
      <Link
        to={fixLink(resumeId, check)}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-text"
      >
        {fixLabel(check)}
        <Icon name="arrow" />
      </Link>
    </li>
  )
}

export function AtsPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const carried = (location.state as { jobDescription?: string } | null)?.jobDescription ?? ''

  const [resume, setResume] = useState<ResumeDetail | null>(null)
  const [result, setResult] = useState<AtsResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [posting, setPosting] = useState(carried)
  const [scoring, setScoring] = useState(false)
  const [tailoring, setTailoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const score = useCallback(
    async (jobDescription: string) => {
      setScoring(true)
      try {
        const next = await apiPost<AtsResult>(`/resumes/${id}/ats`, {
          jobDescription: jobDescription.trim() || undefined,
        })
        setResult(next)
        const { history: list } = await apiGet<{ history: HistoryItem[] }>(`/resumes/${id}/ats`)
        setHistory(list)
      } catch (caught) {
        setError(toApiFailure(caught).message)
      } finally {
        setScoring(false)
      }
    },
    [id]
  )

  useEffect(() => {
    apiGet<{ resume: ResumeDetail }>(`/resumes/${id}`)
      .then(({ resume: doc }) => setResume(doc))
      .catch((caught) => setError(toApiFailure(caught).message))
    void score(carried)
    // the carried posting is read once on arrival; later edits go through the button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, score])

  const failing = useMemo(
    () => result?.checks.filter((c) => c.status === 'fail' || c.status === 'partial') ?? [],
    [result]
  )
  const passing = result ? result.checks.length - failing.length : 0
  const previous = history[1]

  async function tailor() {
    if (!resume || !result?.keywords) return
    setTailoring(true)
    try {
      const role = result.keywords.jobTitle || 'this job'
      const { resume: copy } = await apiPost<{ resume: ResumeDetail }>(`/resumes/${id}/duplicate`, {
        title: `${resume.title} for ${role}`.slice(0, 80),
      })
      toast('success', 'A tailored copy is ready. The original is unchanged.')
      // the posting travels in router state only, so it is never stored anywhere
      navigate(`/resume/${copy.id}/ats`, { state: { jobDescription: posting } })
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setTailoring(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Banner>{error}</Banner>
        <ButtonLink to="/dashboard" variant="secondary" className="mt-6">
          Back to my resumes
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ButtonLink to={`/resume/${id}`} variant="ghost" size="sm" className="-ml-3">
        <Icon name="arrow" className="rotate-180" />
        Preview
      </ButtonLink>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl text-ink-12">ATS Readiness</h1>
          <p className="mt-1 text-sm text-ink-09">{resume?.title ?? ' '}</p>
        </div>
        <ButtonLink to={`/resume/${id}/edit`} variant="secondary">
          Open the editor
        </ButtonLink>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {!result ? (
            <Skeleton className="h-72" />
          ) : (
            <Card className="p-6">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-d3 leading-none text-ink-12 tabular-nums">
                  {result.total}
                  <span className="text-lg text-ink-09"> / 100</span>
                </p>
                <div className="pb-1 text-sm text-ink-09">
                  <p className="font-medium text-ink-11">
                    {result.mode === 'full' ? 'Matched to the job posting' : 'Format only'}
                  </p>
                  {previous ? (
                    <p>
                      Previously {previous.total}, {formatRelative(previous.at)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {DIMENSIONS.map((d) => {
                  const row = result.dimensions.find((r) => r.id === d.id)!
                  return (
                    <DimensionBar
                      key={d.id}
                      id={d.id}
                      title={d.title}
                      earned={row.earned}
                      possible={row.possible}
                      muted={d.id === 'E' && result.mode === 'format_only'}
                    />
                  )
                })}
              </div>

              <p className="mt-6 text-xs text-ink-09">
                Scored against the published resume-quality rules of the Textkernel (Sovren) parsing
                engine used by iCIMS, Bullhorn and others. Rubric v{result.rubricVersion}.{' '}
                <Link to="/ats-methodology" className="font-medium text-accent-text">
                  See the full 100-point breakdown
                </Link>
                .
              </p>
            </Card>
          )}

          {result?.gate.blocked ? (
            <Banner>
              We found text hidden from human readers ({result.gate.reasons.join('; ')}). Parsers
              extract colour-blind raw text, so hidden keywords show up in recruiter exports. This
              gets applications blacklisted, not boosted. The score is 0 and export is blocked until
              it is removed.
            </Banner>
          ) : null}

          {result && result.templateCeiling.max < 30 ? (
            <Banner tone="info">
              {result.templateCeiling.template} caps parseability at {result.templateCeiling.max} of
              30. Switch to {result.templateCeiling.best} to recover{' '}
              {30 - result.templateCeiling.max} points; your content stays as it is.
            </Banner>
          ) : null}

          {result ? (
            <Card className="p-6">
              <h2 className="text-md text-ink-12">
                {failing.length === 0
                  ? 'Nothing to fix'
                  : failing.length === 1
                    ? '1 thing to fix'
                    : `${failing.length} things to fix`}
              </h2>
              {failing.length ? (
                <ul className="mt-4">
                  {failing.map((check) => (
                    <CheckRow key={check.checkId} resumeId={id} check={check} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-09">Every check passes.</p>
              )}
              {result.hints.map((hint) => (
                <p key={hint} className="mt-4 border-t border-ink-04 pt-4 text-sm text-ink-10">
                  {hint}
                </p>
              ))}
              <details className="mt-4 border-t border-ink-04 pt-4 text-sm">
                <summary className="cursor-pointer text-ink-09">{passing} checks passed</summary>
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {result.checks
                    .filter((c) => c.status === 'pass' || c.status === 'na')
                    .map((c) => (
                      <li key={c.checkId} className="text-ink-10">
                        <span className="mr-2 font-mono text-xs text-ink-09">{c.checkId}</span>
                        {c.title}
                        {c.status === 'na' ? ' (does not apply)' : ''}
                      </li>
                    ))}
                </ul>
              </details>
            </Card>
          ) : null}

          {result ? (
            <section>
              <h2 className="text-md text-ink-12">Parser preview</h2>
              <p className="mt-1 text-sm text-ink-09">
                The raw text a line-by-line parser extracts from this resume, in the order it reads
                it. If something looks scrambled here, it is scrambled for the recruiter&rsquo;s
                search too.
              </p>
              <pre className="mt-3 max-h-[32rem] overflow-auto rounded-sm border border-ink-04 bg-ink-00 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-11">
                {result.parserPreview}
              </pre>
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <Card className="p-5">
            <h2 className="text-md text-ink-12">Match to a job</h2>
            <p className="mt-1 text-sm text-ink-09">
              Paste the posting. It is used for this check only and never stored.
            </p>
            <Field label="Job description" value={posting} max={20000} className="mt-4">
              {({ id: fieldId }) => (
                <Textarea
                  id={fieldId}
                  rows={8}
                  value={posting}
                  placeholder="Senior Backend Engineer&#10;Requirements: ..."
                  onChange={(event) => setPosting(event.target.value)}
                />
              )}
            </Field>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                loading={scoring}
                disabled={posting.trim().length < 40}
                onClick={() => void score(posting)}
              >
                Score against this job
              </Button>
              {result?.mode === 'full' ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPosting('')
                    void score('')
                  }}
                >
                  Format only
                </Button>
              ) : null}
            </div>
          </Card>

          {result?.keywords ? (
            <Card className="p-5">
              <h2 className="text-md text-ink-12">Keywords</h2>
              {result.keywords.jobTitle ? (
                <p className="mt-1 text-sm text-ink-09">For {result.keywords.jobTitle}</p>
              ) : null}
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-ink-09">On your resume</dt>
                  <dd className="mt-0.5 text-ink-12">
                    {result.keywords.matched.join(', ') || 'None yet'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-09">Missing</dt>
                  <dd className="mt-0.5 text-ink-12">
                    {result.keywords.missing.join(', ') || 'Nothing, every hard skill is there'}
                  </dd>
                </div>
              </dl>
              {result.keywords.stuffing.length ? (
                <Banner tone="warning" className="mt-4">
                  This reads as keyword stuffing ({result.keywords.stuffing.join('; ')}), so the job
                  match is capped at 12 of 20. Each keyword counts once, and recruiters read the
                  extracted text, where a padded list is obvious.
                </Banner>
              ) : null}
              <p className="mt-4 text-xs text-ink-09">
                Add a missing skill only if you have it, ideally inside the role that used it.
              </p>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                loading={tailoring}
                onClick={() => void tailor()}
              >
                Tailor a copy for this job
              </Button>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
