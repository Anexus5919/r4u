import { connectDb } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { syncTemplates } from './modules/templates/templates.service.js'
import { ensureIndexes } from './scripts/indexes.js'
import { handleSignals, startServer } from './server.js'

async function start() {
  await connectDb()

  // unique and TTL indexes are load bearing: a missing unique email index allows duplicate accounts
  await ensureIndexes()

  // idempotent: inserts any built-in template missing from the registry, never overwrites edits
  const added = await syncTemplates()
  if (added > 0) logger.info({ added }, 'template registry synced')

  const running = await startServer(env.PORT)
  logger.info(`r4u server listening on ${env.PORT}`)
  handleSignals(running)
}

start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start')
  process.exit(1)
})
