import { compact, contactLine, spacer, stack, text, tracking } from '../layout/helpers.js'
import type { LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

// QUIRE. freshers. no rules anywhere, low density, education first
function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.9

  const header = stack({ marginBottom: theme.sectionGap * 1.3 }, [
    ...compact([
      personal.fullName
        ? text({ fontFamily: theme.serif, fontSize: nameSize, color: theme.ink }, personal.fullName)
        : null,

      personal.headline
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize,
              color: theme.muted,
              marginTop: theme.bodySize * 0.4,
            },
            personal.headline
          )
        : null,

      contactLine(personal)
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.85,
              color: theme.muted,
              textTransform: 'uppercase',
              letterSpacing: tracking(theme.bodySize * 0.85, 0.08),
              marginTop: theme.bodySize * 0.8,
            },
            contactLine(personal)
          )
        : null,
    ]),
  ])

  // 18pt of air above each heading is the whole divider system
  const sections = resume.sections.map((section) =>
    stack({ marginBottom: theme.sectionGap * 1.3 }, [
      sectionHead(theme, section.title, 'plain'),
      ...section.entries.map((entry) =>
        renderEntry(theme, section.type, entry, { dates: 'right' })
      ),
    ])
  )

  return [header, ...sections, spacer(0)]
}

export const quire: ResumeTemplate = {
  key: 'quire',
  name: 'Quire',
  category: 'Standard',
  audience: 'Students and first jobs, where education is the strongest thing on the page.',
  atsSafe: 'safe',
  atsProfile: {
    columns: 1,
    hasTables: false,
    hasImages: false,
    headerFooterContent: false,
    bodyFont: 'Source Sans 3',
    bulletGlyph: '•',
    dateLayout: 'right',
    maxDimensionAScore: 30,
  },
  slots: {
    main: [
      'education',
      'projects',
      'skills',
      'experience',
      'achievements',
      'certifications',
      'summary',
      'languages',
      'publications',
      'references',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: [
    'education',
    'projects',
    'skills',
    'experience',
    'achievements',
    'certifications',
  ],
  suitedTo: ['fresher'],
  render,
}
