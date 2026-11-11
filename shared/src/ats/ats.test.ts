import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { DOC_COLORS } from '../layout/tokens.js'
import type { LayoutNode, ResumeTemplate } from '../layout/types.js'
import type { Resume, ResumeSection } from '../resume/schema.js'
import { getTemplate } from '../templates/index.js'
import { deltaE, hiddenText, serializeToParserView } from './parserView.js'
import { scoreResume } from './score.js'
import { findSkills } from './text.js'

const clone = (): Resume => structuredClone(SAMPLE_RESUME)

function section(
  type: ResumeSection['type'],
  title: string,
  data: Record<string, unknown>[]
): ResumeSection {
  return {
    _id: `${type}-1`,
    type,
    title,
    hidden: false,
    locked: false,
    keepTogether: false,
    startOnNewPage: false,
    entries: data.map((d, i) => ({ _id: `${type}-e${i}`, hidden: false, data: d })),
  } as ResumeSection
}

function withSections(...sections: ResumeSection[]): Resume {
  return { ...clone(), sections }
}

const role = (bullets: string[], extra: Record<string, unknown> = {}) => ({
  role: 'Backend Engineer',
  organisation: 'Halden',
  startDate: '2021-01',
  endDate: '2023-06',
  bullets,
  ...extra,
})

const checkOf = (resume: Partial<Resume>, id: string, jobDescription?: string) =>
  scoreResume(resume, { jobDescription }).checks.find((c) => c.checkId === id)!

describe('the quantification guard (the exit criterion)', () => {
  it('scores a duty-only bullet in a 2021 to 2023 role at zero on D3', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [
        role([
          'Maintained the billing service from 2021 to 2023 using Node 18.2 and v3.1.4 of the SDK.',
        ]),
      ])
    )
    const d3 = checkOf(resume, 'D3')
    expect(d3.earned).toBe(0)
    expect(d3.status).toBe('fail')
  })

  it('still credits a real number, and full marks arrive at half the bullets', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [
        role([
          'Reduced settlement latency by 41% with an event-driven writer.',
          'Maintained the billing service.',
        ]),
      ])
    )
    expect(checkOf(resume, 'D3').earned).toBe(4)
  })
})

describe('dimension A: parseability', () => {
  it('gives a single-column template the full 30', () => {
    const result = scoreResume({ ...clone(), templateKey: 'foundry' })
    expect(result.dimensions.find((d) => d.id === 'A')!.earned).toBe(30)
  })

  it('grades two columns to zero on A2 when education sits in the sidebar, and caps A at the template ceiling', () => {
    const result = scoreResume({ ...clone(), templateKey: 'recto' })
    expect(result.checks.find((c) => c.checkId === 'A2')!.earned).toBe(0)
    expect(result.dimensions.find((d) => d.id === 'A')!.earned).toBe(21)
    expect(result.templateCeiling).toMatchObject({ max: 21, best: 'Foundry' })
  })

  it('gives the date rail half of A2', () => {
    expect(checkOf({ ...clone(), templateKey: 'marginalia' }, 'A2').earned).toBe(3)
  })

  it('takes a point off A7 for body text under 10pt', () => {
    const resume = clone()
    resume.design.typeScale = 9.5
    expect(checkOf(resume, 'A7').earned).toBe(1)
  })
})

describe('dimension B: structure', () => {
  it('accepts a whitelisted experience heading and refuses a creative one', () => {
    const ok = withSections(
      section('experience', 'Professional Experience', [role(['Built a thing.'])])
    )
    const bad = withSections(section('experience', 'Where I have been', [role(['Built a thing.'])]))
    expect(checkOf(ok, 'B1').earned).toBe(5)
    const b1 = checkOf(bad, 'B1')
    expect(b1.earned).toBe(0)
    expect(b1.target).toMatchObject({ sectionId: 'experience-1', field: 'title' })
  })

  it('gives Core Competencies the amber 2 of 3', () => {
    const resume = withSections(section('skills', 'Core Competencies', [{ items: ['Go'] }]))
    expect(checkOf(resume, 'B3').earned).toBe(2)
  })

  it('scores B7 in proportion to complete roles and names the missing field', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [
        role(['Built a thing.']),
        role(['Built a thing.'], { organisation: '' }),
      ])
    )
    const b7 = checkOf(resume, 'B7')
    expect(b7.earned).toBe(1.5)
    expect(b7.message).toMatch(/Role 2 is missing a company/)
    expect(b7.target?.entryId).toBe('experience-e1')
  })

  it('wants the newest role first', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [
        role(['Built a thing.'], { startDate: '2019-01', endDate: '2020-01' }),
        role(['Built a thing.'], { startDate: '2021-01', endDate: '2022-01' }),
      ])
    )
    expect(checkOf(resume, 'B6').earned).toBe(0)
  })
})

describe('dimension C: contact', () => {
  it('fails C1 when a second email appears in the body', () => {
    const resume = withSections(
      section('summary', 'Summary', [{ text: 'Reach me at other@example.com any time.' }])
    )
    expect(checkOf(resume, 'C1').earned).toBe(0)
  })

  it('refuses a street address and personal data', () => {
    const resume = clone()
    resume.personal.location = '221 Baker Street, London'
    expect(checkOf(resume, 'C4').earned).toBe(0)
    const dob = withSections(
      section('summary', 'Summary', [{ text: 'Date of birth: 1 May 2001.' }])
    )
    expect(checkOf(dob, 'C5').message).toMatch(/date of birth/)
  })
})

