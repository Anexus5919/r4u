import { SECTION_REGISTRY } from './sections.js'
import type { SectionType } from './sections.js'
import { personalOf } from './schema.js'
import type { Resume } from './schema.js'

// jsonresume.org, so R4U is a place people can leave as well as arrive

export interface JsonResume {
  basics?: {
    name?: string
    label?: string
    email?: string
    phone?: string
    url?: string
    summary?: string
    location?: { city?: string; region?: string; countryCode?: string }
    profiles?: { network?: string; url?: string }[]
  }
  work?: Record<string, unknown>[]
  education?: Record<string, unknown>[]
  skills?: Record<string, unknown>[]
  projects?: Record<string, unknown>[]
  certificates?: Record<string, unknown>[]
  awards?: Record<string, unknown>[]
  languages?: Record<string, unknown>[]
  publications?: Record<string, unknown>[]
  references?: Record<string, unknown>[]
}

/** JSON Resume dates are ISO and may be a year, a month or a full date. R4U stores YYYY-MM. */
function toMonth(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value.trim())
  if (!match) return ''
  return `${match[1]}-${match[2] ?? '01'}`
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

interface JsonLocation {
  city?: string
  region?: string
  countryCode?: string
}

/** "Manchester, England, GB". City and region are what recruiters filter on. */
function joinLocation(location: JsonLocation = {}): string {
  return [location.city, location.region, location.countryCode].filter(Boolean).join(', ')
}

/* ---------------------------------------------------------------- export */

export function toJsonResume(resume: Partial<Resume>): JsonResume {
  const personal = personalOf(resume)
  const sections = resume.sections ?? []

  const visible = (type: SectionType) =>
    sections
      .filter((section) => section.type === type && !section.hidden)
      .flatMap((section) => section.entries.filter((entry) => !entry.hidden))
      .map((entry) => entry.data as Record<string, unknown>)

  const summary = visible('summary')[0]

  return {
    basics: {
      name: personal.fullName ?? '',
      label: personal.headline ?? '',
      email: personal.email ?? '',
      phone: personal.phone ?? '',
      summary: text(summary?.text),
      location: { city: personal.location ?? '' },
      profiles: (personal.links ?? []).map((link) => ({ network: link.label, url: link.url })),
    },

    work: visible('experience').map((data) => ({
      name: text(data.organisation),
      position: text(data.role),
      location: text(data.location),
      startDate: text(data.startDate),
      endDate: data.current === true ? '' : text(data.endDate),
      highlights: strings(data.bullets),
    })),

    education: visible('education').map((data) => ({
      institution: text(data.organisation),
      studyType: text(data.degree),
      startDate: text(data.startDate),
      endDate: text(data.endDate),
      score: text(data.grade),
      courses: strings(data.coursework),
    })),

    projects: visible('projects').map((data) => ({
      name: text(data.name),
      url: text(data.url),
      startDate: text(data.startDate),
      endDate: text(data.endDate),
      keywords: strings(data.stack),
      highlights: strings(data.bullets),
    })),

    skills: visible('skills').map((data) => ({
      name: text(data.group) || 'Skills',
      keywords: strings(data.items),
    })),

    certificates: visible('certifications').map((data) => ({
      name: text(data.name),
      issuer: text(data.issuer),
      date: text(data.startDate),
      url: text(data.url),
    })),

    awards: visible('achievements').map((data) => ({
      title: text(data.title),
      date: text(data.startDate),
      summary: text(data.detail),
    })),

    languages: visible('languages').map((data) => ({
      language: text(data.name),
      fluency: text(data.level),
    })),

    publications: visible('publications').map((data) => ({
      name: text(data.title),
      publisher: text(data.venue),
      releaseDate: text(data.startDate),
      url: text(data.url),
    })),

    references: visible('references').map((data) => ({
      name: text(data.name),
      reference: [text(data.role), text(data.organisation), text(data.contact)]
        .filter(Boolean)
        .join(', '),
    })),
  }
}

/* ---------------------------------------------------------------- import */

