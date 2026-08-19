import { useEffect, useMemo, useReducer, useState } from 'react'
import { useParams } from 'react-router-dom'
import { computeMeta, lintResume } from '@r4u/shared'
import type { ResumeDetail } from '@r4u/shared'
import { api, apiGet, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useToast } from '@/context/ToastContext'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Card'
import { CoachPanel, SaveIndicator } from '@/components/editor/CoachPanel'
import { PersonalForm } from '@/components/editor/PersonalForm'
import { SectionForm } from '@/components/editor/SectionForm'
import { SectionList } from '@/components/editor/SectionList'
import { fromWire } from '@/editor/fromWire'
import { canRedo, canUndo, editorReducer, initialState } from '@/editor/reducer'
import type { EditorState } from '@/editor/reducer'
import { useAutosave } from '@/editor/useAutosave'
import type { EditorResume } from '@/editor/types'

const PERSONAL = 'personal'

function Loading() {
  return (
    <div className="flex gap-0" aria-busy="true">
      <div className="w-64 shrink-0 border-r border-ink-04 p-6">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="mb-6 h-9 w-full max-w-md" />
        <Skeleton className="mb-3 h-9 w-full max-w-md" />
        <Skeleton className="h-24 w-full max-w-md" />
      </div>
    </div>
  )
}

export function EditorPage() {
  const { id } = useParams()
  const [loaded, setLoaded] = useState<EditorResume | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    apiGet<{ resume: ResumeDetail }>(`/resumes/${id}`, controller.signal)
      .then(({ resume }) => setLoaded(fromWire(resume)))
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadError(toApiFailure(error).message)
      })

    return () => controller.abort()
  }, [id])

  if (loadError) return <Banner className="max-w-md">{loadError}</Banner>
  if (!loaded) return <Loading />

  // keyed so switching resumes rebuilds the reducer rather than carrying the old history over
  return <Editor key={loaded.id} loaded={loaded} />
}

