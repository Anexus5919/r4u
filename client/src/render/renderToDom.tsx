import { PT_TO_PX } from '@r4u/shared'
import type { LayoutNode, Style } from '@r4u/shared'

// DOM adapter: AST lengths are pt, converted to px; no Tailwind. see ADR-002

const px = (value: number) => `${value * PT_TO_PX}px`

const LENGTHS = [
  'gap',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'fontSize',
  'letterSpacing',
  'borderTopWidth',
  'borderBottomWidth',
  'width',
  'maxWidth',
] as const

function toCss(style: Style = {}): React.CSSProperties {
  const css: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue

    if ((LENGTHS as readonly string[]).includes(key)) {
      // a percentage passes straight through; only points need converting
      css[key] = typeof value === 'number' ? px(value) : value
      continue
    }

    if (key === 'borderColor') {
      css.borderTopColor = value
      css.borderBottomColor = value
      continue
    }

    css[key] = value
  }

  // Yoga defaults flexShrink to 0 and the DOM to 1, so a declared width must not yield to a sibling
  if (style.width !== undefined && style.flexShrink === undefined) css.flexShrink = 0

  // Yoga lays out in flex by default, so the DOM has to be told the same thing
  css.display = css.display ?? 'flex'
  css.flexDirection = css.flexDirection ?? 'column'
  css.borderStyle = 'solid'
  css.borderTopWidth = css.borderTopWidth ?? 0
  css.borderBottomWidth = css.borderBottomWidth ?? 0
  css.borderLeftWidth = 0
  css.borderRightWidth = 0
  css.minWidth = 0

  return css as React.CSSProperties
}

function textCss(style: Style = {}): React.CSSProperties {
  return {
    ...toCss(style),
    display: 'block',
    // rag right always: the measure is long and the vocabulary full of unbreakable technology names
    textAlign: style.textAlign ?? 'left',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  }
}

export function renderToDom(nodes: LayoutNode[], keyPrefix = 'n'): React.ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`

    switch (node.type) {
      case 'text':
        return (
          <span key={key} style={textCss(node.style)}>
            {node.value}
          </span>
        )

      case 'rule':
        return <div key={key} style={{ ...toCss(node.style), width: '100%' }} />

      case 'spacer':
        return <div key={key} style={{ height: px(node.size), flexShrink: 0 }} />

      // painted against the page padding box, so it bleeds past the margin on all four edges
      case 'ground': {
        const { width, backgroundColor } = toCss(node.style)
        return (
          <div
            key={key}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width, backgroundColor }}
          />
        )
      }

      case 'block':
        return (
          // the DOM equivalent of wrap={false}: an entry never splits across a page
          <div key={key} style={{ ...toCss(node.style), breakInside: 'avoid' }}>
            {renderToDom(node.children, key)}
          </div>
        )

      case 'row':
      case 'stack':
      default:
        return (
          <div key={key} style={toCss(node.style)}>
            {renderToDom(node.children, key)}
          </div>
        )
    }
  })
}
