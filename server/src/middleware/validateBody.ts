import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../lib/AppError.js'

/*
  The Zod half of the validation split recorded in ADR-009.

  express-validator stays on auth routes, params and pagination, where it is ergonomic. It cannot
  express a discriminated union or a cross-field rule, which is exactly what the autosave payload
  and the resume document are, so those go through Zod.

  Merges into req.validated rather than replacing it, so a route can run param validation first
  and still read everything from one place.
*/
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      throw new AppError('VALIDATION_FAILED', 'Some fields need attention', details)
    }

    req.validated = { ...(req.validated ?? {}), ...(result.data as object) }
    next()
  }
}
