import { trusted } from 'mongoose'
import { DEFAULT_SECTION_ORDER, SECTION_REGISTRY, computeMeta } from '@r4u/shared'
import type { Resume as ResumeShape, ResumeType } from '@r4u/shared'
import { notFound } from '../../lib/AppError.js'
import { ResumeModel } from '../../models/index.js'
import { readResumeContent } from './resumes.access.js'
import type { Principal } from './resumes.access.js'
import { resolveForNewResume } from '../templates/templates.service.js'

export interface ListOptions {
  q?: string
  status?: 'draft' | 'in_review' | 'reviewed'
  sort?: 'updated' | 'created' | 'title'
  page: number
  limit: number
}

const SORTS = {
  updated: { updatedAt: -1 },
  created: { createdAt: -1 },
  title: { title: 1 },
} as const

// no Atlas Search on M0: a regex over the owner's own documents, indexed first
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function list(ownerId: string, options: ListOptions) {
  const filter: Record<string, unknown> = { owner: ownerId }

  // trusted() or sanitizeFilter wraps $regex in $eq and matches nothing
  if (options.q) {
    filter.title = trusted({ $regex: escapeRegex(options.q), $options: 'i' })
  }
  if (options.status) filter.status = options.status

  const sort = SORTS[options.sort ?? 'updated']
  const skip = (options.page - 1) * options.limit

  // content is stripped by the schema hook, so a list can never carry resume bodies
  const [items, total] = await Promise.all([
    ResumeModel.find(filter).sort(sort).skip(skip).limit(options.limit),
    ResumeModel.countDocuments(filter),
  ])

  return {
    items,
    meta: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    },
  }
}

// seeded with the section order its career stage calls for
function seedSections(resumeType: ResumeType) {
  return DEFAULT_SECTION_ORDER[resumeType].map((type) => ({
    type,
    title: SECTION_REGISTRY[type].label,
    hidden: false,
    locked: false,
    keepTogether: false,
    startOnNewPage: false,
    entries: [],
  }))
}

export interface CreateInput {
  title: string
  resumeType: ResumeType
  templateKey?: string
}

export async function create(ownerId: string, input: CreateInput) {
  // a gallery entry may be a preset, so it resolves to a renderer key plus design defaults
  const { templateKey, design } = await resolveForNewResume(input.templateKey)

  return ResumeModel.create({
    owner: ownerId,
    title: input.title,
    resumeType: input.resumeType,
    templateKey,
    design,
    sections: seedSections(input.resumeType),
    meta: { completeness: 0, wordCount: 0, sectionCount: 0 },
  })
}

export function read(resumeId: string, principal: Principal) {
  return readResumeContent(resumeId, principal)
}

/** Metadata only. Section and entry edits go through the autosave op vocabulary in phase 5. */
export async function rename(resumeId: string, ownerId: string, title: string) {
  const resume = await ResumeModel.findOneAndUpdate(
    { _id: resumeId, owner: ownerId },
    { $set: { title }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  )

  if (!resume) throw notFound('Resume')
  return resume
}

// a copy keeps content but resets status, version, shares and reviews
export async function duplicate(resumeId: string, principal: Principal, title?: string) {
  const source = await readResumeContent(resumeId, principal)

  // destructured rather than deleted, because the mongoose document type marks these required
  const { _id, createdAt, updatedAt, ...copy } = source.toObject()
  void _id
  void createdAt
  void updatedAt

  return ResumeModel.create({
    ...copy,
    owner: principal.id,
    title: title ?? `${source.title} copy`,
    status: 'draft',
    version: 0,
  })
}

export async function remove(resumeId: string, ownerId: string) {
  const deleted = await ResumeModel.findOneAndDelete({ _id: resumeId, owner: ownerId })
  if (!deleted) throw notFound('Resume')
}

// denormalised on write so admin views never need a content projection
export async function refreshMeta(resumeId: string, principal: Principal) {
  const resume = await readResumeContent(resumeId, principal)
  const meta = computeMeta(resume.toObject() as unknown as ResumeShape)

  await ResumeModel.updateOne({ _id: resumeId }, { $set: { meta: { ...resume.meta, ...meta } } })
  return meta
}
