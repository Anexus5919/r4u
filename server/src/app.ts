import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import { pinoHttp } from 'pino-http'
import { env, isProduction, isTest } from './config/env.js'
import { logger } from './config/logger.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { generalLimiter } from './middleware/rateLimit.js'
import { apiRouter } from './routes.js'

const PREVIEW_ORIGIN = /^https:\/\/r4u-[a-z0-9-]+\.vercel\.app$/

export function isAllowedOrigin(origin: string): boolean {
  if (env.CORS_ORIGINS.includes(origin)) return true
  // preview builds get a new hostname per commit, so the pattern is gated behind a flag
  return env.ALLOW_PREVIEW_ORIGINS && PREVIEW_ORIGIN.test(origin)
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')

  // the exact hop count, never true: true trusts a client-forged X-Forwarded-For
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // same-origin default blocks the Vercel frontend and looks like a CORS error
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    })
  )

  app.use(
    cors({
      origin(origin, callback) {
        // same-origin requests and server-to-server calls send no Origin header
        if (!origin) return callback(null, true)
        return callback(null, isAllowedOrigin(origin))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    })
  )

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
      })
    )
  }

  app.use(compression())
  app.use(cookieParser())
  app.use(express.json({ limit: '256kb' }))
  app.use(express.urlencoded({ extended: true, limit: '32kb' }))

  app.use('/api', generalLimiter, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  if (isProduction) logger.info('running in production mode')

  return app
}
