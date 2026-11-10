import { connectDb, disconnectDb } from '../config/db.js'
import { ensureIndexes } from './indexes.js'

// npm run migrate --workspace=server, against whatever MONGODB_URI points at
await connectDb()
try {
  await ensureIndexes()
} finally {
  await disconnectDb()
}
