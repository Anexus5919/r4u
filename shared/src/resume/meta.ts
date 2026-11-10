import { personalOf } from './schema.js'
import type { Resume, ResumeSection } from './schema.js'

// shared, so the editor updates as the user types and the server denormalises one number

// strip years and versions, or every bullet in a 2021 to 2023 role scores as quantified
const VERSION = /\bv\d+(\.\d+)*\b|\b\d+\.\d+\.\d+\b/gi
const YEAR = /\b(19|20)\d{2}\b/g

// a number plus a plural noun: any fixed noun list is one word short of the next resume
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

// tolerates a partial object: toObject() leaves an untouched subdocument absent
function sectionsOf(resume: Partial<Resume>): ResumeSection[] {
  return Array.isArray(resume.sections) ? resume.sections : []
}

function bulletsIn(section: ResumeSection): string[] {
  if (section.hidden || !Array.isArray(section.entries)) return []

  return section.entries
    .filter((entry) => !entry.hidden)
    .flatMap((entry) => {
      const value = ((entry.data ?? {}) as { bullets?: unknown }).bullets
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : []
    })
}

function visibleText(resume: Partial<Resume>): string[] {
  const parts: string[] = []

  for (const section of sectionsOf(resume)) {
    if (section.hidden || !Array.isArray(section.entries)) continue

    for (const entry of section.entries) {
      if (entry.hidden) continue

      for (const value of Object.values(entry.data ?? {})) {
        if (typeof value === 'string') parts.push(value)
        else if (Array.isArray(value)) {
          parts.push(...value.filter((item): item is string => typeof item === 'string'))
        }
      }
    }
  }

  return parts
}

export function wordCount(resume: Partial<Resume>): number {
  return visibleText(resume).join(' ').split(/\s+/).filter(Boolean).length
}

export function quantifiedRatio(resume: Partial<Resume>): { quantified: number; total: number } {
  const bullets = sectionsOf(resume).flatMap(bulletsIn)
  return { quantified: bullets.filter(isQuantified).length, total: bullets.length }
}

function hasVisibleEntries(resume: Partial<Resume>, type: string): boolean {
  return sectionsOf(resume).some(
    (section) =>
      section.type === type &&
      !section.hidden &&
      Array.isArray(section.entries) &&
      section.entries.some((e) => !e.hidden)
  )
}

// weighted by section per TEMPLATES.md section 20; page fit is absent until measurable
const WEIGHTS = {
  contact: 10,
  summary: 10,
  history: 30,
  education: 15,
  skills: 15,
  quantification: 10,
} as const

export const COMPLETENESS_TOTAL = Object.values(WEIGHTS).reduce((sum, n) => sum + n, 0)

export function completeness(resume: Partial<Resume>): number {
  let earned = 0

  const personal = personalOf(resume)
  const contactParts = [
    personal.fullName,
    personal.email,
    personal.phone,
    personal.location,
  ].filter(Boolean).length
  earned += Math.round((contactParts / 4) * WEIGHTS.contact)

  const summary = sectionsOf(resume).find((s) => s.type === 'summary' && !s.hidden)
  const summaryText = summary?.entries?.[0]?.data as { text?: string } | undefined
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

export function computeMeta(resume: Partial<Resume>): ResumeMeta {
  return {
    completeness: completeness(resume),
    wordCount: wordCount(resume),
    sectionCount: sectionsOf(resume).filter((section) => !section.hidden).length,
  }
}
