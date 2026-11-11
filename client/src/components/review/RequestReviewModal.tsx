import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PersonRef, ResumeSummary, ReviewerCard, ReviewItem } from '@r4u/shared'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPost, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Card'
import { ReviewerRecord } from './ReviewerRecord'

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

const SELECT =
  'h-10 w-full rounded-xs border border-ink-05 bg-ink-00 px-3 text-sm text-ink-12 focus-visible:border-accent focus-visible:outline-none'

// opened from a resume (choose the reviewer) or from the reviewer directory (choose the resume)
export function RequestReviewModal({
  open,
  resumeId,
  reviewer,
  title = 'Request a review',
  onClose,
}: {
  open: boolean
  resumeId?: string
  reviewer?: PersonRef
  title?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const reviewerId = reviewer?.id
  const { toast } = useToast()
  const [reviewers, setReviewers] = useState<ReviewerCard[] | null>(null)
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(reviewer?.id ?? null)
  const [resume, setResume] = useState<string>(resumeId ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChosen(reviewerId ?? null)
    setResume(resumeId ?? '')
    setError(null)
    let cancelled = false
    const fail = (caught: unknown) => {
      if (!cancelled) setError(toApiFailure(caught).message)
    }
    if (!reviewerId) {
      apiGet<{ reviewers: ReviewerCard[] }>('/users/reviewers')
        .then(({ reviewers: list }) => !cancelled && setReviewers(list))
        .catch(fail)
    }
    if (!resumeId) {
      apiGet<{ resumes: ResumeSummary[] }>('/resumes')
        .then(({ resumes: list }) => {
          if (cancelled) return
          setResumes(list)
          setResume((current) => current || list[0]?.id || '')
        })
        .catch(fail)
    }
    return () => {
      cancelled = true
    }
  }, [open, reviewerId, resumeId])

  async function send() {
    if (!chosen || !resume) return
    setBusy(true)
    setError(null)
    try {
      await apiPost<{ review: ReviewItem }>('/reviews', {
        resumeId: resume,
        reviewerId: chosen,
        message,
      })
      toast('success', 'Request sent. You will be notified when they answer.')
      setMessage('')
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
      title={title}
      description="A reviewer reads your resume, pins comments to sections and chats with you live. They can never edit it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!chosen || !resume}
            onClick={() => void send()}
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? <Banner>{error}</Banner> : null}

        {reviewer ? (
          <p className="text-sm text-ink-10">
            To <span className="font-semibold text-ink-12">{reviewer.name}</span>. They accept or
            decline, and you are notified either way.
          </p>
        ) : null}

        {!resumeId ? (
          resumes === null && !error ? (
            <Skeleton className="h-10" />
          ) : resumes?.length === 0 ? (
            <p className="text-sm text-ink-09">
              You have no resume yet. Create one from My resumes, then come back.
            </p>
          ) : resumes ? (
            <Field label="Which resume">
              {({ id }) => (
                <select
                  id={id}
                  className={SELECT}
                  value={resume}
                  onChange={(event) => setResume(event.target.value)}
                >
                  {resumes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null
        ) : null}

        {!reviewer && reviewers === null && !error ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : null}

        {!reviewer && reviewers?.length === 0 ? (
          <p className="text-sm text-ink-09">
            No reviewer is taking requests right now. Try again later.
          </p>
        ) : null}

        {!reviewer && reviewers && reviewers.length > 0 ? (
          <div
            role="radiogroup"
            aria-label="Reviewer"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {reviewers.map((card) => (
              <button
                key={card.id}
                type="button"
                role="radio"
                aria-checked={chosen === card.id}
                onClick={() => setChosen(card.id)}
                className={cn(
                  't-xs flex flex-col gap-1.5 rounded-sm border p-4 text-left transition-colors',
                  chosen === card.id
                    ? 'border-accent bg-accent-subtle'
                    : 'border-ink-05 bg-ink-00 hover:border-ink-06'
                )}
              >
                <span className="flex items-center gap-2">
                  <PresenceGlyph online={card.online} />
                  <span className="text-sm font-semibold text-ink-12">{card.name}</span>
                  <span className="ml-auto text-xs text-ink-09">
                    {card.slotsFree} of {card.openSlots} free
                  </span>
                </span>
                {card.headline ? (
                  <span className="text-sm text-ink-10">{card.headline}</span>
                ) : null}
                {card.expertise.length ? (
                  <span className="text-xs text-ink-09">{card.expertise.join(' · ')}</span>
                ) : null}
                <ReviewerRecord
                  compact
                  record={card.record}
                  slotsFree={card.slotsFree}
                  openSlots={card.openSlots}
                />
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
