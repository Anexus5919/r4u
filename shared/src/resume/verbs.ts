/*
  Word lists for the content linter and, in phase 10, for rubric checks D2 and D4.

  A JSON word list rather than a model call. The checks stay explainable, reproducible and free,
  which is the whole differentiator: a user can see exactly which rule fired and why.
*/

export const ACTION_VERBS = {
  leadership: [
    'led',
    'directed',
    'managed',
    'coordinated',
    'oversaw',
    'supervised',
    'chaired',
    'spearheaded',
    'orchestrated',
    'mentored',
    'guided',
    'championed',
  ],
  build: [
    'built',
    'developed',
    'engineered',
    'designed',
    'architected',
    'implemented',
    'deployed',
    'programmed',
    'prototyped',
    'migrated',
    'refactored',
    'integrated',
    'containerised',
    'containerized',
    'created',
    'wrote',
    'shipped',
    'rebuilt',
  ],
  improve: [
    'optimized',
    'optimised',
    'improved',
    'reduced',
    'increased',
    'accelerated',
    'streamlined',
    'automated',
    'scaled',
    'consolidated',
    'standardised',
    'standardized',
    'hardened',
    'cut',
    'raised',
    'lowered',
    'saved',
    'simplified',
  ],
  analyse: [
    'analyzed',
    'analysed',
    'evaluated',
    'researched',
    'modeled',
    'modelled',
    'forecasted',
    'diagnosed',
    'audited',
    'benchmarked',
    'profiled',
    'investigated',
  ],
  deliver: [
    'delivered',
    'launched',
    'executed',
    'completed',
    'achieved',
    'won',
    'secured',
    'closed',
    'released',
    'introduced',
  ],
  communicate: [
    'presented',
    'authored',
    'documented',
    'negotiated',
    'trained',
    'facilitated',
    'published',
    'taught',
    'advised',
  ],
} as const

export const ALL_ACTION_VERBS: string[] = Object.values(ACTION_VERBS).flat()

/*
  From Rezi's 102,944-resume corpus. These are the openers that read as filler even though they
  are grammatically verbs.
*/
export const WEAK_VERBS = [
  'worked',
  'work',
  'make',
  'study',
  'made',
  'took',
  'show',
  'take',
  'leave',
  'showed',
  'helped',
  'assisted',
  'handled',
  'dealt',
]

/** Openers that describe an assignment rather than an outcome. */
export const WEAK_OPENERS =
  /^(responsible for|was responsible|worked on|worked with|helped( to)?|assisted (with|in)|involved in|participated in|duties included|tasked with|in charge of|part of|contributed to|handled|dealt with)\b/i

export const FIRST_PERSON = /\b(I|I'm|I've|my|me|we|our|us)\b/

/** Claims without evidence. Every one of these is better replaced by the bullet that proves it. */
export const CLICHES = [
  'team player',
  'hard worker',
  'hard-working',
  'go-getter',
  'detail-oriented',
  'results-driven',
  'self-starter',
  'think outside the box',
  'synergy',
  'dynamic',
  'passionate',
  'guru',
  'ninja',
  'rockstar',
  'proven track record',
  'excellent communication skills',
]

export function firstWord(text: string): string {
  return (
    text
      .trim()
      .replace(/^[^a-zA-Z]+/, '')
      .split(/\s+/)[0]
      ?.toLowerCase() ?? ''
  )
}

export function isActionVerb(word: string): boolean {
  return ALL_ACTION_VERBS.includes(word.toLowerCase())
}

export function isWeakVerb(word: string): boolean {
  return WEAK_VERBS.includes(word.toLowerCase())
}
