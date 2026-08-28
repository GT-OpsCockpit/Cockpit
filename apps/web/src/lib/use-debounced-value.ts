import { useEffect, useState } from 'react'

/** Delays reacting to a fast-changing value (e.g. a search input) until it's stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

/**
 * Same debounce, plus a `pending` flag for the window between a keystroke and
 * the query it will trigger — a remote-search combobox has to look busy from
 * the first character typed, not only once the request is actually in flight,
 * otherwise the debounce delay reads as a dead UI.
 */
export function useDebouncedSearch(value: string, delayMs: number): { debounced: string; pending: boolean } {
  const debounced = useDebouncedValue(value, delayMs)
  return { debounced, pending: debounced !== value }
}
