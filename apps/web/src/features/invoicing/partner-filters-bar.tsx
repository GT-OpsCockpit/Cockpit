import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList, useDriversControllerList } from '@cockpit/shared/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useOptionMemory } from '@/lib/use-option-memory'
import { SearchCombobox } from '@/components/search-combobox'
import { Input } from '@/components/ui/input'
import type { PartnerFilters } from './partner-filters'

const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

/** Mirrors the legacy's Partner log search block (invoicing.html:142-172). */
export function PartnerFiltersBar({
  filters,
  onChange,
}: {
  filters: PartnerFilters
  onChange: (filters: PartnerFilters) => void
}) {
  const [partnerSearch, setPartnerSearch] = useState('')
  const debouncedPartnerSearch = useDebouncedValue(partnerSearch, PICKER_DEBOUNCE_MS)
  // The "partner" pool is the same split used everywhere else in the app: a driver record with a non-empty Company.
  const partners = useDriversControllerList({ search: debouncedPartnerSearch || undefined, limit: PICKER_LIMIT })
  const partnerResults = (partners.data?.data ?? [])
    .filter((d) => d.company)
    .map((d) => ({ value: d.ref, label: `${d.name} — ${d.company}` }))
  const partnerOptions = [{ value: '', label: 'All partners' }, ...useOptionMemory(partnerResults)]

  const [eventSearch, setEventSearch] = useState('')
  const debouncedEventSearch = useDebouncedValue(eventSearch, PICKER_DEBOUNCE_MS)
  const events = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedEventSearch || undefined,
    limit: PICKER_LIMIT,
  })
  const eventOptions = [{ value: '', label: 'All events' }, ...useOptionMemory((events.data?.data ?? []).map((c) => ({ value: c.ref, label: c.name })))]

  const set = <K extends keyof PartnerFilters>(key: K, value: PartnerFilters[K]) => onChange({ ...filters, [key]: value })

  // Partner / Event selects are mutually exclusive, same convention as Customer.
  const setPartner = (v: string) => onChange({ ...filters, partnerRef: v, eventRef: v ? '' : filters.eventRef })
  const setEvent = (v: string) => onChange({ ...filters, eventRef: v, partnerRef: v ? '' : filters.partnerRef })

  return (
    <div className="flex flex-wrap items-end gap-2">
      <SearchCombobox
        aria-label="Partner"
        className="w-56"
        value={filters.partnerRef}
        onChange={setPartner}
        options={partnerOptions}
        placeholder="All partners"
        searchPlaceholder="Search partner…"
        searchValue={partnerSearch}
        onSearchChange={setPartnerSearch}
      />

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
        className="w-44"
        placeholder="Search ref/PO…"
        value={filters.refPo}
        onChange={(e) => set('refPo', e.target.value)}
      />

      <SearchCombobox
        aria-label="Event"
        className="w-56"
        value={filters.eventRef}
        onChange={setEvent}
        options={eventOptions}
        placeholder="All events"
        searchPlaceholder="Search event…"
        searchValue={eventSearch}
        onSearchChange={setEventSearch}
      />
    </div>
  )
}
