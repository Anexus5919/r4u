import type { NotificationItem } from '@r4u/shared'

const NOTIFY_COPY: Record<NotificationItem['type'], string> = {
  review_requested: 'asked you to review',
  review_accepted: 'accepted your review request for',
  review_declined: 'declined your review request for',
  review_completed: 'completed the review of',
  review_resubmitted: 'sent an updated version for another look:',
  review_rated: 'rated your review',
  comment: 'commented:',
  chat: 'sent a message:',
}

export function describeNotification(item: NotificationItem) {
  const count = item.type === 'chat' && item.count > 1 ? ` (${item.count} messages)` : ''
  return `${item.actorName} ${NOTIFY_COPY[item.type]} ${item.preview}${count}`
}
