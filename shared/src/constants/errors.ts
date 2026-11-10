// one table for both sides. the client switches on code, never on message

export const ERROR_STATUS = {
  VALIDATION_FAILED: 422,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  TOKEN_MISSING: 401,
  ACCOUNT_BLOCKED: 403,
  FORBIDDEN_ROLE: 403,
  ADMIN_CONTENT_FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  EMAIL_IN_USE: 409,
  SHARE_LINK_DISABLED: 410,
  SHARE_LINK_EXPIRED: 410,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export interface ApiErrorShape {
  error: {
    code: ErrorCode
    message: string
    details?: { path: string; message: string }[]
  }
}

export function statusForCode(code: ErrorCode): number {
  return ERROR_STATUS[code]
}
