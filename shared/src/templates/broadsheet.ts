import {
  compact,
  contactLine,
  dateRange,
  row,
  rule,
  spacer,
  stack,
  str,
  text,
  tracking,
} from '../layout/helpers.js'
import type { DocTheme, LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

/*
  BROADSHEET. Academic CV, three to six pages.

  Structural signature: a centred masthead closed by a classic double rule, 1pt over 0.25pt with
  2mm between, and centred small-caps section headings with no rules of their own. Publications
  get a bibliographic hanging indent no other template has.

  Not ATS safe, and correctly so. Academic hiring runs through Interfolio and AJO, which take the
  PDF whole rather than parsing it into fields, so optimising this for a resume parser would be
  optimising for a system nobody in that pipeline uses.
*/

/*
  A true hanging indent, built from the same two-column row the bullets use: the marker sits in a
  fixed column and the text flows in a flexible one, so wrapped lines align under the text rather
  than under the number.

  CSS text-indent would be the obvious tool and is deliberately absent from the style vocabulary,
  because @react-pdf does not implement it. This gets the same result inside the intersection.
*/
function citation(theme: DocTheme, index: number, value: string, detail: string): LayoutNode {
  return row({ gap: 0, marginTop: theme.bodySize * 0.45 }, [
    text(
      { width: 20, fontSize: theme.bodySize, lineHeight: theme.leading, color: theme.muted },
      `${index + 1}.`
    ),
    stack({ flexGrow: 1, flexShrink: 1 }, [
      text({ fontSize: theme.bodySize, lineHeight: theme.leading, color: theme.ink }, value),
      detail
        ? text(
            {
              fontSize: theme.bodySize * 0.92,
              color: theme.muted,
              fontStyle: 'italic',
              marginTop: theme.bodySize * 0.1,
            },
            detail
          )
        : spacer(0),
    ]),
  ])
}

function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.3

  const masthead = stack({ alignItems: 'center', marginBottom: theme.sectionGap }, [
    ...compact([
      personal.fullName
        ? text(
            {
              fontFamily: theme.serif,
              fontSize: nameSize,
              color: theme.ink,
              textTransform: 'uppercase',
              letterSpacing: tracking(nameSize, 0.08),
              textAlign: 'center',
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
              textAlign: 'center',
              marginTop: theme.bodySize * 0.3,
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
              textAlign: 'center',
              marginTop: theme.bodySize * 0.5,
            },
            contactLine(personal)
          )
        : null,
    ]),

    // the masthead double rule: 1pt over 0.25pt with 2mm between them
    stack({ width: '100%', marginTop: theme.bodySize * 0.9 }, [
      rule({ borderTopWidth: 1, borderColor: theme.ink }),
      stack({ marginTop: 5.7 }, [rule({ borderTopWidth: 0.25, borderColor: theme.ink })]),
    ]),
  ])

  const sections = resume.sections.map((section) => {
    const isPublications = section.type === 'publications'

    return stack({ marginBottom: theme.sectionGap }, [
      sectionHead(theme, section.title, 'centered'),

      ...(isPublications
        ? section.entries.map((entry, index) =>
            citation(
              theme,
              index,
              str(entry.data, 'title'),
              [str(entry.data, 'venue'), dateRange(entry.data)].filter(Boolean).join(', ')
            )
          )
        : section.entries.map((entry) =>
            renderEntry(theme, section.type, entry, { dates: 'right' })
          )),
    ])
  })

  return [masthead, ...sections, spacer(0)]
}

export const broadsheet: ResumeTemplate = {
  key: 'broadsheet',
  name: 'Broadsheet',
  category: 'Academic',
  audience: 'Academic CVs, where the publication list is the document.',
  atsSafe: 'unsafe',
  atsProfile: {
    columns: 1,
    hasTables: false,
    hasImages: false,
    headerFooterContent: false,
    bodyFont: 'EB Garamond',
    bulletGlyph: '•',
    dateLayout: 'right',
    /*
      Centred headings are harder for a header-matching parser than left-aligned ones, and the
      length alone puts it outside what a resume parser expects. Badged honestly rather than
      scored generously.
    */
    maxDimensionAScore: 18,
  },
  slots: {
    main: [
      'education',
      'experience',
      'publications',
      'achievements',
      'projects',
      'skills',
      'languages',
      'certifications',
      'references',
      'summary',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: [
    'education',
    'experience',
    'publications',
    'achievements',
    'projects',
    'skills',
    'languages',
    'references',
  ],
  suitedTo: ['academic'],
  render,
}
