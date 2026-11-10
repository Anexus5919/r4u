import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../lib/AppError.js'

// Zod for unions and cross-field rules (ADR-009); merges into req.validated
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
