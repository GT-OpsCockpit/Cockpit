import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList, useMetaControllerGetMeta } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterResetButton } from '@/components/filter-reset-button'
import type { EventFilters } from './event-filters'

const ALL = '__all__'
const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

/** Mirrors the legacy's Events search block (events.html:230-265). */
export function EventFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
}: {
  filters: EventFilters
  onChange: (filters: EventFilters) => void
  hasActiveFilters: boolean
  onReset: () => void
}) {
  const meta = useMetaControllerGetMeta()
  const countryOptions = [{ value: '', label: 'All countries' }, ...useCountryOptions()]

  const [clientSearch, setClientSearch] = useState('')
  const { debounced: debouncedClientSearch, pending: clientSearchPending } = useDebouncedSearch(clientSearch, PICKER_DEBOUNCE_MS)
  const clients = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedClientSearch || undefined,
    limit: PICKER_LIMIT,
  })
  const clientOptions = [
    { value: '', label: 'All clients' },
    ...(clients.data?.data ?? []).map((c) => ({ value: c.ref, label: c.name })),
  ]

  const set = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap gap-2">
      <SearchCombobox
        className="w-48"
        value={filters.clientRef}
        onChange={(v) => set('clientRef', v)}
        options={clientOptions}
        placeholder="All clients"
        searchPlaceholder="Search event client…"
        searchValue={clientSearch}
        onSearchChange={setClientSearch}
        loading={clientSearchPending || clients.isFetching}
      />

      {/* A <Select> here meant scrolling 210 unsearchable rows, and labelled them
          by name alone where every other screen shows "Name (CODE)". */}
      <SearchCombobox
        className="w-40"
        aria-label="Country"
        value={filters.countryCode}
        onChange={(v) => set('countryCode', v)}
        options={countryOptions}
        placeholder="All countries"
        searchPlaceholder="Search country…"
      />

      <Input
        className="w-36"
        type="date"
        value={filters.dateStart}
        onChange={(e) => set('dateStart', e.target.value)}
        aria-label="Date start"
      />
      <Input
        className="w-36"
        type="date"
        value={filters.dateEnd}
        onChange={(e) => set('dateEnd', e.target.value)}
        aria-label="Date end"
      />

      <Select value={filters.vehicleType || ALL} onValueChange={(v) => set('vehicleType', v === ALL ? '' : v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All vehicles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All vehicles</SelectItem>
          {(meta.data?.vehicleTypes ?? []).map((v) => (
            <SelectItem key={v.ref} value={v.name}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="w-44"
        placeholder="Search event name…"
        value={filters.eventName}
        onChange={(e) => set('eventName', e.target.value)}
      />
      <Input
        className="w-44"
        placeholder="Search ref/PO…"
        value={filters.refPoOther}
        onChange={(e) => set('refPoOther', e.target.value)}
      />

      <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
    </div>
  )
}
