import {
  contactLine,
  dateRange,
  list,
  resolveTheme,
  str,
  toTemplateResume,
} from '../layout/helpers.js'
import type { LayoutNode, ResumeTemplate, TemplateResume } from '../layout/types.js'
import type { Resume } from '../resume/schema.js'
import { DesignSchema } from '../resume/schema.js'
import { slotFor } from '../templates/index.js'

type Section = TemplateResume['sections'][number]
type Entry = Section['entries'][number]

function titleWithDate(
  title: string,
  date: string,
  layout: ResumeTemplate['atsProfile']['dateLayout']
) {
  if (!date) return title
  if (layout === 'rail') return `${date}   ${title}`
  if (layout === 'inline') return `${title}, ${date}`
  return `${title}    ${date}`
}

function joined(...parts: string[]) {
  return parts.filter(Boolean).join(' · ')
}

function entryLines(type: Section['type'], entry: Entry, template: ResumeTemplate): string[] {
  const d = entry.data
  const date = dateRange(d)
  const layout = template.atsProfile.dateLayout
  const glyph = template.atsProfile.bulletGlyph
  const bullets = list(d, 'bullets').map((bullet) => `${glyph} ${bullet}`)

  switch (type) {
    case 'summary':
      return [str(d, 'text')]
    case 'experience':
      return [
        titleWithDate(str(d, 'role'), date, layout),
        joined(str(d, 'organisation'), str(d, 'location')),
        ...bullets,
      ]
    case 'education':
      return [
        titleWithDate(str(d, 'degree'), date, layout),
        joined(str(d, 'organisation'), str(d, 'location')),
        str(d, 'grade'),
        list(d, 'coursework').join(', '),
      ]
    case 'projects':
      return [
        titleWithDate(str(d, 'name'), date, layout),
        list(d, 'stack').join(', '),
        str(d, 'url'),
        ...bullets,
      ]
    case 'skills': {
      const items = list(d, 'items').join(', ')
      const group = str(d, 'group')
      return [group ? `${group}: ${items}` : items]
    }
    case 'certifications':
      return [titleWithDate(str(d, 'name'), date, layout), str(d, 'issuer')]
    case 'achievements':
      return [titleWithDate(str(d, 'title'), date, layout), str(d, 'detail')]
    case 'languages':
      return [str(d, 'level') ? `${str(d, 'name')} (${str(d, 'level')})` : str(d, 'name')]
    case 'publications':
      return [str(d, 'title'), titleWithDate(str(d, 'venue'), date, layout)]
    case 'references':
      return [str(d, 'name'), joined(str(d, 'role'), str(d, 'organisation')), str(d, 'contact')]
    default:
      return [titleWithDate(str(d, 'title'), date, layout), str(d, 'subtitle'), ...bullets]
  }
}

function sectionLines(section: Section, template: ResumeTemplate): string[] {
  return [
    '',
    section.title,
    ...section.entries.flatMap((entry) => entryLines(section.type, entry, template)),
  ].filter((line, index) => index === 0 || line.trim() !== '')
}

// what a line-oriented extractor reads; two columns interleave on purpose, as a sidebar does (code 433)
export function serializeToParserView(resume: Partial<Resume>, template: ResumeTemplate): string {
  const shaped = toTemplateResume(resume)
  const head = [shaped.personal.fullName, shaped.personal.headline, contactLine(shaped.personal)]
    .map((line) => line.trim())
    .filter(Boolean)

  if (template.atsProfile.columns === 1) {
    const body = shaped.sections.flatMap((section) => sectionLines(section, template))
    return [...head, ...body].join('\n').trim()
  }

  const main = shaped.sections
    .filter((section) => slotFor(section.type, template) === 'main')
    .flatMap((section) => sectionLines(section, template))
  const aside = shaped.sections
    .filter((section) => slotFor(section.type, template) === 'aside')
    .flatMap((section) => sectionLines(section, template))

  const rows = Array.from({ length: Math.max(main.length, aside.length) }, (_, i) =>
    [main[i] ?? '', aside[i] ?? ''].filter((part) => part.trim()).join('      ')
  )
  return [...head, ...rows].join('\n').trim()
}

// ---------------------------------------------------------------- A-GATE

function hexToLab(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const raw = match[1]!.length === 3 ? [...match[1]!].map((c) => c + c).join('') : match[1]!
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(raw.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIE76 distance between two hex colours; Infinity when either cannot be read. */
export function deltaE(a: string, b: string): number {
  const la = hexToLab(a)
  const lb = hexToLab(b)
  if (!la || !lb) return Infinity
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

// under 6pt, or within delta-E 10 of every surface it could sit on, so light text on a dark band passes
export function hiddenText(resume: Partial<Resume>, template: ResumeTemplate): string[] {
  const theme = resolveTheme(DesignSchema.parse(resume.design ?? {}))
  const nodes = template.render({ resume: toTemplateResume(resume), theme })

  const surfaces = new Set<string>([theme.paper])
  const collect = (list: LayoutNode[]) => {
    for (const node of list) {
      if ('style' in node && node.style?.backgroundColor) surfaces.add(node.style.backgroundColor)
      if ('children' in node) collect(node.children)
    }
  }
  collect(nodes)

  const reasons: string[] = []
  const walk = (list: LayoutNode[], color: string, size: number) => {
    for (const node of list) {
      const style = 'style' in node ? node.style : undefined
      const nextColor = style?.color ?? color
      const nextSize = style?.fontSize ?? size
      if (node.type === 'text' && node.value.trim()) {
        if (nextSize < 6) reasons.push(`"${node.value.slice(0, 40)}" is set below 6pt`)
        else if ([...surfaces].every((surface) => deltaE(nextColor, surface) < 10)) {
          reasons.push(`"${node.value.slice(0, 40)}" is the same colour as the page`)
        }
      }
      if ('children' in node) walk(node.children, nextColor, nextSize)
    }
  }
  walk(nodes, theme.ink, theme.bodySize)
  return reasons
}
