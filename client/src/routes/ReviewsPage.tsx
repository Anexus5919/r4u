import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReviewItem } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'
import { useSocketEvent } from '@/context/SocketContext'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPatch, toApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, Skeleton, StatusLabel } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'

const STATUS_LABEL: Record<ReviewItem['status'], string> = {
  requested: 'Waiting for a reply',
  active: 'In review',
  declined: 'Declined',
  completed: 'Completed',
}

function ReviewRow({
  review,
  onRespond,
}: {
  review: ReviewItem
  onRespond: (id: string, accept: boolean) => void
}) {
  const other = review.as === 'owner' ? review.reviewer : review.owner
  const open = review.status === 'active' || review.status === 'completed'

  return (
    <li className="flex flex-col gap-3 border-t border-ink-04 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-12">
          {open ? (
            <Link to={`/reviews/${review.id}`} className="no-underline hover:text-accent-text">
              {review.resume.title}
            </Link>
          ) : (
            review.resume.title
          )}
        </p>
        <p className="mt-0.5 text-sm text-ink-09">
          {review.as === 'owner' ? 'Reviewer' : 'From'} {other.name} · requested{' '}
          {formatRelative(review.requestedAt)}
        </p>
        {review.message ? (
          <p className="mt-1.5 text-sm text-ink-10">&ldquo;{review.message}&rdquo;</p>
        ) : null}
        {review.summary ? (
          <p className="mt-1.5 border-l-2 border-accent pl-3 text-sm text-ink-10">
            {review.summary}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusLabel on={review.status === 'active'}>{STATUS_LABEL[review.status]}</StatusLabel>
        {review.as === 'reviewer' && review.status === 'requested' ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => onRespond(review.id, false)}>
              Decline
            </Button>
            <Button size="sm" variant="primary" onClick={() => onRespond(review.id, true)}>
              Accept
            </Button>
          </>
        ) : null}
        {open ? (
          <ButtonLink size="sm" variant="secondary" to={`/reviews/${review.id}`}>
            Open room
          </ButtonLink>
        ) : null}
      </div>
    </li>
  )
}

interface ReviewerProfile {
  bio: string
  expertise: string[]
  acceptingRequests: boolean
  openSlots: number
}

function ReviewerProfileCard() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<ReviewerProfile | null>(null)
  const [expertise, setExpertise] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet<{ profile: ReviewerProfile }>('/users/me/reviewer-profile')
      .then(({ profile: loaded }) => {
        setProfile(loaded)
        setExpertise(loaded.expertise.join(', '))
      })
      .catch(() => undefined)
  }, [])

  if (!profile) return null

  async function save() {
    if (!profile) return
    setSaving(true)
    try {
      const tags = expertise
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8)
      const { profile: saved } = await apiPatch<{ profile: ReviewerProfile }>(
        '/users/me/reviewer-profile',
        {
          ...profile,
          expertise: tags,
        }
      )
      setProfile(saved)
      toast('success', 'Reviewer profile saved')
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-md text-ink-12">Your reviewer profile</h2>
      <p className="mt-1 text-sm text-ink-09">
        What people see in the directory when they ask for a review.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        <Field label="About you" value={profile.bio} max={400}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          )}
        </Field>
        <Field label="Expertise" hint="Comma separated, up to eight.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Open slots" className="w-32">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={20}
                value={profile.openSlots}
                onChange={(e) => setProfile({ ...profile, openSlots: Number(e.target.value) })}
              />
            )}
          </Field>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ink-11">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={profile.acceptingRequests}
              onChange={(e) => setProfile({ ...profile, acceptingRequests: e.target.checked })}
            />
            Taking new requests
          </label>
        </div>
        <div>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save profile
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function ReviewsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    apiGet<{ reviews: ReviewItem[] }>('/reviews')
      .then(({ reviews: list }) => setReviews(list))
      .catch((caught) => setError(toApiFailure(caught).message))
  }, [])

  useEffect(() => load(), [load])
  // a new request or an answer arrives as a notification; refresh the list when it does
  useSocketEvent('notify:new', () => load())

  async function respond(id: string, accept: boolean) {
    try {
      await apiPatch(`/reviews/${id}/respond`, { accept })
      toast('success', accept ? 'Accepted. The review room is open.' : 'Request declined')
      load()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  const incoming = reviews?.filter((r) => r.as === 'reviewer') ?? []
  const outgoing = reviews?.filter((r) => r.as === 'owner') ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl text-ink-12">Reviews</h1>
      <p className="mt-1.5 text-sm text-ink-09">
        Feedback from mentors, pinned to sections, with live chat. Reviewers can read and comment,
        never edit.
      </p>

      {error ? <Banner className="mt-6">{error}</Banner> : null}
      {reviews === null && !error ? <Skeleton className="mt-8 h-48" /> : null}

      {user?.role === 'reviewer' && reviews ? (
        <Card className="mt-8 p-6">
          <h2 className="text-md text-ink-12">Assigned to you</h2>
          {incoming.length ? (
            <ul className="mt-3">
              {incoming.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  onRespond={(id, accept) => void respond(id, accept)}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-09">
              No requests yet. They appear here and in your notifications.
            </p>
          )}
        </Card>
      ) : null}

      {reviews ? (
        <Card className="mt-6 p-6">
          <h2 className="text-md text-ink-12">Your requests</h2>
          {outgoing.length ? (
            <ul className="mt-3">
              {outgoing.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  onRespond={(id, accept) => void respond(id, accept)}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-09">
              Open any resume and choose Request review to ask a mentor for feedback.{' '}
              <Link to="/dashboard" className="font-medium text-accent-text">
                Go to my resumes
              </Link>
            </p>
          )}
        </Card>
      ) : null}

      {user?.role === 'reviewer' ? (
        <div className="mt-6">
          <ReviewerProfileCard />
        </div>
      ) : null}
    </div>
  )
}
