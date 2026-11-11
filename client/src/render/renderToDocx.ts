import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx'
import { deltaE, getTemplate, resolveTheme, splitGrounds, toTemplateResume } from '@r4u/shared'
import type { DocTheme, LayoutNode, Resume, Style } from '@r4u/shared'

// the third adapter over the one layout tree: same template, written as a single-column Word file

export interface RunSpec {
  text: string
  size: number
  bold: boolean
  italics: boolean
  caps: boolean
  color: string
  font: 'sans' | 'serif'
  tab?: boolean
}

export interface ParaSpec {
  runs: RunSpec[]
  align: 'left' | 'center' | 'right'
  before: number
  after: number
  border?: { color: string; size: number }
}

interface Inherited {
  fontSize: number
  color: string
  bold: boolean
  italics: boolean
  caps: boolean
  font: 'sans' | 'serif'
}

// a Word file has no full-bleed ground, so light text meant for a dark band would vanish on paper
function readable(color: string | undefined, theme: DocTheme): string {
  const value = color ?? theme.ink
  return deltaE(value, theme.paper) < 25 ? theme.ink : value
}

function inherit(style: Style | undefined, base: Inherited, theme: DocTheme): Inherited {
  if (!style) return base
  return {
    fontSize: style.fontSize ?? base.fontSize,
    color: style.color ? readable(style.color, theme) : base.color,
    bold: style.fontWeight ? style.fontWeight >= 600 : base.bold,
    italics: style.fontStyle ? style.fontStyle === 'italic' : base.italics,
    caps: style.textTransform ? style.textTransform === 'uppercase' : base.caps,
    font: style.fontFamily ? (style.fontFamily === theme.serif ? 'serif' : 'sans') : base.font,
  }
}

const space = (style?: Style) => ({
  before: (style?.marginTop ?? 0) + (style?.paddingTop ?? 0),
  after: (style?.marginBottom ?? 0) + (style?.paddingBottom ?? 0),
})

function textParagraph(value: string, style: Style | undefined, at: Inherited): ParaSpec {
  return {
    runs: [
      {
        text: value,
        size: at.fontSize,
        bold: at.bold,
        italics: at.italics,
        caps: at.caps,
        color: at.color,
        font: at.font,
      },
    ],
    align: style?.textAlign ?? 'left',
    ...space(style),
  }
}

const textCount = (node: LayoutNode): number =>
  node.type === 'text'
    ? 1
    : 'children' in node
      ? node.children.reduce((n, c) => n + textCount(c), 0)
      : 0

// the main column is the one that grows; a sidebar has a fixed width
function mainFirst(children: LayoutNode[]): LayoutNode[] {
  const fixed = (node: LayoutNode) =>
    'style' in node && node.style?.width !== undefined && !node.style?.flexGrow
  return [...children.filter((c) => !fixed(c)), ...children.filter(fixed)]
}

function paragraphs(nodes: LayoutNode[], at: Inherited, theme: DocTheme): ParaSpec[] {
  const out: ParaSpec[] = []
  let pending = 0

  const push = (list: ParaSpec[]) => {
    if (!list.length) return
    list[0] = { ...list[0]!, before: list[0]!.before + pending }
    pending = 0
    out.push(...list)
  }

  for (const node of nodes) {
    switch (node.type) {
      case 'ground':
        break
      case 'spacer':
        pending += node.size
        break
      case 'text':
        if (node.value.trim())
          push([textParagraph(node.value, node.style, inherit(node.style, at, theme))])
        break
      case 'rule': {
        const width = node.style?.borderBottomWidth ?? node.style?.borderTopWidth ?? 0.75
        push([
          {
            runs: [],
            align: 'left',
            ...space(node.style),
            border: { color: node.style?.borderColor ?? theme.rule, size: width },
          },
        ])
        break
      }
      case 'row':
        push(row(node, inherit(node.style, at, theme), theme))
        break
      default: {
        const inner = paragraphs(node.children, inherit(node.style, at, theme), theme)
        const { before, after } = space(node.style)
        if (inner.length) {
          inner[0] = { ...inner[0]!, before: inner[0]!.before + before }
          inner[inner.length - 1] = {
            ...inner[inner.length - 1]!,
            after: inner[inner.length - 1]!.after + after,
          }
        }
        push(inner)
      }
    }
  }
  return out
}

