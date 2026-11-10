import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicResume, Resume } from '@r4u/shared'
import { ResumePreview } from '@/render/ResumePreview'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPost, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'
import { downloadPdf } from '@/lib/pdf'
import { usePrivateDocument } from '@/hooks/usePrivateDocument'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/brand/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Load =
  | { status: 'loading' }
  | { status: 'ready'; resume: PublicResume }
  | { status: 'error'; error: ApiFailure }

const UNAVAILABLE: Record<string, { title: string; body: string }> = {
  SHARE_LINK_DISABLED: {
    title: 'This link has been turned off',
    body: 'The owner has stopped sharing this resume. Ask them for a new link if you still need it.',
  },
  SHARE_LINK_EXPIRED: {
    title: 'This link has expired',
    body: 'The owner set this link to stop working after a date. Ask them for a fresh one.',
  },
  NOT_FOUND: {
    title: 'This link does not exist',
    body: 'Check that the whole address was copied. A deleted link also ends up here.',
  },
}

const REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'impersonation', label: 'Pretends to be someone else' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'personal_data', label: "Exposes someone else's personal data" },
  { value: 'other', label: 'Something else' },
]

function ReportModal({
  slug,
  open,
  onClose,
}: {
  slug: string
  open: boolean
  onClose: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [snippet, setSnippet] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await apiPost(`/public/r/${slug}/report`, { reason, snippet })
      toast('success', 'Thank you. An administrator will look at this link.')
      onClose()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report this resume"
      description="Reports go to the R4U administrators, who judge the public page you are looking at."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={!reason} onClick={() => void submit()}>
            Send report
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2">
          {REASONS.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-11"
            >
              <input
                type="radio"
                name="reason"
                className="size-4 accent-accent"
                checked={reason === item.value}
                onChange={() => setReason(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
        <Field label="Details (optional)" value={snippet} max={500}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={snippet}
              onChange={(event) => setSnippet(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}

// public and read-only: no account, no editor, and nothing the owner hid or redacted
export function PublicResumePage() {
  const { slug = '' } = useParams()
  const { toast } = useToast()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [downloading, setDownloading] = useState(false)
  const [reporting, setReporting] = useState(false)
  usePrivateDocument()

  useEffect(() => {
    const controller = new AbortController()
    apiGet<{ resume: PublicResume }>(`/public/r/${encodeURIComponent(slug)}`, controller.signal)
      .then(({ resume }) => setLoad({ status: 'ready', resume }))
      .catch((caught) => {
        if (!controller.signal.aborted) setLoad({ status: 'error', error: toApiFailure(caught) })
      })
    return () => controller.abort()
  }, [slug])

  async function download() {
    setDownloading(true)
    try {
      // the POST records the download, then the same payload is drawn into the PDF
      const { resume } = await apiPost<{ resume: PublicResume }>(
        `/public/r/${encodeURIComponent(slug)}/download`
      )
      await downloadPdf(resume as unknown as Partial<Resume>)
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setDownloading(false)
    }
  }

  const ready = load.status === 'ready'
  const name = ready ? load.resume.personal.fullName : ''

  return (
    <div className="flex min-h-dvh flex-col bg-ink-02">
      <header className="sticky top-0 z-10 border-b border-ink-04 bg-ink-00">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Logo tagline />
          {ready ? (
            <Button
              variant="primary"
              className="ml-auto"
              loading={downloading}
              onClick={() => void download()}
            >
              <Icon name="download" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {load.status === 'loading' ? (
          <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[794px]" />
        ) : null}

        {load.status === 'error' ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <h1 className="text-xl text-ink-12">
              {(UNAVAILABLE[load.error.code] ?? UNAVAILABLE.NOT_FOUND)!.title}
            </h1>
            <p className="mt-3 text-sm text-ink-09">
              {
                (
                  UNAVAILABLE[load.error.code] ?? {
                    body: load.error.message,
                  }
                ).body
              }
            </p>
            <ButtonLink to="/" variant="secondary" className="mt-8">
              About R4U
            </ButtonLink>
          </div>
        ) : null}

        {ready ? (
          <>
            <h1 className="sr-only">{name ? `${name}, resume` : load.resume.title}</h1>
            <div className={cn('sheet mx-auto w-full max-w-[794px]')}>
              <ResumePreview resume={load.resume as unknown as Partial<Resume>} />
            </div>
          </>
        ) : null}
      </main>

      <footer className="border-t border-ink-04 bg-ink-00">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-09 sm:px-6">
          <p>
            Shared with R4U, Resume For You.{' '}
            <a href="/" className="font-medium text-accent-text">
              Build your own, free
            </a>
          </p>
          {ready ? (
            <button
              type="button"
              className="text-ink-09 underline hover:text-ink-12"
              onClick={() => setReporting(true)}
            >
              Report this resume
            </button>
          ) : null}
        </div>
      </footer>

      <ReportModal slug={slug} open={reporting} onClose={() => setReporting(false)} />
    </div>
  )
}
