import { describe, expect, it } from 'vitest'
import { makeResume } from './fixture'
import { HISTORY_LIMIT, canRedo, canUndo, editorReducer, initialState } from './reducer'
import type { EditorAction, EditorState } from './reducer'

const start = () => initialState(makeResume())

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state)
}

const sectionById = (state: EditorState, id: string) =>
  state.resume.sections.find((section) => section._id === id)!

describe('editing', () => {
  it('sets a field on an entry', () => {
    const state = run(start(), {
      type: 'field_set',
      sectionId: 's-exp',
      entryId: 'e-halden',
      field: 'role',
      value: 'Staff Engineer',
    })

    expect(sectionById(state, 's-exp').entries[0]!.data.role).toBe('Staff Engineer')
  })

  it('leaves the other entries untouched', () => {
    const before = start()
    const state = run(before, {
      type: 'field_set',
      sectionId: 's-exp',
      entryId: 'e-halden',
      field: 'role',
      value: 'Staff Engineer',
    })

    expect(sectionById(state, 's-exp').entries[1]).toBe(sectionById(before, 's-exp').entries[1])
  })

  it('sets personal details and notes', () => {
    const state = run(
      start(),
      { type: 'personal_set', field: 'fullName', value: 'Alex Mercer' },
      { type: 'notes_set', value: 'mention the Kafka migration' }
    )

    expect(state.resume.personal.fullName).toBe('Alex Mercer')
    expect(state.resume.notes).toBe('mention the Kafka migration')
  })
})

/* FR 4.3: hiding removes a section from the output without deleting anything. */
describe('hiding', () => {
  it('hides a section and keeps its entries', () => {
    const state = run(start(), { type: 'section_toggle', sectionId: 's-exp' })
    const section = sectionById(state, 's-exp')

    expect(section.hidden).toBe(true)
    expect(section.entries).toHaveLength(2)
    expect(state.resume.sections).toHaveLength(3)
  })

  it('hides a single entry', () => {
    const state = run(start(), {
      type: 'entry_toggle',
      sectionId: 's-exp',
      entryId: 'e-corvid',
    })

    expect(sectionById(state, 's-exp').entries[1]!.hidden).toBe(true)
    expect(sectionById(state, 's-exp').entries).toHaveLength(2)
  })
})

describe('reordering', () => {
  it('reorders sections', () => {
    const state = run(start(), {
      type: 'section_reorder',
      order: ['s-skills', 's-exp', 's-summary'],
    })

    expect(state.resume.sections.map((s) => s._id)).toEqual(['s-skills', 's-exp', 's-summary'])
  })

  /* A reorder that can drop content is the worst bug an editor can have. */
  it('keeps a section missing from the order', () => {
    const state = run(start(), { type: 'section_reorder', order: ['s-skills'] })

    expect(state.resume.sections).toHaveLength(3)
    expect(state.resume.sections[0]!._id).toBe('s-skills')
  })

  it('reorders entries within a section', () => {
    const state = run(start(), {
      type: 'entry_reorder',
      sectionId: 's-exp',
      order: ['e-corvid', 'e-halden'],
    })

    expect(sectionById(state, 's-exp').entries.map((e) => e._id)).toEqual(['e-corvid', 'e-halden'])
  })

  it('adds and removes entries', () => {
    const added = run(start(), { type: 'entry_add', sectionId: 's-skills', entryId: 'e-new' })
    expect(sectionById(added, 's-skills').entries).toHaveLength(1)

    const removed = run(added, {
      type: 'entry_remove',
      sectionId: 's-skills',
      entryId: 'e-new',
    })
    expect(sectionById(removed, 's-skills').entries).toHaveLength(0)
  })
})

