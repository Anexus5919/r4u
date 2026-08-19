import {
  block,
  compact,
  dateRange,
  list,
  row,
  rule,
  stack,
  str,
  text,
  tracking,
} from '../layout/helpers.js'
import type { DocTheme, LayoutNode, TemplateResume } from '../layout/types.js'

/*
  Entry renderers shared by every template.

  The eight templates differ on five structural axes: columns, header treatment, divider system,
  section-head placement and density. They do not differ on what a job entry contains, so that
  lives here once and a template that reimplements it is a template that will drift.
*/

type Entry = TemplateResume['sections'][number]['entries'][number]

export interface BlockOptions {
  /** right-aligned dates, or inline under the title */
  dates?: 'right' | 'inline'
  bulletGlyph?: string
}

const HANGING_INDENT = 11.3 // 4mm

/*
  A bullet is a row, not a list marker. The glyph sits in its own fixed column so wrapped lines
  align under the text rather than under the marker, which is the hanging indent a typeset resume
  has and a word-processed one does not.
*/
export function bullets(theme: DocTheme, items: string[], glyph = '•'): LayoutNode[] {
  return items.map((item) =>
    row({ gap: 0, marginTop: theme.bodySize * 0.35 }, [
      text(
        {
          width: HANGING_INDENT,
          fontSize: theme.bodySize,
          lineHeight: theme.leading,
          color: theme.muted,
        },
        glyph
      ),
      text(
        {
          flexGrow: 1,
          flexShrink: 1,
          fontSize: theme.bodySize,
          lineHeight: theme.leading,
          color: theme.ink,
        },
        item
      ),
    ])
  )
}

function titleRow(
  theme: DocTheme,
  left: string,
  right: string,
  options: BlockOptions
): LayoutNode | null {
  if (!left && !right) return null

  if (options.dates === 'inline' || !right) {
    return text({ fontSize: theme.bodySize, fontWeight: 600, color: theme.ink }, left)
  }

  return row({ justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }, [
    text({ flexGrow: 1, fontSize: theme.bodySize, fontWeight: 600, color: theme.ink }, left),
    text({ fontSize: theme.bodySize * 0.92, color: theme.muted, fontFamily: theme.sans }, right),
  ])
}

function subtitleRow(theme: DocTheme, parts: string[]): LayoutNode | null {
  const value = parts.filter(Boolean).join('  ·  ')
  if (!value) return null

  return text(
    {
      fontSize: theme.bodySize * 0.94,
      color: theme.muted,
      fontFamily: theme.sans,
      marginTop: theme.bodySize * 0.2,
    },
    value
  )
}

export function experienceEntry(
  theme: DocTheme,
  entry: Entry,
  options: BlockOptions = {}
): LayoutNode {
  const data = entry.data
  const dates = dateRange(data)

  return block({ marginTop: theme.bodySize * 0.9 }, [
    ...compact([
      titleRow(theme, str(data, 'role'), dates, options),
      subtitleRow(theme, [
        str(data, 'organisation'),
        str(data, 'location'),
        options.dates === 'inline' ? dates : '',
      ]),
    ]),
    ...bullets(theme, list(data, 'bullets'), options.bulletGlyph),
  ])
}

export function educationEntry(
  theme: DocTheme,
  entry: Entry,
  options: BlockOptions = {}
): LayoutNode {
  const data = entry.data
  const dates = dateRange(data)

  return block({ marginTop: theme.bodySize * 0.9 }, [
    ...compact([
      titleRow(theme, str(data, 'degree'), dates, options),
      subtitleRow(theme, [
        str(data, 'organisation'),
        str(data, 'location'),
        str(data, 'grade'),
        options.dates === 'inline' ? dates : '',
      ]),
    ]),
    ...bullets(theme, list(data, 'coursework').length ? [list(data, 'coursework').join(', ')] : []),
  ])
}

export function projectEntry(
  theme: DocTheme,
  entry: Entry,
  options: BlockOptions = {}
): LayoutNode {
  const data = entry.data
  const stack_ = list(data, 'stack')

  return block({ marginTop: theme.bodySize * 0.9 }, [
    ...compact([
      titleRow(theme, str(data, 'name'), dateRange(data), options),
      subtitleRow(theme, [stack_.join(', '), str(data, 'url')]),
    ]),
    ...bullets(theme, list(data, 'bullets'), options.bulletGlyph),
  ])
}

