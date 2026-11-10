import type { SectionType } from '../resume/sections.js'
import type { ResumeTemplate } from '../layout/types.js'
import { broadsheet } from './broadsheet.js'
import { foundry } from './foundry.js'
import { ledger } from './ledger.js'
import { marginalia } from './marginalia.js'
import { placard } from './placard.js'
import { quire } from './quire.js'
import { recto } from './recto.js'
import { verso } from './verso.js'

export * from './blocks.js'
export { broadsheet, foundry, ledger, marginalia, placard, quire, recto, verso }

// functions in the repo, keyed by string. markup in the database would be RCE. ADR-005
export const TEMPLATES: Record<string, ResumeTemplate> = {
  foundry,
  quire,
  ledger,
  placard,
  recto,
  verso,
  marginalia,
  broadsheet,
}

export const TEMPLATE_LIST: ResumeTemplate[] = Object.values(TEMPLATES)

export const DEFAULT_TEMPLATE_KEY = 'foundry'

export function getTemplate(key: string): ResumeTemplate {
  return TEMPLATES[key] ?? foundry
}

interface OrderableSection {
  _id?: unknown
  type: SectionType
}

// anything the template does not mention keeps its place rather than vanishing
export function reorderForTemplate<T extends OrderableSection>(
  sections: T[],
  template: ResumeTemplate
): T[] {
  const ranked = new Map(template.recommendedOrder.map((type, index) => [type, index]))

  const known = sections
    .filter((section) => ranked.has(section.type))
    .sort((a, b) => (ranked.get(a.type) ?? 0) - (ranked.get(b.type) ?? 0))

  const unknown = sections.filter((section) => !ranked.has(section.type))

  return [...known, ...unknown]
}

// unlisted sections fall into main, or a one to two column switch loses them
export function slotFor(type: SectionType, template: ResumeTemplate): 'main' | 'aside' {
  return template.slots.aside.includes(type) ? 'aside' : 'main'
}

/** True when the template would put the sections in a different order than they are now. */
export function wouldReorder<T extends OrderableSection>(
  sections: T[],
  template: ResumeTemplate
): boolean {
  const next = reorderForTemplate(sections, template)
  return next.some((section, index) => section !== sections[index])
}
