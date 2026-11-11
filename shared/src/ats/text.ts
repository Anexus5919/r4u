import { SKILLS } from './skills.js'
import type { Skill, SkillType } from './skills.js'

// NFKC, lowercase, punctuation stripped except + # . - / so C++, C#, Node.js, CI/CD and .NET survive
export function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#./\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// short or everyday-word aliases are matched as written: "Go", "R" and "Express" are not "go", "r", "express"
const EVERYDAY = new Set([
  'go',
  'r',
  'c',
  'ai',
  'ml',
  'qa',
  'ci',
  'ux',
  'js',
  'ba',
  'ma',
  'bs',
  'express',
  'swift',
  'rust',
  'spring',
  'render',
  'notion',
  'slack',
  'node',
  'shell',
  'spark',
  'lambda',
  'helm',
  'rails',
  'sketch',
  'babel',
  'vite',
  'yarn',
  'jest',
  'mocha',
  'react',
  'angular',
  'git',
  'sap',
  'sales',
])

interface Matcher {
  skill: Skill
  patterns: { regex: RegExp; caseSensitive: boolean }[]
}

// (?<![\w+#.])ALIAS(?![\w+#.]): C++ and .NET match, Java does not match JavaScript (rubric 7.2.9)
function patternFor(alias: string): { regex: RegExp; caseSensitive: boolean } {
  const caseSensitive = EVERYDAY.has(alias.toLowerCase()) || alias.length <= 2
  const body = escape(caseSensitive ? alias : alias.toLowerCase()).replace(/\\?\s+/g, '[\\s-]+')
  // a single letter also refuses a hyphen or ampersand after it, so R&D and C-suite are not languages
  const after = alias.length === 1 ? '(?![\\w+#.&\\-])' : '(?![\\w+#.])'
  return { regex: new RegExp(`(?<![\\w+#.])${body}${after}`, 'g'), caseSensitive }
}

const MATCHERS: Matcher[] = SKILLS.map((skill) => ({
  skill,
  patterns: [skill.canonical, ...skill.aliases].map(patternFor),
}))

export interface SkillHit {
  skill: Skill
  count: number
}

/** Dictionary skills found in a text, each counted once per occurrence, never fuzzily. */
export function findSkills(text: string, types?: SkillType[]): Map<string, SkillHit> {
  const raw = text.normalize('NFKC')
  const lower = raw.toLowerCase()
  const hits = new Map<string, SkillHit>()
  for (const matcher of MATCHERS) {
    if (types && !types.includes(matcher.skill.type)) continue
    let count = 0
    for (const { regex, caseSensitive } of matcher.patterns) {
      regex.lastIndex = 0
      count += (caseSensitive ? raw : lower).match(regex)?.length ?? 0
    }
    if (count > 0) hits.set(matcher.skill.canonical, { skill: matcher.skill, count })
  }
  return hits
}

const BOILERPLATE =
  /equal opportunit|about (us|the company)|benefits|perks|we offer|diversity|accommodation|salary range/i
const REQUIREMENT_HEAD =
  /requirement|qualification|must[- ]have|what you('ll| will)? (need|bring)|you have|who you are|skills/i

function isHeading(line: string) {
  const trimmed = line.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length <= 60 &&
    (/:$/.test(trimmed) || !/[.]$/.test(trimmed)) &&
    trimmed.split(/\s+/).length <= 7
  )
}

/** Drops boilerplate blocks and marks requirement blocks, which weigh double in the fallback. */
export function splitPosting(text: string): { body: string; requirements: string } {
  const body: string[] = []
  const requirements: string[] = []
  let skipping = false
  let inRequirements = false
  for (const line of text.split(/\r?\n/)) {
    if (isHeading(line)) {
      skipping = BOILERPLATE.test(line)
      inRequirements = REQUIREMENT_HEAD.test(line)
    }
    if (skipping) continue
    body.push(line)
    if (inRequirements) requirements.push(line)
  }
  return { body: body.join('\n'), requirements: requirements.join('\n') }
}

const STOPWORDS = new Set(
  (
    'a an and are as at be been being but by can could do does for from had has have he her his ' +
    'how i if in into is it its may more most must not of on or our out over per she should so such ' +
    'than that the their them then there these they this those through to under up us very was we ' +
    'were what when where which while who will with within would you your yours also any all each ' +
    'etc via across both other own same some well just only able ability strong excellent good great ' +
    'experience experienced work working role roles team teams company candidate candidates job ' +
    'position years year plus including include includes new looking join help make using use used ' +
    'based related required requirements preferred qualifications responsibilities responsible ' +
    'knowledge understanding skills skill familiarity proficiency proficient hands-on minimum ' +
    'opportunity environment day days time fast-paced deliver ensure across key level senior junior ' +
    "lead mid ideal ideally bonus nice want need needs we're you'll you're world"
  ).split(/\s+/)
)

// Porter-lite, used only on the fallback bucket and never on the dictionary (rubric 7.2.6)
export function stem(word: string): string {
  const rules: [RegExp, string][] = [
    [/isations?$|izations?$/, 'is'],
    [/ational$/, 'ate'],
    [/(ments?|ness)$/, ''],
    [/ing$/, ''],
    [/ies$/, 'y'],
    [/ed$/, ''],
    [/es$/, ''],
    [/s$/, ''],
    [/ly$/, ''],
  ]
  for (const [pattern, replacement] of rules) {
    if (pattern.test(word)) {
      const next = word.replace(pattern, replacement)
      return next.length >= 3 ? next : word
    }
  }
  return word
}

const tokens = (text: string) =>
  normalise(text)
    .split(' ')
    .map((token) => token.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter((token) => token.length > 2 && !STOPWORDS.has(token) && !/^\d+$/.test(token))

/** Terms the dictionary missed: repeated, or named once in a requirements block. Stemmed. */
export function fallbackTerms(posting: string, requirements: string, known: Set<string>): string[] {
  const weight = new Map<string, number>()
  const add = (text: string, by: number) => {
    const list = tokens(text)
    const grams = [...list, ...list.slice(1).map((token, i) => `${list[i]} ${token}`)]
    for (const gram of grams) weight.set(gram, (weight.get(gram) ?? 0) + by)
  }
  add(posting, 1)
  add(requirements, 1)

  const knownWords = new Set([...known].flatMap((name) => normalise(name).split(' ')))
  return [...weight.entries()]
    .filter(([gram, w]) => w >= 2 && !gram.split(' ').some((part) => knownWords.has(part)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([gram]) => gram.split(' ').map(stem).join(' '))
}

/** The resume as stemmed tokens and stemmed bigrams, for the fallback comparison. */
export function stemmedVocabulary(text: string): Set<string> {
  const list = tokens(text).map(stem)
  return new Set([...list, ...list.slice(1).map((token, i) => `${list[i]} ${token}`)])
}

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
