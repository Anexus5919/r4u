import type { Request, Response } from 'express'
import { body } from 'express-validator'
import type { ReviewerCard } from '@r4u/shared'
import { principalOf } from '../../lib/principal.js'
import { notFound } from '../../lib/AppError.js'
import { UserModel } from '../../models/User.js'
import { isOnline } from '../../sockets/emitters.js'

// the directory never carries an email or phone: a request goes through R4U, not around it
export async function listReviewers(req: Request, res: Response) {
  const me = principalOf(req).id
  const docs = await UserModel.find({ role: 'reviewer', status: 'active' })
    .select('name headline reviewerProfile')
    .sort({ name: 1 })
    .limit(100)

  const reviewers: ReviewerCard[] = docs
    .filter((doc) => doc.id !== me && doc.reviewerProfile?.acceptingRequests !== false)
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      headline: doc.headline ?? '',
      bio: doc.reviewerProfile?.bio ?? '',
      expertise: doc.reviewerProfile?.expertise ?? [],
      openSlots: doc.reviewerProfile?.openSlots ?? 0,
      online: isOnline(doc.id),
    }))

  res.json({ data: { reviewers } })
}

export const reviewerProfileRules = [
  body('bio').optional().isString().trim().isLength({ max: 400 }),
  body('expertise').optional().isArray({ max: 8 }),
  body('expertise.*').isString().trim().isLength({ min: 1, max: 30 }),
  body('acceptingRequests').optional().isBoolean().toBoolean(),
  body('openSlots').optional().isInt({ min: 0, max: 20 }).toInt(),
]

export async function getReviewerProfile(req: Request, res: Response) {
  const user = await UserModel.findById(principalOf(req).id).select('reviewerProfile')
  if (!user) throw notFound('User')
  res.json({
    data: {
      profile: {
        bio: user.reviewerProfile?.bio ?? '',
        expertise: user.reviewerProfile?.expertise ?? [],
        acceptingRequests: user.reviewerProfile?.acceptingRequests ?? true,
        openSlots: user.reviewerProfile?.openSlots ?? 3,
      },
    },
  })
}

export async function updateReviewerProfile(req: Request, res: Response) {
  const patch = req.validated as {
    bio?: string
    expertise?: string[]
    acceptingRequests?: boolean
    openSlots?: number
  }
  const user = await UserModel.findById(principalOf(req).id)
  if (!user) throw notFound('User')

  const current = user.reviewerProfile ?? {
    bio: '',
    expertise: [],
    acceptingRequests: true,
    openSlots: 3,
  }
  user.reviewerProfile = {
    bio: patch.bio ?? current.bio,
    expertise: patch.expertise ?? current.expertise,
    acceptingRequests: patch.acceptingRequests ?? current.acceptingRequests,
    openSlots: patch.openSlots ?? current.openSlots,
  }
  await user.save()
  res.json({ data: { profile: user.reviewerProfile } })
}
