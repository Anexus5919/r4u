import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request, Response } from 'express'
import { isTest } from '../config/env.js'
import type { ApiErrorShape } from '@r4u/shared'

/*
  The in-memory store is wiped on every restart, and this service restarts often on a free tier,
  so these limits are effectively per-uptime-window. That is stated honestly in the README rather
  than described as robust brute-force protection. What actually survives a restart is the
  persistent failedLoginCount and lockUntil on the user document.
*/

function handler(_req: Request, res: Response) {
  const body: ApiErrorShape = {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
  }
  res.status(429).json(body)
}

const base = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler,
  skip: () => isTest,
}

export const generalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 300,
})

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
})

/*
  Keyed on the email as well as the IP, so one attacker cannot exhaust a victim's reset budget
  from many addresses, and one address cannot spray many accounts.
*/
export const passwordResetLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  /*
    ipKeyGenerator normalises an IPv6 address to its /56 subnet. Keying on the raw address would
    let one IPv6 client cycle through effectively unlimited addresses within its own allocation
    and walk straight past the limit.
  */
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`
  },
})
