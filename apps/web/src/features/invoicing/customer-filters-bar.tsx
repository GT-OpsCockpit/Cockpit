import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
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
  const clients = useClientsControllerList({ search: debouncedClientSearch || undefined, limit: PICKER_LIMIT })
  const clientOptions = [
    { value: '', label: 'All clients' },
    ...(clients.data?.data ?? []).filter((c) => c.clientType !== 'EVENT').map((c) => ({ value: c.ref, label: c.name })),
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
    <div className="flex flex-wrap items-end gap-2">
      {filters.eventsMode ? (
        <SearchCombobox
          id="inv-cust-event"
          aria-label="Event"
          className="w-48"
          value={filters.eventRef}
          onChange={(v) => set('eventRef', v)}
          options={eventOptions}
          placeholder="All events"
          searchPlaceholder="Search event…"
          searchValue={eventSearch}
          onSearchChange={setEventSearch}
          loading={eventSearchPending || events.isFetching}
        />
      ) : (
        <SearchCombobox
          id="inv-cust-client"
          aria-label="Client"
          className="w-48"
          value={filters.clientRef}
          onChange={(v) => set('clientRef', v)}
          options={clientOptions}
          placeholder="All clients"
          searchPlaceholder="Search client…"
          searchValue={clientSearch}
          onSearchChange={setClientSearch}
          loading={clientSearchPending || clients.isFetching}
        />
      )}

      <Input
        className="w-36"
        type="date"
        value={filters.dateStart}
        onChange={(e) => set('dateStart', e.target.value)}
        aria-label="Date in"
      />
      <Input
        className="w-36"
        type="date"
        value={filters.dateEnd}
        onChange={(e) => set('dateEnd', e.target.value)}
        aria-label="Date out"
      />

      <Input
        className="w-40"
        placeholder="Search ref/PO…"
        value={filters.refPo}
        onChange={(e) => set('refPo', e.target.value)}
      />
      <Input
        className="w-40"
        placeholder="Search passenger…"
        value={filters.passenger}
        onChange={(e) => set('passenger', e.target.value)}
      />

      <div className="flex items-center gap-2 pb-2">
        <Checkbox id="inv-cust-events-toggle" checked={filters.eventsMode} onCheckedChange={(c) => toggleEventsMode(!!c)} />
        <Label htmlFor="inv-cust-events-toggle" title="Search by Event instead of Client">
          Events
        </Label>
      </div>
    </div>
  )
}
