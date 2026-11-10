import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'
import { REVIEW_STATUSES } from '@r4u/shared'

// an explicit request the reviewer accepts or declines, never auto-assignment (ADR-012)
const reviewSchema = new Schema(
  {
    resume: { type: Types.ObjectId, ref: 'Resume', required: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true },
    reviewer: { type: Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: REVIEW_STATUSES, default: 'requested' },
    message: { type: String, maxlength: 500, default: '' },
    summary: { type: String, maxlength: 1000, default: '' },
    // read receipts per participant, O(participants) rather than O(messages x participants)
    participants: [
      {
        _id: false,
        user: { type: Types.ObjectId, ref: 'User', required: true },
        lastReadMessageId: { type: Types.ObjectId, default: null },
        lastReadAt: { type: Date, default: null },
      },
    ],
    requestedAt: { type: Date, default: () => new Date() },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

reviewSchema.index({ owner: 1, status: 1 })
reviewSchema.index({ reviewer: 1, status: 1 })
reviewSchema.index({ resume: 1 })

export type Review = InferSchemaType<typeof reviewSchema>
export type ReviewDoc = HydratedDocument<Review>
export const ReviewModel = model('Review', reviewSchema)

// own collection: a different actor writes it, so embedding would contend on the resume
const commentSchema = new Schema(
  {
    review: { type: Types.ObjectId, ref: 'Review', required: true },
    resume: { type: Types.ObjectId, ref: 'Resume', required: true },
    author: { type: Types.ObjectId, ref: 'User', required: true },
    sectionKey: { type: String, required: true, maxlength: 20 },
    entryId: { type: String, default: null },
    fieldPath: { type: String, default: null },
    anchorText: { type: String, maxlength: 200, default: '' },
    body: { type: String, required: true, minlength: 1, maxlength: 1000 },
    clientId: { type: String, required: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

commentSchema.index({ resume: 1, createdAt: -1 })
commentSchema.index({ review: 1, resolved: 1 })
commentSchema.index({ review: 1, clientId: 1 }, { unique: true })

export type Comment = InferSchemaType<typeof commentSchema>
export type CommentDoc = HydratedDocument<Comment>
export const CommentModel = model('Comment', commentSchema)

// the unique index on review plus clientId is what makes a retried send idempotent
const messageSchema = new Schema(
  {
    review: { type: Types.ObjectId, ref: 'Review', required: true },
    sender: { type: Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 2000 },
    clientId: { type: String, required: true },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

messageSchema.index({ review: 1, _id: -1 })
messageSchema.index({ review: 1, clientId: 1 }, { unique: true })

export type Message = InferSchemaType<typeof messageSchema>
export type MessageDoc = HydratedDocument<Message>
export const MessageModel = model('Message', messageSchema)
