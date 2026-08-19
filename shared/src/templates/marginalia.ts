import {
  compact,
  contactLine,
  dateRange,
  row,
  spacer,
  stack,
  text,
  tracking,
} from '../layout/helpers.js'
import type { LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry } from './blocks.js'

/*
  MARGINALIA. Researchers, long chronologies, anyone with many short entries.

  Structural signature: a 26mm left rail. Section headings and entry dates hang in it,
  right-aligned against the body, and the content runs in a single column beside them. Headings
  are hung rather than stacked, which is the one layout in the set that does not put its heading
  above its content.

  ATS caution, and honestly so: a rail is a second column as far as a line-oriented extractor is
  concerned, so the dates can interleave with the headings. The linearised variant moves both
  back inline.
*/
const RAIL = 73.7 // 26mm

function railRow(theme: DocThemeShape, railText: string, body: LayoutNode[]): LayoutNode {
  return row({ gap: 14, alignItems: 'flex-start' }, [
    stack({ width: RAIL, alignItems: 'flex-end' }, [
      railText
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.85,
              color: theme.muted,
              textAlign: 'right',
            },
            railText
          )
        : spacer(0),
    ]),
    stack({ flexGrow: 1, flexShrink: 1 }, body),
  ])
}

type DocThemeShape = TemplateInput['theme']

function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.2

  const header = railRow(
    theme,
    '',
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

  const sections = resume.sections.map((section) => {
    const headSize = theme.bodySize * 0.92

    return stack({ marginBottom: theme.sectionGap }, [
      // the heading hangs in the rail rather than sitting above the content
      railRow(theme, '', [
        text(
          {
            fontFamily: theme.sans,
            fontSize: headSize,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: tracking(headSize, 0.08),
            color: theme.accent,
            marginBottom: theme.bodySize * 0.2,
          },
          section.title
        ),
      ]),

      ...section.entries.map((entry) =>
        railRow(theme, dateRange(entry.data), [
          renderEntry(theme, section.type, entry, { dates: 'none' }),
        ])
      ),
    ])
  })

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
