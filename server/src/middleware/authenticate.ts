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

/*
  Runs on every request. Sets a guest principal when there is no usable token, so downstream
  policy code never has to handle a null user.
*/
export async function attachPrincipal(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req)
  if (!token) {
    req.principal = GUEST
    return next()
  }

  const claims = verifyAccessToken(token)

  /*
    One indexed lookup per authenticated request, deliberately. It is what makes blocking an
    account and resetting a password take effect immediately rather than at the next 15 minute
    expiry, which FR 9.3 requires. At this scale the cost is acceptable, and it is the reason
    tokenVersion exists at all.
  */
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
