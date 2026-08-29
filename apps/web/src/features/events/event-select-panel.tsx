import { useState } from 'react'
import { ClientsControllerListType, useClientsControllerList } from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { FilterField } from '@/components/filter-field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EventClientCreateDialog } from './event-client-create-dialog'

const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

function formatEventDates(client: ClientEntity | null): string {
  if (!client?.eventStartDate || !client.eventEndDate) return '—'
  // eventStartDate/eventEndDate are Prisma DateTime columns, serialized as
  // full ISO instants — only the date portion is meaningful here.
  return `${client.eventStartDate.slice(0, 10)} → ${client.eventEndDate.slice(0, 10)}`
}

/**
 * "Select event" panel (events.html:34-61 + L305-346) — pick (or create) an
 * Events-type client account, then Confirm to lock the creation bar's
 * Customer field to it. Confirming a different event later just re-targets
 * the lock (there's no "unconfirm" — same as legacy, this page is scoped to
 * event bookings).
 *
 * Renders its fields alone, without a card of its own: EventsPage sits them and
 * the ride filters in one <FilterCard> — choosing the event and narrowing its
 * rides are one gesture, and two stacked cards said otherwise.
 */
export function EventSelectPanel({
  confirmedEvent,
  onConfirm,
}: {
  confirmedEvent: ClientEntity | null
  onConfirm: (client: ClientEntity) => void
}) {
  const [pendingClient, setPendingClient] = useState<ClientEntity | null>(confirmedEvent)
  const [search, setSearch] = useState('')
  const { debounced: debouncedSearch, pending: searchPending } = useDebouncedSearch(search, PICKER_DEBOUNCE_MS)
  const eventClients = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedSearch || undefined,
    limit: PICKER_LIMIT,
  })

  const results = eventClients.data?.data ?? []
  const options = results.map((c) => ({ value: c.ref, label: c.name }))

  const handleChange = (ref: string) => {
    const found = results.find((c) => c.ref === ref) ?? (pendingClient?.ref === ref ? pendingClient : null)
    setPendingClient(found ?? null)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
      <FilterField label="Client" htmlFor="event-select-client">
        <SearchCombobox
          id="event-select-client"
          value={pendingClient?.ref ?? ''}
          onChange={handleChange}
          options={options}
          placeholder="Choose an event client…"
          searchPlaceholder="Search event client…"
          searchValue={search}
          onSearchChange={setSearch}
          loading={searchPending || eventClients.isFetching}
          selectedLabel={pendingClient?.name}
        />
      </FilterField>
      <FilterField label="Event" htmlFor="event-select-name">
        <Input
          id="event-select-name"
          disabled
          value={pendingClient?.company ?? pendingClient?.name ?? ''}
          placeholder="—"
        />
      </FilterField>
      <FilterField label="Dates" htmlFor="event-select-dates">
        <Input id="event-select-dates" disabled value={formatEventDates(pendingClient)} placeholder="—" />
      </FilterField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPendingClient(null)
            setSearch('')
          }}
        >
          Cancel
        </Button>
        <EventClientCreateDialog onCreated={setPendingClient} />
        <Button type="button" disabled={!pendingClient} onClick={() => pendingClient && onConfirm(pendingClient)}>
          Confirm
        </Button>
      </div>
    </div>
  )
}
