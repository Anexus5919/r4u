import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { io as connectClient } from 'socket.io-client'
import type { Socket as ClientSocket } from 'socket.io-client'
import type { Server } from 'socket.io'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { useTestDb } from '../test/db.js'
import { MessageModel, NotificationModel, ResumeModel, UserModel } from '../models/index.js'
import { closeSockets, initSockets } from './index.js'
import { resetLimits } from './guard.js'

useTestDb()

const app = createApp()
let io: Server
let url = ''
const open: ClientSocket[] = []

beforeAll(async () => {
  const httpServer = createServer(app)
  io = initSockets(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`
})

afterEach(() => {
  for (const socket of open.splice(0)) socket.disconnect()
  resetLimits()
})

afterAll(async () => {
  await closeSockets(io)
})

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function account(email: string, role: 'user' | 'reviewer' | 'admin' = 'user') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'CorrectHorse7Battery' })
  const id = res.body.data.user.id as string
  if (role !== 'user') await UserModel.updateOne({ _id: id }, { $set: { role } })
  return { id, token: res.body.data.accessToken as string }
}

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = connectClient(url, {
      auth: (cb) => cb({ token }),
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    open.push(socket)
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', (error) => reject(error))
  })
}

function once<T>(socket: ClientSocket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event}`)), ms)
    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (socket: ClientSocket, event: string, payload: object = {}): Promise<any> =>
  socket.timeout(5000).emitWithAck(event, payload)

/** An owner, a reviewer and an accepted review between them. */
async function activeReview() {
  const owner = await account('aman@example.com')
  const reviewer = await account('neha@example.com', 'reviewer')
  const resume = await request(app)
    .post('/api/resumes')
    .set(auth(owner.token))
    .send({ title: 'Backend CV', resumeType: 'technical' })
  const resumeId = resume.body.data.resume.id as string

  const created = await request(app)
    .post('/api/reviews')
    .set(auth(owner.token))
    .send({ resumeId, reviewerId: reviewer.id, message: 'Please look' })
  const reviewId = created.body.data.review.id as string

  await request(app)
    .patch(`/api/reviews/${reviewId}/respond`)
    .set(auth(reviewer.token))
    .send({ accept: true })
  return { owner, reviewer, reviewId, resumeId }
}

describe('socket handshake', () => {
  it('refuses a connection without a token, with a code the client can act on', async () => {
    await expect(connect(undefined)).rejects.toMatchObject({ data: { code: 'TOKEN_MISSING' } })
  })

  it('accepts a valid token and announces the session', async () => {
    const { token, id } = await account('aman@example.com')
    const socket = connectClient(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    })
    open.push(socket)
    const ready = await once<{ userId: string }>(socket, 'session:ready')
    expect(ready.userId).toBe(id)
  })

  it('refuses a blocked account', async () => {
    const { token, id } = await account('rahul@example.com')
    await UserModel.updateOne({ _id: id }, { $set: { status: 'blocked' } })
    await expect(connect(token)).rejects.toMatchObject({ data: { code: 'ACCOUNT_BLOCKED' } })
  })
})

