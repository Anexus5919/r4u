import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { ResumeModel } from '../../models/Resume.js'
import { useTestDb } from '../../test/db.js'
import { listResumesForOwner, readResumeContent } from './resumes.access.js'
import { AppError } from '../../lib/AppError.js'

// privacy boundary (FR 9.6, ADR-008): never deleted, a regression is a breach

useTestDb()

const OWNER = new Types.ObjectId().toString()
const STRANGER = new Types.ObjectId().toString()

async function seedResume() {
  return ResumeModel.create({
    owner: OWNER,
    title: 'Backend Developer CV',
    personal: { fullName: 'Aman Sharma', email: 'aman@example.com' },
    notes: 'mention the Kafka migration',
    sections: [
      {
        type: 'experience',
        title: 'Work Experience',
        entries: [{ data: { role: 'Backend Engineer', company: 'Zendex' } }],
      },
    ],
    meta: { completeness: 72, wordCount: 410, sectionCount: 1 },
  })
}

describe('resume content boundary', () => {
  it('strips content from an ordinary find, with no opt-out required', async () => {
    await seedResume()

    const found = await ResumeModel.findOne({ owner: OWNER })

    expect(found).not.toBeNull()
    expect(found?.title).toBe('Backend Developer CV')

    // the paths are absent entirely, not merely emptied, so nothing can read through them
    expect(found?.sections).toBeUndefined()
    expect(found?.notes).toBeUndefined()
    expect(found?.personal).toBeUndefined()
  })

  // a future unscoped admin query must return nothing sensitive by construction
  it('strips content from an unscoped find across every document', async () => {
    await seedResume()

    const all = await ResumeModel.find({}).lean()

    expect(all).toHaveLength(1)
    expect(all[0]).not.toHaveProperty('sections')
    expect(all[0]).not.toHaveProperty('personal')
    expect(all[0]).not.toHaveProperty('notes')
    // metadata survives, which is what keeps admin dashboards possible
    expect(all[0]?.meta?.completeness).toBe(72)
  })

  it('returns content to the owner through the single opt-in path', async () => {
    const seeded = await seedResume()

    const resume = await readResumeContent(seeded.id, { id: OWNER, role: 'user' })

    expect(resume.sections).toHaveLength(1)
    expect(resume.notes).toBe('mention the Kafka migration')
    expect((resume.personal as { fullName: string }).fullName).toBe('Aman Sharma')
  })

  it('refuses an administrator unconditionally', async () => {
    const seeded = await seedResume()

    const attempt = readResumeContent(seeded.id, { id: OWNER, role: 'admin' })

    await expect(attempt).rejects.toBeInstanceOf(AppError)
    await expect(attempt).rejects.toMatchObject({
      code: 'ADMIN_CONTENT_FORBIDDEN',
      status: 403,
    })
  })

  it('refuses an administrator even for a resume that does not exist', async () => {
    const attempt = readResumeContent(new Types.ObjectId().toString(), {
      id: OWNER,
      role: 'admin',
    })

    // the refusal precedes the lookup, so an admin cannot probe for existence either
    await expect(attempt).rejects.toMatchObject({ code: 'ADMIN_CONTENT_FORBIDDEN' })
  })

  it('gives a non-owner 404 rather than 403', async () => {
    const seeded = await seedResume()

    const attempt = readResumeContent(seeded.id, { id: STRANGER, role: 'user' })

    // 403 would confirm the id exists, which enumerates a collection of PII documents
    await expect(attempt).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('never returns content from the list path', async () => {
    await seedResume()

    const list = await listResumesForOwner(OWNER)

    expect(list).toHaveLength(1)
    expect(list[0]?.sections).toBeUndefined()
    expect(list[0]?.personal).toBeUndefined()
    expect(list[0]?.meta.wordCount).toBe(410)
  })
})
