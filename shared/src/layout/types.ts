import type { ResumeType, SectionType } from '../resume/sections.js'

// one layout AST, two adapters: renderToDom walks it to divs, renderToPdf to View and Text

// the browser and yoga intersection, typed rather than trusted: a compile error is cheaper
export interface Style {
  flexDirection?: 'row' | 'column'
  // no baseline: @react-pdf gives Text no baseline function, so yoga bottom-aligns instead
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  flexGrow?: number
  flexShrink?: number
  flexWrap?: 'wrap' | 'nowrap'
  width?: number | `${number}%`
  maxWidth?: number | `${number}%`
  gap?: number

  padding?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  margin?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number

  fontFamily?: string
  fontSize?: number
  fontWeight?: 400 | 600
  fontStyle?: 'normal' | 'italic'
  lineHeight?: number
  // capped at 0.08 x fontSize by the theme layer: extraction breaks around 0.10
  letterSpacing?: number
  textTransform?: 'uppercase' | 'lowercase' | 'none'
  textAlign?: 'left' | 'center' | 'right'
  color?: string

  backgroundColor?: string
  borderTopWidth?: number
  borderBottomWidth?: number
  borderColor?: string
}

export type LayoutNode =
  | { type: 'stack'; style?: Style; children: LayoutNode[] }
  | { type: 'row'; style?: Style; children: LayoutNode[] }
  | { type: 'text'; style?: Style; value: string }
  | { type: 'rule'; style?: Style }
  | { type: 'spacer'; size: number }
  // never split across an A4 boundary: wrap={false} in the PDF, break-inside avoid in the DOM
  | { type: 'block'; style?: Style; children: LayoutNode[] }
  // a full-bleed ground behind the page, left trim to right. stretch would stop at the content
  | { type: 'ground'; style?: Style }

/** The resolved document theme. Templates read this and never reach for a raw token. */
export interface DocTheme {
  serif: string
  sans: string
  mono: string

  /** body size in points, one of the five customisation knobs */
  bodySize: number
  leading: number
  /** vertical space between sections, in points */
  sectionGap: number
  /** page margin in points */
  margin: number
  /** A4 width in points, so a template can size a full-bleed ground against the trim */
  pageWidth: number

  ink: string
  muted: string
  rule: string
  accent: string
  paper: string
}

export interface AtsProfile {
  columns: 1 | 2
  hasTables: boolean
  hasImages: boolean
  headerFooterContent: boolean
  bodyFont: string
  bulletGlyph: string
  dateLayout: 'inline' | 'right' | 'rail'
  /** the most this template can score on dimension A of the rubric, out of 30 */
  maxDimensionAScore: number
}

export interface TemplateSlots {
  main: SectionType[]
  aside: SectionType[]
}

export interface ResumeTemplate {
  key: string
  name: string
  category: string
  /** one line, shown on the template card. says who it is for, not how it looks */
  audience: string
  atsSafe: 'safe' | 'caution' | 'unsafe'
  atsProfile: AtsProfile
  slots: TemplateSlots
  recommendedOrder: SectionType[]
  suitedTo: ResumeType[]
  render: (input: TemplateInput) => LayoutNode[]
}

export interface TemplateInput {
  resume: TemplateResume
  theme: DocTheme
}

/** What a template is allowed to see. Deliberately not the whole document: notes never render. */
export interface TemplateResume {
  personal: {
    fullName: string
    headline: string
    email: string
    phone: string
    location: string
    links: { label: string; url: string }[]
  }
  sections: {
    _id: string
    type: SectionType
    title: string
    entries: { _id: string; data: Record<string, unknown> }[]
  }[]
}

export const A4 = { width: 595.28, height: 841.89 } as const
export const PT_TO_PX = 96 / 72
