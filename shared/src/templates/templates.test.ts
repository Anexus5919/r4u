import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { TRACKING_CAP, dateRange, resolveTheme, toTemplateResume } from '../layout/helpers.js'
import { SECTION_REGISTRY, SECTION_TYPES } from '../resume/sections.js'
import { ResumeBase } from '../resume/schema.js'
import type { SectionType } from '../resume/sections.js'
import type { LayoutNode } from '../layout/types.js'
import { RAIL } from './marginalia.js'
import { TEMPLATE_LIST, reorderForTemplate, slotFor, wouldReorder } from './index.js'

const resume = ResumeBase.parse(SAMPLE_RESUME)
const theme = resolveTheme(resume.design)

function renderWith(key: string): LayoutNode[] {
  const template = TEMPLATE_LIST.find((t) => t.key === key)!
  return template.render({ resume: toTemplateResume(resume), theme })
}

function walk(nodes: LayoutNode[], visit: (node: LayoutNode) => void): void {
  for (const node of nodes) {
    visit(node)
    if ('children' in node && node.children) walk(node.children, visit)
  }
}

function textOf(nodes: LayoutNode[]): string[] {
  const out: string[] = []
  walk(nodes, (node) => {
    if (node.type === 'text') out.push(node.value)
  })
  return out
}

describe.each(TEMPLATE_LIST.map((t) => t.key))('template %s', (key) => {
  const nodes = renderWith(key)

  it('renders without throwing and produces text', () => {
    expect(nodes.length).toBeGreaterThan(0)
    expect(textOf(nodes).length).toBeGreaterThan(5)
  })

  it('renders the name and contact details', () => {
    const all = textOf(nodes).join(' ')

    expect(all).toContain('Alex Mercer')
    expect(all).toContain('alex.mercer@example.com')
  })

  // editorial minimalism against ATS parsing: past about 0.10 the parser loses the heading
  it('never exceeds the extraction-safe letter-spacing cap', () => {
    walk(nodes, (node) => {
      const style = node.style
      if (!style?.letterSpacing || !style.fontSize) return

      expect(style.letterSpacing / style.fontSize).toBeLessThanOrEqual(TRACKING_CAP + 1e-9)
    })
  })

  it('never renders a hidden section', () => {
    // the fixture ships certifications hidden, so this exercises the real path
    expect(textOf(nodes).join(' ')).not.toContain('Certified Kubernetes Administrator')
  })

  it('never renders the private notes field', () => {
    const withNotes = { ...resume, notes: 'NEVER-RENDER-THIS-STRING' }
    const template = TEMPLATE_LIST.find((t) => t.key === key)!
    const rendered = template.render({ resume: toTemplateResume(withNotes), theme })

    expect(textOf(rendered).join(' ')).not.toContain('NEVER-RENDER-THIS-STRING')
  })

  it('uses no style property outside the browser and yoga intersection', () => {
    const banned = ['display', 'float', 'position', 'boxShadow', 'textShadow', 'backgroundImage']

    walk(nodes, (node) => {
      for (const property of banned) {
        expect(node.style && property in node.style, `${key} used ${property}`).toBeFalsy()
      }
    })
  })

  it('survives a resume with nothing in it', () => {
    const template = TEMPLATE_LIST.find((t) => t.key === key)!
    expect(() => template.render({ resume: toTemplateResume({}), theme })).not.toThrow()
  })
})

// the net for "the editor accepted it and no template printed it", which section counts miss
describe('field coverage', () => {
  const expected: string[] = []
  let markers = 0
  let year = 2011

  const sections = SECTION_TYPES.map((type) => {
    const spec = SECTION_REGISTRY[type]
    const data: Record<string, unknown> = {}
    const dated = spec.fields.some((field) => field.type === 'month')

    for (const field of spec.fields) {
      if (field.type === 'boolean') continue

      if (field.type === 'month') {
        data[field.key] = field.key === 'startDate' ? `${year}-01` : `${year}-06`
        continue
      }

      markers += 1
      const marker = `Z${String(markers).padStart(2, '0')}`
      expected.push(marker)
      data[field.key] = field.type === 'bullets' || field.type === 'tags' ? [marker] : marker
    }

    if (dated) {
      expected.push(`Jan ${year}`)
      year += 1
    }

    return {
      type: type as SectionType,
      title: spec.label,
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [{ hidden: false, data }],
    }
  })

  const populated = toTemplateResume({ ...resume, sections })

  it.each(TEMPLATE_LIST.map((t) => t.key))('%s prints every field a section declares', (key) => {
    const template = TEMPLATE_LIST.find((t) => t.key === key)!
    const rendered = textOf(template.render({ resume: populated, theme })).join(' | ')

    for (const marker of expected) {
      expect(rendered, `${key} dropped ${marker}`).toContain(marker)
    }
  })
})

