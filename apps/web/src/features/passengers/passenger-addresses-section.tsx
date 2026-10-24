import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPassengersControllerGetQueryKey,
  passengersControllerListQueryKeyPrefix,
  useGeoControllerGeocodeSearch,
  usePassengersControllerAddAddress,
  usePassengersControllerDeleteAddress,
  usePassengersControllerUpdateAddress,
  type PassengerAddressEntity,
  type PassengerEntity,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { SearchCombobox } from '@/components/search-combobox'

const ADDRESS_DEBOUNCE_MS = 450
const ADDRESS_MIN_CHARS = 2

interface DraftAddress {
  id: string | null
  title: string
  address: string
  info: string
  countryCode: string | null
  postalCode: string | null
  isAirport: boolean
}

const BLANK_DRAFT: DraftAddress = {
  id: null,
  title: '',
  address: '',
  info: '',
  countryCode: null,
  postalCode: null,
  isAirport: false,
}

/**
 * The address itself is geocoded exactly like a trip's PU/DO field
 * (LocationField in trip-form-fields.tsx) — same live search, same "type it
 * and it's still accepted even if nothing matched" behaviour — but doesn't
 * need that field's FBO/timezone lookups: a saved address only has to carry
 * a country/airport flag forward, not fill in a flight block.
 */
export function PassengerAddressesSection({ passenger }: { passenger: PassengerEntity }) {
  const [draft, setDraft] = useState<DraftAddress | null>(null)
  const [addressSearch, setAddressSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PassengerAddressEntity | null>(null)

  const { debounced, pending } = useDebouncedSearch(addressSearch, ADDRESS_DEBOUNCE_MS)
  const query = debounced.trim()
  const suggestions = useGeoControllerGeocodeSearch(
    { q: query, limit: '8' },
    { query: { enabled: query.length >= ADDRESS_MIN_CHARS } },
  )
  const hits = suggestions.data?.results ?? []

  const addAddress = usePassengersControllerAddAddress()
  const updateAddress = usePassengersControllerUpdateAddress()
  const deleteAddress = usePassengersControllerDeleteAddress()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: passengersControllerListQueryKeyPrefix })
    void queryClient.invalidateQueries({ queryKey: getPassengersControllerGetQueryKey(passenger.ref) })
  }

  const startEdit = (address: PassengerAddressEntity) => {
    setDraft({
      id: address.id,
      title: address.title,
      address: address.address,
      info: address.info ?? '',
      countryCode: address.countryCode,
      postalCode: address.postalCode,
      isAirport: address.isAirport,
    })
    setAddressSearch('')
  }

  const pickAddress = (value: string) => {
    if (!draft) return
    const hit = hits.find((h) => h.displayName === value)
    setDraft({
      ...draft,
      address: value,
      countryCode: hit?.countryCode ?? draft.countryCode,
      postalCode: hit?.postalCode ?? draft.postalCode,
      isAirport: hit?.isAirport ?? draft.isAirport,
    })
  }

  const saveDraft = async () => {
    if (!draft) return
    if (!draft.title.trim() || !draft.address.trim()) {
      toast.error('Title and address are both required.')
      return
    }
    const data = {
      title: draft.title.trim(),
      address: draft.address.trim(),
      info: draft.info.trim() || undefined,
      countryCode: draft.countryCode ?? undefined,
      postalCode: draft.postalCode ?? undefined,
      isAirport: draft.isAirport,
    }
    try {
      if (draft.id) {
        await updateAddress.mutateAsync({ ref: passenger.ref, addressId: draft.id, data })
        toast.success('Address updated.')
      } else {
        await addAddress.mutateAsync({ ref: passenger.ref, data })
        toast.success('Address added.')
      }
      setDraft(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving address.'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAddress.mutateAsync({ ref: passenger.ref, addressId: deleteTarget.id })
      toast.success('Address removed.')
      setDeleteTarget(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error removing address.'))
    }
  }

  const saving = addAddress.isPending || updateAddress.isPending

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Saved addresses</h3>

      {(passenger.addresses ?? []).length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Info</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(passenger.addresses ?? []).map((address) => (
              <TableRow key={address.id}>
                <TableCell className="text-xs font-medium">{address.title}</TableCell>
                <TableCell className="text-xs">{address.address}</TableCell>
                <TableCell className="text-xs">{address.info ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(address)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(address)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {draft ? (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
          <Input
            placeholder="Title (e.g. Home, Office)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <SearchCombobox
            icon={MapPin}
            value={draft.address}
            onChange={pickAddress}
            options={hits.map((hit) => ({ value: hit.displayName, label: hit.displayName }))}
            placeholder="Search an address…"
            searchPlaceholder="Search an address…"
            searchValue={addressSearch}
            onSearchChange={setAddressSearch}
            loading={query.length >= ADDRESS_MIN_CHARS && (pending || suggestions.isFetching)}
            allowCustomValue
            customValueLabel={(typed) => `Use “${typed}”`}
            selectedLabel={draft.address || undefined}
          />
          <Input
            placeholder="Apt number, gate code, other info…"
            value={draft.info}
            onChange={(e) => setDraft({ ...draft, info: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-3">
            <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={saving}>
              {draft.id ? 'Save' : 'Add'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(null)
                setAddressSearch('')
              }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setDraft(BLANK_DRAFT)}>
          <Plus className="size-3.5" />
          Add an address
        </Button>
      )}

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this address?"
        description={deleteTarget ? `"${deleteTarget.title}" will no longer be suggested for this passenger.` : ''}
        confirmLabel="Remove"
        pending={deleteAddress.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
