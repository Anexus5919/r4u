// the second of two files allowed a hex literal: a PDF has no CSS custom properties

export const DOC_COLORS = {
  /** ink-12. body text and headings on paper */
  ink: '#16130f',
  /** ink-10. dates, locations, and anything supporting */
  muted: '#48433d',
  /** ink-06. hairline rules at 0.5pt */
  rule: '#c2bfba',
  /** ink-00. paper is true white in both themes, because paper is */
  paper: '#ffffff',
  // ink-11. near-black rather than a colour, so an unchosen accent tints nothing
  fallbackAccent: '#2e2924',

  // ink-12 ground for Placard's band. real text over a rectangle, never a rasterised image
  band: '#16130f',
  onBand: '#ffffff',

  /** ink-02. Verso's sidebar ground, four percent of ink so the edge reads without a rule */
  tint: '#f6f5f4',
} as const

// five muted print colours and no picker: a free colour wheel produces the neon resume
export const ACCENT_CHOICES = [
  { key: '', name: 'None', value: DOC_COLORS.fallbackAccent },
  { key: '#7a2e1f', name: 'Oxide', value: '#7a2e1f' },
  { key: '#1f4a5c', name: 'Slate blue', value: '#1f4a5c' },
  { key: '#2f4a32', name: 'Moss', value: '#2f4a32' },
  { key: '#5c3a6b', name: 'Aubergine', value: '#5c3a6b' },
] as const
