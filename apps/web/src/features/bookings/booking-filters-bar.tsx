import { useState } from 'react'
import {
  useClientsControllerList,
  useDriversControllerList,
  useMetaControllerGetMeta,
  TripEntityService,
} from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { FilterResetButton } from '@/components/filter-reset-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BookingFilters, TripPeriod } from './booking-filters'

const PERIOD_OPTIONS: { value: TripPeriod; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

const ALL = '__all__'
const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

export function BookingFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
}: {
  filters: BookingFilters
  onChange: (filters: BookingFilters) => void
  hasActiveFilters: boolean
  onReset: () => void
}) {
  const meta = useMetaControllerGetMeta()

  const [clientSearch, setClientSearch] = useState('')
  const { debounced: debouncedClientSearch, pending: clientSearchPending } = useDebouncedSearch(clientSearch, PICKER_DEBOUNCE_MS)
  const clients = useClientsControllerList({ search: debouncedClientSearch || undefined, limit: PICKER_LIMIT })
  // A remote-search combobox has no built-in "clear selection" affordance
  // (unlike the plain <Select> this replaced, whose sentinel ALL item let
  // the user click back to "no filter") — always show this first, unfiltered.
  const clientOptions = [
    { value: '', label: 'All clients' },
    ...(clients.data?.data ?? []).filter((c) => c.clientType !== 'EVENT').map((c) => ({ value: c.ref, label: c.name })),
  ]

  const [driverSearch, setDriverSearch] = useState('')
  const { debounced: debouncedDriverSearch, pending: driverSearchPending } = useDebouncedSearch(driverSearch, PICKER_DEBOUNCE_MS)
  const drivers = useDriversControllerList({ search: debouncedDriverSearch || undefined, limit: PICKER_LIMIT })
  const driverOptions = [
    { value: '', label: 'All drivers' },
    ...(drivers.data?.data ?? []).map((d) => ({ value: d.ref, label: d.name })),
  ]

  const set = <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <Input
        type="search"
        placeholder="Search by ref., account, passenger or driver…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Select value={filters.period} onValueChange={(v) => set('period', v as TripPeriod)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchCombobox
          className="w-44"
          value={filters.clientRef}
          onChange={(v) => set('clientRef', v)}
          options={clientOptions}
          placeholder="All clients"
          searchPlaceholder="Search customer…"
          searchValue={clientSearch}
          onSearchChange={setClientSearch}
          loading={clientSearchPending || clients.isFetching}
        />

        <SearchCombobox
          className="w-44"
          value={filters.driverRef}
          onChange={(v) => set('driverRef', v)}
          options={driverOptions}
          placeholder="All drivers"
          searchPlaceholder="Search driver…"
          searchValue={driverSearch}
          onSearchChange={setDriverSearch}
          loading={driverSearchPending || drivers.isFetching}
        />

        <Input
          className="w-40"
          placeholder="Passenger…"
          value={filters.passenger}
          onChange={(e) => set('passenger', e.target.value)}
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

        <Select value={filters.service || ALL} onValueChange={(v) => set('service', v === ALL ? '' : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All services</SelectItem>
            <SelectItem value={TripEntityService.TSF}>TSF</SelectItem>
            <SelectItem value={TripEntityService.ASD}>ASD</SelectItem>
            <SelectItem value={TripEntityService.SPEC}>SPEC</SelectItem>
          </SelectContent>
        </Select>

        <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
      </div>
    </div>
  )
}
