import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION_ORDER } from '@r4u/shared'
import { createApp } from '../../app.js'
import { useTestDb } from '../../test/db.js'

useTestDb()

const app = createApp()

async function signUp(email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Aman Sharma', email, password: 'CorrectHorse7Battery' })

  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function createResume(token: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/resumes')
    .set(auth(token))
    .send({ title: 'Backend Developer CV', ...body })

  return res.body.data.resume as { id: string; title: string }
}

describe('POST /api/resumes', () => {
  it('refuses an unauthenticated caller', async () => {
    const res = await request(app).post('/api/resumes').send({ title: 'CV' })
    expect(res.status).toBe(401)
  })

  it('requires a title', async () => {
    const { token } = await signUp('a@example.com')
    const res = await request(app).post('/api/resumes').set(auth(token)).send({})

    expect(res.status).toBe(422)
  })

  /*
    Section order is a function of career stage, not of taste. A fresher leading with Experience
    buries the Education that is actually their strongest asset, so the seed differs by type.
  */
  it('seeds the section order its career stage calls for', async () => {
    const { token } = await signUp('a@example.com')

    const fresher = await request(app)
      .post('/api/resumes')
      .set(auth(token))
      .send({ title: 'Fresher CV', resumeType: 'fresher' })

    const types = fresher.body.data.resume.sections.map((s: { type: string }) => s.type)

    expect(types).toEqual(DEFAULT_SECTION_ORDER.fresher)
    expect(types[0]).toBe('education')
  })

  it('seeds a professional resume with summary first', async () => {
    const { token } = await signUp('a@example.com')
    const resume = await createResume(token, { resumeType: 'professional' })

    const res = await request(app).get(`/api/resumes/${resume.id}`).set(auth(token))
    expect(res.body.data.resume.sections[0].type).toBe('summary')
  })
})

describe('GET /api/resumes', () => {
  it('lists only the caller resumes', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')

    await createResume(alice.token, { title: 'Alice CV' })
    await createResume(bob.token, { title: 'Bob CV' })

    const res = await request(app).get('/api/resumes').set(auth(alice.token))

    expect(res.status).toBe(200)
    expect(res.body.data.resumes).toHaveLength(1)
    expect(res.body.data.resumes[0].title).toBe('Alice CV')
  })

  /*
    A list response physically cannot carry a resume body, because the summary serialiser has no
    field for one and the schema hook strips content before it ever reaches the serialiser.
  */
  it('never includes resume content in a summary', async () => {
    const { token } = await signUp('a@example.com')
    await createResume(token)

    const res = await request(app).get('/api/resumes').set(auth(token))
    const summary = res.body.data.resumes[0]

    expect(summary).not.toHaveProperty('sections')
    expect(summary).not.toHaveProperty('personal')
    expect(summary).not.toHaveProperty('notes')
    expect(summary.meta).toBeDefined()
  })

  it('filters by title, case insensitively', async () => {
    const { token } = await signUp('a@example.com')
    await createResume(token, { title: 'Backend Developer CV' })
    await createResume(token, { title: 'Internship Resume' })

    const res = await request(app).get('/api/resumes?q=internship').set(auth(token))

    expect(res.body.data.resumes).toHaveLength(1)
    expect(res.body.data.resumes[0].title).toBe('Internship Resume')
  })

  it('treats a regex metacharacter in the query as a literal', async () => {
    const { token } = await signUp('a@example.com')
    await createResume(token, { title: 'Backend Developer CV' })

    // an unescaped ".*" would match everything and quietly break the search
    const res = await request(app).get('/api/resumes?q=.*').set(auth(token))

    expect(res.body.data.resumes).toHaveLength(0)
  })

  it('sorts by title when asked', async () => {
    const { token } = await signUp('a@example.com')
    await createResume(token, { title: 'Zebra CV' })
    await createResume(token, { title: 'Alpha CV' })

    const res = await request(app).get('/api/resumes?sort=title').set(auth(token))

    expect(res.body.data.resumes.map((r: { title: string }) => r.title)).toEqual([
      'Alpha CV',
      'Zebra CV',
    ])
  })

  it('paginates and reports the totals', async () => {
    const { token } = await signUp('a@example.com')
    for (let i = 0; i < 3; i++) await createResume(token, { title: `CV ${i}` })

    const res = await request(app).get('/api/resumes?limit=2&page=2').set(auth(token))

    expect(res.body.data.resumes).toHaveLength(1)
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 })
  })

  it('rejects an uncapped limit', async () => {
    const { token } = await signUp('a@example.com')
    const res = await request(app).get('/api/resumes?limit=100000').set(auth(token))

    expect(res.status).toBe(422)
  })
})

/*
  FR 3.7. Every cross-user access returns 404 rather than 403, because a 403 confirms the id
  exists and turns the endpoint into an enumeration oracle over a PII collection.
*/
describe('ownership isolation', () => {
  it('gives 404 on another user resume, for every verb', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')
    const resume = await createResume(alice.token)

    const calls = [
      request(app).get(`/api/resumes/${resume.id}`).set(auth(bob.token)),
      request(app).patch(`/api/resumes/${resume.id}`).set(auth(bob.token)).send({ title: 'Mine' }),
      request(app).delete(`/api/resumes/${resume.id}`).set(auth(bob.token)),
      request(app).post(`/api/resumes/${resume.id}/duplicate`).set(auth(bob.token)).send({}),
    ]

    for (const call of await Promise.all(calls)) {
      expect(call.status).toBe(404)
      expect(call.body.error.code).toBe('NOT_FOUND')
    }
  })

  it('gives the same 404 for an id that does not exist at all', async () => {
    const { token } = await signUp('a@example.com')

    const missing = await request(app).get('/api/resumes/60a0000000000000000000aa').set(auth(token))

    // indistinguishable from "not yours", which is the point
    expect(missing.status).toBe(404)
  })

  it('rejects a malformed id before it reaches the database', async () => {
    const { token } = await signUp('a@example.com')
    const res = await request(app).get('/api/resumes/not-an-id').set(auth(token))

    expect(res.status).toBe(422)
  })
})

describe('POST /api/resumes/:id/duplicate', () => {
  it('copies the content and resets what belongs to the original', async () => {
    const { token } = await signUp('a@example.com')
    const original = await createResume(token, { resumeType: 'technical' })

    const res = await request(app)
      .post(`/api/resumes/${original.id}/duplicate`)
      .set(auth(token))
      .send({ title: 'Backend Developer CV, tailored' })

    expect(res.status).toBe(201)
    expect(res.body.data.resume.id).not.toBe(original.id)
    expect(res.body.data.resume.title).toBe('Backend Developer CV, tailored')
    expect(res.body.data.resume.status).toBe('draft')
    expect(res.body.data.resume.version).toBe(0)
    expect(res.body.data.resume.sections).toHaveLength(DEFAULT_SECTION_ORDER.technical.length)
  })

  it('defaults the copy title when none is given', async () => {
    const { token } = await signUp('a@example.com')
    const original = await createResume(token)

    const res = await request(app)
      .post(`/api/resumes/${original.id}/duplicate`)
      .set(auth(token))
      .send({})

    expect(res.body.data.resume.title).toBe('Backend Developer CV copy')
  })
})

describe('DELETE /api/resumes/:id', () => {
  it('removes the resume', async () => {
    const { token } = await signUp('a@example.com')
    const resume = await createResume(token)

    expect((await request(app).delete(`/api/resumes/${resume.id}`).set(auth(token))).status).toBe(
      204
    )
    expect((await request(app).get(`/api/resumes/${resume.id}`).set(auth(token))).status).toBe(404)
  })
})
