import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'
import { REPORT_STATUSES } from '@r4u/shared'

// meta is written only through an allowlist in lib/activity.ts, never a raw request body
const activityLogSchema = new Schema({
  actor: { type: Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, maxlength: 60 },
  targetType: { type: String, required: true, maxlength: 30 },
  targetId: { type: Types.ObjectId, default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  at: { type: Date, default: () => new Date() },
})

activityLogSchema.index({ at: -1 })
activityLogSchema.index({ actor: 1, at: -1 })
activityLogSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60, name: 'at_ttl' })

export type ActivityLog = InferSchemaType<typeof activityLogSchema>
export const ActivityLogModel = model('ActivityLog', activityLogSchema)

// targetType has no private-resume value: only a publicly shared resume is reportable (ADR-008)
const reportSchema = new Schema(
  {
    reporter: { type: Types.ObjectId, ref: 'User', default: null },
    shareLink: { type: Types.ObjectId, ref: 'ShareLink', default: null },
    targetType: { type: String, enum: ['share_link', 'user', 'comment'], required: true },
    reason: { type: String, required: true, maxlength: 60 },
    snippet: { type: String, maxlength: 500, default: '' },
    status: { type: String, enum: REPORT_STATUSES, default: 'open' },
    handledBy: { type: Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

reportSchema.index({ status: 1, createdAt: -1 })

export type Report = InferSchemaType<typeof reportSchema>
export type ReportDoc = HydratedDocument<Report>
export const ReportModel = model('Report', reportSchema)
