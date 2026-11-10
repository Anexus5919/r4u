import pino from 'pino'
import { env, isProduction, isTest } from './env.js'

// JSON for searchable logs; redaction keeps passwords and tokens out of them
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