/*
  Groups on one line each. Never a rating bar, never a set of dots: both are unparseable by every
  ATS and neither is a claim anyone can verify.
*/
export function skillsEntry(theme: DocTheme, entry: Entry): LayoutNode {
  const group = str(entry.data, 'group')
  const items = list(entry.data, 'items')
  if (!items.length) return { type: 'spacer', size: 0 }

  return block({ marginTop: theme.bodySize * 0.45 }, [
    row({ gap: 6, alignItems: 'baseline' }, [
      ...compact([
        group
          ? text(
              {
                width: '28%',
                fontSize: theme.bodySize,
                fontWeight: 600,
                color: theme.ink,
              },
              group
            )
          : null,
        text(
          {
            flexGrow: 1,
            flexShrink: 1,
            fontSize: theme.bodySize,
            lineHeight: theme.leading,
            color: theme.ink,
          },
          items.join(', ')
        ),
      ]),
    ]),
  ])
}

export function simpleEntry(theme: DocTheme, entry: Entry, options: BlockOptions = {}): LayoutNode {
  const data = entry.data
  const title = str(data, 'name') || str(data, 'title') || str(data, 'degree')
  const detail = [
    str(data, 'issuer'),
    str(data, 'venue'),
    str(data, 'organisation'),
    str(data, 'level'),
    str(data, 'role'),
    str(data, 'contact'),
    str(data, 'detail'),
    str(data, 'url'),
  ].filter(Boolean)

  return block({ marginTop: theme.bodySize * 0.55 }, [
    ...compact([titleRow(theme, title, dateRange(data), options), subtitleRow(theme, detail)]),
  ])
}

export function summaryEntry(theme: DocTheme, entry: Entry): LayoutNode {
  const value = str(entry.data, 'text')
  if (!value) return { type: 'spacer', size: 0 }

  return text({ fontSize: theme.bodySize, lineHeight: theme.leading, color: theme.ink }, value)
}

/** Dispatches an entry to the renderer its section type calls for. */
export function renderEntry(
  theme: DocTheme,
  type: string,
  entry: Entry,
  options: BlockOptions = {}
): LayoutNode {
  switch (type) {
    case 'summary':
      return summaryEntry(theme, entry)
    case 'experience':
      return experienceEntry(theme, entry, options)
    case 'education':
      return educationEntry(theme, entry, options)
    case 'projects':
      return projectEntry(theme, entry, options)
    case 'skills':
      return skillsEntry(theme, entry)
    default:
      return simpleEntry(theme, entry, options)
  }
}

/* ---------------------------------------------------------------- section heads

  Four divider systems, one per structural axis in TEMPLATES.md. A template picks one and never
  mixes them, which is what makes the eight read as eight designs rather than one recoloured.
*/

export type HeadStyle = 'rule-below' | 'rule-above' | 'rule-to-margin' | 'plain' | 'centered'

export function sectionHead(theme: DocTheme, title: string, style: HeadStyle): LayoutNode {
  const size = theme.bodySize * 0.92

  const label = text(
    {
      fontSize: size,
      fontFamily: theme.sans,
      fontWeight: 600,
      textTransform: 'uppercase',
      // routed through tracking(), so it can never exceed the extraction-safe cap
      letterSpacing: tracking(size, 0.08),
      color: theme.accent,
    },
    title
  )

  const hairline = rule({ borderTopWidth: 0.5, borderColor: theme.rule })

  switch (style) {
    case 'rule-below':
      return stack({ marginBottom: theme.bodySize * 0.5 }, [
        label,
        stack({ marginTop: theme.bodySize * 0.3 }, [hairline]),
      ])

    case 'rule-above':
      return stack({ marginBottom: theme.bodySize * 0.5 }, [
        hairline,
        stack({ marginTop: theme.bodySize * 0.35 }, [label]),
      ])

    case 'rule-to-margin':
      return row({ alignItems: 'center', gap: 8, marginBottom: theme.bodySize * 0.4 }, [
        label,
        stack({ flexGrow: 1 }, [hairline]),
      ])

    case 'centered':
      return stack({ marginBottom: theme.bodySize * 0.5, alignItems: 'center' }, [label])

    default:
      return stack({ marginBottom: theme.bodySize * 0.5 }, [label])
  }
}
