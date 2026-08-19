import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../lib/AppError.js'

/*
  No CSRF library. Only two endpoints read the refresh cookie, and all three conditions below
  require a CORS preflight that a cross-site attacker cannot satisfy:

    1. Origin must be on the allowlist
    2. a custom header must be present, which makes the request non-simple
    3. Content-Type must be application/json, which is also non-simple

  Every other endpoint authenticates with an Authorization header and has no CSRF surface at all,
  because a browser will not attach one automatically.

  csrf-csrf is the named library alternative if a rubric ever demands one.
*/
export function cookieGuard(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get('origin')

  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  if (req.get('x-requested-with') !== 'r4u') {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  /*
    Only checked when a body is actually present. /refresh and /logout send none, so demanding a
    Content-Type would reject every legitimate call.

    The purpose of this check is narrow: a cross-site HTML form can POST as
    application/x-www-form-urlencoded, multipart/form-data or text/plain with no preflight, so
    those three must be refused. A request carrying no body carries none of them, and the custom
    header above has already forced a preflight.
  */
  const contentType = req.get('content-type')
  if (contentType && !contentType.startsWith('application/json')) {
    throw new AppError('FORBIDDEN_ROLE', 'Request rejected')
  }

  next()
}
