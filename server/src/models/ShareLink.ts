import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

// the token is stored only as a SHA-256, so a leaked backup exposes no private resume
const shareLinkSchema = new Schema(
  {
    resume: { type: Types.ObjectId, ref: 'Resume', required: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    hint: { type: String, required: true, maxlength: 8 },
    enabled: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    redact: {
      email: { type: Boolean, default: false },
      phone: { type: Boolean, default: false },
      address: { type: Boolean, default: false },
    },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    lastDownloadedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

shareLinkSchema.index({ resume: 1 })

export type ShareLink = InferSchemaType<typeof shareLinkSchema>
export type ShareLinkDoc = HydratedDocument<ShareLink>
export const ShareLinkModel = model('ShareLink', shareLinkSchema)

// one row per visitor fingerprint and hour; expires after 48 hours, the counters do not
const shareViewSchema = new Schema(
  {
    shareLink: { type: Types.ObjectId, ref: 'ShareLink', required: true },
    resume: { type: Types.ObjectId, ref: 'Resume', required: true },
    fingerprint: { type: String, required: true },
    kind: { type: String, enum: ['view', 'download'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

shareViewSchema.index({ shareLink: 1, fingerprint: 1, kind: 1, createdAt: -1 })
shareViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 48 * 60 * 60 })

export const ShareViewModel = model('ShareView', shareViewSchema)

// the daily rollup behind the owner's sparkline, one upsert per counted event
const shareDailySchema = new Schema({
  shareLink: { type: Types.ObjectId, ref: 'ShareLink', required: true },
  date: { type: String, required: true },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
})

shareDailySchema.index({ shareLink: 1, date: 1 }, { unique: true })

export const ShareDailyModel = model('ShareDaily', shareDailySchema)
