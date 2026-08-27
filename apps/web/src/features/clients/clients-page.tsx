import { useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ClientEntity } from '@cockpit/shared/api'
import { getClientsControllerListQueryKey, useClientsControllerList, useClientsControllerSetActive } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { ListPagination } from '@/components/list-pagination'
import { ClientCreateDialog } from './client-create-dialog'
import { ClientEditDialog } from './client-edit-dialog'
import { ClientFiltersBar } from './client-filters-bar'
import { ClientsTable } from './clients-table'
import { defaultClientFilters, type ClientFilters } from './client-status'

const PAGE_SIZE = 20

export function ClientsPage() {
  const [filters, setFilters] = useState(defaultClientFilters())
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<ClientEntity | null>(null)

  // Debounced so typing doesn't fire a request per keystroke — search/type/
  // showInactive are all resolved server-side now (ClientsService.list()),
  // not filtered in the browser against a full unpaginated fetch.
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const clients = useClientsControllerList(
    {
      search: debouncedSearch || undefined,
      type: filters.type || undefined,
      includeInactive: filters.showInactive || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { query: { placeholderData: keepPreviousData } },
  )

  const setActive = useClientsControllerSetActive()

  const handleFiltersChange = (next: ClientFilters) => {
    setFilters(next)
    setPage(1)
  }

  const handleToggleActive = async (client: ClientEntity) => {
    try {
      await setActive.mutateAsync({ ref: client.ref, data: { active: !client.active } })
      toast.success(`Account ${client.ref} ${client.active ? 'deactivated' : 'reactivated'}.`)
      void queryClient.invalidateQueries({ queryKey: getClientsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating account status.'))
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <ClientCreateDialog />
      </div>

      <ClientFiltersBar filters={filters} onChange={handleFiltersChange} />

      <ClientsTable
        clients={clients.data?.data ?? []}
        onEdit={setEditTarget}
        onToggleActive={(c) => void handleToggleActive(c)}
      />

      <ListPagination page={page} limit={PAGE_SIZE} total={clients.data?.total ?? 0} onPageChange={setPage} />

      <ClientEditDialog client={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
    </div>
  )
}
