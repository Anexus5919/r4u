import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request, Response } from 'express'
import { isTest } from '../config/env.js'
import type { ApiErrorShape } from '@r4u/shared'

// in-memory limits reset on restart; failedLoginCount and lockUntil persist

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

// keyed on email and IP, so neither many IPs nor many emails beat it
export const passwordResetLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  // ipKeyGenerator groups IPv6 by /56, or one client cycles addresses past it
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`
  },
})

// a public resume link is cheap to hammer and costs a database read each time
export const publicShareLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 60,
})

export const reportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
})
