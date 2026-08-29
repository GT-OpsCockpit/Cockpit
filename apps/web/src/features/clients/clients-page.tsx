import { useState } from 'react'
import type { ClientEntity, ClientsControllerListParams } from '@cockpit/shared/api'
import { getClientsControllerListQueryKey, useClientsControllerList, useClientsControllerSetActive } from '@cockpit/shared/api'
import { useRoster } from '@/lib/use-roster'
import { FilterCard } from '@/components/filter-card'
import { ListPagination } from '@/components/list-pagination'
import { BookingCreateDialog, type BookingPrefill } from '@/features/bookings/booking-create-dialog'
import { ClientCreateDialog } from './client-create-dialog'
import { ClientEditDialog } from './client-edit-dialog'
import { ClientFiltersBar } from './client-filters-bar'
import { ClientsTable } from './clients-table'
import { clientBookingPrefill, defaultClientFilters, type ClientFilters } from './client-status'
import { PageTitle } from '@/components/layout/page-title'

export function ClientsPage() {
  const [editTarget, setEditTarget] = useState<ClientEntity | null>(null)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)

  const roster = useRoster<ClientFilters, ClientEntity, { type?: ClientsControllerListParams['type'] }>({
    defaults: defaultClientFilters,
    useList: useClientsControllerList,
    useSetActive: useClientsControllerSetActive,
    listQueryKey: getClientsControllerListQueryKey(),
    extraParams: (filters) => ({ type: filters.type || undefined }),
    label: 'Account',
    errorLabel: 'account',
  })

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle>Clients</PageTitle>
        <ClientCreateDialog />
      </div>

      <FilterCard hasActiveFilters={roster.hasActiveFilters} onReset={roster.resetFilters}>
        <ClientFiltersBar filters={roster.filters} onChange={roster.setFilters} />
      </FilterCard>

      <ClientsTable
        clients={roster.rows}
        loading={roster.loading}
        onEdit={setEditTarget}
        onToggleActive={roster.toggleActive}
        onNewBooking={(c) => setBookingPrefill(clientBookingPrefill(c))}
        hasActiveFilters={roster.hasActiveFilters}
        onResetFilters={roster.resetFilters}
      />

      <ListPagination page={roster.page} limit={roster.pageSize} total={roster.total} onPageChange={roster.setPage} />

      <ClientEditDialog client={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
      <BookingCreateDialog
        open={bookingPrefill !== null}
        onOpenChange={(open) => !open && setBookingPrefill(null)}
        draftKey="newBookingDraft:clients"
        prefill={bookingPrefill ?? undefined}
      />
    </div>
  )
}
