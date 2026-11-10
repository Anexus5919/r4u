import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType, Query } from 'mongoose'

/** Widened in phase 4 by SECTION_REGISTRY. Kept loose here so the strip hook can land first. */
const entrySchema = new Schema(
  {
    hidden: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
)

const sectionSchema = new Schema(
  {
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 60 },
    hidden: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    keepTogether: { type: Boolean, default: false },
    startOnNewPage: { type: Boolean, default: false },
    entries: { type: [entrySchema], default: [] },
  },
  { _id: true }
)

const resumeSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },

    resumeType: {
      type: String,
      enum: ['fresher', 'professional', 'technical', 'academic'],
      default: 'professional',
    },
    status: { type: String, enum: ['draft', 'in_review', 'reviewed'], default: 'draft' },
    templateKey: { type: String, default: 'foundry' },

    design: {
      accent: { type: String, default: '' },
      typeScale: { type: Number, default: 10.5 },
      leading: { type: Number, default: 1.35 },
      sectionSpacing: { type: String, default: 'normal' },
      margins: { type: Number, default: 20 },
    },

    // ---- protected content. stripped by default, see the hook below
    personal: { type: Schema.Types.Mixed, default: {} },
    sections: { type: [sectionSchema], default: [] },
    notes: { type: String, maxlength: 4000, default: '' },

    // denormalised on write so admin views never need a content projection
    meta: {
      completeness: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 },
      sectionCount: { type: Number, default: 0 },
      pageCount: { type: Number, default: 1 },
      atsScore: { type: Number, default: 0 },
    },

    version: { type: Number, default: 0 },
  },
  { timestamps: true }
)

resumeSchema.index({ owner: 1, updatedAt: -1 })

export const PROTECTED_CONTENT_PATHS = ['sections', 'personal', 'notes'] as const

// privacy boundary, fail closed: only readResumeContent() opts in. see ADR-008
resumeSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  if (this.getOptions().contentScope !== 'full') {
    this.select(PROTECTED_CONTENT_PATHS.map((path) => `-${path}`).join(' '))
  }
})

export type Resume = InferSchemaType<typeof resumeSchema>
export type ResumeDoc = HydratedDocument<Resume>
export const ResumeModel = model('Resume', resumeSchema)
