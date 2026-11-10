import { ACCENT_CHOICES, TEMPLATE_LIST, getTemplate } from '@r4u/shared'
import type { ResumeDesign, TemplateMeta } from '@r4u/shared'
import { AppError, notFound } from '../../lib/AppError.js'
import { TemplateModel } from '../../models/Template.js'
import type { TemplateDoc } from '../../models/Template.js'

const RENDERER_KEYS = new Set(TEMPLATE_LIST.map((template) => template.key))

export function isRenderer(key: string) {
  return RENDERER_KEYS.has(key)
}

export function serializeTemplate(doc: TemplateDoc): TemplateMeta {
  const defaults: Partial<ResumeDesign> = {}
  const stored = doc.defaults ?? {}
  if (stored.accent !== undefined && stored.accent !== null) defaults.accent = stored.accent
  if (stored.typeScale) defaults.typeScale = stored.typeScale
  if (stored.leading) defaults.leading = stored.leading
  if (stored.sectionSpacing) defaults.sectionSpacing = stored.sectionSpacing
  if (stored.margins) defaults.margins = stored.margins

  return {
    id: doc.id,
    key: doc.key,
    baseKey: doc.baseKey,
    name: doc.name,
    category: doc.category,
    description: doc.description ?? '',
    atsSafe: getTemplate(doc.baseKey).atsSafe,
    active: doc.active,
    order: doc.order,
    builtIn: doc.builtIn,
    defaults,
  }
}

// two presets prove the admin "add a template" path without any markup ever being stored
const PRESETS = [
  {
    key: 'foundry-compact',
    baseKey: 'foundry',
    name: 'Foundry Compact',
    category: 'Standard',
    description: 'Foundry set tighter, for a long first page that has to stay at one.',
    defaults: { typeScale: 10, sectionSpacing: 'compact' as const, margins: 16 },
  },
  {
    key: 'ledger-slate',
    baseKey: 'ledger',
    name: 'Ledger Slate',
    category: 'Standard',
    description: 'Ledger with a slate blue accent on its rules, for finance and operations.',
    defaults: { accent: ACCENT_CHOICES[2].key },
  },
]

/** Inserts any built-in entry that is missing. Never overwrites what an admin has edited. */
export async function syncTemplates() {
  const existing = new Set((await TemplateModel.find().select('key').lean()).map((t) => t.key))

  const builtIns = TEMPLATE_LIST.map((template, index) => ({
    key: template.key,
    baseKey: template.key,
    name: template.name,
    category: template.category,
    description: template.audience,
    active: true,
    order: index,
    builtIn: true,
  }))

  const presets = PRESETS.map((preset, index) => ({
    ...preset,
    active: true,
    order: builtIns.length + index,
    builtIn: false,
  }))

  const missing = [...builtIns, ...presets].filter((entry) => !existing.has(entry.key))
  if (missing.length > 0) await TemplateModel.insertMany(missing, { ordered: false })
  return missing.length
}

export async function listActive() {
  const docs = await TemplateModel.find({ active: true }).sort({ order: 1, name: 1 })
  return docs.map(serializeTemplate)
}

export async function getByKey(key: string) {
  const doc = await TemplateModel.findOne({ key, active: true })
  if (!doc) throw notFound('Template')
  return serializeTemplate(doc)
}

/** Resolves what a new resume should store: the renderer key plus the preset's design. */
export async function resolveForNewResume(key?: string) {
  if (!key) return { templateKey: 'foundry', design: {} as Partial<ResumeDesign> }

  const doc = await TemplateModel.findOne({ key })
  if (doc) {
    if (!doc.active) {
      throw new AppError('VALIDATION_FAILED', 'That template is no longer offered for new resumes')
    }
    return { templateKey: doc.baseKey, design: serializeTemplate(doc).defaults }
  }

  // a bare renderer key still works, which keeps the API usable before templates are synced
  if (isRenderer(key)) return { templateKey: key, design: {} as Partial<ResumeDesign> }
  throw new AppError('VALIDATION_FAILED', 'Unknown template')
}
