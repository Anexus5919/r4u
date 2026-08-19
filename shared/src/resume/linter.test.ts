import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '../fixtures/sample-resume.js'
import { countBySeverity, lintResume } from './linter.js'
import { ResumeBase } from './schema.js'
import type { Finding } from './linter.js'

function lintBullets(bullets: string[], resumeType: 'technical' | 'academic' = 'technical') {
  return lintResume({
    resumeType,
    sections: [
      {
        _id: 's1',
        type: 'experience',
        title: 'Work Experience',
        hidden: false,
        locked: false,
        keepTogether: false,
        startOnNewPage: false,
        entries: [
          {
            _id: 'e1',
            hidden: false,
            data: { role: 'Engineer', organisation: 'Halden', bullets },
          },
        ],
      },
    ],
  } as never)
}

const rules = (findings: Finding[]) => findings.map((f) => f.rule)

describe('bullet rules', () => {
  it('flags an opener that describes an assignment', () => {
    const found = lintBullets([
      'Responsible for the billing service and its 4 downstream consumers.',
    ])
    expect(rules(found)).toContain('weak-opener')
  })

  it('flags a filler verb that is not already a weak opener', () => {
    // "Worked on" would match the opener rule first, which is the more specific message
    expect(rules(lintBullets(['Made 3 payment integrations for the checkout team.']))).toContain(
      'weak-verb'
    )
  })

  it('prefers the opener rule when both could fire', () => {
    const found = rules(lintBullets(['Worked on 3 payment integrations.']))

    expect(found).toContain('weak-opener')
    expect(found).not.toContain('weak-verb')
  })

  it('flags a first-person pronoun as an error', () => {
    const found = lintBullets(['I reduced page load time by 40% across 3 services.'])
    const pronoun = found.find((f) => f.rule === 'first-person')

    expect(pronoun?.severity).toBe('error')
  })

  it('flags a bullet with no measurable result', () => {
    expect(rules(lintBullets(['Built the internal admin tool.']))).toContain('not-quantified')
  })

  it('flags a bullet that has stopped being scannable', () => {
    const long = `Led ${'a very long clause '.repeat(12)} across 4 teams.`
    expect(rules(lintBullets([long]))).toContain('bullet-too-long')
  })

  it('flags a cliche', () => {
    const found = lintBullets(['Built 3 services as a team player with a proven track record.'])
    expect(rules(found)).toContain('cliche')
  })

  it('points at the exact bullet it is about', () => {
    const found = lintBullets([
      'Reduced latency by 41% by adding a cache.',
      'Responsible for the roadmap.',
    ])
    const weak = found.find((f) => f.rule === 'weak-opener')

    expect(weak?.entryId).toBe('e1')
    expect(weak?.field).toBe('bullets')
    expect(weak?.index).toBe(1)
  })
})

describe('entry rules', () => {
  it('nudges when a role is thin', () => {
    expect(rules(lintBullets(['Reduced latency by 41%.']))).toContain('too-few-bullets')
  })

  it('nudges when a role dilutes itself', () => {
    const many = Array.from(
      { length: 7 },
      (_, i) => `Reduced latency by ${i + 1}0% in service ${i}.`
    )
    expect(rules(lintBullets(many))).toContain('too-many-bullets')
  })

  it('flags a verb used to open more than two bullets', () => {
    const repeated = [
      'Built 3 services on the payments platform.',
      'Built 4 internal tools for the support team.',
      'Built 2 dashboards used by 40 people.',
    ]
    expect(rules(lintBullets(repeated))).toContain('repeated-verb')
  })
})

/*
  A linter that flags everything is noise. The sample resume is the worked example the product
  shows off, so it has to come back clean on the rules that matter.
*/
describe('the sample resume', () => {
  const findings = lintResume(ResumeBase.parse(SAMPLE_RESUME))

  it('raises no errors', () => {
    expect(countBySeverity(findings).error).toBe(0)
  })

  it('raises no weak openers, fillers or cliches', () => {
    const noisy = findings.filter((f) =>
      ['weak-opener', 'weak-verb', 'cliche', 'not-quantified'].includes(f.rule)
    )

    expect(noisy).toEqual([])
  })
})

describe('scope', () => {
  it('ignores a hidden section', () => {
    const findings = lintResume({
      resumeType: 'technical',
      sections: [
        {
          _id: 's1',
          type: 'experience',
          title: 'Work Experience',
          hidden: true,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [{ _id: 'e1', hidden: false, data: { bullets: ['Responsible for things.'] } }],
        },
      ],
    } as never)

    expect(findings).toEqual([])
  })

  /*
    Gating on resumeType is what stops the linter fighting the user. Publications are not bullets,
    a citation cannot be quantified, and a references section is correct on a CV.
  */
  it('leaves an academic CV alone where the rules do not apply', () => {
    const cv = {
      resumeType: 'academic' as const,
      sections: [
        {
          _id: 's1',
          type: 'references' as const,
          title: 'References',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [{ _id: 'e1', hidden: false, data: { name: 'Prof. R Patel' } }],
        },
      ],
    }

    expect(lintResume(cv as never)).toEqual([])
  })

  it('tells a resume that a references section is not earning its space', () => {
    const resume = {
      resumeType: 'technical' as const,
      sections: [
        {
          _id: 's1',
          type: 'references' as const,
          title: 'References',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [],
        },
      ],
    }

    expect(rules(lintResume(resume as never))).toContain('references-section')
  })

  it('handles a resume with nothing in it', () => {
    expect(() => lintResume({})).not.toThrow()
    expect(lintResume({})).toEqual([])
  })
})

describe('summary rules', () => {
  const summary = (text: string) =>
    lintResume({
      resumeType: 'technical',
      sections: [
        {
          _id: 's1',
          type: 'summary',
          title: 'Summary',
          hidden: false,
          locked: false,
          keepTogether: false,
          startOnNewPage: false,
          entries: [{ _id: 'e1', hidden: false, data: { text } }],
        },
      ],
    } as never)

  it('flags a summary that is too short', () => {
    expect(rules(summary('Backend engineer.'))).toContain('summary-length')
  })

  it('accepts one in the right band', () => {
    const text = `Backend engineer with six years building payment systems. ${'Known for making flaky services boring. '.repeat(10)}`

    expect(text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(50)
    expect(rules(summary(text))).not.toContain('summary-length')
  })

  it('flags pronouns in a summary', () => {
    expect(rules(summary('I am a backend engineer who builds payment systems.'))).toContain(
      'first-person'
    )
  })
})
