/*
  The one definition of what a resume section contains.

  Imported by the express validators, the React form renderer, the character counters, the ATS
  checker and the template adapters. A limit that lives in two places will eventually disagree
  with itself, and a counter promising 240 characters while the server rejects at 220 is the
  fastest way to look unfinished.

  Every limit here matches docs/TEMPLATES.md section 11.1 and the D-dimension checks in
  docs/ATS-RUBRIC.md.
*/

export const SECTION_TYPES = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
  'achievements',
  'languages',
  'publications',
  'references',
  'custom',
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export type FieldType =
  'text' | 'textarea' | 'bullets' | 'month' | 'url' | 'tags' | 'boolean' | 'location'

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  max?: number
  /** soft warning threshold, defaults to 80 percent of max */
  warn?: number
  required?: boolean
  hint?: string
}

export interface SectionSpec {
  type: SectionType
  /** the default heading, chosen because parsers match on header text */
  label: string
  /**
   * Headings a production parser reliably recognises. Anything outside this set risks the
   * section being mis-filed or absorbed into the one above it. See ATS-RUBRIC.md dimension B.
   */
  canonicalHeadings: string[]
  repeatable: boolean
  maxEntries: number
  fields: FieldSpec[]
}

export const BULLET_MAX = 220
export const BULLET_WARN = 170
export const MAX_BULLETS_PER_ENTRY = 8
export const WARN_BULLETS_PER_ENTRY = 5

const dateFields: FieldSpec[] = [
  { key: 'startDate', label: 'Start date', type: 'month', required: true },
  { key: 'endDate', label: 'End date', type: 'month' },
  { key: 'current', label: 'I currently work here', type: 'boolean' },
]

export const SECTION_REGISTRY: Record<SectionType, SectionSpec> = {
  summary: {
    type: 'summary',
    label: 'Summary',
    canonicalHeadings: ['Summary', 'Professional Summary', 'Profile', 'Objective'],
    repeatable: false,
    maxEntries: 1,
    fields: [
      {
        key: 'text',
        label: 'Profile summary',
        type: 'textarea',
        max: 600,
        warn: 480,
        hint: 'Three to five sentences. Around 57 words reads best.',
      },
    ],
  },

  experience: {
    type: 'experience',
    label: 'Work Experience',
    canonicalHeadings: [
      'Work Experience',
      'Professional Experience',
      'Experience',
      'Employment History',
      'Work History',
      'Career History',
      'Relevant Experience',
    ],
    repeatable: true,
    maxEntries: 12,
    fields: [
      { key: 'role', label: 'Job title', type: 'text', max: 80, required: true },
      { key: 'organisation', label: 'Company', type: 'text', max: 80, required: true },
      { key: 'location', label: 'Location', type: 'location', max: 60 },
      ...dateFields,
      {
        key: 'bullets',
        label: 'What you did',
        type: 'bullets',
        max: BULLET_MAX,
        warn: BULLET_WARN,
        hint: 'Lead with a verb and include a number. Three to six bullets per role.',
      },
    ],
  },

  education: {
    type: 'education',
    label: 'Education',
    canonicalHeadings: ['Education', 'Education and Training', 'Academic Background'],
    repeatable: true,
    maxEntries: 8,
    fields: [
      { key: 'degree', label: 'Degree', type: 'text', max: 100, required: true },
      { key: 'organisation', label: 'Institution', type: 'text', max: 80, required: true },
      { key: 'location', label: 'Location', type: 'location', max: 60 },
      ...dateFields,
      { key: 'grade', label: 'Grade or GPA', type: 'text', max: 40 },
      { key: 'coursework', label: 'Relevant coursework', type: 'tags', max: 60 },
    ],
  },

  projects: {
    type: 'projects',
    label: 'Projects',
    canonicalHeadings: ['Projects', 'Selected Projects', 'Personal Projects'],
    repeatable: true,
    maxEntries: 12,
    fields: [
      { key: 'name', label: 'Project name', type: 'text', max: 80, required: true },
      { key: 'url', label: 'Link', type: 'url', max: 200 },
      ...dateFields,
      { key: 'stack', label: 'Built with', type: 'tags', max: 40 },
      {
        key: 'bullets',
        label: 'What it does',
        type: 'bullets',
        max: BULLET_MAX,
        warn: BULLET_WARN,
      },
    ],
  },

  skills: {
    type: 'skills',
    label: 'Skills',
    canonicalHeadings: ['Skills', 'Technical Skills'],
    repeatable: true,
    maxEntries: 8,
    fields: [
      { key: 'group', label: 'Group', type: 'text', max: 30, hint: 'Languages, Tools, Cloud' },
      {
        key: 'items',
        label: 'Skills',
        type: 'tags',
        max: 40,
        hint: 'Name a level in words if you want one. Never a rating bar.',
      },
    ],
  },

  certifications: {
    type: 'certifications',
    label: 'Certifications',
    canonicalHeadings: ['Certifications', 'Licenses and Certifications'],
    repeatable: true,
    maxEntries: 12,
    fields: [
      { key: 'name', label: 'Certification', type: 'text', max: 100, required: true },
      { key: 'issuer', label: 'Issued by', type: 'text', max: 80 },
      { key: 'startDate', label: 'Issued', type: 'month' },
      { key: 'endDate', label: 'Expires', type: 'month' },
      { key: 'url', label: 'Credential link', type: 'url', max: 200 },
    ],
  },

  achievements: {
    type: 'achievements',
    label: 'Achievements',
    canonicalHeadings: ['Achievements', 'Awards', 'Honours and Awards'],
    repeatable: true,
    maxEntries: 12,
    fields: [
      { key: 'title', label: 'Achievement', type: 'text', max: 200, required: true },
      { key: 'startDate', label: 'Date', type: 'month' },
      { key: 'detail', label: 'Detail', type: 'textarea', max: 200 },
    ],
  },

  languages: {
    type: 'languages',
    label: 'Languages',
    canonicalHeadings: ['Languages'],
    repeatable: true,
    maxEntries: 10,
    fields: [
      { key: 'name', label: 'Language', type: 'text', max: 40, required: true },
      {
        key: 'level',
        label: 'Level',
        type: 'text',
        max: 20,
        hint: 'Native, Fluent, C1. A word, never a bar or a set of dots.',
      },
    ],
  },

  publications: {
    type: 'publications',
    label: 'Publications',
    canonicalHeadings: ['Publications', 'Selected Publications'],
    repeatable: true,
    maxEntries: 60,
    fields: [
      { key: 'title', label: 'Title', type: 'text', max: 300, required: true },
      { key: 'venue', label: 'Venue', type: 'text', max: 200 },
      { key: 'startDate', label: 'Date', type: 'month' },
      { key: 'url', label: 'Link', type: 'url', max: 200 },
    ],
  },

  references: {
    type: 'references',
    label: 'References',
    canonicalHeadings: ['References'],
    repeatable: true,
    maxEntries: 6,
    fields: [
      { key: 'name', label: 'Name', type: 'text', max: 80, required: true },
      { key: 'role', label: 'Title', type: 'text', max: 80 },
      { key: 'organisation', label: 'Organisation', type: 'text', max: 80 },
      { key: 'contact', label: 'Contact', type: 'text', max: 120 },
    ],
  },

  custom: {
    type: 'custom',
    label: 'Custom Section',
    canonicalHeadings: [],
    repeatable: true,
    maxEntries: 12,
    fields: [
      { key: 'title', label: 'Title', type: 'text', max: 100, required: true },
      { key: 'subtitle', label: 'Subtitle', type: 'text', max: 100 },
      ...dateFields,
      { key: 'bullets', label: 'Detail', type: 'bullets', max: BULLET_MAX, warn: BULLET_WARN },
    ],
  },
}

