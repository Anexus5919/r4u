import type { ResumeType, SectionType } from '../resume/sections.js'

/*
  One layout AST, two adapters.

  The hardest problem in a resume builder is template drift: the live HTML preview and the
  exported PDF are rendered by different engines, so they diverge and the user downloads
  something they did not see. Writing each template twice guarantees it.

  A template is a pure function to this node set. renderToDom walks it into divs, renderToPdf
  walks it into View and Text. Content drift becomes structurally impossible, and box drift is
  near zero because @react-pdf/renderer runs yoga-layout, the same Flexbox spec the browser does.
*/

/*
  The style vocabulary is the intersection of what a browser and Yoga both implement, and it is
  enforced by this type rather than by discipline.

  CSS Grid, float, text-shadow and background-image are absent on purpose: @react-pdf supports
  none of them, and a compile error is far cheaper than a silently different PDF.

  Every length is in points. The PDF renderer treats a bare number as pt, and the DOM adapter
  scales pt to px, so one number means one physical size in both.
*/
export interface Style {
  flexDirection?: 'row' | 'column'
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'baseline' | 'stretch'
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
  /*
    Capped at 0.08 x fontSize by the theme layer. Measured, extraction breaks around 0.10, where
    EXPERIENCE comes back as E X P E R I E N C E and the parser stops recognising the heading.
  */
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
  /*
    An atomic block that must not split across an A4 boundary: one job, one degree, one project.
    The PDF adapter maps it to wrap={false}; the DOM adapter uses break-inside: avoid.
  */
  | { type: 'block'; style?: Style; children: LayoutNode[] }

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