function row(
  node: Extract<LayoutNode, { type: 'row' }>,
  at: Inherited,
  theme: DocTheme
): ParaSpec[] {
  const children = node.children.filter((c) => c.type !== 'ground' && c.type !== 'spacer')

  // two real columns: written one after the other, main first, which is what makes it parse
  if (children.length > 1 && children.some((c) => textCount(c) > 4)) {
    return paragraphs(mainFirst(children), at, theme)
  }

  const parts = children.map((child) => paragraphs([child], at, theme)).filter((p) => p.length)
  if (parts.length <= 1) return parts[0] ?? []

  // an entry line: left parts joined, the last part behind a right tab, the way Word aligns dates
  const tabbed = node.style?.justifyContent === 'space-between'
  const firstLine = parts.flatMap((part, i) => {
    const runs = part[0]!.runs
    if (i === 0) return runs
    const lead: RunSpec = {
      ...runs[0]!,
      text: tabbed && i === parts.length - 1 ? '' : ' ',
      tab: tabbed && i === parts.length - 1,
    }
    return runs.length ? [lead, ...runs] : runs
  })
  const { before, after } = space(node.style)
  return [
    {
      runs: firstLine,
      align: 'left',
      before: before + parts[0]![0]!.before,
      after: parts.length ? after : 0,
    },
    ...parts.flatMap((part) => part.slice(1)),
  ]
}

const DEFAULT_DESIGN = {
  accent: '',
  typeScale: 10.5,
  leading: 1.35,
  sectionSpacing: 'normal' as const,
  margins: 20,
}

/** The layout tree flattened to Word paragraphs; pure, so it is tested without building a file. */
export function resumeToParagraphs(resume: Partial<Resume>): {
  theme: DocTheme
  paragraphs: ParaSpec[]
} {
  const template = getTemplate(resume.templateKey ?? 'foundry')
  const theme = resolveTheme(resume.design ?? DEFAULT_DESIGN)
  const { flow } = splitGrounds(template.render({ resume: toTemplateResume(resume), theme }))
  const base: Inherited = {
    fontSize: theme.bodySize,
    color: theme.ink,
    bold: false,
    italics: false,
    caps: false,
    font: 'sans',
  }
  return { theme, paragraphs: paragraphs(flow, base, theme) }
}

const twips = (points: number) => Math.round(points * 20)
const hex = (color: string) => color.replace('#', '').toUpperCase()
const A4_WIDTH_TWIPS = 11906
// Calibri and Cambria are on the rubric's safe list and installed wherever Word is
const FACE = { sans: 'Calibri', serif: 'Cambria' }

export async function resumeToDocxBlob(resume: Partial<Resume>): Promise<Blob> {
  const { theme, paragraphs: specs } = resumeToParagraphs(resume)
  const margin = twips(theme.margin)
  const right = A4_WIDTH_TWIPS - margin * 2
  const name = resume.personal?.fullName ?? ''

  const doc = new Document({
    creator: 'R4U',
    title: name ? `${name} resume` : (resume.title ?? 'Resume'),
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: 16838 },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        children: specs.map(
          (spec) =>
            new Paragraph({
              alignment:
                spec.align === 'center'
                  ? AlignmentType.CENTER
                  : spec.align === 'right'
                    ? AlignmentType.RIGHT
                    : AlignmentType.LEFT,
              spacing: {
                before: twips(spec.before),
                after: twips(spec.after),
                line: Math.round(theme.leading * 240),
              },
              tabStops: [{ type: TabStopType.RIGHT, position: right }],
              border: spec.border
                ? {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: Math.max(2, Math.round(spec.border.size * 8)),
                      color: hex(spec.border.color),
                      space: 1,
                    },
                  }
                : undefined,
              children: spec.runs.map((run) =>
                run.tab
                  ? new TextRun({ children: [new Tab()] })
                  : new TextRun({
                      text: run.text,
                      size: Math.round(run.size * 2),
                      bold: run.bold,
                      italics: run.italics,
                      allCaps: run.caps,
                      color: hex(run.color),
                      font: FACE[run.font],
                    })
              ),
            })
        ),
      },
    ],
  })
  return Packer.toBlob(doc)
}

export function docxFileName(resume: Partial<Resume>) {
  const base = resume.personal?.fullName || resume.title || 'resume'
  return `${base.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'resume'}.docx`
}

export async function downloadResumeDocx(resume: Partial<Resume>) {
  const blob = await resumeToDocxBlob(resume)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = docxFileName(resume)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
