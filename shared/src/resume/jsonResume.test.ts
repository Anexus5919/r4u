import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { fromJsonResume, toJsonResume } from './jsonResume.js'
import { ResumeBase } from './schema.js'

const resume = ResumeBase.parse(SAMPLE_RESUME)

describe('export', () => {
  const json = toJsonResume(resume)

  it('carries the basics', () => {
    expect(json.basics?.name).toBe('Alex Mercer')
    expect(json.basics?.email).toBe('alex.mercer@example.com')
    expect(json.basics?.label).toBe('Backend engineer, distributed systems')
  })

  it('maps work with highlights', () => {
    expect(json.work).toHaveLength(2)
    expect(json.work?.[0]).toMatchObject({
      name: 'Halden Payments',
      position: 'Senior Backend Engineer',
    })
    expect((json.work?.[0]?.highlights as string[]).length).toBe(4)
  })

  /* A current role has no end date in JSON Resume, rather than an end date equal to today. */
  it('leaves the end date empty on a current role', () => {
    expect(json.work?.[0]?.endDate).toBe('')
    expect(json.work?.[1]?.endDate).toBe('2023-01')
  })

  it('maps skills groups to named skill blocks with keywords', () => {
    expect(json.skills).toHaveLength(3)
    expect(json.skills?.[0]).toMatchObject({ name: 'Languages' })
    expect(json.skills?.[0]?.keywords).toContain('TypeScript')
  })

  // an export is what the resume says, so a hidden section must not reappear in it
  it('omits a hidden section', () => {
    expect(json.certificates).toHaveLength(0)
  })

  it('never carries the private notes field', () => {
    const withNotes = { ...resume, notes: 'NEVER-EXPORT-THIS' }
    expect(JSON.stringify(toJsonResume(withNotes))).not.toContain('NEVER-EXPORT-THIS')
  })
})

describe('import', () => {
  const source = {
    basics: {
      name: 'Neha Verma',
      label: 'Platform engineer',
      email: 'neha@example.com',
      phone: '+44 161 496 0233',
      url: 'nehaverma.dev',
      summary: 'Platform engineer with four years on developer tooling.',
      location: { city: 'Leeds', region: 'England', countryCode: 'GB' },
      profiles: [{ network: 'GitHub', url: 'github.com/nehaverma' }],
    },
    work: [
      {
        name: 'Corvid Messaging',
        position: 'Platform Engineer',
        startDate: '2021-04',
        endDate: '2024-08',
        highlights: ['Cut build times by 55%.'],
      },
    ],
    education: [
      {
        institution: 'University of Leeds',
        studyType: 'BSc',
        area: 'Computer Science',
        startDate: '2017',
        endDate: '2020',
      },
    ],
    skills: [{ name: 'Languages', keywords: ['Go', 'Python'] }],
    volunteer: [{ organization: 'Code Club' }],
  }

  const { personal, sections, skipped } = fromJsonResume(source)

  it('maps the basics, joining the location', () => {
    expect(personal.fullName).toBe('Neha Verma')
    expect(personal.location).toBe('Leeds, England, GB')
  })

  it('keeps profiles and the site as links', () => {
    expect(personal.links).toHaveLength(2)
    expect(personal.links[0]).toEqual({ label: 'GitHub', url: 'github.com/nehaverma' })
    expect(personal.links[1]?.label).toBe('Website')
  })

  it('turns the summary into a section rather than a field', () => {
    const summary = sections.find((s) => s.type === 'summary')
    expect(summary?.entries[0]?.data.text).toContain('Platform engineer')
  })

  it('normalises a bare year to the month format the schema expects', () => {
    const education = sections.find((s) => s.type === 'education')
    expect(education?.entries[0]?.data.startDate).toBe('2017-01')
    expect(education?.entries[0]?.data.degree).toBe('BSc, Computer Science')
  })

  it('marks a role with no end date as current', () => {
    const running = fromJsonResume({
      work: [{ name: 'Halden', position: 'Engineer', startDate: '2023-02' }],
    })
    expect(running.sections[0]?.entries[0]?.data.current).toBe(true)
  })

  // naming what did not come across is what makes an import trustworthy
  it('reports what it could not place', () => {
    expect(skipped).toContain('volunteer')
  })

  it('produces no empty sections', () => {
    expect(sections.every((section) => section.entries.length > 0)).toBe(true)
  })

  it('accepts an empty document', () => {
    const empty = fromJsonResume({})
    expect(empty.sections).toEqual([])
    expect(empty.personal.fullName).toBe('')
  })
})

// the real test of an interchange format: what survives export but not import is lost
describe('round trip', () => {
  const back = fromJsonResume(toJsonResume(resume))

  it('preserves the identity', () => {
    expect(back.personal.fullName).toBe('Alex Mercer')
    expect(back.personal.email).toBe('alex.mercer@example.com')
    expect(back.personal.location).toBe('Manchester, United Kingdom')
  })

  it('preserves every visible role with its bullets', () => {
    const experience = back.sections.find((s) => s.type === 'experience')

    expect(experience?.entries).toHaveLength(2)
    expect(experience?.entries[0]?.data.role).toBe('Senior Backend Engineer')
    expect(experience?.entries[0]?.data.bullets).toHaveLength(4)
    expect(experience?.entries[0]?.data.current).toBe(true)
  })

  it('preserves skills groups', () => {
    const skills = back.sections.find((s) => s.type === 'skills')

    expect(skills?.entries).toHaveLength(3)
    expect(skills?.entries[0]?.data.items).toContain('TypeScript')
  })

  it('preserves the summary', () => {
    const summary = back.sections.find((s) => s.type === 'summary')
    expect(String(summary?.entries[0]?.data.text)).toContain('Backend engineer with six years')
  })
})
