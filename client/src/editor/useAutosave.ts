import { useCallback, useEffect, useRef } from 'react'
import type { AxiosError } from 'axios'
import type { ApiErrorShape, ResumeDetail } from '@r4u/shared'
import { api } from '@/lib/api'
import { diffResume } from './diff'
import { fromWire } from './fromWire'
import type { EditorAction, EditorState } from './reducer'

export const AUTOSAVE_DELAY = 500

// debounced HTTP PATCH of the diff since the last confirmed save, see ADR-013
export function useAutosave(state: EditorState, dispatch: (action: EditorAction) => void) {
  // a ref, because the timer closure would otherwise capture the state it was created with
  const latest = useRef(state)
  latest.current = state

  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    const current = latest.current
    if (inFlight.current) return

    const ops = diffResume(current.base, current.resume)
    if (ops.length === 0) return

    const sent = current.resume
    inFlight.current = true
    dispatch({ type: 'save_started' })

    try {
      const res = await api.patch(`/resumes/${current.resume.id}`, {
        version: current.base.version,
        ops,
      })
      dispatch({ type: 'save_succeeded', sent, version: res.data.data.version })
    } catch (error) {
      const failure = error as AxiosError<ApiErrorShape & { data?: { resume: ResumeDetail } }>

      // 409: the other tab won, so rebase on the server copy rather than reload
      if (failure.response?.status === 409) {
        const remote = (failure.response.data as { data?: { resume: ResumeDetail } }).data?.resume
        if (remote) {
          dispatch({ type: 'rebased', resume: fromWire(remote) })
          return
        }
      }

      dispatch({ type: 'save_failed' })
    } finally {
      inFlight.current = false
    }
  }, [dispatch])

  const dirty = diffResume(state.base, state.resume).length > 0

  useEffect(() => {
    if (!dirty) return

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dirty, state.resume, flush])

  // the browser will not await a save, so the honest option is to ask the user
  useEffect(() => {
    if (!dirty) return

    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // one last attempt when the editor closes, for the common case of navigating within the app
  useEffect(() => {
    return () => {
      if (diffResume(latest.current.base, latest.current.resume).length > 0) void flush()
    }
  }, [flush])

  return { dirty, flush }
}
