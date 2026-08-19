import { describe, expect, it } from 'vitest'
import { diffResume, hasChanges } from './diff'
import { makeResume } from './fixture'
import { editorReducer, initialState } from './reducer'
import type { EditorAction } from './reducer'

function after(...actions: EditorAction[]) {
  const state = actions.reduce(editorReducer, initialState(makeResume()))
  return { base: state.base, next: state.resume, ops: diffResume(state.base, state.resume) }
}

describe('diffResume', () => {
  it('emits nothing when nothing changed', () => {
    const base = makeResume()
    expect(diffResume(base, structuredClone(base))).toEqual([])
    expect(hasChanges(base, structuredClone(base))).toBe(false)
  })

  it('emits one setField for an edited entry field', () => {
    const { ops } = after({
      type: 'field_set',
      sectionId: 's-exp',
      entryId: 'e-halden',
      field: 'role',
      value: 'Staff Engineer',
    })

    expect(ops).toEqual([
      {
        op: 'setField',
        sectionId: 's-exp',
        entryId: 'e-halden',
        field: 'role',
        value: 'Staff Engineer',
      },
    ])
  })

  it('emits one op per changed field, and none for the rest', () => {
    const { ops } = after(
      { type: 'personal_set', field: 'fullName', value: 'Alex Mercer' },
      { type: 'personal_set', field: 'email', value: 'alex@example.com' }
    )

    expect(ops).toHaveLength(2)
    expect(ops.every((op) => op.op === 'setPersonal')).toBe(true)
  })

  /*
    Clearing a field that was never set is not a change. Without this, opening a form and
    tabbing through it would send an op per field on first load.
  */
  it('treats an empty string and an unset value as the same', () => {
    const base = makeResume()
    const next = structuredClone(base)
    next.sections[1]!.entries[0]!.data.location = ''

    expect(diffResume(base, next)).toEqual([])
  })

  it('emits reorderSections when the order changes', () => {
    const { ops } = after({
      type: 'section_reorder',
      order: ['s-skills', 's-exp', 's-summary'],
    })

    expect(ops).toEqual([{ op: 'reorderSections', order: ['s-skills', 's-exp', 's-summary'] }])
  })

  it('emits addEntry and removeEntry', () => {
    const added = after({ type: 'entry_add', sectionId: 's-skills', entryId: 'e-new' })
    expect(added.ops).toEqual([{ op: 'addEntry', sectionId: 's-skills', entryId: 'e-new' }])

    const removed = after({
      type: 'entry_remove',
      sectionId: 's-exp',
      entryId: 'e-corvid',
    })
    expect(removed.ops).toEqual([{ op: 'removeEntry', sectionId: 's-exp', entryId: 'e-corvid' }])
  })

  /* Adding at the end must not also look like a reorder of the entries that were already there. */
  it('does not emit a reorder when an entry is only appended', () => {
    const { ops } = after({ type: 'entry_add', sectionId: 's-exp', entryId: 'e-new' })

    expect(ops.some((op) => op.op === 'reorderEntries')).toBe(false)
  })

  it('emits toggleSection and toggleEntry', () => {
    expect(after({ type: 'section_toggle', sectionId: 's-exp' }).ops).toEqual([
      { op: 'toggleSection', sectionId: 's-exp', hidden: true },
    ])

    expect(after({ type: 'entry_toggle', sectionId: 's-exp', entryId: 'e-halden' }).ops).toEqual([
      { op: 'toggleEntry', sectionId: 's-exp', entryId: 'e-halden', hidden: true },
    ])
  })
})

/*
  The payoff of deriving ops from a diff rather than accumulating them.

  With an accumulated log, undo has to emit the inverse of whatever it reversed, and every action
  needs a hand-written opposite. Here an undo is just another state, so the diff describes it
  correctly without anyone writing an inverse at all.
*/
describe('undo through the diff', () => {
  it('emits nothing once an edit is undone back to the saved state', () => {
    const { ops } = after({ type: 'section_toggle', sectionId: 's-exp' }, { type: 'undo' })

    expect(ops).toEqual([])
  })

  it('emits the reversing op when an undo lands on a different state', () => {
    const { ops } = after(
      { type: 'notes_set', value: 'first' },
      { type: 'section_toggle', sectionId: 's-exp' },
      { type: 'undo' }
    )

    // the toggle is gone, the notes edit survives, and no inverse op was ever written by hand
    expect(ops).toEqual([{ op: 'setNotes', value: 'first' }])
  })

  it('restores a removed entry as an addEntry after undo', () => {
    const { ops } = after(
      { type: 'entry_remove', sectionId: 's-exp', entryId: 'e-corvid' },
      { type: 'entry_add', sectionId: 's-exp', entryId: 'e-corvid' }
    )

    // removed then re-added is a no-op against base, except for the data the entry has lost
    expect(ops.some((op) => op.op === 'removeEntry')).toBe(false)
    expect(ops.some((op) => op.op === 'addEntry')).toBe(false)
  })
})
