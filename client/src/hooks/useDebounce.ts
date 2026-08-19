import { useEffect, useState } from 'react'

/**
 * Returns the value only after it has stopped changing for `delay` milliseconds.
 *
 * Used by the dashboard search box and, in phase 5, by autosave. The cleanup is what makes it
 * correct: without clearing the previous timer on every keystroke, a fast typist queues one
 * pending update per character and they all fire.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
