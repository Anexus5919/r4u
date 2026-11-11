import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '@r4u/shared'
import { createApp } from '../../app.js'
import { AtsScoreModel, ResumeModel } from '../../models/index.js'
import { useTestDb } from '../../test/db.js'

useTestDb()

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function owner(email = 'aman@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Aman Sharma', email, password: 'CorrectHorse7Battery' })
  return res.body.data.accessToken as string
}

async function sampleResume(token: string) {
  const created = await request(app)
    .post('/api/resumes')
    .set(auth(token))
    .send({ title: 'Backend CV' })
  const id = created.body.data.resume.id as string
  await ResumeModel.updateOne(
    { _id: id },
    { $set: { personal: SAMPLE_RESUME.personal, sections: SAMPLE_RESUME.sections } }
  )
  return id
}

const POSTING = `Backend Engineer
Requirements:
- TypeScript, PostgreSQL, Kafka and Kubernetes
- Unmistakable-marker-phrase for the privacy check`

describe('POST /api/resumes/:id/ats', () => {
  it('scores in format-only mode and returns the parser view', async () => {
    const token = await owner()
    const id = await sampleResume(token)

    const res = await request(app).post(`/api/resumes/${id}/ats`).set(auth(token)).send({})

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ rubricVersion: '1.0.0', mode: 'format_only' })
    expect(res.body.data.total).toBeGreaterThan(80)
    expect(res.body.data.parserPreview.startsWith('Alex Mercer')).toBe(true)
    expect((await ResumeModel.findById(id).select('meta'))?.meta?.atsScore).toBe(
      res.body.data.total
    )
  })

  it('matches a pasted posting and stores only ids and points, never the text', async () => {
    const token = await owner()
    const id = await sampleResume(token)

    const res = await request(app)
      .post(`/api/resumes/${id}/ats`)
      .set(auth(token))
      .send({ jobDescription: POSTING })

    expect(res.body.data.mode).toBe('full')
    expect(res.body.data.keywords.missing).toContain('Kubernetes')

    const stored = await AtsScoreModel.findOne({ resume: id }).lean()
    const dump = JSON.stringify(stored)
    expect(dump).not.toMatch(/Unmistakable-marker-phrase/)
    expect(dump).not.toMatch(/Alex Mercer|settlement latency/)
    expect(stored?.checks[0]).toEqual(
      expect.objectContaining({ checkId: 'A1', status: 'pass', earned: 8, possible: 8 })
    )
    expect(Object.keys(stored?.checks[0] ?? {}).sort()).toEqual([
      'checkId',
      'earned',
      'possible',
      'status',
    ])
  })

  it('answers someone else with 404 and a guest with 401', async () => {
    const id = await sampleResume(await owner())
    const stranger = await owner('someone@example.com')
    expect(
      (await request(app).post(`/api/resumes/${id}/ats`).set(auth(stranger)).send({})).status
    ).toBe(404)
    expect((await request(app).post(`/api/resumes/${id}/ats`).send({})).status).toBe(401)
  })

  it('keeps a short history of totals', async () => {
    const token = await owner()
    const id = await sampleResume(token)
    await request(app).post(`/api/resumes/${id}/ats`).set(auth(token)).send({})
    await request(app)
      .post(`/api/resumes/${id}/ats`)
      .set(auth(token))
      .send({ jobDescription: POSTING })

    const res = await request(app).get(`/api/resumes/${id}/ats`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data.history).toHaveLength(2)
    expect(res.body.data.history[0].mode).toBe('full')
  })
})
