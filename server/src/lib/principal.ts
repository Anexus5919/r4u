import type { Request } from 'express'
import { AppError } from './AppError.js'
import type { Principal } from '../modules/resumes/resumes.access.js'

/** The signed-in caller. Throws for a guest, so a handler behind requireAuth never sees null. */
export function principalOf(req: Request): Principal {
  const id = req.principal.id
  if (!id) throw new AppError('TOKEN_MISSING', 'Sign in to continue')
  return { id, role: req.principal.role }
}

export function clientIp(req: Request): string {
  return req.ip ?? ''
}
