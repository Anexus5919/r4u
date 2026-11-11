import { Schema, Types, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

// ids, statuses and points only: no resume text and no job description, ever (ADR-011)
const atsScoreSchema = new Schema(
  {
    resume: { type: Types.ObjectId, ref: 'Resume', required: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true },
    rubricVersion: { type: String, required: true, maxlength: 20 },
    total: { type: Number, required: true, min: 0, max: 100 },
    mode: { type: String, enum: ['full', 'format_only'], required: true },
    dimensions: [
      {
        _id: false,
        id: { type: String, required: true, maxlength: 2 },
        earned: { type: Number, required: true },
        possible: { type: Number, required: true },
      },
    ],
    checks: [
      {
        _id: false,
        checkId: { type: String, required: true, maxlength: 4 },
        status: { type: String, enum: ['pass', 'partial', 'fail', 'na'], required: true },
        earned: { type: Number, required: true },
        possible: { type: Number, required: true },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

atsScoreSchema.index({ resume: 1, createdAt: -1 })

export type AtsScore = InferSchemaType<typeof atsScoreSchema>
export const AtsScoreModel = model('AtsScore', atsScoreSchema)
