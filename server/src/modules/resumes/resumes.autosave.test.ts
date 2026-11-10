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

interface Loaded {
  id: string
  version: number
  sections: { _id: string; type: string; entries: { _id: string }[] }[]
}

async function newResume(token: string): Promise<Loaded> {
  const created = await request(app)
    .post('/api/resumes')
    .set(auth(token))
    .send({ title: 'Backend Developer CV', resumeType: 'technical' })

  return created.body.data.resume
}

async function load(token: string, id: string): Promise<Loaded> {
  const res = await request(app).get(`/api/resumes/${id}`).set(auth(token))
  return res.body.data.resume
}

function patch(token: string, id: string, version: number, ops: ResumeOp[]) {
  return request(app).patch(`/api/resumes/${id}`).set(auth(token)).send({ version, ops })
}

describe('autosave field ops', () => {
  it('writes a field and advances the version', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections.find((s) => s.type === 'experience')!

    const added = await patch(token, resume.id, resume.version, [
      { op: 'addEntry', sectionId: section._id, entryId: 'a'.repeat(24) },
    ])
    expect(added.status).toBe(200)

    const res = await patch(token, resume.id, added.body.data.version, [
      {
        op: 'setField',
        sectionId: section._id,
        entryId: 'a'.repeat(24),
        field: 'role',
        value: 'Backend Engineer',
      },
    ])

    expect(res.status).toBe(200)
    expect(res.body.data.version).toBe(added.body.data.version + 1)

    const loaded = await load(token, resume.id)
    const entry = loaded.sections.find((s) => s._id === section._id)!.entries[0] as unknown as {
      data: { role: string }
    }
    expect(entry.data.role).toBe('Backend Engineer')
  })

  it('sets personal details and notes', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex Mercer' },
      { op: 'setNotes', value: 'mention the Kafka migration' },
    ])

    const loaded = (await load(token, resume.id)) as unknown as {
      personal: { fullName: string }
      notes: string
    }

    expect(loaded.personal.fullName).toBe('Alex Mercer')
    expect(loaded.notes).toBe('mention the Kafka migration')
  })

  it('toggles a section without deleting its entries', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections[0]!

    await patch(token, resume.id, resume.version, [
      { op: 'toggleSection', sectionId: section._id, hidden: true },
    ])

    const loaded = await load(token, resume.id)
    const found = loaded.sections.find((s) => s._id === section._id) as unknown as {
      hidden: boolean
    }

    expect(found.hidden).toBe(true)
    expect(loaded.sections).toHaveLength(resume.sections.length)
  })

  // coalescing avoids a write per character and conflicting update paths
  it('coalesces repeated edits to one field, keeping the last', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections.find((s) => s.type === 'experience')!
    const entryId = 'b'.repeat(24)

    const added = await patch(token, resume.id, resume.version, [
      { op: 'addEntry', sectionId: section._id, entryId },
    ])

    const typing: ResumeOp[] = 'Backend Engineer'.split('').map((_, i) => ({
      op: 'setField',
      sectionId: section._id,
      entryId,
      field: 'role',
      value: 'Backend Engineer'.slice(0, i + 1),
    }))

    const res = await patch(token, resume.id, added.body.data.version, typing)
    expect(res.status).toBe(200)

    // one version bump for the whole burst, not sixteen
    expect(res.body.data.version).toBe(added.body.data.version + 1)

    const loaded = await load(token, resume.id)
    const entry = loaded.sections.find((s) => s._id === section._id)!.entries[0] as unknown as {
      data: { role: string }
    }
    expect(entry.data.role).toBe('Backend Engineer')
  })
})

