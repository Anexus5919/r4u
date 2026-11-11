import { list, str, toTemplateResume } from '../layout/helpers.js'
import type { ResumeTemplate, TemplateResume } from '../layout/types.js'
import { isQuantified } from '../resume/meta.js'
import type { Resume } from '../resume/schema.js'
import { DesignSchema } from '../resume/schema.js'
import { CLICHES, FIRST_PERSON, WEAK_OPENERS, firstWord, isActionVerb } from '../resume/verbs.js'
import { TEMPLATE_LIST, getTemplate, slotFor } from '../templates/index.js'
import { hiddenText, serializeToParserView } from './parserView.js'
import { CHECK_BY_ID, DIMENSIONS, E_CAP, RUBRIC_VERSION } from './rubric.js'
import type { AtsCheckResult, AtsKeywordReport, AtsResult, DimensionId } from './rubric.js'
import {
  countWords,
  fallbackTerms,
  findSkills,
  normalise,
  splitPosting,
  stemmedVocabulary,
} from './text.js'

export interface ScoreOptions {
  /** pasted only, never fetched; used for this request and never stored */
  jobDescription?: string
  /** measured by the renderer when known, otherwise estimated from the word count */
  pageCount?: number
}

type Section = TemplateResume['sections'][number]
type Target = AtsCheckResult['target']

const round1 = (value: number) => Math.round(value * 10) / 10

function check(id: string, earned: number, message = '', target?: Target): AtsCheckResult {
  const def = CHECK_BY_ID.get(id)!
  const value = Math.max(0, Math.min(def.points, round1(earned)))
  const status = value >= def.points ? 'pass' : value <= 0 ? 'fail' : 'partial'
  return {
    checkId: id,
    dimension: def.dimension,
    title: def.title,
    status,
    earned: value,
    possible: def.points,
    message: status === 'pass' ? '' : message,
    target,
  }
}

// a check that does not apply scores in full and says why, rather than vanishing
function notApplicable(id: string, reason: string): AtsCheckResult {
  const def = CHECK_BY_ID.get(id)!
  return {
    checkId: id,
    dimension: def.dimension,
    title: def.title,
    status: 'na',
    earned: def.points,
    possible: def.points,
    message: reason,
  }
}

const heading = (title: string) =>
  normalise(title.replace(/&/g, ' and '))
    .replace(/[^a-z ]/g, '')
    .trim()

const EXPERIENCE_HEADINGS = [
  'work experience',
  'professional experience',
  'experience',
  'employment history',
  'work history',
  'career history',
  'relevant experience',
]
const EDUCATION_HEADINGS = ['education', 'education and training', 'academic background']
const SKILLS_HEADINGS = ['skills', 'technical skills']

// the rubric's list plus the faces R4U ships as static TTFs, which embed with a complete CMap
const SAFE_FONTS = [
  'arial',
  'calibri',
  'helvetica',
  'georgia',
  'cambria',
  'garamond',
  'palatino',
  'tahoma',
  'verdana',
  'times new roman',
  'source sans 3',
  'source serif 4',
  'geist',
  'eb garamond',
  'ibm plex serif',
  'spectral',
]
const PLAIN_BULLETS = ['-', '•', '◦', '▪', '■', '○', '·']

