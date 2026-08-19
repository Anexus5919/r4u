import { z } from 'zod'
import { MAX_LINKS, MAX_SECTIONS, RESUME_TYPES, SECTION_TYPES } from './sections.js'

/*
  Two Zod 4 traps govern the shape of this file.

  1. `.partial()` throws outright on an object schema that already carries a refinement. So the
     base object is composed first and completely, the draft schema is derived from it, and the
     strict schema attaches its cross-field rules last. Reordering these breaks the module at
     import time, not at call time.

  2. `.default({})` injects the literal value without parsing it, so a nested object ships as
     `{}` with none of its own defaults filled in. `.prefault({})` runs it through the schema.
     The failure is silent: the resume renders with an undefined accent and nobody notices.

  Both are pinned by tests in schema.test.ts against the installed version.
*/

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const EntrySchema = z.object({
  _id: z.string().optional(),
  hidden: z.boolean().default(false),
  /*
    Deliberately open. Per-type field validation is driven by SECTION_REGISTRY at the edge,
    where the section type is known, rather than by a discriminated union here that would have
    to be kept in step with the registry by hand.
  */
  data: z.record(z.string(), z.unknown()).prefault({}),
})

export const SectionSchema = z.object({
  _id: z.string().optional(),
  type: z.enum(SECTION_TYPES),
  title: z.string().min(1, 'Give the section a heading').max(60),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  keepTogether: z.boolean().default(false),
  startOnNewPage: z.boolean().default(false),
  entries: z.array(EntrySchema).default([]),
})

export const LinkSchema = z.object({
  label: z.string().max(30),
  url: z.string().max(200),
})

export const PersonalSchema = z.object({
  fullName: z.string().max(60).default(''),
  headline: z.string().max(80).default(''),
  email: z.string().max(254).default(''),
  phone: z.string().max(32).default(''),
  location: z.string().max(60).default(''),
  links: z.array(LinkSchema).max(MAX_LINKS).default([]),
})

export const DesignSchema = z.object({
  accent: z.string().max(20).default(''),
  typeScale: z.number().min(9.5).max(11.5).default(10.5),
  leading: z.number().min(1.2).max(1.45).default(1.35),
  sectionSpacing: z.enum(['compact', 'normal', 'airy']).default('normal'),
  margins: z.number().min(16).max(25).default(20),
})

/** The complete object. No refinements, so `.partial()` still works on it. */
export const ResumeBase = z.object({
  title: z.string().min(1, 'Give the resume a title').max(80),
  resumeType: z.enum(RESUME_TYPES).default('professional'),
  templateKey: z.string().min(1).max(40).default('foundry'),
  design: DesignSchema.prefault({}),
  personal: PersonalSchema.prefault({}),
  sections: z.array(SectionSchema).max(MAX_SECTIONS).default([]),
  notes: z.string().max(4000).default(''),
})

/**
 * Autosave. Every field optional, because a half-typed resume must never be rejected: the user
 * is mid-sentence, not submitting a form.
 */
export const ResumeDraftSchema = ResumeBase.partial()

interface DateRange {
  startDate?: unknown
  endDate?: unknown
  current?: unknown
}

/*
  FR 4.4, and dimension B of the ATS rubric.

  Format first, then ordering. Month strings sort lexicographically once they are zero padded,
  so a string compare is correct here and needs no date parsing at all.

  Entry data is an open record, so these rules cannot live on the field schemas. They belong on
  the strict schema, where every entry is visible at once.
*/
function dateIssues(sections: z.infer<typeof SectionSchema>[]) {
  const issues: { path: (string | number)[]; message: string }[] = []

  sections.forEach((section, sectionIndex) => {
    section.entries.forEach((entry, entryIndex) => {
      const data = entry.data as DateRange
      const at = (key: string) => ['sections', sectionIndex, 'entries', entryIndex, 'data', key]

      const start = typeof data.startDate === 'string' ? data.startDate : ''
      const end = typeof data.endDate === 'string' ? data.endDate : ''

      for (const [key, value] of [
        ['startDate', start],
        ['endDate', end],
      ] as const) {
        if (value && !MONTH_PATTERN.test(value)) {
          issues.push({ path: at(key), message: 'Use the format YYYY-MM' })
        }
      }

      if (!start || !end || data.current === true) return
      if (!MONTH_PATTERN.test(start) || !MONTH_PATTERN.test(end)) return
      if (end >= start) return

      issues.push({
        path: at('endDate'),
        message: 'The end date cannot be before the start date',
      })
    })
  })

  return issues
}

/** Strict. Used when publishing or exporting, never on the autosave path. */
export const ResumeSchema = ResumeBase.check((ctx) => {
  for (const issue of dateIssues(ctx.value.sections)) {
    ctx.issues.push({ code: 'custom', input: ctx.value, ...issue })
  }
})

/*
  A typed fallback for the one subdocument that is routinely absent.

  `resume.personal ?? {}` widens to `{}` and every field access on it becomes a type error, which
  has now been written out by hand in three places. One helper instead.
*/
export function personalOf(resume: { personal?: ResumePersonal }): Partial<ResumePersonal> {
  return resume.personal ?? {}
}

export type Resume = z.infer<typeof ResumeBase>
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>
export type ResumeSection = z.infer<typeof SectionSchema>
export type ResumeEntry = z.infer<typeof EntrySchema>
export type ResumePersonal = z.infer<typeof PersonalSchema>
export type ResumeDesign = z.infer<typeof DesignSchema>
