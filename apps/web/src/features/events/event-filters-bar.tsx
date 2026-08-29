import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList, useMetaControllerGetMeta } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { FilterField } from '@/components/filter-field'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EventFilters } from './event-filters'

const ALL = '__all__'
const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

/** Mirrors the legacy's Events search block (events.html:230-265). */
export function EventFiltersBar({
  filters,
  onChange,
}: {
  filters: EventFilters
  onChange: (filters: EventFilters) => void
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
    <div className="flex flex-wrap items-end gap-3">
      {/* "Customer", not "Client": the event-selection half of this same card
          already owns a "Client" field, and two identically named fields side
          by side name nothing at all. */}
      <FilterField label="Customer" htmlFor="ev-filter-client" className="w-48">
        <SearchCombobox
          id="ev-filter-client"
          className="w-full"
          value={filters.clientRef}
          onChange={(v) => set('clientRef', v)}
          options={clientOptions}
          placeholder="All clients"
          searchPlaceholder="Search event client…"
          searchValue={clientSearch}
          onSearchChange={setClientSearch}
          loading={clientSearchPending || clients.isFetching}
        />
      </FilterField>

      {/* A <Select> here meant scrolling 210 unsearchable rows, and labelled them
          by name alone where every other screen shows "Name (CODE)". */}
      <FilterField label="Country" htmlFor="ev-filter-country" className="w-40">
        <SearchCombobox
          id="ev-filter-country"
          className="w-full"
          value={filters.countryCode}
          onChange={(v) => set('countryCode', v)}
          options={countryOptions}
          placeholder="All countries"
          searchPlaceholder="Search country…"
        />
      </FilterField>

      <FilterField label="Date start" htmlFor="ev-filter-date-start" className="w-36">
        <Input
          id="ev-filter-date-start"
          className="w-full"
          type="date"
          value={filters.dateStart}
          onChange={(e) => set('dateStart', e.target.value)}
        />
      </FilterField>
      <FilterField label="Date end" htmlFor="ev-filter-date-end" className="w-36">
        <Input
          id="ev-filter-date-end"
          className="w-full"
          type="date"
          value={filters.dateEnd}
          onChange={(e) => set('dateEnd', e.target.value)}
        />
      </FilterField>

      <FilterField label="Vehicle type" htmlFor="ev-filter-vehicle-type" className="w-36">
        <Select value={filters.vehicleType || ALL} onValueChange={(v) => set('vehicleType', v === ALL ? '' : v)}>
          <SelectTrigger id="ev-filter-vehicle-type" className="w-full">
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
      </FilterField>

      <FilterField label="Event name" htmlFor="ev-filter-event-name" className="w-44">
        <Input
          id="ev-filter-event-name"
          className="w-full"
          placeholder="Search event name…"
          value={filters.eventName}
          onChange={(e) => set('eventName', e.target.value)}
        />
      </FilterField>
      <FilterField label="Ref/PO" htmlFor="ev-filter-ref-po" className="w-44">
        <Input
          id="ev-filter-ref-po"
          className="w-full"
          placeholder="Search ref/PO…"
          value={filters.refPoOther}
          onChange={(e) => set('refPoOther', e.target.value)}
        />
      </FilterField>
    </div>
  )
}
