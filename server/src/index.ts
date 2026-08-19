import { createServer } from 'node:http'
import { createApp } from './app.js'
import { connectDb, disconnectDb } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

const server = createServer(createApp())

async function start() {
  await connectDb()
  server.listen(env.PORT, () => logger.info(`r4u server listening on ${env.PORT}`))
}

/*
  Render sends SIGTERM on every rolling deploy. Draining rather than dying keeps an in-flight
  write from being severed. Phase 8 adds io.close() between the two steps below.
*/
function shutdown(signal: string) {
  logger.info(`${signal} received, draining`)

  server.close(() => {
    void disconnectDb().finally(() => process.exit(0))
  })

  setTimeout(() => {
    logger.error('drain timed out, exiting')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start')
  process.exit(1)
})
