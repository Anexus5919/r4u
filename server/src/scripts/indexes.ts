import mongoose from 'mongoose'
import { logger } from '../config/logger.js'
// imported for its side effect: every model must be registered before indexes are built
import '../models/index.js'

/** Creates every declared index that is missing. Idempotent: an existing index is a no-op. */
export async function ensureIndexes() {
  const models = Object.values(mongoose.models)
  await Promise.all(models.map((model) => model.createIndexes()))
  logger.info({ collections: models.length }, 'indexes ensured')
}
