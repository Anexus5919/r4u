import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Closes a menu or panel on a pointer press outside it, or on Escape. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!open) return

    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onDismiss])
}
