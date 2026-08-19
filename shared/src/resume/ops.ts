import { z } from 'zod'

/*
  The autosave vocabulary.

  Deliberately a closed set of named operations rather than JSON Patch. A free-form `path` lets a
  client write `/owner`, `/version` or `/meta.completeness`, and no amount of downstream checking
  makes that safe again. Every op below names exactly what it may touch.

  Structural ops (reorder, add, remove) rewrite an array. Field ops address a single subdocument
  by `_id`, never by array index, because an index shifts the moment a section is reordered and
  an in-flight patch would then write into a neighbouring entry.
*/

export const FIELD_OPS = [
  'setPersonal',
  'setDesign',
  'setNotes',
  'setSectionTitle',
  'toggleSection',
  'toggleEntry',
  'setField',
] as const

export const STRUCTURAL_OPS = [
  'reorderSections',
  'reorderEntries',
  'addEntry',
  'removeEntry',
] as const

export const OP_NAMES = [...FIELD_OPS, ...STRUCTURAL_OPS] as const
export type OpName = (typeof OP_NAMES)[number]

export type ResumeOp =
  | { op: 'setPersonal'; field: string; value: unknown }
  | { op: 'setDesign'; field: string; value: unknown }
  | { op: 'setNotes'; value: string }
  | { op: 'setSectionTitle'; sectionId: string; value: string }
  | { op: 'toggleSection'; sectionId: string; hidden: boolean }
  | { op: 'toggleEntry'; sectionId: string; entryId: string; hidden: boolean }
  | { op: 'setField'; sectionId: string; entryId: string; field: string; value: unknown }
  | { op: 'reorderSections'; order: string[] }
  | { op: 'reorderEntries'; sectionId: string; order: string[] }
  | { op: 'addEntry'; sectionId: string; entryId: string }
  | { op: 'removeEntry'; sectionId: string; entryId: string }

export function isStructural(op: ResumeOp): boolean {
  return (STRUCTURAL_OPS as readonly string[]).includes(op.op)
}

/*
  A field name becomes part of a Mongo update path, so it must never carry a dot or a dollar.
  The allowlist below is the union of every key in SECTION_REGISTRY plus the personal and design
  keys, which is narrower than a character check and cannot be widened by accident.
*/
export const PERSONAL_KEYS = [
  'fullName',
  'headline',
  'email',
  'phone',
  'location',
  'links',
] as const

export const DESIGN_KEYS = ['accent', 'typeScale', 'leading', 'sectionSpacing', 'margins'] as const

export const ENTRY_KEYS = [
  'text',
  'role',
  'organisation',
  'location',
  'startDate',
  'endDate',
  'current',
  'bullets',
  'degree',
  'grade',
  'coursework',
  'name',
  'url',
  'stack',
  'group',
  'items',
  'issuer',
  'title',
  'detail',
  'level',
  'venue',
  'contact',
  'subtitle',
] as const

const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/

export function isSafeKey(key: string, allowed: readonly string[]): boolean {
  return SAFE_KEY.test(key) && allowed.includes(key)
}

/** The maximum ops one autosave request may carry. A larger batch is a client bug, not a user. */
export const MAX_OPS_PER_PATCH = 200

/*
  What an op writes to. Two ops sharing a target are the same edit made twice, which is exactly
  what typing produces: a keystroke per character, all aimed at one field.
*/
function targetOf(op: ResumeOp, index: number): string {
  switch (op.op) {
    case 'setPersonal':
      return `personal.${op.field}`
    case 'setDesign':
      return `design.${op.field}`
    case 'setNotes':
      return 'notes'
    case 'setSectionTitle':
      return `section.${op.sectionId}.title`
    case 'toggleSection':
      return `section.${op.sectionId}.hidden`
    case 'toggleEntry':
      return `entry.${op.sectionId}.${op.entryId}.hidden`
    case 'setField':
      return `entry.${op.sectionId}.${op.entryId}.${op.field}`
    default:
      // structural ops are never merged: order matters and each one is distinct
      return `structural.${index}`
  }
}

/**
 * Collapses repeated edits to the same target, keeping the last, and preserves order otherwise.
 *
 * Two purposes. It stops a typing burst sending forty writes for one field, and it guarantees a
 * batch cannot produce two Mongo update paths that resolve to the same document position, which
 * Mongo rejects outright.
 */
export function coalesceOps(ops: ResumeOp[]): ResumeOp[] {
  const byTarget = new Map<string, ResumeOp>()

  ops.forEach((op, index) => {
    const target = targetOf(op, index)
    // delete first so the re-insert moves it to the end, keeping the newest edit last
    byTarget.delete(target)
    byTarget.set(target, op)
  })

  return [...byTarget.values()]
}

/* ---------------------------------------------------------------- validation

  Zod rather than express-validator. Its wildcard syntax cannot express a discriminated union,
  and this payload is nothing but one. See ADR-009.
*/

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Not a valid id')

/** Bounded on purpose: an unbounded value is an unbounded document. */
const opValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(1000)).max(50),
  z.array(z.object({ label: z.string().max(30), url: z.string().max(200) })).max(5),
])

export const ResumeOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setPersonal'), field: z.enum(PERSONAL_KEYS), value: opValue }),
  z.object({ op: z.literal('setDesign'), field: z.enum(DESIGN_KEYS), value: opValue }),
  z.object({ op: z.literal('setNotes'), value: z.string().max(4000) }),
  z.object({
    op: z.literal('setSectionTitle'),
    sectionId: objectId,
    value: z.string().min(1).max(60),
  }),
  z.object({ op: z.literal('toggleSection'), sectionId: objectId, hidden: z.boolean() }),
  z.object({
    op: z.literal('toggleEntry'),
    sectionId: objectId,
    entryId: objectId,
    hidden: z.boolean(),
  }),
  z.object({
    op: z.literal('setField'),
    sectionId: objectId,
    entryId: objectId,
    field: z.enum(ENTRY_KEYS),
    value: opValue,
  }),
  z.object({ op: z.literal('reorderSections'), order: z.array(objectId).max(15) }),
  z.object({
    op: z.literal('reorderEntries'),
    sectionId: objectId,
    order: z.array(objectId).max(60),
  }),
  z.object({ op: z.literal('addEntry'), sectionId: objectId, entryId: objectId }),
  z.object({ op: z.literal('removeEntry'), sectionId: objectId, entryId: objectId }),
])

export const AutosaveSchema = z.object({
  version: z.number().int().min(0),
  ops: z.array(ResumeOpSchema).min(1).max(MAX_OPS_PER_PATCH),
})

export type AutosavePayload = z.infer<typeof AutosaveSchema>
