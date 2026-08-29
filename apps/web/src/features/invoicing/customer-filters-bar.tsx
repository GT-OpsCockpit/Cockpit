import { useState } from 'react'
import { ClientsControllerListExcludeType, ClientsControllerListType, useClientsControllerList } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { FilterField } from '@/components/filter-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomerFilters } from './customer-filters'

const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

/** Mirrors the legacy's Customer search block (invoicing.html:52-96). */
export function CustomerFiltersBar({
  filters,
  onChange,
}: {
  filters: CustomerFilters
  onChange: (filters: CustomerFilters) => void
}) {
  const [clientSearch, setClientSearch] = useState('')
  const { debounced: debouncedClientSearch, pending: clientSearchPending } = useDebouncedSearch(clientSearch, PICKER_DEBOUNCE_MS)
  // Events have their own selector beside this one, so this is every *other*
  // account — excluded by the query rather than dropped from the page it
  // returns, which would just shorten a page of PICKER_LIMIT rows.
  const clients = useClientsControllerList({
    excludeType: ClientsControllerListExcludeType.EVENT,
    search: debouncedClientSearch || undefined,
    limit: PICKER_LIMIT,
  })
  const clientOptions = [
    { value: '', label: 'All clients' },
    ...(clients.data?.data ?? []).map((c) => ({ value: c.ref, label: c.name })),
  ]

  const [eventSearch, setEventSearch] = useState('')
  const { debounced: debouncedEventSearch, pending: eventSearchPending } = useDebouncedSearch(eventSearch, PICKER_DEBOUNCE_MS)
  const events = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedEventSearch || undefined,
    limit: PICKER_LIMIT,
  })
  const eventOptions = [
    { value: '', label: 'All events' },
    ...(events.data?.data ?? []).map((c) => ({ value: c.ref, label: c.name })),
  ]

  const set = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => onChange({ ...filters, [key]: value })

  // Client and Event fields fill the same slot (trip.client.ref) — toggling clears the other so the combination never silently returns nothing.
  const toggleEventsMode = (checked: boolean) => onChange({ ...filters, eventsMode: checked, clientRef: '', eventRef: '' })

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.eventsMode ? (
        <FilterField label="Event" htmlFor="inv-cust-event" className="w-48">
          <SearchCombobox
            id="inv-cust-event"
            className="w-full"
            value={filters.eventRef}
            onChange={(v) => set('eventRef', v)}
            options={eventOptions}
            placeholder="All events"
            searchPlaceholder="Search event…"
            searchValue={eventSearch}
            onSearchChange={setEventSearch}
            loading={eventSearchPending || events.isFetching}
          />
        </FilterField>
      ) : (
        <FilterField label="Client" htmlFor="inv-cust-client" className="w-48">
          <SearchCombobox
            id="inv-cust-client"
            className="w-full"
            value={filters.clientRef}
            onChange={(v) => set('clientRef', v)}
            options={clientOptions}
            placeholder="All clients"
            searchPlaceholder="Search client…"
            searchValue={clientSearch}
            onSearchChange={setClientSearch}
            loading={clientSearchPending || clients.isFetching}
          />
        </FilterField>
      )}

      <FilterField label="Date in" htmlFor="inv-cust-date-in" className="w-36">
        <Input
          id="inv-cust-date-in"
          className="w-full"
          type="date"
          value={filters.dateStart}
          onChange={(e) => set('dateStart', e.target.value)}
        />
      </FilterField>
      <FilterField label="Date out" htmlFor="inv-cust-date-out" className="w-36">
        <Input
          id="inv-cust-date-out"
          className="w-full"
          type="date"
          value={filters.dateEnd}
          onChange={(e) => set('dateEnd', e.target.value)}
        />
      </FilterField>

      <FilterField label="Ref/PO" htmlFor="inv-cust-ref-po" className="w-40">
        <Input
          id="inv-cust-ref-po"
          className="w-full"
          placeholder="Search ref/PO…"
          value={filters.refPo}
          onChange={(e) => set('refPo', e.target.value)}
        />
      </FilterField>
      <FilterField label="Passenger" htmlFor="inv-cust-passenger" className="w-40">
        <Input
          id="inv-cust-passenger"
          className="w-full"
          placeholder="Search passenger…"
          value={filters.passenger}
          onChange={(e) => set('passenger', e.target.value)}
        />
      </FilterField>

      <div className="flex h-9 items-center gap-2">
        <Checkbox id="inv-cust-events-toggle" checked={filters.eventsMode} onCheckedChange={(c) => toggleEventsMode(!!c)} />
        <Label htmlFor="inv-cust-events-toggle" title="Search by Event instead of Client">
          Events
        </Label>
      </div>
    </div>
  )
}
