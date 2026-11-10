import dns from 'node:dns'
import mongoose from 'mongoose'
import { env, isProduction } from './env.js'
import { logger } from './logger.js'

// sanitizeFilter, not express-mongo-sanitize, which breaks on Express 5
mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

// M0 op budget: index.ts runs ensureIndexes() once per boot instead of autoIndex
if (isProduction) mongoose.set('autoIndex', false)

const PUBLIC_RESOLVERS = ['8.8.8.8', '1.1.1.1']

// some Windows routers refuse Node's SRV queries though the OS resolves them; fall back only then
async function ensureSrvResolvable(uri: string) {
  if (!uri.startsWith('mongodb+srv://')) return
  const host = new URL(uri).hostname
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== 'ECONNREFUSED' && code !== 'ETIMEOUT' && code !== 'ESERVFAIL') throw error
    dns.setServers(PUBLIC_RESOLVERS)
    logger.warn({ code }, 'system dns refused the srv lookup, using public resolvers')
  }
}

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('error', (error) => logger.error({ error }, 'mongoose connection error'))
  mongoose.connection.on('disconnected', () => logger.warn('mongoose disconnected'))

  await ensureSrvResolvable(uri)
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
