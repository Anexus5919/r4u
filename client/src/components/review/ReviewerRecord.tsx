import type { ReviewerTrackRecord } from '@r4u/shared'
import { cn } from '@/lib/cn'

function formatReply(hours: number | null) {
  if (hours === null) return 'No requests answered yet'
  if (hours < 1) return 'Replies within an hour'
  if (hours < 48) return `Replies in about ${Math.round(hours)} hours`
  return `Replies in about ${Math.round(hours / 24)} days`
}

function formatRating(record: ReviewerTrackRecord) {
  if (record.rating === null) return 'No ratings yet'
  const count = record.ratings === 1 ? '1 rating' : `${record.ratings} ratings`
  return `${record.rating.toFixed(1)} out of 5, ${count}`
}

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

/** The figures come from finished reviews on R4U, so the label says so rather than "verified". */
export function ReviewerRecord({
  record,
  slotsFree,
  openSlots,
  compact,
  className,
}: {
  record: ReviewerTrackRecord
  slotsFree: number
  openSlots: number
  compact?: boolean
  className?: string
}) {
  const completed =
    record.completed === 1 ? '1 review completed' : `${record.completed} reviews completed`

  if (compact) {
    return (
      <span className={cn('text-xs text-ink-09', className)}>
        {formatRating(record)} · {completed} · {formatReply(record.replyHours).toLowerCase()}
      </span>
    )
  }

  const rows: [string, string][] = [
    ['Rating', formatRating(record)],
    ['Track record', completed],
    ['Response', formatReply(record.replyHours)],
    ['Capacity', `${slotsFree} of ${openSlots} slots free`],
    ['On R4U since', memberSince(record.memberSince)],
  ]

  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm', className)}>
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-09">{term}</dt>
          <dd className="text-ink-12 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