/** Personal details are not a section: they are the contact block, and every template needs them. */
export const PERSONAL_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'Full name', type: 'text', max: 60, required: true },
  { key: 'headline', label: 'Professional headline', type: 'text', max: 80 },
  { key: 'email', label: 'Email address', type: 'text', max: 254, required: true },
  { key: 'phone', label: 'Phone', type: 'text', max: 32 },
  {
    key: 'location',
    label: 'Location',
    type: 'location',
    max: 60,
    hint: 'City and state. Leave off the street address.',
  },
]

export const MAX_LINKS = 5
export const MAX_SECTIONS = 15

/** Section order is a function of career stage, not of taste. See TEMPLATES.md section 5. */
export const RESUME_TYPES = ['fresher', 'professional', 'technical', 'academic'] as const
export type ResumeType = (typeof RESUME_TYPES)[number]

export const DEFAULT_SECTION_ORDER: Record<ResumeType, SectionType[]> = {
  fresher: ['education', 'projects', 'skills', 'experience', 'achievements', 'certifications'],
  professional: ['summary', 'experience', 'education', 'skills', 'certifications'],
  technical: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
  academic: ['education', 'experience', 'publications', 'achievements', 'skills', 'references'],
}

export const PAGE_TARGET: Record<ResumeType, string> = {
  fresher: '1 page',
  professional: '1 to 2 pages',
  technical: '1 to 2 pages',
  academic: '3 to 6 pages',
}

export function specFor(type: SectionType): SectionSpec {
  return SECTION_REGISTRY[type]
}

export function fieldSpec(type: SectionType, key: string): FieldSpec | undefined {
  return SECTION_REGISTRY[type].fields.find((field) => field.key === key)
}
