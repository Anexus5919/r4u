import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { useTestDb } from '../test/db.js'
import { MessageModel, ReviewModel, ShareLinkModel, TemplateModel } from '../models/index.js'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } from './seed.js'

useTestDb()

const app = createApp()

function login(email: string) {
  return request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD })
}

describe('seedDemo', () => {
  it('creates every demo role with a working password', async () => {
    const result = await seedDemo()
    expect(result.seeded).toBe(true)

    for (const key of ['admin', 'reviewer', 'user'] as const) {
      const account = DEMO_ACCOUNTS[key]
      const res = await login(account.email)
      expect(res.status).toBe(200)
      expect(res.body.data.user.role).toBe(account.role)
    }
  })

  it('keeps the blocked account blocked', async () => {
    await seedDemo()
    const res = await login(DEMO_ACCOUNTS.blocked.email)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })

  it('leaves a review with history, a live share link and the template registry', async () => {
    await seedDemo()
    expect(await ReviewModel.countDocuments({ status: 'active' })).toBe(1)
    expect(await MessageModel.countDocuments()).toBeGreaterThan(0)
    expect(await ShareLinkModel.countDocuments({ enabled: true })).toBe(1)
    expect(await TemplateModel.countDocuments({ builtIn: true })).toBe(8)
  })

  it('does nothing on a second run', async () => {
    await seedDemo()
    const again = await seedDemo()
    expect(again.seeded).toBe(false)
  })
})
