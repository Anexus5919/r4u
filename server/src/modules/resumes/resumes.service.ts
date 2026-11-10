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

/*
  Atlas M0 has no Atlas Search, so title search is a case-insensitive regex against the owner's
  own documents. The owner filter runs first and is indexed, so the regex only ever scans one
  user's resumes, which at realistic volumes is a handful of rows.
*/
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function list(ownerId: string, options: ListOptions) {
  const filter: Record<string, unknown> = { owner: ownerId }

  /*
    trusted() is required on any filter carrying a server-authored $ operator. sanitizeFilter
    cannot tell ours from a client's, so without it this becomes { $eq: { $regex: ... } } and
    silently matches nothing. Same trap as the password reset query.
  */
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

/*
  A new resume is seeded with the section order its career stage calls for, rather than an empty
  document. Section order is a function of career stage, not of taste: a fresher leading with
  Experience buries the Education that is actually their strongest asset.
*/
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
    { new: true }
  )

  if (!resume) throw notFound('Resume')
  return resume
}

/*
  Duplication is how "tailor this for a different role" starts, so it copies the content and
  resets everything that is specific to the original: status, version, and later the share links
  and review history, which must never follow a copy.
*/
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

/*
  Denormalised on every write so admin dashboards and analytics never need a content projection.
  This is what makes the admin content ban survivable rather than crippling.
*/
export async function refreshMeta(resumeId: string, principal: Principal) {
  const resume = await readResumeContent(resumeId, principal)
  const meta = computeMeta(resume.toObject() as unknown as ResumeShape)

  await ResumeModel.updateOne({ _id: resumeId }, { $set: { meta: { ...resume.meta, ...meta } } })
  return meta
}
