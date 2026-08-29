import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FilterField } from '@/components/filter-field'
import type { RosterFilters } from '@/lib/use-roster'

/**
 * The filters bar of a roster page: one search box, one "Show deactivated"
 * switch, and room for whatever else the record filters on.
 *
 * Drivers' and Vehicles' bars were identical down to the character apart from
 * a placeholder and two ids, and Clients' was the same again plus a Select.
 * That Select is passed as a child rather than answered by a third component
 * — a record adds filters, it doesn't get a bar of its own.
 *
 * Deliberately not used by Bookings, Planning or Invoicing: their bars filter
 * on periods, dates and resources, and none of those pages is a roster.
 */
export function SearchAndInactiveFiltersBar<TFilters extends RosterFilters>({
  filters,
  onChange,
  idPrefix,
  searchPlaceholder,
  children,
}: {
  filters: TFilters
  onChange: (filters: TFilters) => void
  /** Namespaces this page's control ids — `cl`, `dr`, `vh`. */
  idPrefix: string
  searchPlaceholder: string
  /** The record's own filters, rendered before the "Show deactivated" box. */
  children?: React.ReactNode
}) {
  const set = <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => onChange({ ...filters, [key]: value })
  const searchId = `${idPrefix}-filter-search`
  const inactiveId = `${idPrefix}-show-inactive`

  return (
    <div className="grid gap-3">
      <FilterField label="Search" htmlFor={searchId}>
        <Input
          id={searchId}
          type="search"
          placeholder={searchPlaceholder}
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </FilterField>
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id={inactiveId}
            checked={filters.showInactive}
            onCheckedChange={(checked) => set('showInactive', checked === true)}
          />
          <Label htmlFor={inactiveId} className="text-sm font-normal">
            Show deactivated
          </Label>
        </div>
      </div>
    </div>
  )
}
