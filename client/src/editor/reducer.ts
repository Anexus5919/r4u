import type { EditorEntry, EditorResume, EditorSection } from './types'

/*
  Actions are domain verbs, not setState calls. That is what makes undo, redo and a socket-driven
  remote edit all the same shape: another dispatched action over the same state.

  History holds whole snapshots. A resume is a few kilobytes and the cap is fifty, so the memory
  cost is trivial next to the correctness of never having to write an inverse for each action.
*/

export const HISTORY_LIMIT = 50

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface EditorState {
  /** the last state the server confirmed. every op sent is a diff from this */
  base: EditorResume
  resume: EditorResume
  past: EditorResume[]
  future: EditorResume[]
  /** the target of the most recent edit, so a typing burst is one undo step and not forty */
  lastTarget: string | null
  saving: SaveStatus
  conflict: boolean
}

export type EditorAction =
  | { type: 'personal_set'; field: string; value: unknown }
  | { type: 'design_set'; field: string; value: unknown }
  | { type: 'notes_set'; value: string }
  | { type: 'field_set'; sectionId: string; entryId: string; field: string; value: unknown }
  | { type: 'section_title_set'; sectionId: string; value: string }
  | { type: 'section_toggle'; sectionId: string }
  | { type: 'section_reorder'; order: string[] }
  | { type: 'entry_add'; sectionId: string; entryId: string }
  | { type: 'entry_remove'; sectionId: string; entryId: string }
  | { type: 'entry_toggle'; sectionId: string; entryId: string }
  | { type: 'entry_reorder'; sectionId: string; order: string[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'save_started' }
  | { type: 'save_succeeded'; sent: EditorResume; version: number }
  | { type: 'save_failed' }
  | { type: 'rebased'; resume: EditorResume }

export function initialState(resume: EditorResume): EditorState {
  return {
    base: resume,
    resume,
    past: [],
    future: [],
    lastTarget: null,
    saving: 'idle',
    conflict: false,
  }
}

/** What an action edits. Two consecutive edits to one target collapse into a single history step. */
function targetOf(action: EditorAction): string | null {
  switch (action.type) {
    case 'personal_set':
      return `personal.${action.field}`
    case 'design_set':
      return `design.${action.field}`
    case 'notes_set':
      return 'notes'
    case 'field_set':
      return `field.${action.sectionId}.${action.entryId}.${action.field}`
    case 'section_title_set':
      return `title.${action.sectionId}`
    default:
      // structural edits always get their own step: nobody wants one undo to remove three rows
      return null
  }
}

function mapSection(
  resume: EditorResume,
  sectionId: string,
  update: (section: EditorSection) => EditorSection
): EditorResume {
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      section._id === sectionId ? update(section) : section
    ),
  }
}

function mapEntry(
  resume: EditorResume,
  sectionId: string,
  entryId: string,
  update: (entry: EditorEntry) => EditorEntry
): EditorResume {
  return mapSection(resume, sectionId, (section) => ({
    ...section,
    entries: section.entries.map((entry) => (entry._id === entryId ? update(entry) : entry)),
  }))
}

function reorder<T extends { _id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((item) => [item._id, item]))
  const moved = order.map((id) => byId.get(id)).filter(Boolean) as T[]
  // anything not named keeps its place at the end rather than disappearing
  const rest = items.filter((item) => !order.includes(item._id))
  return [...moved, ...rest]
}

function apply(resume: EditorResume, action: EditorAction): EditorResume {
  switch (action.type) {
    case 'personal_set':
      return { ...resume, personal: { ...resume.personal, [action.field]: action.value } }

    case 'design_set':
      return { ...resume, design: { ...resume.design, [action.field]: action.value } }

    case 'notes_set':
      return { ...resume, notes: action.value }

    case 'field_set':
      return mapEntry(resume, action.sectionId, action.entryId, (entry) => ({
        ...entry,
        data: { ...entry.data, [action.field]: action.value },
      }))

    case 'section_title_set':
      return mapSection(resume, action.sectionId, (section) => ({
        ...section,
        title: action.value,
      }))

    /*
      Hiding keeps the entries. FR 4.3 asks for a section to leave the output without its data
      being deleted, so this is a flag and never a removal.
    */
    case 'section_toggle':
      return mapSection(resume, action.sectionId, (section) => ({
        ...section,
        hidden: !section.hidden,
      }))

    case 'section_reorder':
      return { ...resume, sections: reorder(resume.sections, action.order) }

    case 'entry_add':
      return mapSection(resume, action.sectionId, (section) => ({
        ...section,
        entries: [...section.entries, { _id: action.entryId, hidden: false, data: {} }],
      }))

    case 'entry_remove':
      return mapSection(resume, action.sectionId, (section) => ({
        ...section,
        entries: section.entries.filter((entry) => entry._id !== action.entryId),
      }))

    case 'entry_toggle':
      return mapEntry(resume, action.sectionId, action.entryId, (entry) => ({
        ...entry,
        hidden: !entry.hidden,
      }))

    case 'entry_reorder':
      return mapSection(resume, action.sectionId, (section) => ({
        ...section,
        entries: reorder(section.entries, action.order),
      }))

    default:
      return resume
  }
}

const MUTATING = new Set<EditorAction['type']>([
  'personal_set',
  'design_set',
  'notes_set',
  'field_set',
  'section_title_set',
  'section_toggle',
  'section_reorder',
  'entry_add',
  'entry_remove',
  'entry_toggle',
  'entry_reorder',
])

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state

      return {
        ...state,
        resume: previous,
        past: state.past.slice(0, -1),
        future: [state.resume, ...state.future],
        lastTarget: null,
        saving: 'idle',
      }
    }

    case 'redo': {
      const next = state.future[0]
      if (!next) return state

      return {
        ...state,
        resume: next,
        past: [...state.past, state.resume],
        future: state.future.slice(1),
        lastTarget: null,
        saving: 'idle',
      }
    }

    case 'save_started':
      return { ...state, saving: 'saving' }

    /*
      base becomes the snapshot that was actually sent, not the current state. Anything typed
      while the request was in flight stays in the diff and goes out with the next save.
    */
    case 'save_succeeded':
      return {
        ...state,
        base: { ...action.sent, version: action.version },
        resume: { ...state.resume, version: action.version },
        saving: 'saved',
        conflict: false,
      }

    case 'save_failed':
      return { ...state, saving: 'error' }

    /*
      A 409 recovery. The server's copy becomes both the new base and the working state, and the
      history is cleared because those snapshots describe a document that no longer exists.
    */
    case 'rebased':
      return {
        ...initialState(action.resume),
        saving: 'idle',
        conflict: true,
      }

    default: {
      if (!MUTATING.has(action.type)) return state

      const next = apply(state.resume, action)
      if (next === state.resume) return state

      const target = targetOf(action)
      const continues = target !== null && target === state.lastTarget

      return {
        ...state,
        resume: next,
        // a continuing edit replaces the top of the stack instead of adding to it
        past: continues ? state.past : [...state.past, state.resume].slice(-HISTORY_LIMIT),
        future: [],
        lastTarget: target,
        saving: 'idle',
      }
    }
  }
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0
}
