import { useState } from 'react'
import type { PassengerEntity } from '@cockpit/shared/api'
import { usePassengersControllerList } from '@cockpit/shared/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { PageTitle } from '@/components/layout/page-title'
import { FilterCard } from '@/components/filter-card'
import { FilterField } from '@/components/filter-field'
import { Input } from '@/components/ui/input'
import { PassengerCreateDialog } from './passenger-create-dialog'
import { PassengerEditDialog } from './passenger-edit-dialog'
import { PassengersTable } from './passengers-table'

export function PassengersPage() {
  const [search, setSearch] = useState('')
  // Just the ref, not the row object — PassengerEditDialog fetches its own
  // live copy by ref, so an address/route added inside it is visible
  // immediately without a close-and-reopen round trip.
  const [editTargetRef, setEditTargetRef] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 300)

  const passengers = usePassengersControllerList({ search: debouncedSearch || undefined })
  const hasActiveFilters = search.trim().length > 0

  const handleEdit = (passenger: PassengerEntity) => setEditTargetRef(passenger.ref)

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle />
        <PassengerCreateDialog />
      </div>

      <FilterCard hasActiveFilters={hasActiveFilters} onReset={() => setSearch('')}>
        <FilterField label="Search" htmlFor="psg-filter-search" className="w-80">
          <Input
            id="psg-filter-search"
            placeholder="Search by name, phone, email or ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
      </FilterCard>

      <PassengersTable
        passengers={passengers.data ?? []}
        loading={passengers.isLoading}
        onEdit={handleEdit}
      />

      <PassengerEditDialog passengerRef={editTargetRef} onOpenChange={(open) => !open && setEditTargetRef(null)} />
    </div>
  )
}
