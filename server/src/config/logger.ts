import pino from 'pino'
import { env, isProduction, isTest } from './env.js'

/*
  Structured JSON in production so Render's log viewer is searchable by request id.

  The redact list is not optional. A plain console.log of a request body would put passwords and
  bearer tokens into a third party's log store permanently.
*/
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
})
