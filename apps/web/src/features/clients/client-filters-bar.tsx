import { ClientEntityClientType } from '@cockpit/shared/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterField } from '@/components/filter-field'
import { SearchAndInactiveFiltersBar } from '@/components/search-and-inactive-filters-bar'
import type { ClientFilters } from './client-status'

const ALL_TYPES = '__all__'

export function ClientFiltersBar({
  filters,
  onChange,
}: {
  filters: ClientFilters
  onChange: (filters: ClientFilters) => void
}) {
  return (
    <SearchAndInactiveFiltersBar
      filters={filters}
      onChange={onChange}
      idPrefix="cl"
      searchPlaceholder="Search by ref, name, email or acronym…"
    >
      <FilterField label="Type" htmlFor="cl-filter-type" className="w-44">
        <Select
          value={filters.type || ALL_TYPES}
          onValueChange={(v) => onChange({ ...filters, type: v === ALL_TYPES ? '' : (v as ClientFilters['type']) })}
        >
          <SelectTrigger id="cl-filter-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            <SelectItem value={ClientEntityClientType.INDIVIDUAL}>Individual</SelectItem>
            <SelectItem value={ClientEntityClientType.COMPANY}>Company</SelectItem>
            <SelectItem value={ClientEntityClientType.EVENT}>Events</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </SearchAndInactiveFiltersBar>
  )
}
