import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui/Icon'
import { ToastContext } from './ToastContext'
import type { Toast, ToastTone } from './ToastContext'

const DURATION = 5000
const MAX_VISIBLE = 3

type Action = { type: 'push'; toast: Toast } | { type: 'dismiss'; id: string }

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'push':
      return [...state, action.toast].slice(-MAX_VISIBLE)
    case 'dismiss':
      return state.filter((t) => t.id !== action.id)
  }
}

const RULE: Record<ToastTone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
  info: 'border-l-info',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    dispatch({ type: 'dismiss', id })
  }, [])

  const toast = useCallback(
    (tone: ToastTone, message: string) => {
      const id = crypto.randomUUID()
      dispatch({ type: 'push', toast: { id, tone, message } })
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION)
      )
    },
    [dismiss]
  )

  // clear every pending timer on unmount, otherwise a dispatch fires after teardown
  const pending = timers.current
  useEffect(() => () => pending.forEach(clearTimeout), [pending])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              // the surface stays neutral. only the hairline left rule carries the tone
              'pointer-events-auto flex items-start gap-3 rounded-xs border border-l-2 border-ink-05 bg-ink-00 px-3 py-2.5',
              RULE[t.tone]
            )}
          >
            <p className="flex-1 text-sm text-ink-11">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="t-xs text-ink-07 transition-colors hover:text-ink-11"
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