function Editor({ loaded }: { loaded: EditorResume }) {
  const { toast } = useToast()
  const [state, dispatch] = useReducer(editorReducer, loaded, initialState)
  const [activeId, setActiveId] = useState<string>(PERSONAL)
  const [title, setTitle] = useState(loaded.title)

  const { dirty } = useAutosave(state, dispatch)

  const findings = useMemo(() => lintResume(state.resume as never), [state.resume])

  const findingsBySection = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const finding of findings) {
      if (!finding.sectionId) continue
      counts[finding.sectionId] = (counts[finding.sectionId] ?? 0) + 1
    }
    return counts
  }, [findings])

  /*
    The same functions the server uses to denormalise meta, not a second implementation. Two
    copies would drift, and the number the editor shows while typing would stop matching the one
    the dashboard reads back.
  */
  const meta = useMemo(() => computeMeta(state.resume as never), [state.resume])

  // a rebase is the one moment the screen changes under the user, so it has to be announced
  useEffect(() => {
    if (state.conflict) {
      toast('warning', 'This resume changed elsewhere. The newer version is now open.')
    }
  }, [state.conflict, toast])

  const active = state.resume.sections.find((section) => section._id === activeId)

  async function saveTitle() {
    if (title.trim() === loaded.title || !title.trim()) return
    try {
      await api.patch(`/resumes/${state.resume.id}/title`, { title: title.trim() })
      toast('success', 'Title updated')
    } catch (error) {
      toast('danger', toApiFailure(error).message)
    }
  }

  return (
    <div className="-mx-6 -my-10 lg:-mx-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-04 px-6 py-4 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <ButtonLink to="/dashboard" variant="ghost" size="sm">
            Resumes
          </ButtonLink>

          <Input
            value={title}
            maxLength={80}
            aria-label="Resume title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveTitle()}
            className="h-8 w-64 border-transparent bg-transparent hover:border-ink-05"
          />
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator status={state.saving} dirty={dirty} />

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={!canUndo(state)}
              onClick={() => dispatch({ type: 'undo' })}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canRedo(state)}
              onClick={() => dispatch({ type: 'redo' })}
            >
              Redo
            </Button>
          </div>

          <ButtonLink to={`/resume/${state.resume.id}`} size="sm" variant="secondary">
            Preview
          </ButtonLink>
        </div>
      </header>

      {/*
        Three panels split by a single hairline with background parity, not three cards on a grey
        field. Uniform connectedness through a rule costs less ink than common region through
        cards, and it keeps the paper as the only figure on the screen.
      */}
      <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-ink-04 px-4 py-6 lg:w-64 lg:border-r lg:border-b-0">
          <button
            type="button"
            onClick={() => setActiveId(PERSONAL)}
            aria-current={activeId === PERSONAL ? 'true' : undefined}
            className={cn(
              't-xs relative flex w-full items-baseline gap-2.5 py-1.5 pl-3 text-left text-sm transition-colors',
              activeId === PERSONAL ? 'text-ink-12' : 'text-ink-09 hover:text-ink-11'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute top-1 bottom-1 left-0 w-0.5',
                activeId === PERSONAL ? 'bg-accent' : 'bg-transparent'
              )}
            />
            <span className="font-mono text-2xs tracking-wide text-ink-07 uppercase">pe</span>
            Personal details
          </button>

          <div className="mt-5 border-t border-ink-04 pt-5">
            <SectionList
              sections={state.resume.sections}
              activeId={activeId}
              findingsBySection={findingsBySection}
              onSelect={setActiveId}
              onToggle={(sectionId) => dispatch({ type: 'section_toggle', sectionId })}
              onReorder={(order) => dispatch({ type: 'section_reorder', order })}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
          <div className="max-w-2xl">
            {activeId === PERSONAL ? (
              <PersonalForm
                personal={state.resume.personal}
                onChange={(field, value) => dispatch({ type: 'personal_set', field, value })}
              />
            ) : active ? (
              <SectionForm
                key={active._id}
                section={active}
                findings={findings.filter((f) => f.sectionId === active._id)}
                onTitle={(value) =>
                  dispatch({ type: 'section_title_set', sectionId: active._id, value })
                }
                onField={(entryId, field, value) =>
                  dispatch({ type: 'field_set', sectionId: active._id, entryId, field, value })
                }
                onAddEntry={(entryId) =>
                  dispatch({ type: 'entry_add', sectionId: active._id, entryId })
                }
                onRemoveEntry={(entryId) =>
                  dispatch({ type: 'entry_remove', sectionId: active._id, entryId })
                }
                onToggleEntry={(entryId) =>
                  dispatch({ type: 'entry_toggle', sectionId: active._id, entryId })
                }
                onReorderEntries={(order) =>
                  dispatch({ type: 'entry_reorder', sectionId: active._id, order })
                }
              />
            ) : (
              <p className="text-sm text-ink-09">Choose a section on the left.</p>
            )}
          </div>
        </main>

        <aside className="shrink-0 border-t border-ink-04 px-6 py-8 lg:w-72 lg:border-t-0 lg:border-l">
          <CoachPanel
            findings={findings}
            completeness={meta.completeness}
            wordCount={meta.wordCount}
            resumeType={state.resume.resumeType}
            onJump={setActiveId}
          />

          <div className="mt-8 border-t border-ink-04 pt-5">
            <p className="mb-2 text-xs text-ink-09">
              Private notes. Never rendered into the resume, never included in a share link.
            </p>
            <textarea
              value={state.resume.notes}
              maxLength={4000}
              aria-label="Private notes"
              rows={4}
              placeholder="mention the Kafka migration"
              onChange={(e) => dispatch({ type: 'notes_set', value: e.target.value })}
              className="w-full resize-y rounded-xs border border-ink-05 bg-ink-00 px-2.5 py-2 text-xs text-ink-12 placeholder:text-ink-07"
            />
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-2xs text-ink-07">
            <Icon name="check" className="size-3" />
            Preview and export arrive in phases 6 and 7
          </p>
        </aside>
      </div>
    </div>
  )
}

export type { EditorState }
