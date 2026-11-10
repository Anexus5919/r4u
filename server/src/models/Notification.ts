import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'
import { NOTIFICATION_TYPES } from '@r4u/shared'

const notificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: Types.ObjectId, ref: 'User', default: null },
    entity: {
      kind: { type: String, enum: ['review', 'resume', 'comment'], required: true },
      id: { type: Types.ObjectId, required: true },
    },
    preview: { type: String, maxlength: 160, default: '' },
    // a burst of chat coalesces into one unread row with a count, never forty rows
    count: { type: Number, default: 1 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export type Notification = InferSchemaType<typeof notificationSchema>
export type NotificationDoc = HydratedDocument<Notification>
export const NotificationModel = model('Notification', notificationSchema)
