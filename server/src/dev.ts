/*
  Development entry point that boots an in-memory MongoDB instead of Atlas.

  Free-tier Atlas auto-pauses after 30 days idle and every developer needs their own connection
  string, so requiring one just to run the app locally is friction with no upside. This keeps the
  loop offline. Data is discarded on exit, which is what you want while iterating on schemas.

  Never imported by src/index.ts, so mongodb-memory-server stays out of the production image.
*/
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createServer } from 'node:http'
import mongoose from 'mongoose'

const memory = await MongoMemoryServer.create()
process.env.MONGODB_URI = memory.getUri('r4u')

// imported after the URI is set, because config/env.ts validates at import time
const { createApp } = await import('./app.js')
const { connectDb, disconnectDb } = await import('./config/db.js')
const { env } = await import('./config/env.js')
const { logger } = await import('./config/logger.js')

await connectDb()

// safe here, and it means indexes exist without running the migration script first
await mongoose.syncIndexes()

const server = createServer(createApp())

server.listen(env.PORT, () => {
  logger.info(`r4u dev server on ${env.PORT}, in-memory database, data is not persisted`)
})

async function shutdown() {
  server.close()
  await disconnectDb()
  await memory.stop()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
