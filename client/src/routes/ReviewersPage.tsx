import { useEffect, useMemo, useState } from 'react'
import type { PersonRef, ReviewerCard } from '@r4u/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { apiGet, toApiFailure } from '@/lib/api'
import { PresenceGlyph, RequestReviewModal } from '@/components/review/RequestReviewModal'
import { ReviewerRecord } from '@/components/review/ReviewerRecord'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'

type Sort = 'rating' | 'reviews' | 'reply'

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'rating', label: 'Best rated' },
  { value: 'reviews', label: 'Most reviews' },
  { value: 'reply', label: 'Fastest reply' },
]

// nulls sort last in every order: a reviewer with no record yet is not "best" at anything
function compare(sort: Sort) {
  return (a: ReviewerCard, b: ReviewerCard) => {
    if (sort === 'reviews') return b.record.completed - a.record.completed
    if (sort === 'reply') {
      return (a.record.replyHours ?? Infinity) - (b.record.replyHours ?? Infinity)
    }
    const byRating = (b.record.rating ?? -1) - (a.record.rating ?? -1)
    return byRating || b.record.completed - a.record.completed
  }
}

function matches(card: ReviewerCard, query: string) {
  if (!query) return true
  const haystack = [card.name, card.headline, card.bio, ...card.expertise].join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

function ReviewerEntry({
  card,
  onRequest,
  onArea,
}: {
  card: ReviewerCard
  onRequest: () => void
  onArea: (area: string) => void
}) {
  const full = card.slotsFree === 0
  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-md text-ink-12">{card.name}</h2>
          {card.headline ? <p className="mt-0.5 text-sm text-ink-10">{card.headline}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-09">
          <PresenceGlyph online={card.online} />
          {card.online ? 'Online' : 'Offline'}
        </span>
      </div>

      {card.bio ? <p className="mt-3 text-sm text-ink-11">{card.bio}</p> : null}

      {card.expertise.length ? (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {card.expertise.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => onArea(area)}
              className="font-medium text-accent-text hover:underline"
            >
              {area}
            </button>
          ))}
        </p>
      ) : null}

      <ReviewerRecord
        className="mt-5 border-t border-ink-04 pt-4"
        record={card.record}
        slotsFree={card.slotsFree}
        openSlots={card.openSlots}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3 pt-1">
        <Button variant="primary" disabled={full} onClick={onRequest}>
          Request a review
        </Button>
        {full ? (
          <span className="text-xs text-ink-09">Every slot is taken. Check back soon.</span>
        ) : null}
      </div>
    </Card>
  )
}

export function ReviewersPage() {
  const [reviewers, setReviewers] = useState<ReviewerCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [sort, setSort] = useState<Sort>('rating')
  const [target, setTarget] = useState<PersonRef | null>(null)
  const query = useDebounce(search.trim(), 200)

  useEffect(() => {
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
  }, [])

  const areas = useMemo(
    () => [...new Set((reviewers ?? []).flatMap((card) => card.expertise))].sort(),
    [reviewers]
  )

  const shown = useMemo(
    () =>
      (reviewers ?? [])
        .filter((card) => matches(card, query) && (!area || card.expertise.includes(area)))
        .sort(compare(sort)),
    [reviewers, query, area, sort]
  )

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl text-ink-12">Reviewers</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-09">
        Mentors who read resumes and pin feedback to sections. Ratings, completed reviews and reply
        times come from their finished reviews on R4U, not from what they say about themselves.
      </p>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Icon name="search" className="pointer-events-none absolute top-3 left-3 text-ink-08" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role or skill"
            aria-label="Search reviewers"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter by expertise"
          value={area}
          onChange={(event) => setArea(event.target.value)}
          className="h-10 rounded-xs border border-ink-05 bg-ink-00 px-3 text-sm text-ink-12 lg:w-56"
        >
          <option value="">Any expertise</option>
          {areas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="lg:ml-auto">
          <Segmented
            label="Sort reviewers"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-6">
        {error ? <Banner className="max-w-md">{error}</Banner> : null}

        {reviewers === null && !error ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-busy="true">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : null}

        {reviewers && reviewers.length === 0 ? (
          <Card className="px-6 py-14 text-center">
            <h2 className="text-lg text-ink-12">No reviewer is taking requests</h2>
            <p className="mt-2 text-sm text-ink-09">Check back soon.</p>
          </Card>
        ) : null}

        {reviewers && reviewers.length > 0 && shown.length === 0 ? (
          <Card className="px-6 py-14 text-center">
            <h2 className="text-lg text-ink-12">Nobody matches that</h2>
            <p className="mt-2 text-sm text-ink-09">
              Try a shorter search, or choose Any expertise.
            </p>
          </Card>
        ) : null}

        {shown.length ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {shown.map((card) => (
              <ReviewerEntry
                key={card.id}
                card={card}
                onArea={setArea}
                onRequest={() => setTarget({ id: card.id, name: card.name })}
              />
            ))}
          </div>
        ) : null}
      </div>

      <RequestReviewModal
        open={target !== null}
        reviewer={target ?? undefined}
        title={target ? `Ask ${target.name} for a review` : 'Request a review'}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
