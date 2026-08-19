import { compact, ground, row, spacer, stack, text, tracking } from '../layout/helpers.js'
import { DOC_COLORS } from '../layout/tokens.js'
import type { DocTheme, LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import type { TemplateResume } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

/*
  VERSO. Design, marketing and career changes, where the skills have to lead.

  Structural signature: the sidebar is on the LEFT at 34 percent on a tinted ground, and the name
  lives INSIDE it. There is no header band at all, which is what makes this structurally distinct
  from Recto rather than a mirror of it. No rules anywhere: the tint edge does the separating.

  A hybrid rather than a functional resume. Leading with skills is the goal; dropping the dated
  chronology to do it is the format recruiters distrust most and parsers handle worst.
*/
const ASIDE_SECTIONS = ['skills', 'languages', 'certifications'] as const

function asideSection(theme: DocTheme, section: TemplateResume['sections'][number]): LayoutNode {
  return stack({ marginBottom: theme.sectionGap * 0.8 }, [
    sectionHead(theme, section.title, 'plain'),
    ...section.entries.map((entry) => renderEntry(theme, section.type, entry, { dates: 'inline' })),
  ])
}

function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 1.9
  const small = theme.bodySize * 0.85

  // points: the ground measures against the page, the column against the content box
  const asideWidth = (theme.pageWidth - 2 * theme.margin) * 0.34

  const aside = resume.sections.filter((section) =>
    (ASIDE_SECTIONS as readonly string[]).includes(section.type)
  )
  const main = resume.sections.filter(
    (section) => !(ASIDE_SECTIONS as readonly string[]).includes(section.type)
  )

  const contactLines = compact([
    personal.email
      ? text({ fontFamily: theme.sans, fontSize: small, color: theme.muted }, personal.email)
      : null,
    personal.phone
      ? text({ fontFamily: theme.sans, fontSize: small, color: theme.muted }, personal.phone)
      : null,
    personal.location
      ? text({ fontFamily: theme.sans, fontSize: small, color: theme.muted }, personal.location)
      : null,
    ...personal.links.map((link) =>
      text({ fontFamily: theme.sans, fontSize: small, color: theme.muted }, link.url)
    ),
  ])

  const sidebar = stack(
    {
      width: asideWidth,
      // pulled out to the left trim, where the ground behind it starts
      marginLeft: -theme.margin,
      paddingLeft: theme.margin,
      paddingRight: 16,
    },
    [
      // the name sits in the sidebar, which is why this template has no header block
      stack({ marginBottom: theme.sectionGap }, [
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
                  fontSize: small,
                  color: theme.muted,
                  marginTop: theme.bodySize * 0.3,
                  textTransform: 'uppercase',
                  letterSpacing: tracking(small, 0.08),
                },
                personal.headline
              )
            : null,
        ]),
      ]),

      contactLines.length
        ? stack({ gap: 2, marginBottom: theme.sectionGap }, contactLines)
        : spacer(0),

      ...aside.map((section) => asideSection(theme, section)),
    ]
  )

  // flexGrow, or the sidebar's negative margin leaves 20mm of dead measure down the right edge
  const body = stack(
    { flexGrow: 1, flexShrink: 1, paddingLeft: 20 },
    main.map((section) =>
      stack({ marginBottom: theme.sectionGap }, [
        sectionHead(theme, section.title, 'plain'),
        ...section.entries.map((entry) =>
          renderEntry(theme, section.type, entry, { dates: 'right' })
        ),
      ])
    )
  )

  return [
    ground({ width: asideWidth, backgroundColor: DOC_COLORS.tint }),
    row({ gap: 0, alignItems: 'flex-start' }, [sidebar, body]),
  ]
}

export const verso: ResumeTemplate = {
  key: 'verso',
  name: 'Verso',
  category: 'Two column',
  audience: 'Design, marketing and career changes, where the skills need to come first.',
  atsSafe: 'unsafe',
  atsProfile: {
    columns: 2,
    hasTables: false,
    hasImages: false,
    headerFooterContent: false,
    bodyFont: 'Source Sans 3',
    bulletGlyph: '•',
    dateLayout: 'right',
    maxDimensionAScore: 21,
  },
  slots: {
    main: [
      'summary',
      'experience',
      'projects',
      'education',
      'achievements',
      'publications',
      'references',
      'custom',
    ],
    aside: ['skills', 'languages', 'certifications'],
  },
  recommendedOrder: [
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
    'languages',
  ],
  suitedTo: ['professional', 'technical', 'fresher'],
  render,
}
