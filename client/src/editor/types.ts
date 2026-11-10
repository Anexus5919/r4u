import type {
  ResumeDesign,
  ResumePersonal,
  ResumeStatus,
  ResumeType,
  SectionType,
} from '@r4u/shared'

// every _id is a present string here, sparing a null check on every line

export interface EditorEntry {
  _id: string
  hidden: boolean
  data: Record<string, unknown>
}

export interface EditorSection {
  _id: string
  type: SectionType
  title: string
  hidden: boolean
  locked: boolean
  keepTogether: boolean
  startOnNewPage: boolean
  entries: EditorEntry[]
}

export interface EditorResume {
  id: string
  title: string
  status: ResumeStatus
  resumeType: ResumeType
  templateKey: string
  version: number
  personal: ResumePersonal
  design: ResumeDesign
  notes: string
  sections: EditorSection[]
}

/** Mongo ids are 24 hex characters, and the client mints them so a new row renders immediately. */
export function newObjectId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