describe('autosave structural ops', () => {
  it('reorders sections', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const reversed = [...resume.sections].reverse().map((s) => s._id)
    await patch(token, resume.id, resume.version, [{ op: 'reorderSections', order: reversed }])

    const loaded = await load(token, resume.id)
    expect(loaded.sections.map((s) => s._id)).toEqual(reversed)
  })

  // a reorder must never silently drop a section the client omitted
  it('keeps a section the client omitted from the order', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const partial = resume.sections.slice(0, 2).map((s) => s._id)
    await patch(token, resume.id, resume.version, [{ op: 'reorderSections', order: partial }])

    const loaded = await load(token, resume.id)
    expect(loaded.sections).toHaveLength(resume.sections.length)
  })

  it('adds and removes an entry', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections[0]!
    const entryId = 'c'.repeat(24)

    const added = await patch(token, resume.id, resume.version, [
      { op: 'addEntry', sectionId: section._id, entryId },
    ])

    let loaded = await load(token, resume.id)
    expect(loaded.sections.find((s) => s._id === section._id)!.entries).toHaveLength(1)

    await patch(token, resume.id, added.body.data.version, [
      { op: 'removeEntry', sectionId: section._id, entryId },
    ])

    loaded = await load(token, resume.id)
    expect(loaded.sections.find((s) => s._id === section._id)!.entries).toHaveLength(0)
  })
})

// two tabs must not overwrite each other, and the loser must be able to recover
describe('version conflict', () => {
  it('accepts sequential writes that each carry the current version', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const first = await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex' },
    ])
    const second = await patch(token, resume.id, first.body.data.version, [
      { op: 'setPersonal', field: 'headline', value: 'Backend engineer' },
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.data.version).toBe(resume.version + 2)
  })

  it('rejects a stale version and returns the current document', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex Mercer' },
    ])

    // the second tab still believes it holds the original version
    const stale = await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'headline', value: 'Written from a stale tab' },
    ])

    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')

    // enough to rebase on, rather than "reload and lose your changes"
    expect(stale.body.data.resume.version).toBe(resume.version + 1)
    expect(stale.body.data.resume.personal.fullName).toBe('Alex Mercer')
  })
})

describe('autosave rejects what it should', () => {
  it('refuses an unknown field name', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections[0]!

    const res = await patch(token, resume.id, resume.version, [
      {
        op: 'setField',
        sectionId: section._id,
        entryId: 'd'.repeat(24),
        field: 'owner',
        value: 'someone else',
      } as unknown as ResumeOp,
    ])

    expect(res.status).toBe(422)
  })

  // a closed vocabulary because a field name becomes part of a Mongo update path
  it('refuses a path traversal in a field name', async () => {
    const token = await signUp()
    const resume = await newResume(token)
    const section = resume.sections[0]!

    for (const field of ['data.owner', '$where', 'role.$[]', '__proto__']) {
      const res = await patch(token, resume.id, resume.version, [
        {
          op: 'setField',
          sectionId: section._id,
          entryId: 'd'.repeat(24),
          field,
          value: 'x',
        } as unknown as ResumeOp,
      ])

      expect(res.status, field).toBe(422)
    }
  })

  it('refuses an unknown op', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const res = await patch(token, resume.id, resume.version, [
      { op: 'setOwner', value: 'me' } as unknown as ResumeOp,
    ])

    expect(res.status).toBe(422)
  })

  it('refuses an oversized batch', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const ops = Array.from({ length: 201 }, () => ({
      op: 'setNotes' as const,
      value: 'x',
    }))

    expect((await patch(token, resume.id, resume.version, ops)).status).toBe(422)
  })

  it('gives 404 on another user resume', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')
    const resume = await newResume(alice)

    const res = await patch(bob, resume.id, resume.version, [{ op: 'setNotes', value: 'not mine' }])

    expect(res.status).toBe(404)
  })
})

describe('denormalised meta', () => {
  it('recomputes completeness and word count on every write', async () => {
    const token = await signUp()
    const resume = await newResume(token)

    const res = await patch(token, resume.id, resume.version, [
      { op: 'setPersonal', field: 'fullName', value: 'Alex Mercer' },
      { op: 'setPersonal', field: 'email', value: 'alex@example.com' },
    ])

    expect(res.body.data.meta.completeness).toBeGreaterThan(0)

    // the list path reads the denormalised copy, never resume content
    const list = await request(app).get('/api/resumes').set(auth(token))
    expect(list.body.data.resumes[0].meta.completeness).toBe(res.body.data.meta.completeness)
  })
})
