import { A4 } from './types.js'
import { DOC_COLORS } from './tokens.js'
import type { DocTheme, LayoutNode, Style, TemplateResume } from './types.js'
import { hasContent } from '../resume/sections.js'
import { personalOf } from '../resume/schema.js'
import type { Resume, ResumeDesign } from '../resume/schema.js'

/* ---------------------------------------------------------------- node constructors */

export const stack = (style: Style, children: LayoutNode[]): LayoutNode => ({
  type: 'stack',
  style,
  children,
})

export const row = (style: Style, children: LayoutNode[]): LayoutNode => ({
  type: 'row',
  style: { flexDirection: 'row', ...style },
  children,
})

export const text = (style: Style, value: string): LayoutNode => ({ type: 'text', style, value })

export const rule = (style: Style = {}): LayoutNode => ({ type: 'rule', style })

export const spacer = (size: number): LayoutNode => ({ type: 'spacer', size })

/** One job, one degree, one project. Never split across an A4 boundary. */
export const block = (style: Style, children: LayoutNode[]): LayoutNode => ({
  type: 'block',
  style,
  children,
})

/** A full-bleed ground behind the page. Takes width and backgroundColor, nothing else. */
export const ground = (style: Style): LayoutNode => ({ type: 'ground', style })

/** Grounds paint against the page box, so both adapters lift them out before walking the flow. */
export function splitGrounds(nodes: LayoutNode[]): { grounds: LayoutNode[]; flow: LayoutNode[] } {
  return {
    grounds: nodes.filter((node) => node.type === 'ground'),
    flow: nodes.filter((node) => node.type !== 'ground'),
  }
}

/** Drops the nulls a template produces when a field is empty, so callers can map freely. */
export function compact(nodes: (LayoutNode | null | undefined | false)[]): LayoutNode[] {
  return nodes.filter(Boolean) as LayoutNode[]
}

/* ---------------------------------------------------------------- typography */

export const TRACKING_CAP = 0.08

/*
  The single enforcement point for the letter-spacing cap.

  Severe editorial minimalism invites wide tracking on uppercase section headings, and measured,
  text extraction breaks at a ratio around 0.10: EXPERIENCE comes back as E X P E R I E N C E and
  the parser stops recognising the heading, which cascades into losing the whole employment
  history. Templates ask for tracking through this, so no template can exceed the cap.
*/
export function tracking(fontSize: number, em: number): number {
  return fontSize * Math.min(em, TRACKING_CAP)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2021-06" becomes "Jun 2021". Anything unparseable passes through untouched. */
export function month(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return ''
  const [year, index] = value.split('-')
  return `${MONTHS[Number(index) - 1] ?? ''} ${year}`.trim()
}

/*
  Always one line, always the same shape, with an en dash. A range stacked across two lines is
  Textkernel code 418 and a common casualty of right-aligned date columns.
*/
export function dateRange(data: Record<string, unknown>): string {
  const from = month(data.startDate)
  const to = month(data.endDate)

  // a certification carries an expiry with no issue date more often than not, and it is still a date
  if (!from) return to ? `Until ${to}` : ''

  if (data.current === true) return `${from} – Present`

  return to ? `${from} – ${to}` : from
}

export function str(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function list(data: Record<string, unknown>, key: string): string[] {
  const value = data[key]
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && !!v.trim())
    : []
}

/* ---------------------------------------------------------------- theme */

const GAP_SCALE = { compact: 0.75, normal: 1, airy: 1.4 } as const

/*
  Resolves the five customisation knobs into the values a template reads. Templates never touch
  a raw design field, which is what keeps the knobs to five and stops one template inventing a
  sixth.
*/
export function resolveTheme(design: ResumeDesign, fonts: Partial<DocTheme> = {}): DocTheme {
  const bodySize = design.typeScale
  const spacing = GAP_SCALE[design.sectionSpacing as keyof typeof GAP_SCALE] ?? 1

  return {
    serif: fonts.serif ?? 'Source Serif 4',
    sans: fonts.sans ?? 'Source Sans 3',
    mono: fonts.mono ?? 'Geist Mono',

    bodySize,
    leading: design.leading,
    sectionGap: Math.round(bodySize * 1.4 * spacing),
    // millimetres in the knob, points in the layout
    margin: Math.round(design.margins * 2.8346),
    pageWidth: A4.width,

    ink: DOC_COLORS.ink,
    muted: DOC_COLORS.muted,
    rule: DOC_COLORS.rule,
    /*
      An accent the user has not chosen resolves to near-black, never to a default colour. A
      resume that arrives coloured because nobody picked anything is a template imposing itself.
    */
    accent: design.accent || DOC_COLORS.fallbackAccent,
    paper: DOC_COLORS.paper,
  }
}

/* ---------------------------------------------------------------- resume shaping */

/*
  What a template is allowed to see. Hidden sections and hidden entries are removed here, once,
  so no template can forget to check and none of them can render the private notes field.
*/
export function toTemplateResume(resume: Partial<Resume>): TemplateResume {
  const personal = personalOf(resume)

  return {
    personal: {
      fullName: personal.fullName ?? '',
      headline: personal.headline ?? '',
      email: personal.email ?? '',
      phone: personal.phone ?? '',
      location: personal.location ?? '',
      links: (personal.links ?? []).filter((link) => link.url.trim()),
    },
    sections: (resume.sections ?? [])
      .filter((section) => !section.hidden)
      .map((section) => ({
        _id: String(section._id ?? ''),
        type: section.type,
        title: section.title,
        entries: (section.entries ?? [])
          .filter((entry) => !entry.hidden)
          .map((entry) => ({
            _id: String(entry._id ?? ''),
            data: (entry.data ?? {}) as Record<string, unknown>,
          }))
          // an entry one click old holds no data and renders to nothing, heading included
          .filter((entry) => hasContent(section.type, entry.data)),
      }))
      // a heading with nothing under it raises Textkernel code 324, so it never reaches the page
      .filter((section) => section.entries.length > 0),
  }
}

/** Contact details as one line, joined by middots, in the order parsers expect to find them. */
export function contactLine(personal: TemplateResume['personal']): string {
  return [personal.email, personal.phone, personal.location, ...personal.links.map((l) => l.url)]
    .filter(Boolean)
    .join('  ·  ')
}
