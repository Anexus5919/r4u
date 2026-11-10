import { Types } from 'mongoose'
import { coalesceOps, computeMeta, isStructural } from '@r4u/shared'
import type { Resume as ResumeShape, ResumeOp } from '@r4u/shared'
import { AppError, notFound } from '../../lib/AppError.js'
import { ResumeModel } from '../../models/index.js'
import { readResumeContent } from './resumes.access.js'
import { snapshot } from './resumes.versions.js'
import type { Principal } from './resumes.access.js'
import type { ResumeDoc } from '../../models/Resume.js'

// debounced HTTP PATCH, never a socket message; the socket only broadcasts changes

const oid = (id: string) => new Types.ObjectId(id)

export class VersionConflict extends AppError {
  readonly current: ResumeDoc

  constructor(current: ResumeDoc) {
    super('VERSION_CONFLICT', 'This resume changed in another tab')
    this.current = current
  }
}

// ops target subdocuments by _id via arrayFilters, never index, one filter per op
function buildFieldUpdate(ops: ResumeOp[]) {
  const set: Record<string, unknown> = {}
  const arrayFilters: Record<string, unknown>[] = []
  let n = 0

  for (const op of ops) {
    switch (op.op) {
      case 'setPersonal':
        set[`personal.${op.field}`] = op.value
        break

      case 'setDesign':
        set[`design.${op.field}`] = op.value
        break

      case 'setNotes':
        set.notes = op.value
        break

      case 'setTemplate':
        set.templateKey = op.value
        break

      case 'setSectionTitle': {
        const s = `s${n++}`
        set[`sections.$[${s}].title`] = op.value
        arrayFilters.push({ [`${s}._id`]: oid(op.sectionId) })
        break
      }

      case 'toggleSection': {
        const s = `s${n++}`
        set[`sections.$[${s}].hidden`] = op.hidden
        arrayFilters.push({ [`${s}._id`]: oid(op.sectionId) })
        break
      }

      case 'toggleEntry': {
        const s = `s${n}`
        const e = `e${n++}`
        set[`sections.$[${s}].entries.$[${e}].hidden`] = op.hidden
        arrayFilters.push({ [`${s}._id`]: oid(op.sectionId) }, { [`${e}._id`]: oid(op.entryId) })
        break
      }

      case 'setField': {
        const s = `s${n}`
        const e = `e${n++}`
        set[`sections.$[${s}].entries.$[${e}].data.${op.field}`] = op.value
        arrayFilters.push({ [`${s}._id`]: oid(op.sectionId) }, { [`${e}._id`]: oid(op.entryId) })
        break
      }

      default:
        break
    }
  }

  return { set, arrayFilters }
}

/** Structural ops need the current array, so they read, transform in memory, and write it back. */
function applyStructural(doc: ResumeDoc, ops: ResumeOp[]) {
  type Section = ResumeDoc['sections'][number]

  for (const op of ops) {
    switch (op.op) {
      case 'reorderSections': {
        const byId = new Map(doc.sections.map((s) => [String(s._id), s]))
        const ordered = op.order.map((id) => byId.get(id)).filter(Boolean) as Section[]
        // anything the client did not mention keeps its place at the end, never vanishes
        const missing = doc.sections.filter((s) => !op.order.includes(String(s._id)))
        doc.sections = [...ordered, ...missing] as typeof doc.sections
        break
      }

      case 'reorderEntries': {
        const section = doc.sections.find((s) => String(s._id) === op.sectionId)
        if (!section) break

        const byId = new Map(section.entries.map((e) => [String(e._id), e]))
        const ordered = op.order.map((id) => byId.get(id)).filter(Boolean)
        const missing = section.entries.filter((e) => !op.order.includes(String(e._id)))
        section.entries = [...ordered, ...missing] as typeof section.entries
        break
      }

      case 'addEntry': {
        const section = doc.sections.find((s) => String(s._id) === op.sectionId)
        if (!section) break

        // the client supplies the id so it can render the new row before the round trip lands
        section.entries.push({ _id: oid(op.entryId), hidden: false, data: {} } as never)
        break
      }

      case 'removeEntry': {
        const section = doc.sections.find((s) => String(s._id) === op.sectionId)
        if (!section) break

        section.entries = section.entries.filter(
          (e) => String(e._id) !== op.entryId
        ) as typeof section.entries
        break
      }

      default:
        break
    }
  }
}

async function currentOrThrow(resumeId: string, principal: Principal): Promise<ResumeDoc> {
  const current = await readResumeContent(resumeId, principal)
  return current as ResumeDoc
}

export async function applyOps(
  resumeId: string,
  principal: Principal,
  version: number,
  rawOps: ResumeOp[]
): Promise<{ version: number; meta: ReturnType<typeof computeMeta> }> {
  const ops = coalesceOps(rawOps)

  // readResumeContent enforces ownership and refuses admin, so this is the authorisation gate
  const doc = await currentOrThrow(resumeId, principal)

  if (doc.version !== version) throw new VersionConflict(doc)

  // a real template change is a milestone, so snapshot the state before it
  const switching = ops.find(
    (op): op is Extract<ResumeOp, { op: 'setTemplate' }> =>
      op.op === 'setTemplate' && op.value !== doc.templateKey
  )
  if (switching) {
    await snapshot(resumeId, principal, 'template', `Before switching to ${switching.value}`)
  }

  if (ops.some(isStructural)) {
    applyStructural(doc, ops)
    const { set } = buildFieldUpdate(ops.filter((op) => !isStructural(op)))

    const result = await ResumeModel.updateOne(
      { _id: resumeId, owner: principal.id, version },
      { $set: { ...set, sections: doc.sections }, $inc: { version: 1 } }
    )

    if (result.matchedCount === 0)
      throw new VersionConflict(await currentOrThrow(resumeId, principal))
  } else {
    const { set, arrayFilters } = buildFieldUpdate(ops)

    const result = await ResumeModel.updateOne(
      { _id: resumeId, owner: principal.id, version },
      { $set: set, $inc: { version: 1 } },
      arrayFilters.length ? { arrayFilters } : {}
    )

    if (result.matchedCount === 0)
      throw new VersionConflict(await currentOrThrow(resumeId, principal))
  }

  // meta refreshed on every write so admin views never project content. see ADR-008
  const fresh = await currentOrThrow(resumeId, principal)
  const meta = computeMeta(fresh.toObject() as unknown as ResumeShape)

  await ResumeModel.updateOne(
    { _id: resumeId },
    {
      $set: {
        'meta.completeness': meta.completeness,
        'meta.wordCount': meta.wordCount,
        'meta.sectionCount': meta.sectionCount,
      },
    }
  )

  if (!fresh) throw notFound('Resume')
  return { version: fresh.version, meta }
}