describe('review rooms', () => {
  it('denies an administrator explicitly, even with a valid token', async () => {
    const { reviewId } = await activeReview()
    const admin = await account('admin@example.com', 'admin')
    const socket = await connect(admin.token)
    const reply = await call(socket, 'review:join', { reviewId })
    expect(reply).toMatchObject({ ok: false, code: 'ADMIN_CONTENT_FORBIDDEN' })
  })

  it('gives a stranger the same answer as a missing review', async () => {
    const { reviewId } = await activeReview()
    const stranger = await account('divya@example.com')
    const socket = await connect(stranger.token)
    const reply = await call(socket, 'review:join', { reviewId })
    expect(reply).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('rejects a malformed id before touching the database', async () => {
    const { token } = await account('aman@example.com')
    const socket = await connect(token)
    const reply = await call(socket, 'review:join', { reviewId: 'not-an-id' })
    expect(reply).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' })
  })

  it('delivers a message to the other party instantly and dedupes a retry', async () => {
    const { owner, reviewer, reviewId } = await activeReview()
    const a = await connect(owner.token)
    const b = await connect(reviewer.token)
    expect((await call(a, 'review:join', { reviewId })).ok).toBe(true)
    expect((await call(b, 'review:join', { reviewId })).ok).toBe(true)

    const clientId = randomUUID()
    const arrival = once<{ message: { body: string; clientId: string } }>(b, 'chat:message')
    const sent = await call(a, 'chat:send', { reviewId, clientId, body: 'Hello Neha' })
    expect(sent.ok).toBe(true)
    expect((await arrival).message.body).toBe('Hello Neha')

    const retry = await call(a, 'chat:send', { reviewId, clientId, body: 'Hello Neha' })
    expect(retry.message._id).toBe(sent.message._id)
    expect(await MessageModel.countDocuments({ clientId })).toBe(1)
  })

  it('notifies a participant who is not in the room, coalescing a burst into one row', async () => {
    const { owner, reviewer, reviewId } = await activeReview()
    const a = await connect(owner.token)
    await call(a, 'review:join', { reviewId })

    for (const body of ['one', 'two', 'three']) {
      await call(a, 'chat:send', { reviewId, clientId: randomUUID(), body })
    }

    const rows = await NotificationModel.find({ user: reviewer.id, type: 'chat' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.count).toBe(3)
  })

  it('restores history on rejoin', async () => {
    const { owner, reviewId } = await activeReview()
    const a = await connect(owner.token)
    await call(a, 'review:join', { reviewId })
    await call(a, 'chat:send', { reviewId, clientId: randomUUID(), body: 'remember me' })
    a.disconnect()

    const again = await connect(owner.token)
    const joined = await call(again, 'review:join', { reviewId })
    expect(joined.messages.map((m: { body: string }) => m.body)).toContain('remember me')
  })

  it('shares typing state and comments with the other party', async () => {
    const { owner, reviewer, reviewId } = await activeReview()
    const a = await connect(owner.token)
    const b = await connect(reviewer.token)
    await call(a, 'review:join', { reviewId })
    await call(b, 'review:join', { reviewId })

    const typing = once<{ typing: boolean }>(a, 'chat:typing_state')
    b.emit('chat:typing', { reviewId, typing: true })
    expect((await typing).typing).toBe(true)

    const created = once<{ comment: { body: string } }>(a, 'comment:created')
    const reply = await call(b, 'comment:create', {
      reviewId,
      sectionKey: 'experience',
      anchorText: 'Work Experience',
      body: 'Lead with the outcome.',
      clientId: randomUUID(),
    })
    expect(reply.ok).toBe(true)
    expect((await created).comment.body).toBe('Lead with the outcome.')
  })

  it('refuses a send from a socket that never joined the room', async () => {
    const { owner, reviewId } = await activeReview()
    const a = await connect(owner.token)
    const reply = await call(a, 'chat:send', { reviewId, clientId: randomUUID(), body: 'sneaky' })
    expect(reply).toMatchObject({ ok: false, code: 'FORBIDDEN_ROLE' })
  })
})

describe('review lifecycle over REST', () => {
  it('marks the resume reviewed when the reviewer completes, and only the reviewer can', async () => {
    const { owner, reviewer, reviewId, resumeId } = await activeReview()

    const byOwner = await request(app)
      .patch(`/api/reviews/${reviewId}/complete`)
      .set(auth(owner.token))
      .send({ summary: 'done' })
    expect(byOwner.status).toBe(403)

    const done = await request(app)
      .patch(`/api/reviews/${reviewId}/complete`)
      .set(auth(reviewer.token))
      .send({ summary: 'Strong resume.' })
    expect(done.status).toBe(200)
    expect((await ResumeModel.findById(resumeId))?.status).toBe('reviewed')
  })

  it('lets the reviewer read the resume but never the private notes', async () => {
    const { reviewer, reviewId, resumeId } = await activeReview()
    await ResumeModel.updateOne({ _id: resumeId }, { $set: { notes: 'secret salary note' } })
    const res = await request(app).get(`/api/reviews/${reviewId}/resume`).set(auth(reviewer.token))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('secret salary note')
  })

  it('gives an administrator 403 on every review route', async () => {
    const { reviewId } = await activeReview()
    const admin = await account('admin@example.com', 'admin')
    expect((await request(app).get(`/api/reviews/${reviewId}`).set(auth(admin.token))).status).toBe(
      403
    )
    expect((await request(app).get('/api/reviews').set(auth(admin.token))).status).toBe(403)
  })

  it('lists active reviewers without their email', async () => {
    const owner = await account('aman@example.com')
    await account('neha@example.com', 'reviewer')
    const res = await request(app).get('/api/users/reviewers').set(auth(owner.token))
    expect(res.body.data.reviewers).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toContain('neha@example.com')
  })
})
