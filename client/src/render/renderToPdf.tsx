import { Document, Font, Page, Text, View, pdf } from '@react-pdf/renderer'
import type { Style as PdfStyle } from '@react-pdf/types'
import { getTemplate, resolveTheme, splitGrounds, toTemplateResume } from '@r4u/shared'
import type { LayoutNode, Resume, Style } from '@r4u/shared'

// the PDF half of "one layout AST, two adapters"; never imported eagerly, it is a large module

const TIMEOUT_MS = 10_000

const FAMILIES = [
  { family: 'Source Serif 4', file: 'SourceSerif4' },
  { family: 'Source Sans 3', file: 'SourceSans3' },
]

let registeredBase: string | null = null

/** Static per-weight TTFs only: a variable font renders every weight at 400 in react-pdf. */
export function registerFonts(base: string) {
  if (registeredBase === base) return
  registeredBase = base

  for (const { family, file } of FAMILIES) {
    Font.register({
      family,
      fonts: [
        { src: `${base}/${file}-Regular.ttf`, fontWeight: 400 },
        { src: `${base}/${file}-SemiBold.ttf`, fontWeight: 600 },
        { src: `${base}/${file}-RegularItalic.ttf`, fontWeight: 400, fontStyle: 'italic' },
      ],
    })
  }

  // a hyphenated keyword is a missed keyword for a parser, so words never break
  Font.registerHyphenationCallback((word) => [word])
}

function pdfStyle(style: Style = {}): PdfStyle {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue
    if (key === 'borderColor') {
      out.borderTopColor = value
      out.borderBottomColor = value
      continue
    }
    out[key] = value
  }
  if (style.borderTopWidth) out.borderTopStyle = 'solid'
  if (style.borderBottomWidth) out.borderBottomStyle = 'solid'
  // yoga sizes a text-bearing node at max-content unless a fill item starts from a zero basis
  if (style.flexShrink === 1 && style.width === undefined) {
    out.flexBasis = 0
    out.flexGrow = style.flexGrow ?? 1
  }
  return out as PdfStyle
}

interface TextDefaults {
  fontSize: number
  lineHeight: number
}

// ligatures off: pdfkit maps an ff glyph back to one f, so a parser would read Sheffield as Shefield
const NO_LIGATURES = { liga: false, clig: false }

function textStyle(style: Style = {}, defaults: TextDefaults): PdfStyle {
  // a unitless lineHeight resolves against the node's own fontSize, so both are set on every Text
  return {
    fontSize: defaults.fontSize,
    lineHeight: defaults.lineHeight,
    fontFeatureSettings: NO_LIGATURES,
    ...pdfStyle(style),
  } as PdfStyle
}

function walk(nodes: LayoutNode[], text: TextDefaults, prefix = 'n'): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`
    switch (node.type) {
      case 'text':
        return (
          <Text key={key} style={textStyle(node.style, text)}>
            {node.value}
          </Text>
        )
      case 'rule':
        return <View key={key} style={{ ...pdfStyle(node.style), width: '100%' }} />
      case 'spacer':
        return <View key={key} style={{ height: node.size, flexShrink: 0 }} />
      case 'ground':
        // fixed repeats it on every page; absolute against the page box, as in the DOM adapter
        return (
          <View
            key={key}
            fixed
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: node.style?.width,
              backgroundColor: node.style?.backgroundColor,
            }}
          />
        )
      case 'block':
        // one job, one degree, one project: never split across an A4 boundary
        return (
          <View key={key} wrap={false} style={pdfStyle(node.style)}>
            {walk(node.children, text, key)}
          </View>
        )
      case 'row':
      case 'stack':
      default:
        return (
          <View key={key} style={pdfStyle(node.style)}>
            {walk(node.children, text, key)}
          </View>
        )
    }
  })
}

const DEFAULT_DESIGN = {
  accent: '',
  typeScale: 10.5,
  leading: 1.35,
  sectionSpacing: 'normal' as const,
  margins: 20,
}

export function ResumeDocument({ resume }: { resume: Partial<Resume> }) {
  const template = getTemplate(resume.templateKey ?? 'foundry')
  const theme = resolveTheme(resume.design ?? DEFAULT_DESIGN)
  const { grounds, flow } = splitGrounds(
    template.render({ resume: toTemplateResume(resume), theme })
  )
  const name = resume.personal?.fullName ?? ''
  const text: TextDefaults = { fontSize: theme.bodySize, lineHeight: theme.leading }

  return (
    <Document
      title={name ? `${name} resume` : (resume.title ?? 'Resume')}
      author={name}
      creator="R4U"
      producer="R4U"
    >
      <Page
        size="A4"
        style={{
          padding: theme.margin,
          fontFamily: theme.sans,
          fontSize: theme.bodySize,
          color: theme.ink,
          backgroundColor: theme.paper,
        }}
      >
        {walk(grounds, text, 'g')}
        <View>{walk(flow, text)}</View>
      </Page>
    </Document>
  )
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  // react-pdf issue 2659 can loop forever on some break combinations; never hang the tab
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('PDF rendering took too long')), TIMEOUT_MS)
    ),
  ])
}

export async function resumeToPdfBlob(resume: Partial<Resume>, fontBase?: string): Promise<Blob> {
  registerFonts(fontBase ?? `${window.location.origin}/fonts`)
  return withTimeout(pdf(<ResumeDocument resume={resume} />).toBlob())
}

export function pdfFileName(resume: Partial<Resume>) {
  const base = resume.personal?.fullName || resume.title || 'resume'
  return `${base.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'resume'}.pdf`
}

/** Renders and saves the file, with a real text layer the ATS parsers can read. */
export async function downloadResumePdf(resume: Partial<Resume>) {
  const blob = await resumeToPdfBlob(resume)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = pdfFileName(resume)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
