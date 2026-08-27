import { useEffect, useState } from 'react'
import type { ComboboxOption } from '@/components/search-combobox'

/**
 * A remote-search SearchCombobox only ever holds a small, current slice of
 * options (request-on-demand — see docs/handoff for the 2026-08-27 session).
 * That breaks the "show the selected item's label" contract the moment a
 * fresh search no longer includes it: SearchCombobox derives the trigger's
 * label from `options.find(o => o.value === value)`, so a stale selection
 * would silently fall back to the placeholder.
 *
 * This remembers every option ever seen (from live results, plus an
 * optional `seed` — e.g. the trip's already-known client/driver when editing)
 * so a previously selected value keeps its label indefinitely, while live
 * results still take priority/order in the dropdown itself.
 *
 * Deliberately an effect, not a ref mutated during render: `results` changes
 * because a query (an external system) resolved, not because of a user
 * event this component owns, and this project's React Compiler requires
 * render purity — mutating a ref during render is unsafe under it (a
 * memoized render could skip re-running and read a stale ref value), so the
 * accumulation has to live in real state, updated from an effect.
 */
export function useOptionMemory(results: ComboboxOption[], seed?: ComboboxOption | null): ComboboxOption[] {
  const [memory, setMemory] = useState<Map<string, ComboboxOption>>(new Map())

  useEffect(() => {
    setMemory((prev) => {
      let changed = false
      const next = new Map(prev)
      if (seed && next.get(seed.value)?.label !== seed.label) {
        next.set(seed.value, seed)
        changed = true
      }
      for (const option of results) {
        if (next.get(option.value)?.label !== option.label) {
          next.set(option.value, option)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [results, seed])

  const seen = new Set(results.map((o) => o.value))
  const remembered = [...memory.values()].filter((o) => !seen.has(o.value))
  return [...results, ...remembered]
}
