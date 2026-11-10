import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../lib/AppError.js'

// no CSRF library: allowlisted Origin, custom header and JSON type force a preflight
export function cookieGuard(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get('origin')

  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  if (req.get('x-requested-with') !== 'r4u') {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  // only with a body: refuse the three form types a cross-site form can send
  const contentType = req.get('content-type')
  if (contentType && !contentType.startsWith('application/json')) {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  next()
}