describe('dimension D: content', () => {
  it('awards D2 in full at 80 percent action verbs, not 100', () => {
    const bullets = [
      'Built a ledger.',
      'Led a team of four.',
      'Reduced cost by 10%.',
      'Shipped the app.',
      'Was on the team.',
    ]
    expect(
      checkOf(withSections(section('experience', 'Work Experience', [role(bullets)])), 'D2').earned
    ).toBe(4)
  })

  it('allows present tense only on a current role', () => {
    const current = withSections(
      section('experience', 'Work Experience', [
        role(['Lead the platform team of six engineers.'], { current: true, endDate: '' }),
      ])
    )
    const past = withSections(
      section('experience', 'Work Experience', [role(['Lead the platform team of six engineers.'])])
    )
    expect(checkOf(current, 'D2').earned).toBe(4)
    expect(checkOf(past, 'D2').earned).toBe(0)
  })

  it('names the weak opener and the bullet it is in', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [
        role(['Built a ledger writer.', 'Responsible for the billing service.']),
      ])
    )
    const d4 = checkOf(resume, 'D4')
    expect(d4.earned).toBe(0)
    expect(d4.message).toMatch(/Bullet 2 opens with "Responsible for"/)
  })

  it('catches a first-person pronoun', () => {
    const resume = withSections(
      section('experience', 'Work Experience', [role(['I built the ledger writer.'])])
    )
    expect(checkOf(resume, 'D5').earned).toBe(0)
  })
})

describe('dimension E: job-description match', () => {
  const posting = `Backend Engineer
Requirements:
- TypeScript, PostgreSQL, Kafka and Kubernetes
- 3+ years of experience
Benefits
We use Salesforce, Snowflake and Tableau for everything.`

  it('reports format only, scaled to 100, when no posting is pasted', () => {
    const result = scoreResume(clone())
    expect(result.mode).toBe('format_only')
    expect(result.checks.some((c) => c.dimension === 'E')).toBe(false)
  })

  it('drops boilerplate and finds full marks at 75 percent of the hard skills', () => {
    const result = scoreResume(clone(), { jobDescription: posting })
    expect(result.mode).toBe('full')
    expect(result.keywords!.missing).not.toContain('Salesforce')
    expect(result.keywords!.missing).toEqual(['Kubernetes'])
    expect(result.checks.find((c) => c.checkId === 'E1')!.earned).toBe(10)
  })

  it('caps E at 12 of 20 when one keyword is stuffed', () => {
    const stuffed = clone()
    const summary = stuffed.sections.find((s) => s.type === 'summary')!
    summary.entries[0]!.data = {
      text: 'Kafka Kafka Kafka Kafka Kafka Kafka expert who loves Kafka.',
    }
    const result = scoreResume(stuffed, { jobDescription: posting })
    expect(result.keywords!.stuffing.join()).toMatch(/Kafka appears/)
    expect(result.dimensions.find((d) => d.id === 'E')!.earned).toBeLessThanOrEqual(12)
  })
})

describe('skill matching', () => {
  const names = (text: string) => [...findSkills(text).keys()]

  it('never lets Java match JavaScript, and keeps C++, C# and .NET whole', () => {
    expect(names('Five years of JavaScript')).not.toContain('Java')
    expect(names('Wrote C++ and C# services on .NET')).toEqual(
      expect.arrayContaining(['C++', 'C#', '.NET'])
    )
  })

  it('matches short languages only as written', () => {
    expect(names('Services in Go and R')).toEqual(expect.arrayContaining(['Go', 'R']))
    expect(names('ready to go live with our R&D team')).not.toEqual(expect.arrayContaining(['Go']))
    expect(names('our R&D team')).not.toContain('R')
  })

  it('counts an acronym and its long form as one skill', () => {
    expect(names('Search Engine Optimization')).toContain('Search Engine Optimization')
    expect(names('SEO')).toContain('Search Engine Optimization')
  })
})

describe('parser view and the hidden-text gate', () => {
  it('interleaves two columns line by line, the way a sidebar degrades', () => {
    const view = serializeToParserView(clone(), getTemplate('recto'))
    // the first role and the sidebar's Skills heading land on the same extracted line
    const shared = (line: string) =>
      line.includes('Senior Backend Engineer') && line.includes('Skills')
    expect(view.split('\n').some(shared)).toBe(true)
    expect(view.startsWith('Alex Mercer')).toBe(true)
  })

  it('never blocks a built-in template', () => {
    for (const key of [
      'foundry',
      'quire',
      'ledger',
      'placard',
      'marginalia',
      'recto',
      'verso',
      'broadsheet',
    ]) {
      expect(hiddenText(clone(), getTemplate(key))).toEqual([])
    }
  })

  it('zeroes the score for text set under 6pt or in the page colour', () => {
    const sneaky: ResumeTemplate = {
      ...getTemplate('foundry'),
      render: (): LayoutNode[] => [
        { type: 'text', value: 'Alex Mercer' },
        { type: 'text', value: 'kubernetes aws terraform', style: { color: DOC_COLORS.paper } },
        { type: 'text', value: 'tiny keywords', style: { fontSize: 4 } },
      ],
    }
    expect(hiddenText(clone(), sneaky)).toHaveLength(2)
    expect(deltaE(DOC_COLORS.paper, DOC_COLORS.paper)).toBe(0)
    expect(deltaE(DOC_COLORS.ink, DOC_COLORS.paper)).toBeGreaterThan(10)
  })
})
