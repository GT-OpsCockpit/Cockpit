import { useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { filtersChanged } from '@/lib/utils'

/**
 * The read path every roster page shares — Clients, Drivers, Vehicles: a
 * search box that must not fire a request per keystroke, a server-paginated
 * list that must not flicker between pages, a page number that must go back
 * to 1 the moment the filters change, and one activate/deactivate switch that
 * announces itself and refreshes the list.
 *
 * The pieces were already extracted (useDebouncedValue, ListPagination,
 * filtersChanged) — what was copied three times is the orchestration between
 * them, which is where a page actually goes wrong: forgetting the reset to 1
 * leaves the user on a page 3 that no longer exists, forgetting
 * keepPreviousData makes the table blink empty on every Next.
 *
 * Callers own what makes their record a record (its filters, its columns, its
 * dialogs, its reactivation permission) and the endpoints it lives at.
 *
 * Same division as useRecordForm, one page up: that one owns the write, this
 * one owns the read.
 */

const PAGE_SIZE = 20

/** Every roster filters bar has these two; a record may add its own (Clients' type). */
export interface RosterFilters {
  search: string
  showInactive: boolean
}

/** What the hook needs of a row to switch it on and off. */
export interface RosterRecord {
  ref: string
  active: boolean
}

interface RosterListParams {
  search?: string
  includeInactive?: boolean
  page?: number
  limit?: number
}

export interface RosterOptions<
  TFilters extends RosterFilters,
  TRow extends RosterRecord,
  TExtra extends object,
> {
  /** The blank filters bar. Called for the initial state and to reset. */
  defaults: () => TFilters
  /** The record's generated list hook, called with the params decided here. */
  useList: (
    params: RosterListParams & Partial<TExtra>,
    options: { query: { placeholderData: typeof keepPreviousData } },
  ) => { data?: { data: TRow[]; total: number }; isLoading: boolean }
  /** The record's generated activate/deactivate mutation hook. */
  useSetActive: () => {
    mutateAsync: (variables: {
      ref: string
      data: { active: boolean }
    }) => Promise<unknown>
  }
  /** The list query the switch invalidates. */
  listQueryKey: QueryKey
  /** Filters this record sends that the other two don't — Clients' `type`. */
  extraParams?: (filters: TFilters) => TExtra
  /** Names the record in the success toast: `Account C1 deactivated.` */
  label: string
  /** Names it in the failure one: `Error updating account status.` */
  errorLabel: string
}

export interface Roster<TFilters, TRow> {
  filters: TFilters
  /** Applies the filters and sends the user back to page 1. */
  setFilters: (filters: TFilters) => void
  hasActiveFilters: boolean
  resetFilters: () => void
  page: number
  setPage: (page: number) => void
  pageSize: number
  rows: TRow[]
  total: number
  /** First (uncached) load — the table shows skeleton rows rather than its empty state. */
  loading: boolean
  toggleActive: (record: TRow) => void
}

export function useRoster<
  TFilters extends RosterFilters,
  TRow extends RosterRecord,
  TExtra extends object = Record<string, never>,
>({
  defaults,
  useList,
  useSetActive,
  listQueryKey,
  extraParams,
  label,
  errorLabel,
}: RosterOptions<TFilters, TRow, TExtra>): Roster<TFilters, TRow> {
  const [filters, setFiltersState] = useState(defaults)
  const [page, setPage] = useState(1)

  // Debounced so typing doesn't fire a request per keystroke — search and
  // showInactive are resolved server-side, not filtered in the browser
  // against a full unpaginated fetch.
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const extras: Partial<TExtra> = extraParams ? extraParams(filters) : {}
  const list = useList(
    {
      search: debouncedSearch || undefined,
      includeInactive: filters.showInactive || undefined,
      page,
      limit: PAGE_SIZE,
      ...extras,
    },
    { query: { placeholderData: keepPreviousData } },
  )

  const setActive = useSetActive()

  // A page number only means anything against the filters that produced it:
  // narrowing the list while on page 3 would otherwise leave the user staring
  // at an empty table.
  const setFilters = (next: TFilters) => {
    setFiltersState(next)
    setPage(1)
  }

  const applyToggle = async (record: TRow) => {
    try {
      await setActive.mutateAsync({
        ref: record.ref,
        data: { active: !record.active },
      })
      toast.success(
        `${label} ${record.ref} ${record.active ? 'deactivated' : 'reactivated'}.`,
      )
      void queryClient.invalidateQueries({ queryKey: listQueryKey })
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Error updating ${errorLabel} status.`))
    }
  }

  return {
    filters,
    setFilters,
    hasActiveFilters: filtersChanged(filters, defaults()),
    resetFilters: () => setFilters(defaults()),
    page,
    setPage,
    pageSize: PAGE_SIZE,
    rows: list.data?.data ?? [],
    total: list.data?.total ?? 0,
    loading: list.isLoading,
    toggleActive: (record) => void applyToggle(record),
  }
}
