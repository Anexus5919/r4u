import { statusForCode } from '@r4u/shared'
import type { ErrorCode } from '@r4u/shared'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: { path: string; message: string }[]
  /** true for errors we raised deliberately, false for anything that escaped */
  readonly expected = true

  constructor(code: ErrorCode, message: string, details?: { path: string; message: string }[]) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = statusForCode(code)
    this.details = details
    Error.captureStackTrace?.(this, AppError)
  }
}

// 404 rather than 403: a 403 confirms the id exists. see ADR-008
export function notFound(what = 'Resource'): AppError {
  return new AppError('NOT_FOUND', `${what} not found`)
}
