import { matchedData, validationResult } from 'express-validator'
import type { ValidationChain } from 'express-validator'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/AppError.js'

/*
  On Express 5, req.query is a getter with no setter, so express-validator's sanitizers cannot
  write back to it (issue #1325). matchedData(req) is the only correct read, and the bugs from
  reading req.query directly are quiet: `query('page').toInt()` runs, req.query.page stays a
  string, and pagination arithmetic yields NaN rather than an error.

  An ESLint rule bans req.body, req.query and req.params outside this directory.
*/
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