const PERSONAL_DATA: [RegExp, string][] = [
  [/\b(date of birth|d\.o\.b|dob|born on)\b/i, 'your date of birth'],
  [/\bmarital status\b|\b(married|unmarried)\b/i, 'your marital status'],
  [/\bpassport\b/i, 'your passport details'],
  [/\b(driving|driver'?s) licen[cs]e\b/i, 'your driving licence'],
  [/\bgender\b/i, 'your gender'],
  [/\bnationality\b/i, 'your nationality'],
  [/\breligion\b/i, 'your religion'],
]

const STREET =
  /\b\d+[a-z]?,?\s+[\w .'-]{2,30}\b(street|st|road|rd|avenue|ave|lane|ln|marg|nagar|colony|sector)\b/i

// present tense is allowed only on a current role: "Lead the platform team" is fine while you do
const PRESENT_TO_PAST: Record<string, string> = {
  lead: 'led',
  build: 'built',
  write: 'wrote',
  run: 'ran',
  drive: 'drove',
  grow: 'grew',
  cut: 'cut',
  ship: 'shipped',
  oversee: 'oversaw',
}
function opensWithActionVerb(bullet: string, current: boolean): boolean {
  const word = firstWord(bullet)
  if (isActionVerb(word)) return true
  if (!current) return false
  const candidates = [PRESENT_TO_PAST[word], `${word}ed`, `${word}d`, word.replace(/y$/, 'ied')]
  return candidates.some((candidate) => !!candidate && isActionVerb(candidate))
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  if (!sy || !sm || !ey || !em) return 0
  return Math.max(0, (ey - sy) * 12 + (em - sm))
}

function nowMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface BulletRef {
  text: string
  sectionId: string
  entryId: string
  current: boolean
}

function bulletsOf(sections: Section[]): BulletRef[] {
  return sections
    .filter((s) => s.type === 'experience' || s.type === 'projects' || s.type === 'custom')
    .flatMap((s) =>
      s.entries.flatMap((e) =>
        list(e.data, 'bullets').map((text) => ({
          text,
          sectionId: s._id,
          entryId: e._id,
          current: e.data.current === true,
        }))
      )
    )
}

const at = (ref: { sectionId: string; entryId: string }, field = 'bullets'): Target => ({
  sectionId: ref.sectionId,
  entryId: ref.entryId,
  field,
})

// ---------------------------------------------------------------- A

function dimensionA(
  resume: Partial<Resume>,
  shaped: TemplateResume,
  template: ResumeTemplate,
  pages: number
) {
  const profile = template.atsProfile
  const design = DesignSchema.parse(resume.design ?? {})
  const toTemplate: Target = { field: 'template' }
  const academic = resume.resumeType === 'academic'

  let layout = 6
  if (profile.columns === 2) {
    const sidebar = shaped.sections.filter((s) => slotFor(s.type, template) === 'aside')
    const core = sidebar.some((s) => ['experience', 'education', 'summary'].includes(s.type))
    layout = core ? 0 : 3
  } else if (profile.dateLayout === 'rail') layout = 3

  const sizeIssues = [
    design.typeScale < 10 ? 'body text is below 10pt' : '',
    pages > (academic ? 6 : 2) ? `it runs to about ${pages} pages` : '',
  ].filter(Boolean)

  const checks = [
    check('A1', 8),
    check(
      'A2',
      layout,
      'Parsers read line by line, not column by column. Your two-column layout extracts as interleaved fragments. Textkernel raises quality code 433 and Lever silently drops sidebar content. Switch to a single-column template.',
      toTemplate
    ),
    check(
      'A3',
      profile.hasTables ? 0 : 3,
      'Tables and text boxes are dropped entirely by five of eight major parsers, including Workday. Everything on your resume must be plain flowing text.',
      toTemplate
    ),
    check(
      'A4',
      profile.hasImages ? 0 : 3,
      'Skill bars and icons carry no text. Write Java (Expert) instead of a five-dot rating, and replace the phone icon with the word Phone:.',
      toTemplate
    ),
    check(
      'A5',
      profile.headerFooterContent ? 0 : 3,
      'Content placed in a page header or footer is invisible to most parsers. Move your name and contact line into the first lines of the document body (code 311).',
      toTemplate
    ),
    check(
      'A6',
      SAFE_FONTS.includes(profile.bodyFont.toLowerCase()) ? 3 : 0,
      'Decorative fonts can export without a correct character map, which makes your text extract as blank or garbled symbols. Use a standard document face for body text.',
      toTemplate
    ),
    check(
      'A7',
      2 - sizeIssues.length,
      `Body text below 10pt and margins under half an inch push content into zones that get cropped or mis-ordered. Keep the resume to ${academic ? 'six' : 'two'} pages. Here, ${sizeIssues.join(' and ')}.`,
      { field: 'design' }
    ),
    check(
      'A8',
      PLAIN_BULLETS.includes(profile.bulletGlyph) ? 2 : 0,
      'Checkmarks, arrows and emoji bullets are dingbat glyphs with no Unicode meaning. They extract as junk or delete the line. Use a plain round bullet.',
      toTemplate
    ),
  ]
  const raw = checks.reduce((sum, c) => sum + c.earned, 0)
  return { checks, earned: Math.min(raw, profile.maxDimensionAScore) }
}

// ---------------------------------------------------------------- B

function dimensionB(shaped: TemplateResume) {
  const ofType = (type: string) => shaped.sections.filter((s) => s.type === type)
  const checks: AtsCheckResult[] = []

  const experience = ofType('experience')[0]
  checks.push(
    !experience
      ? check(
          'B1',
          0,
          'Add a Work Experience section. Internships, part-time roles and freelance work all count, and a resume without one cannot fill a parser’s work history (code 413).',
          { sectionId: 'add', field: 'experience' }
        )
      : check(
          'B1',
          EXPERIENCE_HEADINGS.includes(heading(experience.title)) ? 5 : 0,
          'Parsers find sections by matching header text. A custom heading means your entire employment history is either mis-filed or dropped (codes 413 and 417). Rename this section Work Experience.',
          { sectionId: experience._id, field: 'title' }
        )
  )

  const education = ofType('education')[0]
  checks.push(
    !education
      ? check(
          'B2',
          0,
          'Add an Education section so your degree reaches the education field (code 414).',
          {
            sectionId: 'add',
            field: 'education',
          }
        )
      : check(
          'B2',
          EDUCATION_HEADINGS.includes(heading(education.title)) ? 3 : 0,
          'Rename to Education. Anything else risks your degree never reaching the education field (code 414).',
          { sectionId: education._id, field: 'title' }
        )
  )

  const skills = ofType('skills')[0]
  const skillsHeading = skills ? heading(skills.title) : ''
  checks.push(
    !skills
      ? check(
          'B3',
          0,
          'Add a Skills section. Recruiters search the skills field before they read anything else.',
          {
            sectionId: 'add',
            field: 'skills',
          }
        )
      : check(
          'B3',
          SKILLS_HEADINGS.includes(skillsHeading)
            ? 3
            : skillsHeading === 'core competencies'
              ? 2
              : 0,
          'Rename this section Skills. Some engines recognise Core Competencies and others miss it; anything else is read as body text.',
          { sectionId: skills._id, field: 'title' }
        )
  )

  checks.push(check('B4', 2))

  const types = shaped.sections.map((s) => s.type).filter((t) => t !== 'custom')
  const duplicate = types.find((type, index) => types.indexOf(type) !== index)
  checks.push(
    check(
      'B5',
      duplicate ? 0 : 2,
      'You have two sections of the same type. Parsers raise codes 323 and 324 and may keep only the first. Merge them into one section.',
      duplicate
        ? { sectionId: shaped.sections.filter((s) => s.type === duplicate)[1]?._id }
        : undefined
    )
  )

  const outOfOrder = [...ofType('experience'), ...ofType('education')].find((section) => {
    const starts = section.entries.map((e) => str(e.data, 'startDate')).filter(Boolean)
    return starts.some((start, i) => i > 0 && start > starts[i - 1]!)
  })
  checks.push(
    check(
      'B6',
      outOfOrder ? 0 : 2,
      'Put the newest entry first. Parsers and recruiters read top down and take the first role as your current one. Drag the entries into reverse-chronological order.',
      outOfOrder ? { sectionId: outOfOrder._id } : undefined
    )
  )

  const roles = ofType('experience').flatMap((s) => s.entries.map((e) => ({ s, e })))
  const gaps = roles.map(({ e }) =>
    [
      !str(e.data, 'role') && 'job title',
      !str(e.data, 'organisation') && 'company',
      !str(e.data, 'startDate') && 'start date',
      !str(e.data, 'endDate') && e.data.current !== true && 'end date',
    ].filter((gap): gap is string => !!gap)
  )
  const firstGap = gaps.findIndex((g) => g.length > 0)
  checks.push(
    roles.length === 0
      ? notApplicable('B7', 'No roles yet, so there is nothing to check.')
      : check(
          'B7',
          (3 * gaps.filter((g) => g.length === 0).length) / roles.length,
          firstGap >= 0
            ? `Role ${firstGap + 1} is missing a ${gaps[firstGap]!.join(' and ')}. A role without dates cannot be placed on your timeline (codes 224, 225, 419), and a role without a title or company may be discarded entirely (codes 221, 222).`
            : '',
          firstGap >= 0
            ? { sectionId: roles[firstGap]!.s._id, entryId: roles[firstGap]!.e._id }
            : undefined
        )
  )

  return checks
}

// ---------------------------------------------------------------- C

function dimensionC(shaped: TemplateResume, parserText: string) {
  const p = shaped.personal
  const field = (name: string): Target => ({ sectionId: 'personal', field: name })
  const emails = parserText.match(/[^\s@,;:()<>]+@[^\s@,;:()<>]+\.[a-z]{2,}/gi) ?? []
  const ownEmails = new Set(emails.map((e) => e.toLowerCase()))
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)

  const digits = p.phone.replace(/\D/g, '')
  const validPhone = /^[\d\s()+.-]+$/.test(p.phone) && digits.length >= 7 && digits.length <= 15

  const nameTokens = p.fullName.split(/\s+/).filter(Boolean).length
  const personalHit = PERSONAL_DATA.find(([pattern]) => pattern.test(parserText))

  return [
    check(
      'C1',
      validEmail && ownEmails.size <= 1 ? 3 : 0,
      'A resume with no readable email cannot become a candidate record. Textkernel treats a missing email and phone as a fatal parse (code 441). List exactly one address (code 132).',
      field('email')
    ),
    check(
      'C2',
      validPhone ? 2 : 0,
      'Add exactly one phone number written in digits, with an optional country code, for example +91 98765 43210.',
      field('phone')
    ),
    check(
      'C3',
      nameTokens >= 2 ? 2 : nameTokens === 1 ? 1 : 0,
      'Your name must be the first line of the document. Parsers that cannot isolate a first and last name build a nameless record (code 302).',
      field('fullName')
    ),
    check(
      'C4',
      p.location && !STREET.test(p.location) ? 1 : 0,
      'Include City, State. Recruiters filter on location. Leave off the street address.',
      field('location')
    ),
    check(
      'C5',
      personalHit ? 0 : 2,
      `Remove ${personalHit?.[1] ?? 'that detail'}. In the US, UK, Australia and New Zealand these are treated as compliance risk and some systems flag the record (codes 121 to 124).`
    ),
  ]
}

// ---------------------------------------------------------------- D

function dimensionD(shaped: TemplateResume, words: number, pages: number, academic: boolean) {
  const bullets = bulletsOf(shaped.sections)
  const roles = shaped.sections
    .filter((s) => s.type === 'experience')
    .flatMap((s) => s.entries.map((e) => ({ sectionId: s._id, entryId: e._id, data: e.data })))
  const summary = shaped.sections.find((s) => s.type === 'summary')
  const summaryText = summary ? str(summary.entries[0]?.data ?? {}, 'text') : ''

  const checks: AtsCheckResult[] = []

  const sized = roles.filter((r) => {
    const n = list(r.data, 'bullets').length
    return n >= 3 && n <= 6
  })
  const badRole = roles.find((r) => !sized.includes(r))
  checks.push(
    roles.length === 0
      ? notApplicable('D1', 'No roles yet, so bullet counts are not checked.')
      : check(
          'D1',
          (3 * sized.length) / roles.length,
          'Give each role three to six bullets. One bullet reads as a job title with no evidence; ten buries the best one.',
          badRole ? at(badRole) : undefined
        )
  )

  if (bullets.length === 0) {
    const add =
      'Add bullets to your roles and projects: one line per thing you did, each starting with a verb.'
    checks.push(
      check('D2', 0, add),
      check('D3', 0, add),
      check('D4', 3),
      check(
        'D5',
        summaryText && FIRST_PERSON.test(summaryText) ? 0 : 2,
        'Remove pronouns. Resume bullets are written in implied first person: Managed a team of six, not I managed a team of six.',
        summary ? { sectionId: summary._id } : undefined
      ),
      check('D6', 0, add)
    )
  } else {
    const n = bullets.length
    const weakVerb = bullets.filter((b) => !opensWithActionVerb(b.text, b.current))
    checks.push(
      check(
        'D2',
        4 * Math.min(1, (n - weakVerb.length) / n / 0.8),
        `${weakVerb.length} of your ${n} bullets do not start with an action verb. Lead with the verb: Led, Built, Designed, Implemented, Reduced, Automated, Negotiated, Migrated.`,
        weakVerb[0] ? at(weakVerb[0]) : undefined
      )
    )

    const quantified = bullets.filter((b) => isQuantified(b.text))
    const unquantified = bullets.find((b) => !isQuantified(b.text))
    checks.push(
      check(
        'D3',
        4 * Math.min(1, quantified.length / n / 0.5),
        `Only ${quantified.length} of ${n} bullets contain a number. Use Google’s X-Y-Z shape, accomplished X as measured by Y by doing Z. For example: Reduced page load time by 40% by adding server-side caching.`,
        unquantified ? at(unquantified) : undefined
      )
    )

    const weakIndex = bullets.findIndex((b) => WEAK_OPENERS.test(b.text.trim()))
    const phrase = weakIndex >= 0 ? WEAK_OPENERS.exec(bullets[weakIndex]!.text.trim())?.[0] : ''
    checks.push(
      check(
        'D4',
        weakIndex >= 0 ? 0 : 3,
        `Bullet ${weakIndex + 1} opens with "${phrase}", which describes an assignment, not an outcome. Rewrite it starting with what you did.`,
        weakIndex >= 0 ? at(bullets[weakIndex]!) : undefined
      )
    )

    const pronoun = bullets.find((b) => FIRST_PERSON.test(b.text))
    const pronounInSummary = summaryText && FIRST_PERSON.test(summaryText)
    checks.push(
      check(
        'D5',
        pronoun || pronounInSummary ? 0 : 2,
        'Remove pronouns. Resume bullets are written in implied first person: Managed a team of six, not I managed a team of six.',
        pronoun ? at(pronoun) : summary ? { sectionId: summary._id } : undefined
      )
    )

    const mean = bullets.reduce((sum, b) => sum + countWords(b.text), 0) / n
    checks.push(
      check(
        'D6',
        mean >= 8 && mean <= 35 ? 2 : 0,
        mean < 8
          ? `Your bullets average ${Math.round(mean)} words. Under eight words rarely leaves room for what you did and what changed because of it.`
          : `Your bullets average ${Math.round(mean)} words. Over 35 words reads as a paragraph; split it or cut the method and keep the outcome.`,
        at(bullets[0]!)
      )
    )
  }

  const [low, high, maxPages] = academic ? [400, 4000, 6] : [400, 1600, 2]
  const lengthIssues = [words < low || words > high, pages > maxPages].filter(Boolean).length
  checks.push(
    check(
      'D7',
      2 - lengthIssues,
      words < low
        ? `At ${words} words there is room for more evidence. Strong resumes usually carry ${low} to ${high} words; add the outcomes behind your roles and projects, and let it run to a second page if it needs to.`
        : `At ${words} words and about ${pages} pages this is long. Aim for ${low} to ${high} words on at most ${maxPages} pages; cut the oldest and least relevant bullets first.`
    )
  )

  return checks
}

// ---------------------------------------------------------------- E

const SENIORITY = new Set([
  'senior',
  'sr',
  'junior',
  'jr',
  'lead',
  'principal',
  'staff',
  'head',
  'chief',
  'intern',
  'trainee',
  'associate',
  'i',
  'ii',
  'iii',
  'iv',
  'the',
  'a',
  'an',
  'of',
  'and',
  'for',
  'to',
  'with',
  'in',
  'at',
  'remote',
  'hybrid',
  'full-time',
  'part-time',
  'contract',
])

function jobTitleOf(posting: string): string {
  const labelled = /^\s*(job title|title|position|role)\s*[:-]\s*(.+)$/im.exec(posting)
  if (labelled) return labelled[2]!.trim()
  const first =
    posting
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  return first.split(/\s+/).length <= 8 && !/[.!?]$/.test(first) ? first : ''
}

function dimensionE(shaped: TemplateResume, parserText: string, posting: string, words: number) {
  const { body, requirements } = splitPosting(posting)
  const wanted = findSkills(body)
  const hardWanted = [...wanted.values()].filter(
    (h) => h.skill.type === 'hard' || h.skill.type === 'tool'
  )

  const have = findSkills(parserText)
  const skillsSections = shaped.sections.filter((s) => s.type === 'skills')
  const outsideSkills = serializeOutside(shaped)
  const haveOutside = findSkills(outsideSkills)

  const matched = hardWanted.filter((h) => have.has(h.skill.canonical))
  const missing = hardWanted.filter((h) => !have.has(h.skill.canonical))
  const skillsTarget: Target = skillsSections[0]
    ? { sectionId: skillsSections[0]._id }
    : { sectionId: 'add', field: 'skills' }

  const checks: AtsCheckResult[] = []

  checks.push(
    hardWanted.length === 0
      ? notApplicable(
          'E1',
          'No hard skills from our dictionary were found in the posting, so this check scores in full.'
        )
      : check(
          'E1',
          10 * Math.min(1, matched.length / Math.max(1, Math.ceil(0.75 * hardWanted.length))),
          `The posting names ${hardWanted.length} hard skills and your resume shows ${matched.length}. If you have them, add ${missing
            .slice(0, 5)
            .map((h) => h.skill.canonical)
            .join(
              ', '
            )}${missing.length > 5 ? ' and others below' : ''}, ideally inside a role that used them.`,
          skillsTarget
        )
  )

  const jobTitle = jobTitleOf(posting)
  const significant = normalise(jobTitle)
    .split(' ')
    .filter((t) => t && !SENIORITY.has(t))
  if (significant.length === 0) {
    checks.push(
      notApplicable(
        'E2',
        'No job title found in the posting. Put it on the first line to check alignment.'
      )
    )
  } else {
    const titles = [
      shaped.personal.headline,
      ...shaped.sections
        .filter((s) => s.type === 'experience')
        .flatMap((s) => s.entries.map((e) => str(e.data, 'role'))),
    ].map((t) => new Set(normalise(t).split(' ')))
    const best = Math.max(
      0,
      ...titles.map((set) => significant.filter((t) => set.has(t)).length / significant.length)
    )
    checks.push(
      check(
        'E2',
        best >= 0.99 ? 3 : best >= 0.5 ? 1.5 : 0,
        `The posting asks for a ${jobTitle}. Recruiters search by title, so use those words in your headline if they honestly describe you.`,
        { sectionId: 'personal', field: 'headline' }
      )
    )
  }

  const quals = [...wanted.values()].filter(
    (h) => h.skill.type === 'degree' || h.skill.type === 'cert'
  )
  const yearsWanted = Math.max(
    0,
    ...[...body.matchAll(/(\d{1,2})\s*\+?\s*(?:years|yrs)/gi)]
      .map((m) => Number(m[1]))
      .filter((n) => n <= 20)
  )
  const yearsHave =
    shaped.sections
      .filter((s) => s.type === 'experience')
      .flatMap((s) => s.entries)
      .reduce((sum, e) => {
        const start = str(e.data, 'startDate')
        const end = e.data.current === true ? nowMonth() : str(e.data, 'endDate')
        return sum + (start && end ? monthsBetween(start, end) : 0)
      }, 0) / 12
  const requirementsList = [
    ...quals.map((q) => ({ label: q.skill.canonical, met: have.has(q.skill.canonical) })),
    ...(yearsWanted
      ? [{ label: `${yearsWanted}+ years of experience`, met: yearsHave >= yearsWanted }]
      : []),
  ]
  const unmet = requirementsList.filter((r) => !r.met)
  checks.push(
    requirementsList.length === 0
      ? notApplicable('E3', 'The posting names no degree, certification or years of experience.')
      : check(
          'E3',
          (3 * (requirementsList.length - unmet.length)) / requirementsList.length,
          `The posting asks for ${unmet.map((r) => r.label).join(', ')}. If you have it, say so in the words the posting uses; if you do not, say what you have instead.`
        )
  )

  const softWanted = [...wanted.values()].filter((h) => h.skill.type === 'soft')
  const known = new Set([...wanted.keys()])
  const fallback = fallbackTerms(body, requirements, known)
  const vocabulary = stemmedVocabulary(parserText)
  const softTotal = softWanted.length + fallback.length
  const softMatched =
    softWanted.filter((h) => have.has(h.skill.canonical)).length +
    fallback.filter((term) => vocabulary.has(term)).length
  checks.push(
    softTotal === 0
      ? notApplicable('E4', 'No general keywords stood out in the posting.')
      : check(
          'E4',
          2 * Math.min(1, softMatched / Math.ceil(0.75 * softTotal)),
          `The posting leans on ${[...softWanted.map((h) => h.skill.canonical), ...fallback].slice(0, 6).join(', ')}. Show the ones that are true of you inside a bullet, not as a bare list.`
        )
  )

  const inContext = matched.filter((h) => haveOutside.has(h.skill.canonical))
  checks.push(
    hardWanted.length === 0
      ? notApplicable('E5', 'No hard skills to place in context.')
      : check(
          'E5',
          matched.length ? (2 * inContext.length) / matched.length : 0,
          'Skills listed only in the Skills section count for less. Mention each one inside a role or project that used it; parsers rank skills evidenced in dated roles higher (code 112).',
          roleTarget(shaped)
        )
  )

  // E-CAP: any one of three stuffing signals caps the dimension, it never goes negative
  const stuffing: string[] = []
  const limit = Math.max(3, 0.015 * words)
  for (const h of matched) {
    const count = have.get(h.skill.canonical)?.count ?? 0
    if (count > limit) stuffing.push(`${h.skill.canonical} appears ${count} times`)
  }
  const items = skillsSections.flatMap((s) => s.entries.flatMap((e) => list(e.data, 'items')))
  if (items.length > 30) stuffing.push(`the skills section lists ${items.length} items`)
  const lowerOutside = outsideSkills.toLowerCase()
  const orphan = items.filter((item) => !lowerOutside.includes(item.toLowerCase()))
  if (items.length >= 6 && orphan.length / items.length > 0.5) {
    stuffing.push(`${orphan.length} of ${items.length} listed skills appear nowhere else`)
  }

  const keywords: AtsKeywordReport = {
    matched: matched.map((h) => h.skill.canonical),
    missing: missing.map((h) => h.skill.canonical),
    jobTitle,
    stuffing,
  }
  return { checks, keywords }
}

function roleTarget(shaped: TemplateResume): Target {
  const experience = shaped.sections.find((s) => s.type === 'experience')
  return experience ? { sectionId: experience._id } : undefined
}

// everything except the skills list: where a skill is evidenced rather than claimed
function serializeOutside(shaped: TemplateResume): string {
  return [
    shaped.personal.headline,
    ...shaped.sections
      .filter((s) => s.type !== 'skills')
      .flatMap((s) =>
        s.entries.flatMap((e) => Object.values(e.data).flatMap((v) => (Array.isArray(v) ? v : [v])))
      ),
  ]
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
}

// ---------------------------------------------------------------- total

/** Deterministic and explainable: the same resume and posting always produce the same result. */
export function scoreResume(resume: Partial<Resume>, options: ScoreOptions = {}): AtsResult {
  const template = getTemplate(resume.templateKey ?? '')
  const shaped = toTemplateResume(resume)
  const parserPreview = serializeToParserView(resume, template)
  const words = countWords(parserPreview)
  const pages =
    options.pageCount && options.pageCount > 0
      ? options.pageCount
      : Math.max(1, Math.ceil(words / 550))
  const academic = resume.resumeType === 'academic'

  const a = dimensionA(resume, shaped, template, pages)
  const checks: AtsCheckResult[] = [
    ...a.checks,
    ...dimensionB(shaped),
    ...dimensionC(shaped, parserPreview),
    ...dimensionD(shaped, words, pages, academic),
  ]

  const posting = options.jobDescription?.trim() ?? ''
  const mode = posting.length >= 40 ? 'full' : 'format_only'
  let keywords: AtsKeywordReport | null = null
  if (mode === 'full') {
    const e = dimensionE(shaped, parserPreview, posting, words)
    checks.push(...e.checks)
    keywords = e.keywords
  }

  const sum = (id: DimensionId) =>
    checks.filter((c) => c.dimension === id).reduce((s, c) => s + c.earned, 0)
  const earned: Record<DimensionId, number> = {
    A: a.earned,
    B: sum('B'),
    C: sum('C'),
    D: sum('D'),
    E: keywords && keywords.stuffing.length ? Math.min(E_CAP, sum('E')) : sum('E'),
  }
  const dimensions = DIMENSIONS.map((d) => ({
    id: d.id,
    title: d.title,
    earned: round1(earned[d.id]),
    possible: d.points,
  }))

  const formatEarned = earned.A + earned.B + earned.C + earned.D
  const reasons = hiddenText(resume, template)
  const total = reasons.length
    ? 0
    : mode === 'full'
      ? Math.round(formatEarned + earned.E)
      : Math.round((formatEarned / 80) * 100)

  const best = TEMPLATE_LIST.reduce((top, t) =>
    t.atsProfile.maxDimensionAScore > top.atsProfile.maxDimensionAScore ? t : top
  )
  const lower = parserPreview.toLowerCase()
  const fillers = CLICHES.filter((phrase) => lower.includes(phrase))

  return {
    rubricVersion: RUBRIC_VERSION,
    mode,
    total,
    gate: {
      blocked: reasons.length > 0,
      reasons,
    },
    dimensions,
    checks,
    templateCeiling: {
      template: template.name,
      max: template.atsProfile.maxDimensionAScore,
      best: best.name,
    },
    keywords,
    hints: fillers.length
      ? [
          `${fillers.join(', ')}: these phrases are claims without evidence. Replace each with the bullet that proves it.`,
        ]
      : [],
    parserPreview,
  }
}
