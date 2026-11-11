import { createHash, randomBytes } from 'node:crypto'
import { trusted } from 'mongoose'
import { AppError } from '../../lib/AppError.js'
import { hashPassword, verifyPassword, wasteTimeLikeAVerify } from '../../lib/password.js'
import {
  createRefreshToken,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
} from '../../lib/tokens.js'
import { PasswordResetTokenModel, RefreshTokenModel, UserModel } from '../../models/index.js'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { resetPasswordMail, sendMail } from '../../lib/mailer.js'
import type { UserDoc } from '../../models/User.js'

const MAX_FAILED_LOGINS = 10
const LOCK_MINUTES = 15
const RESET_TTL_MINUTES = 15

export interface SessionContext {
  userAgent: string
  ip: string
}

interface Session {
  user: UserDoc
  accessToken: string
  refreshToken: string
}

function issueAccess(user: UserDoc): string {
  return signAccessToken({ sub: user.id, role: user.role, tv: user.tokenVersion })
}

async function issueSession(user: UserDoc, ctx: SessionContext, family?: string): Promise<Session> {
  const refresh = createRefreshToken(family)

  await RefreshTokenModel.create({
    user: user._id,
    tokenHash: refresh.tokenHash,
    family: refresh.family,
    userAgent: ctx.userAgent.slice(0, 300),
    ip: ctx.ip.slice(0, 64),
    expiresAt: refreshExpiryDate(),
  })

  return { user, accessToken: issueAccess(user), refreshToken: refresh.token }
}

export async function register(
  input: { name: string; email: string; password: string },
  ctx: SessionContext
): Promise<Session> {
  const passwordHash = await hashPassword(input.password)

  // the unique index on email is the real guard; a findOne first would be a race
  const user = (await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
  })) as UserDoc

  return issueSession(user, ctx)
}

export async function login(
  input: { email: string; password: string },
  ctx: SessionContext
): Promise<Session> {
  const user = (await UserModel.findOne({ email: input.email }).select(
    '+passwordHash'
  )) as UserDoc | null

  // an unknown email still costs a bcrypt compare and the same message
  if (!user) {
    await wasteTimeLikeAVerify()
    throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect')
  }

  if (user.status === 'blocked') throw new AppError('ACCOUNT_BLOCKED', 'This account is blocked')

  // persistent lockout survives the restarts that wipe in-memory rate limits
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw new AppError('RATE_LIMITED', 'Too many attempts. Try again in a few minutes.')
  }

  const ok = await verifyPassword(input.password, user.passwordHash)

  if (!ok) {
    user.failedLoginCount += 1
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      user.failedLoginCount = 0
    }
    await user.save()
    throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect')
  }

  if (user.failedLoginCount !== 0 || user.lockUntil) {
    user.failedLoginCount = 0
    user.lockUntil = undefined
    await user.save()
  }

  return issueSession(user, ctx)
}

export async function refresh(token: string, ctx: SessionContext): Promise<Session> {
  const tokenHash = hashToken(token)
  const stored = await RefreshTokenModel.findOne({ tokenHash })

  if (!stored) throw new AppError('TOKEN_INVALID', 'Session expired')

  // a consumed token replayed signals theft, so the whole family dies
  if (stored.consumedAt) {
    await RefreshTokenModel.deleteMany({ family: stored.family })
    logger.warn({ family: stored.family }, 'refresh token replay, family revoked')
    throw new AppError('TOKEN_INVALID', 'Session expired')
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw new AppError('TOKEN_EXPIRED', 'Session expired')
  }

  const user = (await UserModel.findById(stored.user)) as UserDoc | null
  if (!user) throw new AppError('TOKEN_INVALID', 'Session expired')
  if (user.status === 'blocked') throw new AppError('ACCOUNT_BLOCKED', 'This account is blocked')

  stored.consumedAt = new Date()
  await stored.save()

  // rotate within the same family, so a replay of any generation revokes the whole chain
  return issueSession(user, ctx, stored.family)
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return
  await RefreshTokenModel.deleteOne({ tokenHash: hashToken(token) })
}

// always resolves, so the endpoint cannot reveal which addresses exist
export async function forgotPassword(email: string): Promise<void> {
  const user = await UserModel.findOne({ email })
  if (!user) return

  // trusted() or sanitizeFilter rewrites $exists into a CastError
  await PasswordResetTokenModel.deleteMany({
    user: user._id,
    usedAt: trusted({ $exists: false }),
  })

  const token = randomBytes(32).toString('base64url')

  await PasswordResetTokenModel.create({
    user: user._id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  })

  const url = `${env.APP_URL}/reset?token=${encodeURIComponent(token)}`
  // never awaited: a slow mail server would hold the request, and the delay would reveal the account
  void sendMail(resetPasswordMail(user.email, user.name, url, RESET_TTL_MINUTES))
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const stored = await PasswordResetTokenModel.findOne({ tokenHash })

  if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
    throw new AppError('TOKEN_INVALID', 'That reset link is no longer valid')
  }

  const user = (await UserModel.findById(stored.user)) as UserDoc | null
  if (!user) throw new AppError('TOKEN_INVALID', 'That reset link is no longer valid')

  user.passwordHash = await hashPassword(password)
  // a reset ends every session: bump the version and delete refresh tokens
  user.tokenVersion += 1
  user.failedLoginCount = 0
  user.lockUntil = undefined
  await user.save()

  stored.usedAt = new Date()
  await stored.save()

  await RefreshTokenModel.deleteMany({ user: user._id })
}
