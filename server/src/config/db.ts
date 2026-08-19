import mongoose from 'mongoose'
import { env, isProduction } from './env.js'
import { logger } from './logger.js'

/*
  sanitizeFilter is the correct Express 5 defence against operator injection. Do NOT install
  express-mongo-sanitize: it is abandoned and silently breaks, because req.query became a getter.
*/
mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

/*
  Atlas M0 gives 0.5 GB including indexes and 100 operations per second, and this service spins
  down after 15 minutes idle so it boots often. Mongoose rebuilds every index on every boot with
  autoIndex on, which would spend that operation budget on nothing. Indexes are created once by
  scripts/create-indexes.ts instead.
*/
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
