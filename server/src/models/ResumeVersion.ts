import { Schema, Types, model } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

export const VERSION_TRIGGERS = ['manual', 'template', 'import', 'restore', 'daily'] as const
export type VersionTrigger = (typeof VERSION_TRIGGERS)[number]

// snapshots at five named milestones only, never per autosave
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
