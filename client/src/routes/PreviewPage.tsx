import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { computeMeta, getTemplate } from '@r4u/shared'
import type { Resume, ResumeDetail } from '@r4u/shared'
import { ResumePreview } from '@/render/ResumePreview'
import { useToast } from '@/context/ToastContext'
import { api, apiGet, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'

type Load =
  | { status: 'loading' }
  | { status: 'ready'; resume: ResumeDetail }
  | { status: 'error'; error: ApiFailure }

const ATS_COPY = {
  safe: 'Single column, reads cleanly in applicant tracking systems.',
  caution: 'Mostly parseable. Check the plain-text order before you apply through an ATS.',
  unsafe: 'A designed layout. Best when a person reads it before a parser does.',
} as const

function fileName(title: string) {
  return (
    title
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'resume'
  )
}

export function PreviewPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    apiGet<{ resume: ResumeDetail }>(`/resumes/${id}`, controller.signal)
      .then(({ resume }) => setLoad({ status: 'ready', resume }))
      .catch((caught) => {
        if (!controller.signal.aborted) setLoad({ status: 'error', error: toApiFailure(caught) })
      })

    return () => controller.abort()
  }, [id])

  async function downloadJson(title: string) {
    setDownloading(true)
    try {
      const res = await api.get(`/resumes/${id}/export.json`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName(title)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast('success', 'JSON Resume downloaded')
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setDownloading(false)
    }
  }

  if (load.status === 'error') {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Banner>
          {load.error.code === 'NOT_FOUND'
            ? 'That resume does not exist, or it belongs to another account.'
            : load.error.message}
        </Banner>
        <ButtonLink to="/dashboard" variant="secondary" className="mt-6">
          Back to my resumes
        </ButtonLink>
      </div>
    )
  }

  if (load.status === 'loading') {
    return (
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]" aria-busy>
        <Skeleton className="aspect-[210/297] w-full max-w-[794px]" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const { resume } = load
  const doc = resume as unknown as Partial<Resume>
  const template = getTemplate(resume.templateKey)
  const meta = computeMeta(doc)

  return (
    <div className="mx-auto max-w-7xl print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <ButtonLink to="/dashboard" variant="ghost" size="sm" className="-ml-3">
            <Icon name="arrow" className="rotate-180" />
            My resumes
          </ButtonLink>
          <h1 className="mt-2 truncate text-xl text-ink-12">{resume.title}</h1>
          <p className="mt-1 text-sm text-ink-09">Updated {formatRelative(resume.updatedAt)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/resume/${resume.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
          <Button
            variant="secondary"
            loading={downloading}
            onClick={() => void downloadJson(resume.title)}
          >
            Download JSON
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Icon name="download" />
            Print or save as PDF
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_320px] print:mt-0 print:block">
        <div className="flex justify-center rounded-sm border border-ink-04 bg-ink-02 p-4 sm:p-10 print:border-0 print:bg-transparent print:p-0">
          <div className="print-root sheet w-full max-w-[794px] print:max-w-none">
            <ResumePreview resume={doc} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 print:hidden">
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-09">Template</p>
            <p className="mt-1 text-md font-semibold text-ink-12">
              {template.name}{' '}
              <span className="text-sm font-normal text-ink-09">· {template.category}</span>
            </p>
            <p className="mt-2 text-sm text-ink-09">{ATS_COPY[template.atsSafe]}</p>

            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-04 pt-4">
              <div>
                <dt className="text-xs text-ink-09">Complete</dt>
                <dd className="mt-0.5 font-semibold text-ink-12">{meta.completeness}%</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-09">Sections</dt>
                <dd className="mt-0.5 font-semibold text-ink-12">{meta.sectionCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-09">Words</dt>
                <dd className="mt-0.5 font-semibold text-ink-12">{meta.wordCount}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-12">Save as PDF</p>
            <p className="mt-2 text-sm text-ink-09">
              Opens your browser&apos;s print dialog with the page set to A4. Choose Save as PDF as
              the destination; the text stays selectable for applicant tracking systems.
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-12">Coming next</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-09">
              <li>One-click PDF export</li>
              <li>Share links with expiry and view counts</li>
              <li>Mentor review with live chat</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
