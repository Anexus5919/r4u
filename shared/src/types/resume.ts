import type { Resume, ResumeDesign, ResumePersonal, ResumeSection } from '../resume/schema.js'
import type { ResumeType } from '../resume/sections.js'

export const RESUME_STATUSES = ['draft', 'in_review', 'reviewed'] as const
export type ResumeStatus = (typeof RESUME_STATUSES)[number]

/**
 * What a list returns. Carries no resume content at all, which is what lets the dashboard, the
 * admin statistics and any future analytics read the same shape without a privileged query.
 */
export interface ResumeSummary {
  id: string
  title: string
  status: ResumeStatus
  resumeType: ResumeType
  templateKey: string
  meta: {
    completeness: number
    wordCount: number
    sectionCount: number
    pageCount: number
    atsScore: number
  }
  createdAt: string
  updatedAt: string
}

/** The owner's own read. The only shape that carries personal details and sections. */
export interface ResumeDetail extends ResumeSummary {
  personal: ResumePersonal
  sections: ResumeSection[]
  design: ResumeDesign
  notes: string
  version: number
}

export type ResumeContent = Resume
