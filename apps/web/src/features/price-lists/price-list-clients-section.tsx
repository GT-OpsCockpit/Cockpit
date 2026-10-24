import { Building2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPriceListsControllerGetQueryKey,
  priceListsControllerListQueryKeyPrefix,
  useClientsControllerList,
  usePriceListsControllerSetClients,
  type PriceListEntity,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Badge } from '@/components/ui/badge'
import { SearchCombobox, type ComboboxOption } from '@/components/search-combobox'

const CLIENT_PICKER_LIMIT = 100

/**
 * Which clients this list applies to — the other side of the same relation
 * a client's own edit screen could show (ClientsController's
 * /price-lists sub-resource); this is the "who's on this list" view,
 * that one the "which lists does this client use" view.
 */
export function PriceListClientsSection({ priceList }: { priceList: PriceListEntity }) {
  const clients = useClientsControllerList({ limit: CLIENT_PICKER_LIMIT })
  const setClients = usePriceListsControllerSetClients()

  const options: ComboboxOption[] = (clients.data?.data ?? [])
    .filter((c) => !(priceList.clients ?? []).some((attached) => attached.ref === c.ref))
    .map((c) => ({ value: c.ref, label: c.name }))

  const applyRefs = async (refs: string[]) => {
    try {
      await setClients.mutateAsync({ ref: priceList.ref, data: { clientRefs: refs } })
      void queryClient.invalidateQueries({ queryKey: priceListsControllerListQueryKeyPrefix })
      void queryClient.invalidateQueries({ queryKey: getPriceListsControllerGetQueryKey(priceList.ref) })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating applicable clients.'))
    }
  }

  const addClient = (clientRef: string) => {
    if (!clientRef) return
    void applyRefs([...(priceList.clients ?? []).map((c) => c.ref), clientRef])
  }

  const removeClient = (clientRef: string) => {
    void applyRefs((priceList.clients ?? []).filter((c) => c.ref !== clientRef).map((c) => c.ref))
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Applicable clients</h3>

      {(priceList.clients ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(priceList.clients ?? []).map((client) => (
            <Badge key={client.ref} variant="secondary" className="gap-1">
              {client.name}
              <button type="button" onClick={() => removeClient(client.ref)} disabled={setClients.isPending}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <SearchCombobox
        icon={Building2}
        value=""
        onChange={addClient}
        options={options}
        placeholder="Add a client…"
        searchPlaceholder="Search account…"
        disabled={setClients.isPending}
      />
    </div>
  )
}
