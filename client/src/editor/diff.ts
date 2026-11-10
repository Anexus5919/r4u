import { DESIGN_KEYS, ENTRY_KEYS, PERSONAL_KEYS } from '@r4u/shared'
import type { ResumeOp } from '@r4u/shared'
import type { EditorResume, EditorSection } from './types'

// ops are diffed against the last save, so undo, redo and rebase are just states

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    return ak.length === bk.length && ak.every((k) => sameValue((a as never)[k], (b as never)[k]))
  }
  // both empty-ish counts as unchanged, so clearing a field that was never set sends nothing
  return (a ?? '') === (b ?? '')
}

function idsOf(sections: { _id: string }[]): string[] {
  return sections.map((s) => s._id)
}

function diffEntries(base: EditorSection, next: EditorSection, ops: ResumeOp[]): void {
  const baseById = new Map(base.entries.map((e) => [e._id, e]))
  const nextById = new Map(next.entries.map((e) => [e._id, e]))

  for (const entry of next.entries) {
    if (!baseById.has(entry._id)) {
      ops.push({ op: 'addEntry', sectionId: next._id, entryId: entry._id })
    }
  }

  for (const entry of base.entries) {
    if (!nextById.has(entry._id)) {
      ops.push({ op: 'removeEntry', sectionId: next._id, entryId: entry._id })
    }
  }

  const survivingBase = idsOf(base.entries).filter((id) => nextById.has(id))
  const survivingNext = idsOf(next.entries).filter((id) => baseById.has(id))
  if (!sameValue(survivingBase, survivingNext)) {
    ops.push({ op: 'reorderEntries', sectionId: next._id, order: idsOf(next.entries) })
  }

  for (const entry of next.entries) {
    const before = baseById.get(entry._id)
    if (!before) continue

    if (before.hidden !== entry.hidden) {
      ops.push({
        op: 'toggleEntry',
        sectionId: next._id,
        entryId: entry._id,
        hidden: entry.hidden,
      })
    }

    for (const field of ENTRY_KEYS) {
      const a = before.data[field]
      const b = entry.data[field]
      if (sameValue(a, b)) continue

      ops.push({
        op: 'setField',
        sectionId: next._id,
        entryId: entry._id,
        field,
        value: (b ?? '') as never,
      })
    }
  }
}

/** Every change between two states, expressed in the vocabulary the server accepts. */
export function diffResume(base: EditorResume, next: EditorResume): ResumeOp[] {
  const ops: ResumeOp[] = []

  for (const field of PERSONAL_KEYS) {
    if (!sameValue(base.personal[field], next.personal[field])) {
      ops.push({ op: 'setPersonal', field, value: next.personal[field] as never })
    }
  }

  for (const field of DESIGN_KEYS) {
    if (!sameValue(base.design[field], next.design[field])) {
      ops.push({ op: 'setDesign', field, value: next.design[field] as never })
    }
  }

  if (base.notes !== next.notes) ops.push({ op: 'setNotes', value: next.notes })

  if (base.templateKey !== next.templateKey) {
    ops.push({ op: 'setTemplate', value: next.templateKey })
  }

  const baseSections = new Map(base.sections.map((s) => [s._id, s]))

  if (!sameValue(idsOf(base.sections), idsOf(next.sections))) {
    ops.push({ op: 'reorderSections', order: idsOf(next.sections) })
  }

  for (const section of next.sections) {
    const before = baseSections.get(section._id)
    if (!before) continue

    if (before.title !== section.title) {
      ops.push({ op: 'setSectionTitle', sectionId: section._id, value: section.title })
    }

    if (before.hidden !== section.hidden) {
      ops.push({ op: 'toggleSection', sectionId: section._id, hidden: section.hidden })
    }

    diffEntries(before, section, ops)
  }

  return ops
}

export function hasChanges(base: EditorResume, next: EditorResume): boolean {
  return diffResume(base, next).length > 0
}
