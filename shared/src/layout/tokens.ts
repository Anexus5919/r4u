/*
  Document colours. The second of exactly two files in the project permitted to hold a hex
  literal, and the reason is structural rather than a convenience.

  The application chrome reads CSS custom properties from client/src/styles/tokens.css, which the
  browser resolves at runtime. A PDF has no CSS, no cascade and no custom properties, so a
  template must be handed concrete values. Putting them here keeps the rule intact: colour lives
  in exactly one place per surface, and no template invents its own.

  Every value below is a step from the ink ramp in docs/DESIGN-SYSTEM.md section 3.1. The document
  does not get a palette of its own.
*/

export const DOC_COLORS = {
  /** ink-12. body text and headings on paper */
  ink: '#16130f',
  /** ink-10. dates, locations, and anything supporting */
  muted: '#48433d',
  /** ink-06. hairline rules at 0.5pt */
  rule: '#c2bfba',
  /** ink-00. paper is true white in both themes, because paper is */
  paper: '#ffffff',
  /*
    ink-11, used when the user has chosen no accent.

    Deliberately a near-black from the ramp rather than a colour. A resume that arrives tinted
    because nobody picked anything is a template imposing itself on someone's document.
  */
  fallbackAccent: '#2e2924',
} as const
