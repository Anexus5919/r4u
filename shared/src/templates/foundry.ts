import { compact, contactLine, spacer, stack, text, tracking } from '../layout/helpers.js'
import type { LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

// FOUNDRY. the ATS-safe default. one column, rule BELOW each head, dates right
function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.1

  const header = stack({ marginBottom: theme.sectionGap }, [
    ...compact([
      personal.fullName
        ? text(
            {
              fontFamily: theme.serif,
              fontSize: nameSize,
              color: theme.ink,
              textTransform: 'uppercase',
              letterSpacing: tracking(nameSize, 0.05),
            },
            personal.fullName
          )
        : null,

      personal.headline
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 1.05,
              color: theme.muted,
              marginTop: theme.bodySize * 0.3,
            },
            personal.headline
          )
        : null,

      // in the body flow: contact in a page header is code 311 and invisible to most parsers
      contactLine(personal)
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.92,
              color: theme.muted,
              marginTop: theme.bodySize * 0.5,
            },
            contactLine(personal)
          )
        : null,
    ]),
  ])

  const sections = resume.sections.map((section) =>
    stack({ marginBottom: theme.sectionGap }, [
      sectionHead(theme, section.title, 'rule-below'),
      ...section.entries.map((entry) =>
        renderEntry(theme, section.type, entry, { dates: 'right' })
      ),
    ])
  )

  return [header, ...sections, spacer(0)]
}

export const foundry: ResumeTemplate = {
  key: 'foundry',
  name: 'Foundry',
  category: 'Standard',
  audience: 'Everyone. The safest choice when a machine reads it first.',
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
      'summary',
      'experience',
      'projects',
      'education',
      'skills',
      'certifications',
      'achievements',
      'languages',
      'publications',
      'references',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
  suitedTo: ['professional', 'technical', 'fresher'],
  render,
}