describe('undo and redo', () => {
  const type = (value: string): EditorAction => ({
    type: 'field_set',
    sectionId: 's-exp',
    entryId: 'e-halden',
    field: 'role',
    value,
  })

  it('has nothing to undo at the start', () => {
    expect(canUndo(start())).toBe(false)
    expect(canRedo(start())).toBe(false)
    expect(editorReducer(start(), { type: 'undo' })).toEqual(start())
  })

  it('restores the previous state', () => {
    const state = run(start(), { type: 'section_toggle', sectionId: 's-exp' }, { type: 'undo' })

    expect(sectionById(state, 's-exp').hidden).toBe(false)
    expect(canRedo(state)).toBe(true)
  })

  it('reapplies on redo', () => {
    const state = run(
      start(),
      { type: 'section_toggle', sectionId: 's-exp' },
      { type: 'undo' },
      { type: 'redo' }
    )

    expect(sectionById(state, 's-exp').hidden).toBe(true)
    expect(canRedo(state)).toBe(false)
  })

  // a typing burst is one undo step, or undo removes a single character
  it('collapses a typing burst into one step', () => {
    const state = run(
      start(),
      ...'Staff Engineer'.split('').map((_, i) => type('Staff Engineer'.slice(0, i + 1)))
    )

    expect(state.past).toHaveLength(1)

    const undone = editorReducer(state, { type: 'undo' })
    expect(sectionById(undone, 's-exp').entries[0]!.data.role).toBe('Senior Backend Engineer')
  })

  it('starts a new step when the edit moves to another field', () => {
    const state = run(
      start(),
      type('Staff'),
      { type: 'personal_set', field: 'fullName', value: 'Alex' },
      type('Staff Engineer')
    )

    expect(state.past).toHaveLength(3)
  })

  it('gives every structural edit its own step', () => {
    const state = run(
      start(),
      { type: 'entry_add', sectionId: 's-skills', entryId: 'a' },
      { type: 'entry_add', sectionId: 's-skills', entryId: 'b' }
    )

    expect(state.past).toHaveLength(2)
  })

  it('drops the redo stack once a new edit is made', () => {
    const state = run(
      start(),
      { type: 'section_toggle', sectionId: 's-exp' },
      { type: 'undo' },
      { type: 'notes_set', value: 'a new direction' }
    )

    expect(canRedo(state)).toBe(false)
  })

  it('caps the history', () => {
    const actions: EditorAction[] = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({
      type: 'entry_add',
      sectionId: 's-skills',
      entryId: `e-${i}`,
    }))

    expect(run(start(), ...actions).past).toHaveLength(HISTORY_LIMIT)
  })
})

describe('save lifecycle', () => {
  // base is the sent snapshot, so edits typed in flight stay in the next diff
  it('rebases onto what was sent, keeping in-flight edits pending', () => {
    const typed = run(start(), { type: 'notes_set', value: 'first' })
    const sent = typed.resume

    const duringFlight = run(typed, { type: 'notes_set', value: 'first and second' })
    const saved = editorReducer(duringFlight, {
      type: 'save_succeeded',
      sent,
      version: 4,
    })

    expect(saved.base.notes).toBe('first')
    expect(saved.resume.notes).toBe('first and second')
    expect(saved.resume.version).toBe(4)
    expect(saved.saving).toBe('saved')
  })

  it('marks an edit as unsaved again', () => {
    const saved = run(
      start(),
      { type: 'notes_set', value: 'a' },
      { type: 'save_started' },
      { type: 'save_succeeded', sent: makeResume(), version: 4 }
    )

    expect(saved.saving).toBe('saved')
    expect(editorReducer(saved, { type: 'notes_set', value: 'b' }).saving).toBe('idle')
  })

  // after a 409 old snapshots would let undo resurrect a state that never existed
  it('clears history on a rebase', () => {
    const edited = run(
      start(),
      { type: 'notes_set', value: 'a' },
      { type: 'section_toggle', sectionId: 's-exp' }
    )

    const remote = { ...makeResume(), version: 9, notes: 'written by the other tab' }
    const rebased = editorReducer(edited, { type: 'rebased', resume: remote })

    expect(rebased.resume.notes).toBe('written by the other tab')
    expect(rebased.base).toBe(rebased.resume)
    expect(canUndo(rebased)).toBe(false)
    expect(rebased.conflict).toBe(true)
  })
})
