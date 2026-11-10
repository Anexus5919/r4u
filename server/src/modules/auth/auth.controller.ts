import type { CookieOptions, Request, Response } from 'express'
import { isProduction } from '../../config/env.js'
import { AppError } from '../../lib/AppError.js'
import { logActivity } from '../../lib/activity.js'
import { publicUser } from '../../lib/serializers.js'
import { UserModel } from '../../models/index.js'
import * as service from './auth.service.js'
import type { UserDoc } from '../../models/User.js'

export const REFRESH_COOKIE = 'r4u_rt'

// scoped to the two endpoints that read it; SameSite=None across sites. see ADR-014
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }
}

function context(req: Request) {
  return { userAgent: req.get('user-agent') ?? '', ip: req.ip ?? '' }
}

/** validate() has already run, so every field a chain covers is present and the right type. */
function input<T>(req: Request): T {
  return req.validated as T
}

function sendSession(
  res: Response,
  session: { user: UserDoc; accessToken: string; refreshToken: string },
  status = 200
) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions())
  res.status(status).json({
    data: { user: publicUser(session.user), accessToken: session.accessToken },
  })
}

// resolves the session on boot while AuthContext holds 'checking'
export async function me(req: Request, res: Response) {
  const user = (await UserModel.findById(req.principal.id)) as UserDoc | null
  if (!user) throw new AppError('TOKEN_INVALID', 'Session expired')
  res.json({ data: { user: publicUser(user) } })
}

export async function register(req: Request, res: Response) {
  const body = input<{ name: string; email: string; password: string }>(req)
  const session = await service.register(body, context(req))
  logActivity({
    actor: session.user.id,
    action: 'auth.register',
    targetType: 'user',
    targetId: session.user.id,
    ip: req.ip,
  })
  sendSession(res, session, 201)
}

export async function login(req: Request, res: Response) {
  const body = input<{ email: string; password: string }>(req)
  const session = await service.login(body, context(req))
  logActivity({
    actor: session.user.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: session.user.id,
    ip: req.ip,
  })
  sendSession(res, session)
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (!token) throw new AppError('TOKEN_MISSING', 'Sign in to continue')

  const session = await service.refresh(token, context(req))
  sendSession(res, session)
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined)
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined })
  res.status(204).end()
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = input<{ email: string }>(req)
  await service.forgotPassword(email)

  // identical response whether or not the account exists
  res.json({ data: { message: 'If an account exists, we have sent a link.' } })
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = input<{ token: string; password: string }>(req)
  await service.resetPassword(token, password)
  res.json({ data: { message: 'Password updated. Sign in with your new password.' } })
}
