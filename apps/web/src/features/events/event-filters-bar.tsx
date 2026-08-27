import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList, useMetaControllerGetMeta } from '@cockpit/shared/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useOptionMemory } from '@/lib/use-option-memory'
import { SearchCombobox } from '@/components/search-combobox'
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

  const [clientSearch, setClientSearch] = useState('')
  const debouncedClientSearch = useDebouncedValue(clientSearch, PICKER_DEBOUNCE_MS)
  const clients = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedClientSearch || undefined,
    limit: PICKER_LIMIT,
  })
  const clientMemory = useOptionMemory((clients.data?.data ?? []).map((c) => ({ value: c.ref, label: c.name })))
  const clientOptions = [{ value: '', label: 'All clients' }, ...clientMemory]

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
      />

      <Select value={filters.countryCode || ALL} onValueChange={(v) => set('countryCode', v === ALL ? '' : v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All countries</SelectItem>
          {(meta.data?.countries ?? []).map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
    </div>
  )
}
