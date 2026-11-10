import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { Style as PdfStyle } from '@react-pdf/types'
import { getTemplate, resolveTheme, splitGrounds, toTemplateResume } from '@r4u/shared'
import type { LayoutNode, Resume, Style } from '@r4u/shared'

// the layout AST drawn as react-pdf primitives; fonts are registered by renderToPdf.tsx

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
