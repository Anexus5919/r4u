import type { SectionType } from '../resume/sections.js'
import type { ResumeTemplate } from '../layout/types.js'
import { foundry } from './foundry.js'
import { ledger } from './ledger.js'
import { quire } from './quire.js'

export * from './blocks.js'
export { foundry, ledger, quire }

/*
  Templates are functions in this repository, keyed by string. The Template collection stores only
  metadata and this key.

  Storing markup in the database would be remote code execution on whoever renders it, and
  @react-pdf cannot render markup anyway: its primitives are Document, Page, View and Text, not
  div and p. See ADR-005.
*/
export const TEMPLATES: Record<string, ResumeTemplate> = {
  foundry,
  quire,
  ledger,
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

/*
  Reordering a resume to a template's recommended order.

  The rule that matters is the one at the end: anything the template does not mention keeps its
  place rather than vanishing. A template switch that can silently drop a section is the worst
  bug this product could ship, and it is the exact failure the two-column slot model invites.

  Never applied automatically. The editor asks first, because the user may have ordered their
  sections deliberately and a template is a suggestion, not an instruction.
*/
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

/*
  Which column a section belongs in for a two-column template.

  Anything absent from both slot lists falls into main. That default is what makes a one-column
  to two-column switch safe: without it a section has no destination and either duplicates into
  both columns or disappears from the page entirely.
*/
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
