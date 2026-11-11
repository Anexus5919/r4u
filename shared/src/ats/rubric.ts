// ATS-RUBRIC.md as data: the methodology page and the scorer read the same table

export const RUBRIC_VERSION = '1.0.0'

export const DIMENSIONS = [
  { id: 'A', title: 'Parseability and export safety', points: 30 },
  { id: 'B', title: 'Structure and sections', points: 20 },
  { id: 'C', title: 'Contact and identity', points: 10 },
  { id: 'D', title: 'Content quality', points: 20 },
  { id: 'E', title: 'Job-description match', points: 20 },
] as const

export type DimensionId = (typeof DIMENSIONS)[number]['id']

export interface CheckDefinition {
  id: string
  dimension: DimensionId
  points: number
  title: string
}

export const CHECKS: CheckDefinition[] = [
  { id: 'A1', dimension: 'A', points: 8, title: 'Export produces a real text layer' },
  { id: 'A2', dimension: 'A', points: 6, title: 'Single-column reading order' },
  { id: 'A3', dimension: 'A', points: 3, title: 'No tables, text boxes or positioned blocks' },
  { id: 'A4', dimension: 'A', points: 3, title: 'No images, logos, icon glyphs or skill bars' },
  { id: 'A5', dimension: 'A', points: 3, title: 'Contact block is in the body, not a header' },
  { id: 'A6', dimension: 'A', points: 3, title: 'Body font is safe and fully embedded' },
  { id: 'A7', dimension: 'A', points: 2, title: 'Readable sizes, margins and page count' },
  { id: 'A8', dimension: 'A', points: 2, title: 'Plain bullet glyphs' },
  { id: 'B1', dimension: 'B', points: 5, title: 'Experience heading a parser recognises' },
  { id: 'B2', dimension: 'B', points: 3, title: 'Education heading a parser recognises' },
  { id: 'B3', dimension: 'B', points: 3, title: 'Skills heading a parser recognises' },
  { id: 'B4', dimension: 'B', points: 2, title: 'Every heading on its own line' },
  { id: 'B5', dimension: 'B', points: 2, title: 'No duplicate or empty sections' },
  { id: 'B6', dimension: 'B', points: 2, title: 'Newest role and course first' },
  { id: 'B7', dimension: 'B', points: 3, title: 'Every role has dates, a title and an employer' },
  { id: 'C1', dimension: 'C', points: 3, title: 'Exactly one readable email' },
  { id: 'C2', dimension: 'C', points: 2, title: 'Exactly one phone number' },
  { id: 'C3', dimension: 'C', points: 2, title: 'Full name on the first line' },
  { id: 'C4', dimension: 'C', points: 1, title: 'City and region, no street address' },
  { id: 'C5', dimension: 'C', points: 2, title: 'No personal data that invites bias' },
  { id: 'D1', dimension: 'D', points: 3, title: 'Three to six bullets per role' },
  { id: 'D2', dimension: 'D', points: 4, title: 'Bullets open with an action verb' },
  { id: 'D3', dimension: 'D', points: 4, title: 'Bullets carry a number' },
  { id: 'D4', dimension: 'D', points: 3, title: 'No weak or passive openers' },
  { id: 'D5', dimension: 'D', points: 2, title: 'No first-person pronouns' },
  { id: 'D6', dimension: 'D', points: 2, title: 'Bullets of a readable length' },
  { id: 'D7', dimension: 'D', points: 2, title: 'Overall length suits the resume type' },
  { id: 'E1', dimension: 'E', points: 10, title: 'Hard skills from the posting' },
  { id: 'E2', dimension: 'E', points: 3, title: 'Job title alignment' },
  { id: 'E3', dimension: 'E', points: 3, title: 'Required qualifications' },
  { id: 'E4', dimension: 'E', points: 2, title: 'General and soft keywords' },
  { id: 'E5', dimension: 'E', points: 2, title: 'Skills shown in context, not only listed' },
]

export const CHECK_BY_ID = new Map(CHECKS.map((check) => [check.id, check]))

/** E-CAP: stuffing caps dimension E rather than subtracting, so the total still sums to 100. */
export const E_CAP = 12

export type CheckStatus = 'pass' | 'partial' | 'fail' | 'na'

export interface AtsCheckResult {
  checkId: string
  dimension: DimensionId
  title: string
  status: CheckStatus
  earned: number
  possible: number
  /** remediation copy from the rubric; empty on a pass */
  message: string
  /** where to fix it, as an editor query: section id, entry id, field */
  target?: { sectionId?: string; entryId?: string; field?: string }
}

export interface AtsDimensionResult {
  id: DimensionId
  title: string
  earned: number
  possible: number
}

export interface AtsKeywordReport {
  matched: string[]
  missing: string[]
  jobTitle: string
  stuffing: string[]
}

export interface AtsResult {
  rubricVersion: string
  mode: 'full' | 'format_only'
  total: number
  /** A-GATE: hidden text zeroes the score and blocks export */
  gate: { blocked: boolean; reasons: string[] }
  dimensions: AtsDimensionResult[]
  checks: AtsCheckResult[]
  /** the template's own parseability ceiling, out of 30 */
  templateCeiling: { template: string; max: number; best: string }
  keywords: AtsKeywordReport | null
  hints: string[]
  parserPreview: string
}
