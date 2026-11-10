import type { NextFunction, Request, Response } from 'express'
import { hasRole } from '@r4u/shared'
import type { Role } from '@r4u/shared'
import { AppError } from '../lib/AppError.js'

// set membership, never a rank ladder, so authorize('user') denies admin. see ADR-008
export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasRole(req.principal.role, allowed)) {
      throw new AppError('FORBIDDEN_ROLE', 'You do not have access to this')
    }
    next()
  }
}
