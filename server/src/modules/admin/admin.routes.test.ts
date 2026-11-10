import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { useTestDb } from '../../test/db.js'
import { UserModel } from '../../models/index.js'
import { flushActivity } from '../../lib/activity.js'
import { syncTemplates } from '../templates/templates.service.js'

useTestDb()

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
const PASSWORD = 'CorrectHorse7Battery'

async function account(email: string, role: 'user' | 'reviewer' | 'admin' = 'user') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: PASSWORD })
  const id = res.body.data.user.id as string
  if (role !== 'user') await UserModel.updateOne({ _id: id }, { $set: { role } })
  return { id, token: res.body.data.accessToken as string, email }
}

async function withContent(token: string) {
  await request(app)
    .post('/api/resumes/import')
    .set(auth(token))
    .send({
      document: { basics: { name: 'Secret Person', summary: 'A very private summary line.' } },
    })
}

describe('admin guard', () => {
  it('refuses every role but admin, and admin is not a superset of user', async () => {
    const user = await account('aman@example.com')
    const reviewer = await account('neha@example.com', 'reviewer')
    const admin = await account('admin@example.com', 'admin')

    expect((await request(app).get('/api/admin/stats').set(auth(user.token))).status).toBe(403)
    expect((await request(app).get('/api/admin/stats').set(auth(reviewer.token))).status).toBe(403)
    expect((await request(app).get('/api/admin/stats').set(auth(admin.token))).status).toBe(200)

    await withContent(user.token)
    const mine = await request(app).get('/api/resumes').set(auth(user.token))
    const read = await request(app)
      .get(`/api/resumes/${mine.body.data.resumes[0].id}`)
      .set(auth(admin.token))
    expect(read.status).toBe(403)
    expect(read.body.error.code).toBe('ADMIN_CONTENT_FORBIDDEN')
  })
})

