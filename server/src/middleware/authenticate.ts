import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/AppError.js'
import { verifyAccessToken } from '../lib/tokens.js'
import { UserModel } from '../models/User.js'

const GUEST = { id: null, role: 'guest' as const }

function bearer(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

// every request gets a principal, guest by default, so nothing handles null
export async function attachPrincipal(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req)
  if (!token) {
    req.principal = GUEST
    return next()
  }

  const claims = verifyAccessToken(token)

  // a lookup per request makes blocks and resets immediate (FR 9.3), via tokenVersion
  const user = await UserModel.findById(claims.sub).select('role status tokenVersion')

  if (!user) throw new AppError('TOKEN_INVALID', 'Invalid token')
  if (user.tokenVersion !== claims.tv) throw new AppError('TOKEN_EXPIRED', 'Session expired')
  if (user.status === 'blocked') throw new AppError('ACCOUNT_BLOCKED', 'This account is blocked')

  req.principal = { id: user.id, role: user.role }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.principal.role === 'guest' || !req.principal.id) {
    throw new AppError('TOKEN_MISSING', 'Sign in to continue')
  }
  next()
}
