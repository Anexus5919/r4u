import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { RefreshTokenModel, ResumeModel, UserModel } from '../../models/index.js'
import { useTestDb } from '../../test/db.js'

useTestDb()

const app = createApp()

const CREDENTIALS = {
  name: 'Aman Sharma',
  email: 'aman@example.com',
  password: 'CorrectHorse7Battery',
}

async function signUp() {
  const res = await request(app).post('/api/auth/register').send(CREDENTIALS)
  return {
    token: res.body.data.accessToken as string,
    id: res.body.data.user.id as string,
  }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('GET /api/users/me', () => {
  it('refuses an unauthenticated caller', async () => {
    const res = await request(app).get('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('returns the wider profile shape to the account holder', async () => {
    const { token } = await signUp()

    const res = await request(app).get('/api/users/me').set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ email: CREDENTIALS.email, phone: '', location: '' })
  })

  it('never leaks credentials or lockout state', async () => {
    const { token } = await signUp()

    const res = await request(app).get('/api/users/me').set(auth(token))
    const serialised = JSON.stringify(res.body)

    for (const field of ['passwordHash', 'tokenVersion', 'failedLoginCount', 'lockUntil']) {
      expect(serialised).not.toContain(field)
    }
  })
})

describe('PATCH /api/users/me', () => {
  it('updates the fields the profile screen owns', async () => {
    const { token } = await signUp()

    const res = await request(app).patch('/api/users/me').set(auth(token)).send({
      headline: 'Backend engineer, distributed systems',
      location: 'Mumbai',
      theme: 'dark',
    })

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({
      headline: 'Backend engineer, distributed systems',
      location: 'Mumbai',
      theme: 'dark',
    })
  })

  // mass assignment: role has no chain, so matchedData never returns it
  it('ignores a role escalation attempt in the body', async () => {
    const { token, id } = await signUp()

    const res = await request(app)
      .patch('/api/users/me')
      .set(auth(token))
      .send({ name: 'Aman', role: 'admin', status: 'blocked', tokenVersion: 99 })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('user')

    const stored = await UserModel.findById(id)
    expect(stored?.role).toBe('user')
    expect(stored?.status).toBe('active')
  })

  it('rejects a phone number containing letters', async () => {
    const { token } = await signUp()

    const res = await request(app)
      .patch('/api/users/me')
      .set(auth(token))
      .send({ phone: 'call me maybe' })

    expect(res.status).toBe(422)
  })
})

describe('PATCH /api/users/me/password', () => {
  it('refuses when the current password is wrong', async () => {
    const { token } = await signUp()

    const res = await request(app)
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: 'NotTheRightOne9', password: 'BrandNewSecret4Word' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('refuses reusing the current password', async () => {
    const { token } = await signUp()

    const res = await request(app)
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: CREDENTIALS.password, password: CREDENTIALS.password })

    expect(res.status).toBe(422)
  })

  // a password change ends every session, including the one that made it
  it('ends every session, including the one that made the change', async () => {
    const { token, id } = await signUp()

    const res = await request(app)
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: CREDENTIALS.password, password: 'BrandNewSecret4Word' })

    expect(res.status).toBe(204)

    const reuse = await request(app).get('/api/users/me').set(auth(token))
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe('TOKEN_EXPIRED')

    expect(await RefreshTokenModel.countDocuments({ user: id })).toBe(0)
  })

  it('accepts the new password at the next sign in', async () => {
    const { token } = await signUp()

    await request(app)
      .patch('/api/users/me/password')
      .set(auth(token))
      .send({ currentPassword: CREDENTIALS.password, password: 'BrandNewSecret4Word' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: 'BrandNewSecret4Word' })

    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/users/me', () => {
  it('removes the account, its resumes and its sessions', async () => {
    const { token, id } = await signUp()

    await ResumeModel.create({ owner: id, title: 'Backend Developer CV' })
    expect(await ResumeModel.countDocuments({ owner: id })).toBe(1)

    const res = await request(app).delete('/api/users/me').set(auth(token))
    expect(res.status).toBe(204)

    expect(await UserModel.countDocuments({ _id: id })).toBe(0)
    expect(await ResumeModel.countDocuments({ owner: id })).toBe(0)
    expect(await RefreshTokenModel.countDocuments({ user: id })).toBe(0)
  })
})
