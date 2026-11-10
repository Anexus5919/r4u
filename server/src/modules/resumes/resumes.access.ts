import { AppError, notFound } from '../../lib/AppError.js'
import { ResumeModel } from '../../models/Resume.js'
import { ReviewModel } from '../../models/Review.js'
import type { Role } from '@r4u/shared'

export interface Principal {
  id: string
  role: Role
}

// the ONLY function allowed to pass contentScope: 'full'
export async function readResumeContent(resumeId: string, principal: Principal) {
  // before the ownership check, so admin cannot tell 'not yours' from 'missing'
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

/** metadata only: the schema hook strips content and nothing here opts in */
export async function listResumesForOwner(ownerId: string) {
  return ResumeModel.find({ owner: ownerId }).sort({ updatedAt: -1 })
}

// the second opt-in: the caller has already resolved an enabled, unexpired share link to this id
export async function readResumeForShare(resumeId: string) {
  const resume = await ResumeModel.findById(resumeId).setOptions({ contentScope: 'full' })
  if (!resume) throw notFound('Resume')
  return resume
}

// the third opt-in: only the assigned reviewer of an accepted or completed review, never an admin
export async function readResumeForReview(reviewId: string, principal: Principal) {
  if (principal.role === 'admin') {
    throw new AppError('ADMIN_CONTENT_FORBIDDEN', 'Resume content is not visible to administrators')
  }

  const review = await ReviewModel.findById(reviewId).select('resume owner reviewer status')
  const isParty =
    review && (String(review.owner) === principal.id || String(review.reviewer) === principal.id)

  // a pending or declined request grants nothing yet, and a stranger learns nothing either way
  if (!review || !isParty || review.status === 'requested' || review.status === 'declined') {
    throw notFound('Review')
  }

  const resume = await ResumeModel.findById(review.resume).setOptions({ contentScope: 'full' })
  if (!resume) throw notFound('Resume')
  return resume
}
