import { compact, contactLine, dateRange, row, spacer, stack, text } from '../layout/helpers.js'
import type { DocTheme, LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

// MARGINALIA. a 26mm left rail carrying heads and dates. caution: a rail reads as a column
/** 26mm. Exported so the test can assert the head really is in the rail and not beside it. */
export const RAIL = 73.7

function railRow(rail: LayoutNode | null, body: LayoutNode[]): LayoutNode {
  return row({ gap: 14, alignItems: 'flex-start' }, [
    stack({ width: RAIL, alignItems: 'flex-end' }, [rail ?? spacer(0)]),
    stack({ flexGrow: 1, flexShrink: 1 }, body),
  ])
}

function railDate(theme: DocTheme, value: string): LayoutNode | null {
  if (!value) return null

  return text(
    {
      fontFamily: theme.sans,
      fontSize: theme.bodySize * 0.85,
      color: theme.muted,
      textAlign: 'right',
    },
    value
  )
}

function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.2

  const header = railRow(
    null,
    compact([
      personal.fullName
        ? text({ fontFamily: theme.serif, fontSize: nameSize, color: theme.ink }, personal.fullName)
        : null,
      personal.headline
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize,
              color: theme.muted,
              marginTop: theme.bodySize * 0.25,
            },
            personal.headline
          )
        : null,
      contactLine(personal)
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.88,
              color: theme.muted,
              marginTop: theme.bodySize * 0.5,
            },
            contactLine(personal)
          )
        : null,
    ])
  )

  const sections = resume.sections.map((section) =>
    stack({ marginBottom: theme.sectionGap }, [
      // a row of its own: beside the first entry the head would share its extracted line, failing B4
      railRow(sectionHead(theme, section.title, 'rail'), []),

      ...section.entries.map((entry) =>
        railRow(railDate(theme, dateRange(entry.data)), [
          renderEntry(theme, section.type, entry, { dates: 'none' }),
        ])
      ),
    ])
  )

  return [stack({ marginBottom: theme.sectionGap }, [header]), ...sections, spacer(0)]
}

export const marginalia: ResumeTemplate = {
  key: 'marginalia',
  name: 'Marginalia',
  category: 'Editorial',
  audience: 'Long chronologies and many short entries, where dates carry the structure.',
  atsSafe: 'caution',
  atsProfile: {
    columns: 1,
    hasTables: false,
    hasImages: false,
    headerFooterContent: false,
    bodyFont: 'Source Sans 3',
    bulletGlyph: '•',
    dateLayout: 'rail',
    // the rail reads as a second column to a line-oriented extractor
    maxDimensionAScore: 24,
  },
  slots: {
    main: [
      'summary',
      'experience',
      'education',
      'projects',
      'publications',
      'achievements',
      'skills',
      'certifications',
      'languages',
      'references',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: [
    'summary',
    'experience',
    'education',
    'projects',
    'publications',
    'achievements',
    'skills',
  ],
  suitedTo: ['professional', 'academic'],
  render,
}
