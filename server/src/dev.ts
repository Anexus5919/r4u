// development entry: an in-memory MongoDB, so local work needs no Atlas connection string
// never imported by src/index.ts, so mongodb-memory-server stays out of the production image
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

const memory = await MongoMemoryServer.create()
process.env.MONGODB_URI = memory.getUri('r4u')

// imported after the URI is set, because config/env.ts validates at import time
const { connectDb } = await import('./config/db.js')
const { env } = await import('./config/env.js')
const { logger } = await import('./config/logger.js')
const { handleSignals, startServer } = await import('./server.js')
const { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } = await import('./scripts/seed.js')

await connectDb()

// safe here, and it means indexes exist without running the migration script first
await mongoose.syncIndexes()

// a fresh database every boot, so the demo accounts are seeded every boot
const seed = await seedDemo()
if (seed.seeded) {
  logger.info(
    {
      accounts: Object.values(DEMO_ACCOUNTS).map((a) => `${a.role} ${a.email}`),
      demoPassword: DEMO_PASSWORD,
      shareUrl: seed.shareUrl,
    },
    'demo data seeded'
  )
}

const running = await startServer(env.PORT)
logger.info(`r4u dev server on ${env.PORT}, in-memory database, data is not persisted`)

handleSignals(running, () => memory.stop().then(() => undefined))
