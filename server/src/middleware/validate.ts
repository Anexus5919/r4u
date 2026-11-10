import { matchedData, validationResult } from 'express-validator'
import type { ValidationChain } from 'express-validator'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/AppError.js'

// Express 5 req.query is a getter, so matchedData(req) is the only correct read
export function validate(chains: ValidationChain[]) {
  return [
    ...chains,
    (req: Request, _res: Response, next: NextFunction) => {
      const result = validationResult(req)

      if (!result.isEmpty()) {
        const details = result.array().map((issue) => ({
          path: issue.type === 'field' ? issue.path : '',
          message: issue.msg as string,
        }))
        throw new AppError('VALIDATION_FAILED', 'Some fields need attention', details)
      }

      // only fields with a validation chain survive, which removes mass assignment as a class
      req.validated = matchedData(req)
      next()
    },
  ]
}
