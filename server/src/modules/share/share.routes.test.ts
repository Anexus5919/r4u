import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { useTestDb } from '../../test/db.js'
import { ReportModel } from '../../models/Moderation.js'
import { ResumeModel } from '../../models/Resume.js'
import { ShareLinkModel } from '../../models/ShareLink.js'
import { TemplateModel } from '../../models/Template.js'
import { syncTemplates } from '../templates/templates.service.js'

useTestDb()

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function signUp(email = 'aman@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Aman Sharma', email, password: 'CorrectHorse7Battery' })
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string }
}

async function resumeWithContent(token: string) {
  const res = await request(app)
    .post('/api/resumes/import')
    .set(auth(token))
    .send({
      title: 'Platform CV',
      document: {
        basics: {
          name: 'Neha Verma',
          email: 'neha@example.com',
          phone: '+44 20 7946 0000',
          summary: 'Platform engineer with four years on developer tooling.',
          location: { city: 'Leeds', countryCode: 'GB' },
        },
        work: [{ name: 'Corvid', position: 'Engineer', highlights: ['Cut builds by 55%.'] }],
      },
    })
  const id = res.body.data.resume.id as string
  await ResumeModel.updateOne({ _id: id }, { $set: { notes: 'private note' } })
  return id
}

async function share(token: string, resumeId: string, body: object = {}) {
  return request(app).post(`/api/resumes/${resumeId}/share`).set(auth(token)).send(body)
}

describe('share links, owner side', () => {
  it('returns the token exactly once and stores only its hash', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)

    const res = await share(token, resumeId)
    expect(res.status).toBe(201)
    expect(res.body.data.url).toContain(`/r/${res.body.data.token}`)

    const stored = await ShareLinkModel.findOne()
    expect(stored?.tokenHash).not.toBe(res.body.data.token)
    expect(JSON.stringify(stored?.toObject())).not.toContain(res.body.data.token)

    const list = await request(app).get(`/api/resumes/${resumeId}/share`).set(auth(token))
    expect(list.body.data.links).toHaveLength(1)
    expect(JSON.stringify(list.body)).not.toContain(res.body.data.token)
  })

  it('gives 404 to another user on every owner route', async () => {
    const owner = await signUp()
    const stranger = await signUp('rahul@example.com')
    const resumeId = await resumeWithContent(owner.token)
    const linkId = (await share(owner.token, resumeId)).body.data.link.id

    expect((await share(stranger.token, resumeId)).status).toBe(404)
    expect(
      (
        await request(app)
          .patch(`/api/share/${linkId}`)
          .set(auth(stranger.token))
          .send({ enabled: false })
      ).status
    ).toBe(404)
    expect(
      (await request(app).delete(`/api/share/${linkId}`).set(auth(stranger.token))).status
    ).toBe(404)
  })

  it('rejects an expiry date in the past', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const res = await share(token, resumeId, { expiresAt: '2001-01-01T00:00:00.000Z' })
    expect(res.status).toBe(422)
  })
})

describe('public resume view', () => {
  it('renders without a login, with privacy headers and no notes', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const { token: shareToken } = (await share(token, resumeId)).body.data

    const res = await request(app).get(`/api/public/r/${shareToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.body.data.resume.personal.fullName).toBe('Neha Verma')
    expect(JSON.stringify(res.body)).not.toContain('private note')
  })

  it('honours the redaction flags', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const { token: shareToken } = (
      await share(token, resumeId, { redact: { email: true, phone: true, address: true } })
    ).body.data

    const { personal } = (await request(app).get(`/api/public/r/${shareToken}`)).body.data.resume
    expect(personal.email).toBe('')
    expect(personal.phone).toBe('')
    expect(personal.location).toBe('')
  })

  it('counts a visitor once per hour and never counts the owner', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const { token: shareToken, link } = (await share(token, resumeId)).body.data

    await request(app).get(`/api/public/r/${shareToken}`).set('User-Agent', 'recruiter-a')
    await request(app).get(`/api/public/r/${shareToken}`).set('User-Agent', 'recruiter-a')
    await request(app).get(`/api/public/r/${shareToken}`).set('User-Agent', 'recruiter-b')
    await request(app).get(`/api/public/r/${shareToken}`).set(auth(token))
    await request(app).post(`/api/public/r/${shareToken}/download`).set('User-Agent', 'recruiter-b')

    const analytics = await request(app).get(`/api/share/${link.id}/analytics`).set(auth(token))
    expect(analytics.body.data.link.views).toBe(2)
    expect(analytics.body.data.link.downloads).toBe(1)
    expect(analytics.body.data.daily).toHaveLength(30)
    expect(analytics.body.data.daily.at(-1).views).toBe(2)
  })

  it('answers 410 for a disabled link and for an expired one, 404 for a made-up one', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const created = (await share(token, resumeId)).body.data

    await request(app)
      .patch(`/api/share/${created.link.id}`)
      .set(auth(token))
      .send({ enabled: false })
    const disabled = await request(app).get(`/api/public/r/${created.token}`)
    expect(disabled.status).toBe(410)
    expect(disabled.body.error.code).toBe('SHARE_LINK_DISABLED')

    const second = (await share(token, resumeId)).body.data
    await ShareLinkModel.updateOne({ _id: second.link.id }, { $set: { expiresAt: new Date(1000) } })
    const expired = await request(app).get(`/api/public/r/${second.token}`)
    expect(expired.status).toBe(410)
    expect(expired.body.error.code).toBe('SHARE_LINK_EXPIRED')

    expect((await request(app).get('/api/public/r/abcdefghijklmnopqrstuvwxyz012345')).status).toBe(
      404
    )
  })

  it('accepts a report against a live link', async () => {
    const { token } = await signUp()
    const resumeId = await resumeWithContent(token)
    const { token: shareToken } = (await share(token, resumeId)).body.data

    const res = await request(app)
      .post(`/api/public/r/${shareToken}/report`)
      .send({ reason: 'spam', snippet: 'repeated ads' })
    expect(res.status).toBe(201)
    expect(await ReportModel.countDocuments({ targetType: 'share_link' })).toBe(1)
  })
})

describe('templates', () => {
  it('lists the active entries, built-ins and presets', async () => {
    await syncTemplates()
    const res = await request(app).get('/api/templates')
    const keys = res.body.data.templates.map((t: { key: string }) => t.key)
    expect(keys).toContain('foundry')
    expect(keys).toContain('foundry-compact')
  })

  it('applies a preset design when a resume is created from it', async () => {
    await syncTemplates()
    const { token } = await signUp()
    const res = await request(app)
      .post('/api/resumes')
      .set(auth(token))
      .send({ title: 'Compact CV', resumeType: 'professional', templateKey: 'foundry-compact' })

    expect(res.status).toBe(201)
    expect(res.body.data.resume.templateKey).toBe('foundry')
    expect(res.body.data.resume.design.sectionSpacing).toBe('compact')
  })

  it('refuses a deactivated template for a new resume', async () => {
    await syncTemplates()
    await TemplateModel.updateOne({ key: 'quire' }, { $set: { active: false } })
    const { token } = await signUp()
    const res = await request(app)
      .post('/api/resumes')
      .set(auth(token))
      .send({ title: 'Quire CV', resumeType: 'fresher', templateKey: 'quire' })
    expect(res.status).toBe(422)
  })
})
