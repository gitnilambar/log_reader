import { useEffect, useRef, useState } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of inactivity, plus an `isPending` boolean that is true while the user
 * is still typing (i.e. the debounced value hasn't caught up yet).
 *
 * Default delay is 300ms per the search specification.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState<T>(value)
  const [isPending, setIsPending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // If value just changed, we're now pending
    setIsPending(true)

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      setDebounced(value)
      setIsPending(false)
      timerRef.current = null
    }, delayMs)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [value, delayMs])

  return { debounced, isPending }
}
