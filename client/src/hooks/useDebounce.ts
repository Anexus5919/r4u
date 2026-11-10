import { useEffect, useState } from 'react'

/** the cleanup clears the previous timer, or every keystroke queues an update */
export function useDebounce<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