describe('dates', () => {
  it('keeps an end date that has no start date', () => {
    // certifications map Expires to endDate and leave Issued optional, so this shape is legal
    expect(dateRange({ endDate: '2027-03' })).toBe('Until Mar 2027')
    expect(dateRange({})).toBe('')
  })
})

describe('empty sections', () => {
  it('never emits a heading with nothing under it', () => {
    const withEmpty = {
      ...resume,
      sections: [
        ...resume.sections,
        {
          type: 'languages' as const,
          title: 'Languages',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [],
        },
      ],
    }

    const shaped = toTemplateResume(withEmpty)

    // Textkernel raises code 324 for a header with no content, so it never reaches the page
    expect(shaped.sections.some((section) => section.type === 'languages')).toBe(false)
  })

  // one click on "Add summary" is exactly this shape, and the entry count cannot see it
  it('drops a section whose only entry is blank', () => {
    const withBlank = {
      ...resume,
      sections: [
        {
          type: 'summary' as const,
          title: 'Summary',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [{ hidden: false, data: { text: '   ' } }],
        },
        {
          type: 'experience' as const,
          title: 'Work Experience',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          // a date and nothing else is not content
          entries: [{ hidden: false, data: { startDate: '2021-06', current: true } }],
        },
      ],
    }

    const shaped = toTemplateResume(withBlank)
    expect(shaped.sections).toHaveLength(0)

    for (const template of TEMPLATE_LIST) {
      const rendered = textOf(template.render({ resume: shaped, theme })).join(' ')
      expect(rendered, `${template.key} kept a bare heading`).not.toContain('Work Experience')
    }
  })
})

describe('structure the two adapters have to agree on', () => {
  // a childless filled box under flex-start resolves to zero height and paints nothing
  it.each(TEMPLATE_LIST.map((t) => t.key))(
    '%s can paint every filled divider it declares',
    (key) => {
      walk(renderWith(key), (node) => {
        if (node.type !== 'row' || !node.children) return

        for (const child of node.children) {
          const filled =
            'children' in child && child.children?.length === 0 && child.style?.backgroundColor

          if (!filled) continue
          expect(node.style?.alignItems, `${key} divider cannot get a height`).toBe('stretch')
          expect(child.style?.flexGrow, `${key} divider absorbs the free space`).toBeUndefined()
        }
      })
    }
  )

  // a nested ground positions against the wrong box in the DOM and pushes the PDF sideways
  it.each(TEMPLATE_LIST.map((t) => t.key))('%s emits grounds only at the top level', (key) => {
    const nodes = renderWith(key)

    for (const node of nodes) {
      if (!('children' in node) || !node.children) continue
      walk(node.children, (child) => {
        expect(child.type, `${key} nested a ground`).not.toBe('ground')
      })
    }
  })

  it('hangs marginalia section heads in the rail', () => {
    const railed: string[] = []

    walk(renderWith('marginalia'), (node) => {
      if (node.type !== 'stack' || node.style?.width !== RAIL) return
      walk(node.children, (child) => {
        if (child.type === 'text') railed.push(child.value)
      })
    })

    for (const section of toTemplateResume(resume).sections) {
      expect(railed, `${section.title} is not in the rail`).toContain(section.title)
    }
  })
})

// every ordered pair, not a sample: a switch that drops a section is the worst bug here
describe('switching between templates', () => {
  const pairs = TEMPLATE_LIST.flatMap((from) =>
    TEMPLATE_LIST.filter((to) => to.key !== from.key).map((to) => [from.key, to.key] as const)
  )

  it.each(pairs)('%s to %s keeps every section exactly once', (_from, to) => {
    const template = TEMPLATE_LIST.find((t) => t.key === to)!
    const next = reorderForTemplate(resume.sections, template)

    expect(next).toHaveLength(resume.sections.length)

    const before = resume.sections.map((s) => s.type).sort()
    const after = next.map((s) => s.type).sort()
    expect(after).toEqual(before)
  })

  it('keeps a section the template never mentions', () => {
    const template = TEMPLATE_LIST[0]!
    const exotic = [
      { type: 'custom' as const },
      { type: 'experience' as const },
      { type: 'publications' as const },
    ]

    const next = reorderForTemplate(exotic, template)

    expect(next).toHaveLength(3)
    expect(next.map((s) => s.type)).toContain('custom')
    expect(next.map((s) => s.type)).toContain('publications')
  })

  it('reports whether a switch would actually change the order', () => {
    const template = TEMPLATE_LIST.find((t) => t.key === 'quire')!
    const ordered = reorderForTemplate(resume.sections, template)

    expect(wouldReorder(ordered, template)).toBe(false)
  })

  // without the main default a section has no destination in a two-column template
  it('gives every section type a column', () => {
    for (const template of TEMPLATE_LIST) {
      for (const section of resume.sections) {
        expect(['main', 'aside']).toContain(slotFor(section.type, template))
      }
    }
  })
})
