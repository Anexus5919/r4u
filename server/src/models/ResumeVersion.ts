import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

export const VERSION_TRIGGERS = ['manual', 'template', 'import', 'restore', 'daily'] as const
export type VersionTrigger = (typeof VERSION_TRIGGERS)[number]

/*
  A full snapshot at milestones only, never per autosave.

  Snapshotting every save would explode storage on a 0.5 GB cluster and, worse, make the version
  list useless: fifty entries called "12:04, 12:04, 12:04" answer no question anyone has. Five
  named triggers produce a list a person can actually read.
*/
const resumeVersionSchema = new Schema(
  {
    resume: { type: Types.ObjectId, ref: 'Resume', required: true, index: true },
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    /** the whole document body at that moment, so a restore needs nothing else */
    data: { type: Schema.Types.Mixed, required: true },

    label: { type: String, maxlength: 120, default: '' },
    trigger: { type: String, enum: VERSION_TRIGGERS, required: true },

    /** the resume version counter at the time, for ordering when timestamps collide */
    at: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

resumeVersionSchema.index({ resume: 1, createdAt: -1 })

export type ResumeVersion = InferSchemaType<typeof resumeVersionSchema>
export type ResumeVersionDoc = HydratedDocument<ResumeVersion>
export const ResumeVersionModel = model('ResumeVersion', resumeVersionSchema)
