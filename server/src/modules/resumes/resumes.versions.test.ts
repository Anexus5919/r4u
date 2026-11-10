import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { ResumeOp } from '@r4u/shared'
import { createApp } from '../../app.js'
import { useTestDb } from '../../test/db.js'

useTestDb()

const app = createApp()

async function signUp(email = 'aman@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Aman Sharma', email, password: 'CorrectHorse7Battery' })

  return res.body.data.accessToken as string
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function newResume(token: string) {
  const res = await request(app)
    .post('/api/resumes')
    .set(auth(token))
    .send({ title: 'Backend Developer CV', resumeType: 'technical' })

  return res.body.data.resume as { id: string; version: number }
}

function patch(token: string, id: string, version: number, ops: ResumeOp[]) {
  return request(app).patch(`/api/resumes/${id}`).set(auth(token)).send({ version, ops })
}

const SOURCE = {
  basics: {
    name: 'Neha Verma',
    label: 'Platform engineer',
    email: 'neha@example.com',
    summary: 'Platform engineer with four years on developer tooling.',
    location: { city: 'Leeds', countryCode: 'GB' },
  },
  work: [
    {
      name: 'Corvid Messaging',
      position: 'Platform Engineer',
      startDate: '2021-04',
      endDate: '2024-08',
      highlights: ['Cut build times by 55%.'],
    },
  ],
  volunteer: [{ organization: 'Code Club' }],
}

describe('POST /api/resumes/import', () => {
  it('creates a new resume from a JSON Resume document', async () => {
    const token = await signUp()

    const res = await request(app)
      .post('/api/resumes/import')
      .set(auth(token))
      .send({ document: SOURCE })

    expect(res.status).toBe(201)
    expect(res.body.data.resume.personal.fullName).toBe('Neha Verma')

    const experience = res.body.data.resume.sections.find(
      (s: { type: string }) => s.type === 'experience'
    )
    expect(experience.entries[0].data.organisation).toBe('Corvid Messaging')
  })

  // skipped sections are named: a silent partial import hides lost content
  it('reports the sections it could not place', async () => {
    const token = await signUp()

    const res = await request(app)
      .post('/api/resumes/import')
      .set(auth(token))
      .send({ document: SOURCE })

    expect(res.body.data.skipped).toContain('volunteer')
  })

  /* Import never overwrites. The user always has a way back to what they had. */
  it('leaves existing resumes untouched', async () => {
    const token = await signUp()
    await newResume(token)

    await request(app).post('/api/resumes/import').set(auth(token)).send({ document: SOURCE })

    const list = await request(app).get('/api/resumes').set(auth(token))
    expect(list.body.data.resumes).toHaveLength(2)
  })

  // the dashboard reads meta from the summary, so an import must not list as an empty resume
  it('lists the imported resume with its real completeness and word count', async () => {
    const token = await signUp()
    await request(app).post('/api/resumes/import').set(auth(token)).send({ document: SOURCE })

    const list = await request(app).get('/api/resumes').set(auth(token))
    const [summary] = list.body.data.resumes

    expect(summary.meta.wordCount).toBeGreaterThan(0)
    expect(summary.meta.completeness).toBeGreaterThan(0)
  })

  it('rejects a body that is not a document', async () => {
    const token = await signUp()
    const res = await request(app)
      .post('/api/resumes/import')
      .set(auth(token))
      .send({ document: 'not an object' })

    expect(res.status).toBe(422)
  })

  it('takes a snapshot so the import itself can be undone', async () => {
    const token = await signUp()

    const created = await request(app)
      .post('/api/resumes/import')
      .set(auth(token))
      .send({ document: SOURCE })

    const versions = await request(app)
      .get(`/api/resumes/${created.body.data.resume.id}/versions`)
      .set(auth(token))

    expect(versions.body.data.versions[0].trigger).toBe('import')
  })
})

describe('GET /api/resumes/:id/export.json', () => {
  it('returns a JSON Resume document as a download', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex Mercer' },
    ])

    const res = await request(app).get(`/api/resumes/${resume.id}/export.json`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('backend-developer-cv.json')
    // the interchange document itself, not wrapped in the API envelope
    expect(res.body.basics.name).toBe('Alex Mercer')
    expect(res.body.data).toBeUndefined()
  })

  it('gives 404 on another user resume', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')
    const resume = await newResume(alice)

    const res = await request(app).get(`/api/resumes/${resume.id}/export.json`).set(auth(bob))

    expect(res.status).toBe(404)
  })
})

describe('version history', () => {
  it('starts empty and records a manual snapshot', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    expect(
      (await request(app).get(`/api/resumes/${resume.id}/versions`).set(auth(token))).body.data
        .versions
    ).toHaveLength(0)

    const created = await request(app)
      .post(`/api/resumes/${resume.id}/versions`)
      .set(auth(token))
      .send({ label: 'Before tailoring for Halden' })

    expect(created.status).toBe(201)

    const list = await request(app).get(`/api/resumes/${resume.id}/versions`).set(auth(token))
    expect(list.body.data.versions[0]).toMatchObject({
      label: 'Before tailoring for Halden',
      trigger: 'manual',
    })
  })

  it('never returns the snapshot body in a listing', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    await request(app).post(`/api/resumes/${resume.id}/versions`).set(auth(token)).send({})

    const list = await request(app).get(`/api/resumes/${resume.id}/versions`).set(auth(token))
    expect(list.body.data.versions[0].data).toBeUndefined()
  })

  it('restores the earlier content', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const first = await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex Mercer' },
    ])

    const snap = await request(app)
      .post(`/api/resumes/${resume.id}/versions`)
      .set(auth(token))
      .send({ label: 'Good state' })

    await patch(token, resume.id, first.body.data.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Typed by mistake' },
    ])

    const restored = await request(app)
      .post(`/api/resumes/${resume.id}/versions/${snap.body.data.version.id}/restore`)
      .set(auth(token))
      .send({})

    expect(restored.status).toBe(200)
    expect(restored.body.data.resume.personal.fullName).toBe('Alex Mercer')
  })

  // a restore must not discard what it replaced
  it('snapshots the current state before restoring, so the restore is undoable', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const snap = await request(app)
      .post(`/api/resumes/${resume.id}/versions`)
      .set(auth(token))
      .send({})

    await request(app)
      .post(`/api/resumes/${resume.id}/versions/${snap.body.data.version.id}/restore`)
      .set(auth(token))
      .send({})

    const list = await request(app).get(`/api/resumes/${resume.id}/versions`).set(auth(token))
    expect(list.body.data.versions.some((v: { trigger: string }) => v.trigger === 'restore')).toBe(
      true
    )
  })

  it('gives 404 for a version belonging to another resume', async () => {
    const token = await signUp()
    const mine = await newResume(token)
    const other = await newResume(token)

    const snap = await request(app)
      .post(`/api/resumes/${other.id}/versions`)
      .set(auth(token))
      .send({})

    const res = await request(app)
      .post(`/api/resumes/${mine.id}/versions/${snap.body.data.version.id}/restore`)
      .set(auth(token))
      .send({})

    expect(res.status).toBe(404)
  })

  it('refuses another user history entirely', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')
    const resume = await newResume(alice)

    expect(
      (await request(app).get(`/api/resumes/${resume.id}/versions`).set(auth(bob))).status
    ).toBe(404)
  })
})
