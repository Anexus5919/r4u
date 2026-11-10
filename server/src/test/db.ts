import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll } from 'vitest'

let memory: MongoMemoryServer | undefined

/** per suite: in-memory MongoDB, collections cleared between tests */
export function useTestDb() {
  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
    await mongoose.connect(memory.getUri())
  }, 120_000)

  afterEach(async () => {
    const { collections } = mongoose.connection
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
  })

  afterAll(async () => {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    await memory?.stop()
  })
}
