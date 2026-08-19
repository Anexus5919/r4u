import { compact, contactLine, spacer, stack, text, tracking } from '../layout/helpers.js'
import { DOC_COLORS } from '../layout/tokens.js'
import type { LayoutNode, ResumeTemplate, TemplateInput } from '../layout/types.js'
import { renderEntry, sectionHead } from './blocks.js'

/*
  PLACARD. Business, consulting and finance, where the first impression is a title.

  Structural signature: a full-bleed reversed header band carrying the name, target title and
  contact, and a hairline rule ABOVE each section heading. Foundry puts its rule below, so the
  two are deliberate opposites rather than variations.

  The band is real text over a background rectangle, never an image. A rasterised header extracts
  as nothing, which would make the one template with a strong header the one with no name on it.
*/
function render({ resume, theme }: TemplateInput): LayoutNode[] {
  const { personal } = resume
  const nameSize = theme.bodySize * 2.2

  const band = stack(
    {
      backgroundColor: DOC_COLORS.band,
      // negative margins pull the band out to the page edge, past the document margin
      marginTop: -theme.margin,
      marginLeft: -theme.margin,
      marginRight: -theme.margin,
      paddingTop: theme.margin * 0.8,
      paddingBottom: theme.margin * 0.8,
      paddingLeft: theme.margin,
      paddingRight: theme.margin,
      marginBottom: theme.sectionGap,
    },
    compact([
      personal.fullName
        ? text(
            {
              fontFamily: theme.serif,
              fontSize: nameSize,
              color: DOC_COLORS.onBand,
              letterSpacing: tracking(nameSize, 0.02),
            },
            personal.fullName
          )
        : null,

      personal.headline
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 1.05,
              color: DOC_COLORS.onBand,
              marginTop: theme.bodySize * 0.35,
            },
            personal.headline
          )
        : null,

      contactLine(personal)
        ? text(
            {
              fontFamily: theme.sans,
              fontSize: theme.bodySize * 0.88,
              color: DOC_COLORS.onBand,
              marginTop: theme.bodySize * 0.7,
            },
            contactLine(personal)
          )
        : null,
    ])
  )

  const sections = resume.sections.map((section) =>
    stack({ marginBottom: theme.sectionGap }, [
      sectionHead(theme, section.title, 'rule-above'),
      ...section.entries.map((entry) =>
        renderEntry(theme, section.type, entry, { dates: 'right' })
      ),
    ])
  )

  return [band, ...sections, spacer(0)]
}

export const placard: ResumeTemplate = {
  key: 'placard',
  name: 'Placard',
  category: 'Statement',
  audience: 'Consulting, finance and business, where the target title does the first work.',
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
      'education',
      'skills',
      'certifications',
      'languages',
      'projects',
      'achievements',
      'publications',
      'references',
      'custom',
    ],
    aside: [],
  },
  recommendedOrder: ['summary', 'experience', 'education', 'skills', 'certifications', 'languages'],
  suitedTo: ['professional'],
  render,
}
