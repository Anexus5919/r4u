import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { ResumeBase } from './schema.js'
import { completeness, computeMeta, isQuantified, quantifiedRatio, wordCount } from './meta.js'

describe('isQuantified', () => {
  it('accepts real metrics', () => {
    const quantified = [
      'Reduced median settlement latency by 41% by replacing a nightly batch.',
      'Delivered 9 million notifications per day at a p99 of 240 ms.',
      'Saved £120k a year by consolidating three vendors.',
      'Improved throughput 3.5x after moving to batched writes.',
      'Mentored 4 engineers through their first production incidents.',
    ]

    for (const bullet of quantified) expect(isQuantified(bullet)).toBe(true)
  })

  // without stripping years and versions first, every duty statement counts as quantified
  it('rejects duty statements whose only numbers are dates or versions', () => {
    const notQuantified = [
      'Worked on the payments platform from 2021 to 2023.',
      'Responsible for maintaining the billing service during 2022.',
      'Migrated the service to Node 22.14.1 and TypeScript 5.9.3.',
      'Upgraded the cluster to v1.29 as part of the platform roadmap.',
      'Assisted with the 2020 replatforming effort.',
    ]

    for (const bullet of notQuantified) {
      expect(isQuantified(bullet), bullet).toBe(false)
    }
  })

  it('still counts a metric that sits alongside a year', () => {
    expect(isQuantified('Cut on-call pages by 62% during 2023.')).toBe(true)
  })

  it('rejects a bullet with no numbers at all', () => {
    expect(isQuantified('Responsible for the team roadmap and stakeholder alignment.')).toBe(false)
  })
})

describe('the sample resume', () => {
  const resume = ResumeBase.parse(SAMPLE_RESUME)

  it('parses against the schema it claims to satisfy', () => {
    expect(resume.title).toBe('Backend Developer CV')
  })

  // the fixture has to pass the check the product asks users to pass
  it('has every visible bullet quantified', () => {
    const { quantified, total } = quantifiedRatio(resume)

    expect(total).toBeGreaterThan(0)
    expect(quantified).toBe(total)
  })

  it('ships one hidden section, so hide-without-delete is exercised on every screen', () => {
    const hidden = resume.sections.filter((section) => section.hidden)

    expect(hidden).toHaveLength(1)
    expect(hidden[0]?.type).toBe('certifications')
  })

  it('excludes hidden sections from the counts', () => {
    const meta = computeMeta(resume)

    expect(meta.sectionCount).toBe(resume.sections.length - 1)
    expect(meta.wordCount).toBeGreaterThan(150)
    expect(meta.completeness).toBeGreaterThanOrEqual(90)
  })
})

describe('completeness', () => {
  it('is zero for an empty resume', () => {
    expect(completeness(ResumeBase.parse({ title: 'Empty' }))).toBe(0)
  })

  it('rises as sections are filled, not as fields are counted', () => {
    const contactOnly = ResumeBase.parse({
      title: 'Draft',
      personal: {
        fullName: 'Alex Mercer',
        email: 'alex@example.com',
        phone: '+44 20 7946 0182',
        location: 'Manchester',
      },
    })

    const withHistory = ResumeBase.parse({
      ...contactOnly,
      sections: [
        {
          type: 'experience',
          title: 'Work Experience',
          entries: [
            {
              data: { role: 'Engineer', organisation: 'Halden', bullets: ['Cut latency by 41%.'] },
            },
          ],
        },
      ],
    })

    expect(completeness(contactOnly)).toBeGreaterThan(0)
    expect(completeness(withHistory)).toBeGreaterThan(completeness(contactOnly))
  })

  it('does not count a hidden section', () => {
    const base = {
      title: 'Draft',
      sections: [
        {
          type: 'skills' as const,
          title: 'Skills',
          entries: [{ data: { group: 'Languages', items: ['Go'] } }],
        },
      ],
    }

    const visible = ResumeBase.parse(base)
    const hidden = ResumeBase.parse({
      ...base,
      sections: [{ ...base.sections[0]!, hidden: true }],
    })

    expect(completeness(visible)).toBeGreaterThan(completeness(hidden))
  })
})

// regression guard: the real caller is toObject(), where an untouched subdocument is absent
describe('tolerating stored shapes', () => {
  it('handles a document with no personal, sections or entries', () => {
    const partials = [
      {},
      { title: 'Draft' },
      { title: 'Draft', sections: undefined },
      { title: 'Draft', personal: undefined, sections: [] },
      { title: 'Draft', sections: [{ type: 'skills', title: 'Skills' }] },
      { title: 'Draft', sections: [{ type: 'skills', title: 'Skills', entries: [{}] }] },
    ]

    for (const partial of partials) {
      expect(() => computeMeta(partial as never)).not.toThrow()
      expect(computeMeta(partial as never).completeness).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('wordCount', () => {
  it('ignores hidden entries', () => {
    const resume = ResumeBase.parse({
      title: 'Draft',
      sections: [
        {
          type: 'summary',
          title: 'Summary',
          entries: [
            { data: { text: 'one two three four five' } },
            { hidden: true, data: { text: 'six seven eight nine ten' } },
          ],
        },
      ],
    })

    expect(wordCount(resume)).toBe(5)
  })
})
