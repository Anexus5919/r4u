import type { Request, Response } from 'express'
import { body } from 'express-validator'
import type { Types } from 'mongoose'
import type { ReviewerCard } from '@r4u/shared'
import { ReviewModel } from '../../models/Review.js'
import { principalOf } from '../../lib/principal.js'
import { notFound } from '../../lib/AppError.js'
import { UserModel } from '../../models/User.js'
import { isOnline } from '../../sockets/emitters.js'

interface RecordRow {
  _id: Types.ObjectId
  completed: number
  active: number
  ratings: number
  ratingSum: number
  replyMs: number | null
}

/** One pass over the reviews of every listed reviewer: what they have actually done here. */
async function trackRecords(ids: Types.ObjectId[]) {
  const rows = await ReviewModel.aggregate<RecordRow>([
    { $match: { reviewer: { $in: ids } } },
    {
      $group: {
        _id: '$reviewer',
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        ratings: { $sum: { $cond: [{ $isNumber: '$rating' }, 1, 0] } },
        ratingSum: { $sum: { $cond: [{ $isNumber: '$rating' }, '$rating', 0] } },
        // $avg skips nulls, so an unanswered request does not drag the figure towards zero
        replyMs: {
          $avg: {
            $cond: [
              { $eq: [{ $type: '$respondedAt' }, 'date'] },
              { $subtract: ['$respondedAt', '$requestedAt'] },
              null,
            ],
          },
        },
      },
    },
  ])
  return new Map(rows.map((row) => [String(row._id), row]))
}

// the directory never carries an email or phone: a request goes through R4U, not around it
export async function listReviewers(req: Request, res: Response) {
  const me = principalOf(req).id
  const docs = (
    await UserModel.find({ role: 'reviewer', status: 'active' })
      .select('name headline reviewerProfile createdAt')
      .sort({ name: 1 })
      .limit(100)
  ).filter((doc) => doc.id !== me && doc.reviewerProfile?.acceptingRequests !== false)

  const records = await trackRecords(docs.map((doc) => doc._id))

  const reviewers: ReviewerCard[] = docs.map((doc) => {
    const row = records.get(doc.id)
    const openSlots = doc.reviewerProfile?.openSlots ?? 0
    const active = row?.active ?? 0
    return {
      id: doc.id,
      name: doc.name,
      headline: doc.headline ?? '',
      bio: doc.reviewerProfile?.bio ?? '',
      expertise: doc.reviewerProfile?.expertise ?? [],
      openSlots,
      slotsFree: Math.max(0, openSlots - active),
      online: isOnline(doc.id),
      record: {
        completed: row?.completed ?? 0,
        active,
        rating: row?.ratings ? Math.round((row.ratingSum / row.ratings) * 10) / 10 : null,
        ratings: row?.ratings ?? 0,
        replyHours: row?.replyMs == null ? null : Math.round((row.replyMs / 3_600_000) * 10) / 10,
        memberSince: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
      },
    }
  })

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
