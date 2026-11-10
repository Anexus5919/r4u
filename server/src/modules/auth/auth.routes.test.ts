import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { UserModel } from '../../models/index.js'
import { useTestDb } from '../../test/db.js'
import { REFRESH_COOKIE } from './auth.controller.js'

useTestDb()

const app = createApp()

const CREDENTIALS = {
  name: 'Aman Sharma',
  email: 'aman@example.com',
  password: 'CorrectHorse7Battery',
}

/** cookieGuard requires a custom header, which is what makes the request non-simple. */
const guard = { 'X-Requested-With': 'r4u' }

async function registerUser(overrides: Partial<typeof CREDENTIALS> = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...CREDENTIALS, ...overrides })
}

function cookieFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  const cookie = raw?.find((entry) => entry.startsWith(REFRESH_COOKIE))
  if (!cookie) throw new Error('no refresh cookie set')
  return cookie.split(';')[0] as string
}

describe('POST /api/auth/register', () => {
  it('creates an account and returns a session', async () => {
    const res = await registerUser()

    expect(res.status).toBe(201)
    expect(res.body.data.accessToken).toEqual(expect.any(String))
    expect(res.body.data.user).toMatchObject({ email: CREDENTIALS.email, role: 'user' })
    expect(cookieFrom(res)).toContain(REFRESH_COOKIE)
  })

  it('never returns the password hash', async () => {
    const res = await registerUser()

    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
    expect(res.body.data.user.passwordHash).toBeUndefined()
  })

  it('sets the refresh cookie httpOnly and scoped to the auth path', async () => {
    const res = await registerUser()
    const raw = (res.headers['set-cookie'] as unknown as string[])[0] as string

    expect(raw).toContain('HttpOnly')
    expect(raw).toContain('Path=/api/auth')
  })

  it('rejects a duplicate email', async () => {
    await registerUser()
    const res = await registerUser()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_IN_USE')
  })

  it('rejects a weak password with per-field detail', async () => {
    const res = await registerUser({ password: 'short' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'password')).toBe(true)
  })
})

describe('POST /api/auth/login', () => {
  it('returns a session for correct credentials', async () => {
    await registerUser()

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toEqual(expect.any(String))
  })

  // the two failures must be identical, or the endpoint enumerates accounts
  it('does not reveal whether an email is registered', async () => {
    await registerUser()

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: 'WrongPassword123x' })

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword123x' })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body.error.code).toBe(unknownEmail.body.error.code)
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message)
  })

  it('refuses a blocked account', async () => {
    await registerUser()
    await UserModel.updateOne({ email: CREDENTIALS.email }, { status: 'blocked' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })
})

describe('GET /api/auth/me', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_MISSING')
  })

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_INVALID')
  })

  it('resolves the session for a valid token', async () => {
    const registered = await registerUser()

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe(CREDENTIALS.email)
  })

  // FR 9.3: blocking is immediate via tokenVersion, not at token expiry
  it('rejects an existing token the moment the account is blocked', async () => {
    const registered = await registerUser()
    const token = registered.body.data.accessToken as string

    await UserModel.updateOne({ email: CREDENTIALS.email }, { status: 'blocked' })

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })
})

describe('POST /api/auth/refresh', () => {
  it('rotates the token', async () => {
    const registered = await registerUser()
    const first = cookieFrom(registered)

    const res = await request(app).post('/api/auth/refresh').set(guard).set('Cookie', first)

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toEqual(expect.any(String))
    expect(cookieFrom(res)).not.toBe(first)
  })

  // a replayed consumed token signals theft, so the whole family is logged out
  it('revokes the entire family when a consumed token is replayed', async () => {
    const registered = await registerUser()
    const stolen = cookieFrom(registered)

    const rotated = await request(app).post('/api/auth/refresh').set(guard).set('Cookie', stolen)
    const legitimate = cookieFrom(rotated)

    const replay = await request(app).post('/api/auth/refresh').set(guard).set('Cookie', stolen)
    expect(replay.status).toBe(401)

    // the token that was legitimately issued is dead too
    const after = await request(app).post('/api/auth/refresh').set(guard).set('Cookie', legitimate)
    expect(after.status).toBe(401)
  })

  it('rejects a request without the custom header', async () => {
    const registered = await registerUser()

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookieFrom(registered))

    // no custom header means no preflight, which is exactly what a cross-site attacker can send
    expect(res.status).toBe(403)
  })

  it('rejects a request from an origin that is not allowlisted', async () => {
    const registered = await registerUser()

    const res = await request(app)
      .post('/api/auth/refresh')
      .set(guard)
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookieFrom(registered))

    expect(res.status).toBe(403)
  })
})

describe('POST /api/auth/logout', () => {
  it('invalidates the refresh token', async () => {
    const registered = await registerUser()
    const cookie = cookieFrom(registered)

    const out = await request(app).post('/api/auth/logout').set(guard).set('Cookie', cookie)
    expect(out.status).toBe(204)

    const after = await request(app).post('/api/auth/refresh').set(guard).set('Cookie', cookie)
    expect(after.status).toBe(401)
  })
})

describe('password reset', () => {
  it('responds identically whether or not the account exists', async () => {
    await registerUser()

    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: CREDENTIALS.email })
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' })

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(known.body).toEqual(unknown.body)
  })

  it('rejects an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'x'.repeat(40), password: 'AnotherGood7Password' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_INVALID')
  })
})
