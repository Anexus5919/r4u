import { compact, contactLine, row, spacer, stack, text, tracking } from '../layout/helpers.js'
import type { DocTheme, LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import type { TemplateResume } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

// RECTO. sidebar RIGHT at 32%, split header, gutter hairline. Verso mirrors all three
const ASIDE_SECTIONS = ['skills', 'certifications', 'languages', 'education'] as const

function asideSection(theme: DocTheme, section: TemplateResume['sections'][number]): LayoutNode {
  return stack({ marginBottom: theme.sectionGap * 0.85 }, [
    sectionHead(theme, section.title, 'plain'),
    ...section.entries.map((entry) => renderEntry(theme, section.type, entry, { dates: 'inline' })),
  ])
}

function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.1

  const aside = resume.sections.filter((section) =>
    (ASIDE_SECTIONS as readonly string[]).includes(section.type)
  )
  // anything the slots map does not name falls into main, so nothing can go missing
  const main = resume.sections.filter(
    (section) => !(ASIDE_SECTIONS as readonly string[]).includes(section.type)
  )

  const header = stack({ marginBottom: theme.sectionGap }, [
    row({ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }, [
      stack({ flexGrow: 1 }, [
        ...compact([
          personal.fullName
            ? text(
                {
                  fontFamily: theme.serif,
                  fontSize: nameSize,
                  color: theme.ink,
                  letterSpacing: tracking(nameSize, 0.02),
                },
                personal.fullName
              )
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
        ]),
      ]),
      contactLine(personal)
        ? text(
            {
              width: '38%',
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.82,
              color: theme.muted,
              textAlign: 'right',
              lineHeight: theme.leading,
            },
            contactLine(personal)
          )
        : spacer(0),
    ]),
    stack({ marginTop: theme.bodySize * 0.8 }, [
      { type: 'rule', style: { borderTopWidth: 0.5, borderColor: theme.rule } },
    ]),
  ])

  // stretch: the gutter rule has no children, so under flex-start it is zero high and paints nothing
  const columns = row({ gap: 0, alignItems: 'stretch' }, [
    // flexGrow rather than a percentage, so main takes exactly what the rule and aside leave
    stack({ flexGrow: 1, flexShrink: 1, paddingRight: 16 }, [
      ...main.map((section) =>
        stack({ marginBottom: theme.sectionGap }, [
          sectionHead(theme, section.title, 'rule-below'),
          ...section.entries.map((entry) =>
            renderEntry(theme, section.type, entry, { dates: 'right' })
          ),
        ])
      ),
    ]),

    // a filled column, not a left border: a vertical border is drawn differently by each engine
    stack({ width: 0.5, backgroundColor: theme.rule }, []),

    stack(
      { width: '32%', paddingLeft: 16 },
      aside.map((section) => asideSection(theme, section))
    ),
  ])

  return [header, columns, spacer(0)]
}

export const recto: ResumeTemplate = {
  key: 'recto',
  name: 'Recto',
  category: 'Two column',
  audience: 'Long skill inventories, for applications a person reads before a parser does.',
  atsSafe: 'unsafe',
  atsProfile: {
    columns: 2,
    hasTables: false,
    hasImages: false,
    headerFooterContent: false,
    bodyFont: 'Source Sans 3',
    bulletGlyph: '•',
    dateLayout: 'right',
    // two columns caps dimension A at 3 of 6 on reading order alone
    maxDimensionAScore: 21,
  },
  slots: {
    main: ['summary', 'experience', 'projects', 'achievements', 'publications', 'custom'],
    aside: ['skills', 'certifications', 'languages', 'education'],
  },
  recommendedOrder: [
    'summary',
    'experience',
    'projects',
    'skills',
    'education',
    'certifications',
    'languages',
  ],
  suitedTo: ['professional', 'technical'],
  render,
}
