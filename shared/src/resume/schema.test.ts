import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ResumeBase, ResumeDraftSchema, ResumeSchema } from './schema.js'

/*
  The first two suites pin behaviour of the installed Zod against the reasoning in schema.ts.
  If a future upgrade changes either, these fail loudly instead of the resume quietly rendering
  with no accent colour.
*/

describe('zod 4 composition traps', () => {
  it('refuses .partial() on a schema that already carries a refinement', () => {
    const refined = z.object({ a: z.string(), b: z.string() }).check(() => {})

    // this is why ResumeBase holds no refinements and ResumeSchema is derived from it
    expect(() => (refined as unknown as typeof ResumeBase).partial()).toThrow()
  })

  it('allows .partial() on the unrefined base', () => {
    expect(() => ResumeBase.partial()).not.toThrow()
  })

  it('injects .default() without parsing, and .prefault() through the schema', () => {
    const inner = z.object({ scale: z.number().default(10.5) })

    const withDefault = z.object({ design: inner.default({} as never) }).parse({})
    const withPrefault = z.object({ design: inner.prefault({}) }).parse({})

    // the silent bug: the nested default never ran
    expect(withDefault.design).toEqual({})
    expect(withPrefault.design).toEqual({ scale: 10.5 })
  })
})

describe('ResumeBase', () => {
  it('fills every nested default from a bare title', () => {
    const parsed = ResumeBase.parse({ title: 'Backend Developer CV' })

    expect(parsed.resumeType).toBe('professional')
    expect(parsed.templateKey).toBe('foundry')
    expect(parsed.sections).toEqual([])
    expect(parsed.personal.fullName).toBe('')
    expect(parsed.personal.links).toEqual([])

    // the prefault case: these only exist because DesignSchema was parsed, not injected
    expect(parsed.design.typeScale).toBe(10.5)
    expect(parsed.design.sectionSpacing).toBe('normal')
  })

  it('requires a title', () => {
    expect(ResumeBase.safeParse({}).success).toBe(false)
  })

  it('rejects a type scale outside the documented range', () => {
    const result = ResumeBase.safeParse({ title: 'CV', design: { typeScale: 14 } })
    expect(result.success).toBe(false)
  })
})

describe('ResumeDraftSchema', () => {
  /*
    Autosave fires mid-sentence. A draft with no title, no sections and a half-typed field is a
    normal state, not an error, and rejecting it would lose the user's work.
  */
  it('accepts an empty object', () => {
    expect(ResumeDraftSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a single field in isolation', () => {
    const result = ResumeDraftSchema.safeParse({ title: 'Half typed' })
    expect(result.success).toBe(true)
  })

  it('still enforces limits on the fields that are present', () => {
    const result = ResumeDraftSchema.safeParse({ title: 'x'.repeat(200) })
    expect(result.success).toBe(false)
  })
})

describe('ResumeSchema date rules', () => {
  const withDates = (startDate: string, endDate: string, current = false) => ({
    title: 'Backend Developer CV',
    sections: [
      {
        type: 'experience' as const,
        title: 'Work Experience',
        entries: [
          { data: { role: 'Engineer', organisation: 'Zendex', startDate, endDate, current } },
        ],
      },
    ],
  })

  it('accepts an end date after the start date', () => {
    expect(ResumeSchema.safeParse(withDates('2021-06', '2023-04')).success).toBe(true)
  })

  it('accepts the same month for both', () => {
    expect(ResumeSchema.safeParse(withDates('2023-04', '2023-04')).success).toBe(true)
  })

  it('rejects an end date before the start date', () => {
    const result = ResumeSchema.safeParse(withDates('2023-04', '2021-06'))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['sections', 0, 'entries', 0, 'data', 'endDate'])
  })

  it('ignores the end date on a current role', () => {
    expect(ResumeSchema.safeParse(withDates('2023-04', '2021-06', true)).success).toBe(true)
  })

  it('rejects a malformed month', () => {
    const result = ResumeSchema.safeParse(withDates('2021-13', '2023-04'))
    expect(result.success).toBe(false)
  })
})
