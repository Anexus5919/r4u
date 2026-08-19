import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { TRACKING_CAP, resolveTheme, toTemplateResume } from '../layout/helpers.js'
import { ResumeBase } from '../resume/schema.js'
import type { LayoutNode } from '../layout/types.js'
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

  /*
    The collision between severe editorial minimalism and ATS parsing, resolved structurally.
    Measured, extraction breaks around 0.10, where EXPERIENCE comes back as E X P E R I E N C E
    and the parser stops recognising the heading. Every template routes tracking through the
    tracking() helper, and this proves none of them found a way around it.
  */
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
})

/*
  The exit criterion for this phase. A template switch that can silently drop a section is the
  worst bug this product could ship, so every ordered pair is checked, not a sample.
*/
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

  /*
    Anything absent from both slot lists falls into main. Without that default a section has no
    destination in a two-column template and either duplicates into both or vanishes.
  */
  it('gives every section type a column', () => {
    for (const template of TEMPLATE_LIST) {
      for (const section of resume.sections) {
        expect(['main', 'aside']).toContain(slotFor(section.type, template))
      }
    }
  })
})
