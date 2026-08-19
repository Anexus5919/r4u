import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/AppError.js'
import { isProduction } from '../config/env.js'
import { logger } from '../config/logger.js'
import type { ApiErrorShape, ErrorCode } from '@r4u/shared'

export function notFoundHandler(req: Request, res: Response) {
  const body: ApiErrorShape = {
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` },
  }
  res.status(404).json(body)
}

interface MongoLikeError {
  name?: string
  /** number for a mongo driver error, string for a multer limit */
  code?: number | string
  type?: string
  keyPattern?: Record<string, unknown>
  errors?: Record<string, { path?: string; message?: string }>
}

function classify(error: unknown): AppError {
  if (error instanceof AppError) return error

  const e = error as MongoLikeError

  // duplicate key. email is the only unique field a user can collide on today
  if (e.code === 11000) {
    const field = Object.keys(e.keyPattern ?? {})[0]
    if (field === 'email') return new AppError('EMAIL_IN_USE', 'That email is already registered')
    return new AppError('VALIDATION_FAILED', 'That value is already in use')
  }

  if (e.name === 'ValidationError') {
    const details = Object.values(e.errors ?? {}).map((detail) => ({
      path: detail.path ?? '',
      message: detail.message ?? 'Invalid value',
    }))
    return new AppError('VALIDATION_FAILED', 'Some fields need attention', details)
  }

  // a malformed ObjectId is a bad id, not a server fault, and must not confirm existence
  if (e.name === 'CastError') return new AppError('NOT_FOUND', 'Resource not found')

  if (e.name === 'TokenExpiredError') return new AppError('TOKEN_EXPIRED', 'Session expired')
  if (e.name === 'JsonWebTokenError') return new AppError('TOKEN_INVALID', 'Invalid token')

  // multer signals its own limits with a string code rather than a typed error
  if (e.code === 'LIMIT_FILE_SIZE') {
    return new AppError('PAYLOAD_TOO_LARGE', 'That image is larger than 2 MB')
  }
  if (typeof e.code === 'string' && e.code.startsWith('LIMIT_')) {
    return new AppError('VALIDATION_FAILED', 'That upload was rejected')
  }

  if (e.type === 'entity.too.large') {
    return new AppError('PAYLOAD_TOO_LARGE', 'That request is too large')
  }
  if (e.type === 'entity.parse.failed') {
    return new AppError('VALIDATION_FAILED', 'Request body is not valid JSON')
  }

  return new AppError('INTERNAL', 'Something went wrong')
}

/*
  Express 5 forwards async rejections here automatically, so there is no catchAsync wrapper
  anywhere in this codebase.
*/
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // unused, but express identifies an error handler by its arity of four
  _next: NextFunction
) {
  const appError = classify(error)

  if (appError.code === 'INTERNAL') {
    logger.error({ err: error, path: req.path, method: req.method }, 'unhandled error')
  } else {
    logger.debug({ code: appError.code, path: req.path }, 'handled error')
  }

  const body: ApiErrorShape = {
    error: {
      code: appError.code as ErrorCode,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  }

  // stack traces never reach a client, in any environment
  if (!isProduction && appError.code === 'INTERNAL') {
    logger.error((error as Error)?.stack ?? String(error))
  }

  res.status(appError.status).json(body)
}
