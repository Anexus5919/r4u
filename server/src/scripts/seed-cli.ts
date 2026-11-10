import { connectDb, disconnectDb } from '../config/db.js'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } from './seed.js'
import { env } from '../config/env.js'
import { flushActivity } from '../lib/activity.js'
import { ensureIndexes } from './indexes.js'

// npm run seed --workspace=server, against whatever MONGODB_URI points at
await connectDb()
await ensureIndexes()

try {
  // a real database never gets the documented admin; only the throwaway in-memory one does
  const result = await seedDemo({ includeAdmin: false })
  const password = env.SEED_PASSWORD ? '(the value of SEED_PASSWORD)' : DEMO_PASSWORD

  if (!result.seeded) {
    console.warn(`Already seeded. Templates added: ${result.templates}.`)
  } else {
    console.warn('Seeded demo data. Sign in with any of these, password', password)
    for (const account of Object.values(DEMO_ACCOUNTS)) {
      if (account.role === 'admin') continue
      console.warn(`  ${account.role.padEnd(9)} ${account.email}`)
    }
    if (result.shareUrl) console.warn(`  share link: ${result.shareUrl}`)
    console.warn('No admin was created. Register your own account, then:')
    console.warn('  npm run admin --workspace=server -- promote you@example.com')
  }
} finally {
  // the activity buffer flushes on a timer, so drain it before the connection closes
  await flushActivity()
  await disconnectDb()
}
