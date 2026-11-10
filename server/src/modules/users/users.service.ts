import { AppError, notFound } from '../../lib/AppError.js'
import { deleteAvatar, uploadAvatar } from '../../lib/cloudinary.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { sniffImage } from '../../lib/upload.js'
import { trusted } from 'mongoose'
import {
  CommentModel,
  MessageModel,
  NotificationModel,
  PasswordResetTokenModel,
  RefreshTokenModel,
  ResumeModel,
  ResumeVersionModel,
  ReviewModel,
  ShareDailyModel,
  ShareLinkModel,
  ShareViewModel,
  UserModel,
} from '../../models/index.js'
import type { UserDoc } from '../../models/User.js'

export interface ProfilePatch {
  name?: string
  headline?: string
  phone?: string
  location?: string
  theme?: 'light' | 'dark' | 'system'
}

async function load(userId: string, withPassword = false): Promise<UserDoc> {
  const query = UserModel.findById(userId)
  if (withPassword) query.select('+passwordHash')

  const user = (await query) as UserDoc | null
  if (!user) throw notFound('Account')
  return user
}

export function getProfile(userId: string) {
  return load(userId)
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<UserDoc> {
  const user = await load(userId)

  // assigned field by field, never Object.assign over the request, so role and status stay unreachable
  if (patch.name !== undefined) user.name = patch.name
  if (patch.headline !== undefined) user.headline = patch.headline
  if (patch.phone !== undefined) user.phone = patch.phone
  if (patch.location !== undefined) user.location = patch.location
  if (patch.theme !== undefined) user.theme = patch.theme

  await user.save()
  return user
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string
): Promise<void> {
  const user = await load(userId, true)

  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Your current password is incorrect')

  if (await verifyPassword(nextPassword, user.passwordHash)) {
    throw new AppError('VALIDATION_FAILED', 'Choose a password you have not used here before', [
      { path: 'password', message: 'This is your current password' },
    ])
  }

  user.passwordHash = await hashPassword(nextPassword)
  /*
    Same reasoning as a reset: changing a password must end every other session. Bumping the
    version kills issued access tokens, deleting the refresh tokens stops new ones being minted.
  */
  user.tokenVersion += 1
  await user.save()

  await RefreshTokenModel.deleteMany({ user: user._id })
}

export async function setAvatar(userId: string, buffer: Buffer): Promise<UserDoc> {
  const kind = sniffImage(buffer)
  if (!kind) {
    throw new AppError('VALIDATION_FAILED', 'That file is not a JPEG, PNG or WebP image')
  }

  const user = await load(userId)
  const stored = await uploadAvatar(buffer, userId)

  user.avatar = { publicId: stored.publicId, version: stored.version }
  await user.save()

  return user
}

// FR 2.4: everything the account owns or wrote goes with it, collection by collection
export async function deleteAccount(userId: string): Promise<void> {
  const user = await load(userId)

  if (user.avatar?.publicId) await deleteAvatar(user.avatar.publicId)

  const resumeIds = (await ResumeModel.find({ owner: user._id }).select('_id').lean()).map(
    (r) => r._id
  )
  const [owned, assigned] = await Promise.all([
    ReviewModel.find({ owner: user._id }).select('_id').lean(),
    ReviewModel.find({ reviewer: user._id }).select('_id').lean(),
  ])
  const reviewIds = [...owned, ...assigned].map((r) => r._id)
  const linkIds = (await ShareLinkModel.find({ owner: user._id }).select('_id').lean()).map(
    (l) => l._id
  )

  await Promise.all([
    ResumeModel.deleteMany({ owner: user._id }),
    ResumeVersionModel.deleteMany({ owner: user._id }),
    ShareLinkModel.deleteMany({ owner: user._id }),
    ShareViewModel.deleteMany({ shareLink: trusted({ $in: linkIds }) }),
    ShareDailyModel.deleteMany({ shareLink: trusted({ $in: linkIds }) }),
    ReviewModel.deleteMany({ _id: trusted({ $in: reviewIds }) }),
    MessageModel.deleteMany({ review: trusted({ $in: reviewIds }) }),
    MessageModel.deleteMany({ sender: user._id }),
    CommentModel.deleteMany({ review: trusted({ $in: reviewIds }) }),
    CommentModel.deleteMany({ resume: trusted({ $in: resumeIds }) }),
    CommentModel.deleteMany({ author: user._id }),
    NotificationModel.deleteMany({ user: user._id }),
    RefreshTokenModel.deleteMany({ user: user._id }),
    PasswordResetTokenModel.deleteMany({ user: user._id }),
  ])

  await user.deleteOne()
}
