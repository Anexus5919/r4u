import mongoose from 'mongoose'
import { env, isProduction } from './env.js'
import { logger } from './logger.js'

// sanitizeFilter, not express-mongo-sanitize, which breaks on Express 5
mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

// M0 op budget: index.ts runs ensureIndexes() once per boot instead of autoIndex
if (isProduction) mongoose.set('autoIndex', false)

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('error', (error) => logger.error({ error }, 'mongoose connection error'))
  mongoose.connection.on('disconnected', () => logger.warn('mongoose disconnected'))

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  })

  logger.info('mongoose connected')
  return mongoose
}

export async function disconnectDb(): Promise<void> {
  await mongoose.connection.close()
}

/** 1 is connected. Surfaced by /api/health so "server up, database unreachable" is visible. */
export function dbReadyState(): number {
  return mongoose.connection.readyState
}
