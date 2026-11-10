import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewerCard, ReviewItem } from '@r4u/shared'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPost, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Card'

// presence is a filled or hollow glyph, never a green dot and never pulsing
export function PresenceGlyph({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      aria-label={online ? 'Online' : 'Offline'}
      role="img"
      className={cn(
        'inline-block size-2 shrink-0 rounded-xs border border-ink-09',
        online ? 'bg-ink-09' : 'bg-transparent',
        className
      )}
    />
  )
}

export function RequestReviewModal({
  open,
  resumeId,
  onClose,
}: {
  open: boolean
  resumeId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [reviewers, setReviewers] = useState<ReviewerCard[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    apiGet<{ reviewers: ReviewerCard[] }>('/users/reviewers')
      .then(({ reviewers: list }) => {
        if (!cancelled) setReviewers(list)
      })
      .catch((caught) => {
        if (!cancelled) setError(toApiFailure(caught).message)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function send() {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      await apiPost<{ review: ReviewItem }>('/reviews', { resumeId, reviewerId: chosen, message })
      toast('success', 'Request sent. You will be notified when they answer.')
      onClose()
      navigate('/reviews')
    } catch (caught) {
      setError(toApiFailure(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Request a review"
      description="A reviewer reads your resume, pins comments to sections and chats with you live. They can never edit it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!chosen} onClick={() => void send()}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? <Banner>{error}</Banner> : null}

        {reviewers === null && !error ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : null}

        {reviewers?.length === 0 ? (
          <p className="text-sm text-ink-09">
            No reviewer is taking requests right now. Try again later.
          </p>
        ) : null}

        {reviewers && reviewers.length > 0 ? (
          <div
            role="radiogroup"
            aria-label="Reviewer"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {reviewers.map((reviewer) => (
              <button
                key={reviewer.id}
                type="button"
                role="radio"
                aria-checked={chosen === reviewer.id}
                onClick={() => setChosen(reviewer.id)}
                className={cn(
                  't-xs flex flex-col gap-1.5 rounded-sm border p-4 text-left transition-colors',
                  chosen === reviewer.id
                    ? 'border-accent bg-accent-subtle'
                    : 'border-ink-05 bg-ink-00 hover:border-ink-06'
                )}
              >
                <span className="flex items-center gap-2">
                  <PresenceGlyph online={reviewer.online} />
                  <span className="text-sm font-semibold text-ink-12">{reviewer.name}</span>
                  <span className="ml-auto text-xs text-ink-09">
                    {reviewer.openSlots} open slots
                  </span>
                </span>
                {reviewer.headline ? (
                  <span className="text-sm text-ink-10">{reviewer.headline}</span>
                ) : null}
                {reviewer.bio ? <span className="text-xs text-ink-09">{reviewer.bio}</span> : null}
                {reviewer.expertise.length ? (
                  <span className="text-xs text-ink-09">{reviewer.expertise.join(' · ')}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <Field
          label="A note for the reviewer"
          value={message}
          max={500}
          hint="What role you are applying for, and what you want them to look at."
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
