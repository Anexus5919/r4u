import { compact, contactLine, row, spacer, stack, text } from '../layout/helpers.js'
import type { LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

/*
  LEDGER. Senior, ten years or more, comfortable running to two pages.

  Structural signature: section headings sit INLINE with a hairline running from the end of the
  heading to the right margin. Density is tight throughout, and the header splits with the name
  left and contact stacked right, so the first line carries two pieces of information rather
  than one.
*/
function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 1.9
  const small = theme.bodySize * 0.85

  const contactStack = compact([
    personal.email
      ? text(
          { fontFamily: theme.sans, fontSize: small, color: theme.muted, textAlign: 'right' },
          personal.email
        )
      : null,
    personal.phone
      ? text(
          { fontFamily: theme.sans, fontSize: small, color: theme.muted, textAlign: 'right' },
          personal.phone
        )
      : null,
    personal.location
      ? text(
          { fontFamily: theme.sans, fontSize: small, color: theme.muted, textAlign: 'right' },
          personal.location
        )
      : null,
    personal.links.length
      ? text(
          { fontFamily: theme.sans, fontSize: small, color: theme.muted, textAlign: 'right' },
          personal.links.map((link) => link.url).join('  ·  ')
        )
      : null,
  ])

  const header = stack({ marginBottom: theme.sectionGap }, [
    row({ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }, [
      stack({ flexGrow: 1 }, [
        ...compact([
          personal.fullName
            ? text(
                { fontFamily: theme.serif, fontSize: nameSize, color: theme.ink },
                personal.fullName
              )
            : null,
          personal.headline
            ? text(
                {
                  fontFamily: theme.sans,
                  fontSize: theme.bodySize,
                  color: theme.muted,
                  marginTop: theme.bodySize * 0.2,
                },
                personal.headline
              )
            : null,
        ]),
      ]),
      contactStack.length ? stack({ gap: 1 }, contactStack) : spacer(0),
    ]),
    // no contact line here: the stack above already carries it, and repeating it is code 131
    ...(contactStack.length === 0 && contactLine(personal)
      ? [
          text(
            { fontFamily: theme.sans, fontSize: small, color: theme.muted },
            contactLine(personal)
          ),
        ]
      : []),
  ])

  const sections = resume.sections.map((section) =>
    stack({ marginBottom: theme.sectionGap * 0.75 }, [
      sectionHead(theme, section.title, 'rule-to-margin'),
      ...section.entries.map((entry) =>
        renderEntry(theme, section.type, entry, { dates: 'right' })
      ),
    ])
  )

  return [header, ...sections, spacer(0)]
}

export const ledger: ResumeTemplate = {
  key: 'ledger',
  name: 'Ledger',
  category: 'Standard',
  audience: 'Ten years or more, where the chronology is long and the page count is two.',
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
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
      'achievements',
      'languages',
      'publications',
      'references',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: [
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
    'achievements',
  ],
  suitedTo: ['professional', 'technical'],
  render,
}
