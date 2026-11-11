import { Types, trusted } from 'mongoose'
import type { NotificationItem, NotificationType } from '@r4u/shared'
import { NotificationModel } from '../../models/Notification.js'
import type { NotificationDoc } from '../../models/Notification.js'
import { UserModel } from '../../models/User.js'
import { emitToUser } from '../../sockets/emitters.js'

type Populated = NotificationDoc & { actor: { _id: Types.ObjectId; name: string } | null }

export function serializeNotification(doc: Populated): NotificationItem {
  const actor = doc.actor && typeof doc.actor === 'object' && 'name' in doc.actor ? doc.actor : null
  return {
    _id: doc.id,
    userId: String(doc.user),
    type: doc.type,
    actorId: actor ? String(actor._id) : null,
    actorName: actor?.name ?? 'R4U',
    entity: { kind: doc.entity?.kind ?? 'review', id: String(doc.entity?.id ?? '') },
    preview: doc.preview ?? '',
    count: doc.count,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
  }
}

export async function unreadCount(userId: string) {
  return NotificationModel.countDocuments({ user: userId, readAt: null })
}

async function pushCount(userId: string) {
  emitToUser(userId, 'notify:count', { unread: await unreadCount(userId) })
}

export interface NotifyInput {
  user: string
  type: NotificationType
  actor: string | null
  entity: { kind: 'review' | 'resume' | 'comment'; id: string }
  preview: string
}

/** Persists first, then emits: the row is the proof of delivery, the emit is a courtesy. */
export async function notify(input: NotifyInput): Promise<NotificationItem> {
  const preview = input.preview.slice(0, 160)
  let doc: NotificationDoc | null

  if (input.type === 'chat') {
    // a burst of messages coalesces into one unread row per review rather than one per message
    doc = await NotificationModel.findOneAndUpdate(
      { user: input.user, type: 'chat', 'entity.id': input.entity.id, readAt: null },
      {
        $inc: { count: 1 },
        $set: { preview, actor: input.actor },
        $setOnInsert: { entity: input.entity, user: input.user, type: 'chat' },
      },
      { upsert: true, returnDocument: 'after' }
    )
  } else {
    doc = await NotificationModel.create({ ...input, preview })
  }

  const populated = (await NotificationModel.findById(doc!._id).populate(
    'actor',
    'name'
  )) as Populated
  const item = serializeNotification(populated)

  emitToUser(input.user, 'notify:new', { notification: item })
  await pushCount(input.user)
  return item
}

const REVIEW_TYPES = [
  'review_requested',
  'review_accepted',
  'review_declined',
  'review_completed',
  'review_resubmitted',
  'review_rated',
]

export async function list(userId: string, filter: 'all' | 'unread' | 'review', limit = 50) {
  const query: Record<string, unknown> = { user: userId }
  if (filter === 'unread') query.readAt = null
  if (filter === 'review') query.type = trusted({ $in: REVIEW_TYPES })

  const docs = (await NotificationModel.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('actor', 'name')) as Populated[]

  return { items: docs.map(serializeNotification), unread: await unreadCount(userId) }
}

export async function markRead(userId: string, ids: string[]) {
  const valid = ids.filter((id) => Types.ObjectId.isValid(id))
  await NotificationModel.updateMany(
    { user: userId, _id: trusted({ $in: valid }), readAt: null },
    { $set: { readAt: new Date() } }
  )
  await pushCount(userId)
  return unreadCount(userId)
}

export async function markAllRead(userId: string) {
  await NotificationModel.updateMany(
    { user: userId, readAt: null },
    { $set: { readAt: new Date() } }
  )
  await pushCount(userId)
  return 0
}

export async function displayName(userId: string) {
  const user = await UserModel.findById(userId).select('name').lean()
  return user?.name ?? 'Someone'
}
