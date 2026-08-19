import type { NextFunction, Request, Response } from 'express'
import { hasRole } from '@r4u/shared'
import type { Role } from '@r4u/shared'
import { AppError } from '../lib/AppError.js'

/*
  Set membership. Never a rank ladder.

  A numeric hierarchy where admin outranks everything is the natural way to write this, and it
  makes admin a superset of every other role by construction. That directly breaks the rule that
  an administrator cannot read private resume content, and the usual repair is a special-case
  `if` that the next route forgets to add. See ADR-008.

  authorize('user') therefore denies an admin, on purpose.
*/
export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasRole(req.principal.role, allowed)) {
      throw new AppError('FORBIDDEN_ROLE', 'You do not have access to this')
    }
    next()
  }
}
