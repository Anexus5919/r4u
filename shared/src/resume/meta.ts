import type { Resume, ResumeSection } from './schema.js'

/*
  Completeness, word count and the quantification ratio.

  Lives in shared so the editor can show completeness update as the user types without a round
  trip, and the server can denormalise the same numbers onto the document. Two implementations
  would drift, and the admin dashboard reads the server's copy.
*/

/*
  Quantification, with the guard that makes the metric mean anything.

  Without stripping years and version numbers first, every bullet in a 2021 to 2023 role counts
  as quantified, the ratio becomes noise, and users notice immediately when a duty-only bullet
  scores full marks. See ATS-RUBRIC.md section 6.2.

  Versions are matched narrowly, either an explicit v prefix or three-part semver, so a genuine
  metric like "3.5x faster" is not mistaken for one.
*/
const VERSION = /\bv\d+(\.\d+)*\b|\b\d+\.\d+\.\d+\b/gi
const YEAR = /\b(19|20)\d{2}\b/g

/*
  An enumerated noun list was the original approach and it is the wrong shape. Real bullets count
  services, minutes, deploys, incidents and failures, and any fixed list is one word short of the
  next resume someone writes.

  A number followed by a plural noun, with up to two words in between, generalises correctly:
  "38 services", "45 minutes", "3 integration failures", "9 million notifications". The explicit
  list is kept only for units that are not plural, such as ms and gb.
*/
const QUANTIFIERS: RegExp[] = [
  /[$£€₹]\s?\d[\d,]*(\.\d+)?\s?(k|m|mn|bn|b|lakh|crore)?/i,
  /\b\d[\d,]*(\.\d+)?\s?%/,
  /\b\d+(\.\d+)?\s?x\b/i,
  /\b\d[\d,]*(\.\d+)?\+?\s?(ms|kb|mb|gb|tb|rps|qps|fps|k|million|billion|thousand|lakh|crore)\b/i,
  /\b\d[\d,]*(\.\d+)?\+?\s+(?:[a-z][a-z-]*\s+){0,2}[a-z]{3,}s\b/i,
  /\b(reduced|increased|improved|grew|cut|raised|lowered|saved|accelerated)\b[^.]{0,40}\d/i,
]

export function isQuantified(bullet: string): boolean {
  const stripped = bullet.replace(VERSION, ' ').replace(YEAR, ' ')
  return QUANTIFIERS.some((pattern) => pattern.test(stripped))
}

function bulletsIn(section: ResumeSection): string[] {
  if (section.hidden) return []

  return section.entries
    .filter((entry) => !entry.hidden)
    .flatMap((entry) => {
      const value = (entry.data as { bullets?: unknown }).bullets
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : []
    })
}

function visibleText(resume: Resume): string[] {
  const parts: string[] = []

  for (const section of resume.sections) {
    if (section.hidden) continue

    for (const entry of section.entries) {
      if (entry.hidden) continue

      for (const value of Object.values(entry.data)) {
        if (typeof value === 'string') parts.push(value)
        else if (Array.isArray(value)) {
          parts.push(...value.filter((item): item is string => typeof item === 'string'))
        }
      }
    }
  }

  return parts
}

export function wordCount(resume: Resume): number {
  return visibleText(resume).join(' ').split(/\s+/).filter(Boolean).length
}

export function quantifiedRatio(resume: Resume): { quantified: number; total: number } {
  const bullets = resume.sections.flatMap(bulletsIn)
  return { quantified: bullets.filter(isQuantified).length, total: bullets.length }
}

function hasVisibleEntries(resume: Resume, type: string): boolean {
  return resume.sections.some(
    (section) => section.type === type && !section.hidden && section.entries.some((e) => !e.hidden)
  )
}

/*
  Weighted by section, never by filled-field count.

  "Fields filled over total fields" is the student-project version: it moves for reasons the user
  cannot act on, and it rewards padding. These weights come from TEMPLATES.md section 20.

  Page fit is the seventh dimension and is deliberately absent until phase 7 can measure a real
  render. Scoring an unmeasured dimension as passing would be dishonest, so the total is
  normalised over what is actually known.
*/
const WEIGHTS = {
  contact: 10,
  summary: 10,
  history: 30,
  education: 15,
  skills: 15,
  quantification: 10,
} as const

export const COMPLETENESS_TOTAL = Object.values(WEIGHTS).reduce((sum, n) => sum + n, 0)

export function completeness(resume: Resume): number {
  let earned = 0

  const { fullName, email, phone, location } = resume.personal
  const contactParts = [fullName, email, phone, location].filter(Boolean).length
  earned += Math.round((contactParts / 4) * WEIGHTS.contact)

  const summary = resume.sections.find((s) => s.type === 'summary' && !s.hidden)
  const summaryText = summary?.entries[0]?.data as { text?: string } | undefined
  if ((summaryText?.text?.trim().length ?? 0) >= 120) earned += WEIGHTS.summary

  // experience or projects, because a fresher's projects are their history
  if (hasVisibleEntries(resume, 'experience') || hasVisibleEntries(resume, 'projects')) {
    earned += WEIGHTS.history
  }

  if (hasVisibleEntries(resume, 'education')) earned += WEIGHTS.education
  if (hasVisibleEntries(resume, 'skills')) earned += WEIGHTS.skills

  const { quantified, total } = quantifiedRatio(resume)
  if (total > 0) {
    // full marks at half the bullets carrying a number, matching rubric check D3
    earned += Math.round(Math.min(1, quantified / total / 0.5) * WEIGHTS.quantification)
  }

  return Math.round((earned / COMPLETENESS_TOTAL) * 100)
}

export interface ResumeMeta {
  completeness: number
  wordCount: number
  sectionCount: number
}

export function computeMeta(resume: Resume): ResumeMeta {
  return {
    completeness: completeness(resume),
    wordCount: wordCount(resume),
    sectionCount: resume.sections.filter((section) => !section.hidden).length,
  }
}