describe('admin overview and users', () => {
  it('reports totals and a fourteen day series without any resume content', async () => {
    const user = await account('aman@example.com')
    await withContent(user.token)
    const admin = await account('admin@example.com', 'admin')

    const stats = await request(app).get('/api/admin/stats').set(auth(admin.token))
    expect(stats.body.data.users.total).toBe(2)
    expect(stats.body.data.resumes).toBe(1)
    expect(stats.body.data.series).toHaveLength(14)

    const users = await request(app).get('/api/admin/users').set(auth(admin.token))
    const all = JSON.stringify([stats.body, users.body])
    expect(all).not.toContain('Secret Person')
    expect(all).not.toContain('private summary')
  })

  it('searches, paginates and counts resumes per user', async () => {
    const user = await account('aman@example.com')
    await withContent(user.token)
    await account('neha@example.com')
    const admin = await account('admin@example.com', 'admin')

    const res = await request(app).get('/api/admin/users?q=aman&limit=1').set(auth(admin.token))
    expect(res.body.data.users).toHaveLength(1)
    expect(res.body.data.users[0].resumeCount).toBe(1)
    expect(res.body.meta.total).toBe(1)
  })

  it('makes a block take effect on the very next request', async () => {
    const user = await account('rahul@example.com')
    const admin = await account('admin@example.com', 'admin')

    const blocked = await request(app)
      .patch(`/api/admin/users/${user.id}/status`)
      .set(auth(admin.token))
      .send({ status: 'blocked' })
    expect(blocked.body.data.user.status).toBe('blocked')

    expect((await request(app).get('/api/users/me').set(auth(user.token))).status).toBe(401)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
    expect(login.body.error.code).toBe('ACCOUNT_BLOCKED')
  })

  it('will not let an admin block or demote themselves', async () => {
    const admin = await account('admin@example.com', 'admin')
    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}/status`)
      .set(auth(admin.token))
      .send({ status: 'blocked' })
    expect(res.status).toBe(422)
  })

  it('promotes a user to reviewer, who then appears in the directory', async () => {
    const candidate = await account('kavya@example.com')
    const owner = await account('aman@example.com')
    const admin = await account('admin@example.com', 'admin')

    await request(app)
      .patch(`/api/admin/users/${candidate.id}/role`)
      .set(auth(admin.token))
      .send({ role: 'reviewer' })

    const directory = await request(app).get('/api/users/reviewers').set(auth(owner.token))
    expect(directory.body.data.reviewers.map((r: { id: string }) => r.id)).toContain(candidate.id)
  })
})

describe('admin templates, reports and logs', () => {
  it('adds a preset and hides a deactivated entry from the public gallery', async () => {
    await syncTemplates()
    const admin = await account('admin@example.com', 'admin')

    const created = await request(app)
      .post('/api/admin/templates')
      .set(auth(admin.token))
      .send({
        key: 'quire-airy',
        baseKey: 'quire',
        name: 'Quire Airy',
        category: 'Standard',
        defaults: { sectionSpacing: 'airy' },
      })
    expect(created.status).toBe(201)

    const id = created.body.data.template.id
    await request(app)
      .patch(`/api/admin/templates/${id}`)
      .set(auth(admin.token))
      .send({ active: false })

    const gallery = await request(app).get('/api/templates')
    expect(gallery.body.data.templates.map((t: { key: string }) => t.key)).not.toContain(
      'quire-airy'
    )
  })

  it('refuses a preset over a layout that does not exist in code', async () => {
    const admin = await account('admin@example.com', 'admin')
    const res = await request(app)
      .post('/api/admin/templates')
      .set(auth(admin.token))
      .send({ key: 'made-up', baseKey: 'nonexistent', name: 'Made Up', category: 'Standard' })
    expect(res.status).toBe(422)
  })

  it('actions a report by disabling the reported share link', async () => {
    const owner = await account('aman@example.com')
    await withContent(owner.token)
    const resumes = await request(app).get('/api/resumes').set(auth(owner.token))
    const created = await request(app)
      .post(`/api/resumes/${resumes.body.data.resumes[0].id}/share`)
      .set(auth(owner.token))
      .send({})
    await request(app)
      .post(`/api/public/r/${created.body.data.token}/report`)
      .send({ reason: 'spam' })

    const admin = await account('admin@example.com', 'admin')
    const reports = await request(app).get('/api/admin/reports').set(auth(admin.token))
    const reportId = reports.body.data.reports[0].id

    const handled = await request(app)
      .patch(`/api/admin/reports/${reportId}`)
      .set(auth(admin.token))
      .send({ action: 'disable_link' })
    expect(handled.body.data.report.status).toBe('actioned')
    expect((await request(app).get(`/api/public/r/${created.body.data.token}`)).status).toBe(410)
  })

  it('records admin actions in the activity log with allowlisted meta only', async () => {
    const user = await account('rahul@example.com')
    const admin = await account('admin@example.com', 'admin')
    await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set(auth(admin.token))
      .send({ role: 'reviewer' })
    await flushActivity()

    const logs = await request(app).get('/api/admin/logs').set(auth(admin.token))
    const entry = logs.body.data.logs.find((l: { action: string }) => l.action === 'admin.role')
    expect(entry.meta).toEqual({ from: 'user', to: 'reviewer' })
    expect(entry.actor.name).toBe('admin')
    expect(entry.actorDeleted).toBe(false)
  })

  it('marks an entry whose actor was deleted, rather than calling them a visitor', async () => {
    const gone = await account('gone@example.com')
    const admin = await account('admin@example.com', 'admin')
    await flushActivity()
    await UserModel.deleteOne({ _id: gone.id })

    const logs = await request(app).get('/api/admin/logs').set(auth(admin.token))
    type Entry = { actor: { id: string } | null; actorDeleted: boolean; targetId: string | null }
    const orphan = logs.body.data.logs.find((l: Entry) => l.targetId === gone.id && !l.actor)
    expect(orphan).toBeDefined()
    expect(orphan.actorDeleted).toBe(true)
    const live = logs.body.data.logs.find((l: Entry) => l.actor?.id === admin.id)
    expect(live.actorDeleted).toBe(false)
  })
})

describe('admin report preview', () => {
  it('shows a reported page only while its link is public', async () => {
    const owner = await account('aman@example.com')
    await withContent(owner.token)
    const resumes = await request(app).get('/api/resumes').set(auth(owner.token))
    const created = await request(app)
      .post(`/api/resumes/${resumes.body.data.resumes[0].id}/share`)
      .set(auth(owner.token))
      .send({ redact: { email: true } })
    await request(app)
      .post(`/api/public/r/${created.body.data.token}/report`)
      .send({ reason: 'spam' })

    const admin = await account('admin@example.com', 'admin')
    const reports = await request(app).get('/api/admin/reports').set(auth(admin.token))
    const reportId = reports.body.data.reports[0].id

    const live = await request(app)
      .get(`/api/admin/reports/${reportId}/preview`)
      .set(auth(admin.token))
    expect(live.status).toBe(200)
    expect(live.body.data.resume.personal.fullName).toBe('Secret Person')

    await request(app)
      .patch(`/api/share/${created.body.data.link.id}`)
      .set(auth(owner.token))
      .send({ enabled: false })
    const off = await request(app)
      .get(`/api/admin/reports/${reportId}/preview`)
      .set(auth(admin.token))
    expect(off.status).toBe(410)
  })
})
