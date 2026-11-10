import { isQuantified } from './meta.js'
import { MAX_BULLETS_PER_ENTRY, WARN_BULLETS_PER_ENTRY } from './sections.js'
import type { Resume, ResumeSection } from './schema.js'
import {
  CLICHES,
  FIRST_PERSON,
  WEAK_OPENERS,
  firstWord,
  isActionVerb,
  isWeakVerb,
} from './verbs.js'

// rule-based, no model call: every finding names its rule, which makes it coaching

export type Severity = 'error' | 'warning' | 'hint'

export interface Finding {
  rule: string
  severity: Severity
  message: string
  sectionId?: string
  entryId?: string
  field?: string
  /** which bullet within the field, when the finding is about one */
  index?: number
}

const BULLET_MAX_WORDS = 35
const SUMMARY_MIN_WORDS = 50
const SUMMARY_MAX_WORDS = 100

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)

function bulletsOf(entry: { data: Record<string, unknown> }): string[] {
  const value = entry.data.bullets
  return Array.isArray(value) ? value.filter((b): b is string => typeof b === 'string') : []
}

function lintBullet(
  bullet: string,
  at: { sectionId: string; entryId: string; index: number },
  out: Finding[]
) {
  const trimmed = bullet.trim()
  if (!trimmed) return

  const base = { sectionId: at.sectionId, entryId: at.entryId, field: 'bullets', index: at.index }

  if (WEAK_OPENERS.test(trimmed)) {
    out.push({
      ...base,
      rule: 'weak-opener',
      severity: 'warning',
      message: 'This describes an assignment, not an outcome. Start with what you did.',
    })
  } else {
    const opener = firstWord(trimmed)
    if (isWeakVerb(opener)) {
      out.push({
        ...base,
        rule: 'weak-verb',
        severity: 'warning',
        message: `"${opener}" is a filler verb. Try Led, Built, Reduced, Automated or Migrated.`,
      })
    } else if (opener && !isActionVerb(opener)) {
      out.push({
        ...base,
        rule: 'no-action-verb',
        severity: 'hint',
        message: 'Lead with an action verb so the sentence opens on what you achieved.',
      })
    }
  }

  if (FIRST_PERSON.test(trimmed)) {
    out.push({
      ...base,
      rule: 'first-person',
      severity: 'error',
      message: 'Remove pronouns. Resume bullets are written in implied first person.',
    })
  }

  if (!isQuantified(trimmed)) {
    out.push({
      ...base,
      rule: 'not-quantified',
      severity: 'hint',
      message: 'Add a measurable result: accomplished X as measured by Y by doing Z.',
    })
  }

  const count = words(trimmed).length
  if (count > BULLET_MAX_WORDS) {
    out.push({
      ...base,
      rule: 'bullet-too-long',
      severity: 'warning',
      message: `This runs ${count} words. Over ${BULLET_MAX_WORDS} it stops being scannable, so split it.`,
    })
  }

  const cliche = CLICHES.find((phrase) => trimmed.toLowerCase().includes(phrase))
  if (cliche) {
    out.push({
      ...base,
      rule: 'cliche',
      severity: 'warning',
      message: `"${cliche}" is a claim without evidence. Replace it with the bullet that proves it.`,
    })
  }
}

function lintSection(section: ResumeSection, out: Finding[]) {
  if (section.hidden) return

  const sectionId = String(section._id ?? '')
  const verbCounts = new Map<string, number>()

  for (const entry of section.entries) {
    if (entry.hidden) continue

    const entryId = String(entry._id ?? '')
    const bullets = bulletsOf(entry)

    bullets.forEach((bullet, index) => {
      lintBullet(bullet, { sectionId, entryId, index }, out)

      const opener = firstWord(bullet)
      if (isActionVerb(opener)) verbCounts.set(opener, (verbCounts.get(opener) ?? 0) + 1)
    })

    // only roles carry bullets, so the count nudge belongs to those sections
    if (section.type === 'experience' || section.type === 'projects') {
      if (bullets.length > 0 && bullets.length < 3) {
        out.push({
          sectionId,
          entryId,
          rule: 'too-few-bullets',
          severity: 'hint',
          message: `${bullets.length} bullet${bullets.length === 1 ? '' : 's'} reads as thin. Aim for three to six.`,
        })
      }

      if (bullets.length > WARN_BULLETS_PER_ENTRY) {
        out.push({
          sectionId,
          entryId,
          rule: 'too-many-bullets',
          severity: 'hint',
          message: `${bullets.length} bullets dilutes your strongest points. Keep the best ${WARN_BULLETS_PER_ENTRY}, up to ${MAX_BULLETS_PER_ENTRY}.`,
        })
      }
    }
  }

  for (const [verb, count] of verbCounts) {
    if (count > 2) {
      out.push({
        sectionId,
        rule: 'repeated-verb',
        severity: 'hint',
        message: `"${verb}" opens ${count} bullets in this section. Vary the opener.`,
      })
    }
  }
}

function lintSummary(section: ResumeSection, out: Finding[]) {
  if (section.hidden) return

  const entry = section.entries[0]
  const text = typeof entry?.data.text === 'string' ? entry.data.text : ''
  if (!text.trim()) return

  const count = words(text).length
  if (count < SUMMARY_MIN_WORDS || count > SUMMARY_MAX_WORDS) {
    out.push({
      sectionId: String(section._id ?? ''),
      entryId: String(entry?._id ?? ''),
      field: 'text',
      rule: 'summary-length',
      severity: 'hint',
      message: `${count} words. Aim for ${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS}, around three to five sentences.`,
    })
  }

  if (FIRST_PERSON.test(text)) {
    out.push({
      sectionId: String(section._id ?? ''),
      entryId: String(entry?._id ?? ''),
      field: 'text',
      rule: 'first-person',
      severity: 'error',
      message: 'Remove pronouns. A summary is written in implied first person.',
    })
  }
}

// gated on resumeType: a CV must not be told to quantify a citation
export function lintResume(resume: Partial<Resume>): Finding[] {
  const findings: Finding[] = []
  const sections = Array.isArray(resume.sections) ? resume.sections : []
  const academic = resume.resumeType === 'academic'

  for (const section of sections) {
    if (section.type === 'summary') {
      lintSummary(section, findings)
      continue
    }

    if (academic && (section.type === 'publications' || section.type === 'references')) continue

    lintSection(section, findings)
  }

  if (!academic) {
    const hasReferences = sections.some((s) => s.type === 'references' && !s.hidden)
    if (hasReferences) {
      findings.push({
        rule: 'references-section',
        severity: 'hint',
        message:
          'A references section is expected on a CV, not a resume. The space is better spent on results.',
      })
    }
  }

  return findings
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return {
    error: findings.filter((f) => f.severity === 'error').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    hint: findings.filter((f) => f.severity === 'hint').length,
  }
}

export function findingsFor(findings: Finding[], entryId: string): Finding[] {
  return findings.filter((finding) => finding.entryId === entryId)
}
