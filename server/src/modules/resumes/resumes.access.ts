import { AppError, notFound } from '../../lib/AppError.js'
import { ResumeModel } from '../../models/Resume.js'
import type { Role } from '@r4u/shared'

export interface Principal {
  id: string
  role: Role
}

/*
  The ONLY function in the codebase permitted to pass contentScope: 'full'.

  If a second one ever appears, the fail-closed hook on the Resume schema stops being a boundary
  and becomes a suggestion. Route every content read through here.
*/
export async function readResumeContent(resumeId: string, principal: Principal) {
  /*
    Unconditional, and deliberately before the ownership check. An administrator must not be
    able to distinguish "not yours" from "does not exist" either.
  */
  if (principal.role === 'admin') {
    throw new AppError('ADMIN_CONTENT_FORBIDDEN', 'Resume content is not visible to administrators')
  }

  const resume = await ResumeModel.findOne({ _id: resumeId, owner: principal.id }).setOptions({
    contentScope: 'full',
  })

  // 404 rather than 403: a 403 would confirm the id exists, which enumerates a PII collection
  if (!resume) throw notFound('Resume')

  return resume
}

/**
 * Metadata only. Safe for dashboards, admin statistics and any list view, because the schema
 * hook strips content unless someone opts in, and nothing here does.
 */
export async function listResumesForOwner(ownerId: string) {
  return ResumeModel.find({ owner: ownerId }).sort({ updatedAt: -1 })
}

/*
  Phase 8 adds readResumeForReview(), which resolves the assigned reviewer through the Review
  document before opting in. It must apply the same admin refusal.
*/