interface ImportedSection {
  type: SectionType
  title: string
  hidden: false
  locked: false
  keepTogether: false
  startOnNewPage: false
  entries: { hidden: false; data: Record<string, unknown> }[]
}

function section(type: SectionType, entries: Record<string, unknown>[]): ImportedSection | null {
  if (entries.length === 0) return null

  return {
    type,
    title: SECTION_REGISTRY[type].label,
    hidden: false,
    locked: false,
    keepTogether: false,
    startOnNewPage: false,
    entries: entries.map((data) => ({ hidden: false, data })),
  }
}

/** tolerant: a file that half-imports and says what it skipped beats one that refuses */
export function fromJsonResume(input: JsonResume): {
  personal: Resume['personal']
  sections: ImportedSection[]
  skipped: string[]
} {
  const basics = input.basics ?? {}
  const skipped: string[] = []

  const personal: Resume['personal'] = {
    fullName: text(basics.name),
    headline: text(basics.label),
    email: text(basics.email),
    phone: text(basics.phone),
    location: joinLocation(basics.location ?? {}),
    links: (basics.profiles ?? [])
      .filter((profile) => text(profile.url))
      .slice(0, 5)
      .map((profile) => ({ label: text(profile.network).slice(0, 30), url: text(profile.url) })),
  }

  if (basics.url && personal.links.length < 5) {
    personal.links.push({ label: 'Website', url: text(basics.url) })
  }

  const sections = [
    text(basics.summary) ? section('summary', [{ text: text(basics.summary) }]) : null,

    section(
      'experience',
      (input.work ?? []).map((item) => ({
        role: text(item.position),
        organisation: text(item.name) || text(item.company),
        location: text(item.location),
        startDate: toMonth(item.startDate),
        endDate: toMonth(item.endDate),
        current: !text(item.endDate),
        bullets: strings(item.highlights),
      }))
    ),

    section(
      'education',
      (input.education ?? []).map((item) => ({
        degree: [text(item.studyType), text(item.area)].filter(Boolean).join(', '),
        organisation: text(item.institution),
        startDate: toMonth(item.startDate),
        endDate: toMonth(item.endDate),
        grade: text(item.score),
        coursework: strings(item.courses),
      }))
    ),

    section(
      'projects',
      (input.projects ?? []).map((item) => ({
        name: text(item.name),
        url: text(item.url),
        startDate: toMonth(item.startDate),
        endDate: toMonth(item.endDate),
        stack: strings(item.keywords),
        bullets: strings(item.highlights).length
          ? strings(item.highlights)
          : text(item.description)
            ? [text(item.description)]
            : [],
      }))
    ),

    section(
      'skills',
      (input.skills ?? []).map((item) => ({
        group: text(item.name),
        items: strings(item.keywords),
      }))
    ),

    section(
      'certifications',
      (input.certificates ?? []).map((item) => ({
        name: text(item.name),
        issuer: text(item.issuer),
        startDate: toMonth(item.date),
        url: text(item.url),
      }))
    ),

    section(
      'achievements',
      (input.awards ?? []).map((item) => ({
        title: text(item.title),
        startDate: toMonth(item.date),
        detail: [text(item.awarder), text(item.summary)].filter(Boolean).join('. '),
      }))
    ),

    section(
      'languages',
      (input.languages ?? []).map((item) => ({
        name: text(item.language),
        level: text(item.fluency),
      }))
    ),

    section(
      'publications',
      (input.publications ?? []).map((item) => ({
        title: text(item.name),
        venue: text(item.publisher),
        startDate: toMonth(item.releaseDate),
        url: text(item.url),
      }))
    ),

    section(
      'references',
      (input.references ?? []).map((item) => ({
        name: text(item.name),
        contact: text(item.reference),
      }))
    ),
  ].filter(Boolean) as ImportedSection[]

  // named rather than silent: JSON Resume carries sections R4U has no home for
  for (const key of ['volunteer', 'interests', 'meta'] as const) {
    if (Array.isArray((input as Record<string, unknown>)[key])) skipped.push(key)
  }

  return { personal, sections, skipped }
}
