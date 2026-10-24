import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPassengersControllerGetQueryKey,
  passengersControllerListQueryKeyPrefix,
  useGeoControllerGeocodeSearch,
  useMetaControllerGetMeta,
  usePassengersControllerAddRoute,
  usePassengersControllerDeleteRoute,
  usePassengersControllerUpdateRoute,
  type PassengerEntity,
  type PassengerRouteEntity,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { SearchCombobox } from '@/components/search-combobox'
import { formatMoney } from '@/features/finance/format-money'

const ADDRESS_DEBOUNCE_MS = 450
const ADDRESS_MIN_CHARS = 2

interface DraftRoute {
  id: string | null // null = adding a new one
  pickupLocation: string
  dropoffLocation: string
  vehicleTypeRef: string
  priceEur: string
}

const BLANK_DRAFT: DraftRoute = { id: null, pickupLocation: '', dropoffLocation: '', vehicleTypeRef: '', priceEur: '' }

function googleMapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

/**
 * Each add/edit/delete here writes immediately (its own mutation, its own
 * refetch) rather than batching into the passenger form's own submit —
 * same reasoning as NameboardUploadDialog: the passenger already has a ref
 * to attach these to, so there's nothing gained by waiting for a bigger
 * "Save" click, and one failed row doesn't roll back the others.
 *
 * Pickup/drop-off are geocoded exactly like a saved address
 * (PassengerAddressesSection) or a trip's own PU/DO field — live search,
 * still accepts whatever is typed even without a match — so a route's
 * addresses stay real Google Maps locations rather than free text that
 * happens to look like one.
 */
export function PassengerRoutesSection({ passenger }: { passenger: PassengerEntity }) {
  const meta = useMetaControllerGetMeta()
  const [draft, setDraft] = useState<DraftRoute | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PassengerRouteEntity | null>(null)
  const [pickupSearch, setPickupSearch] = useState('')
  const [dropoffSearch, setDropoffSearch] = useState('')

  const { debounced: debouncedPickup, pending: pickupPending } = useDebouncedSearch(pickupSearch, ADDRESS_DEBOUNCE_MS)
  const { debounced: debouncedDropoff, pending: dropoffPending } = useDebouncedSearch(dropoffSearch, ADDRESS_DEBOUNCE_MS)
  const pickupQuery = debouncedPickup.trim()
  const dropoffQuery = debouncedDropoff.trim()
  const pickupSuggestions = useGeoControllerGeocodeSearch(
    { q: pickupQuery, limit: '8' },
    { query: { enabled: pickupQuery.length >= ADDRESS_MIN_CHARS } },
  )
  const dropoffSuggestions = useGeoControllerGeocodeSearch(
    { q: dropoffQuery, limit: '8' },
    { query: { enabled: dropoffQuery.length >= ADDRESS_MIN_CHARS } },
  )
  const pickupHits = pickupSuggestions.data?.results ?? []
  const dropoffHits = dropoffSuggestions.data?.results ?? []

  const addRoute = usePassengersControllerAddRoute()
  const updateRoute = usePassengersControllerUpdateRoute()
  const deleteRoute = usePassengersControllerDeleteRoute()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: passengersControllerListQueryKeyPrefix })
    void queryClient.invalidateQueries({ queryKey: getPassengersControllerGetQueryKey(passenger.ref) })
  }

  const startEdit = (route: PassengerRouteEntity) => {
    setDraft({
      id: route.id,
      pickupLocation: route.pickupLocation,
      dropoffLocation: route.dropoffLocation ?? '',
      vehicleTypeRef: route.vehicleType?.ref ?? '',
      priceEur: route.priceEur,
    })
    setPickupSearch('')
    setDropoffSearch('')
  }

  const saveDraft = async () => {
    if (!draft) return
    if (!draft.pickupLocation.trim()) {
      toast.error('Pickup location is required.')
      return
    }
    const price = Number(draft.priceEur)
    if (!Number.isFinite(price)) {
      toast.error('Enter a valid price.')
      return
    }
    const data = {
      pickupLocation: draft.pickupLocation.trim(),
      dropoffLocation: draft.dropoffLocation.trim() || undefined,
      vehicleTypeRef: draft.vehicleTypeRef || undefined,
      priceEur: price,
    }
    try {
      if (draft.id) {
        await updateRoute.mutateAsync({ ref: passenger.ref, routeId: draft.id, data })
        toast.success('Route updated.')
      } else {
        await addRoute.mutateAsync({ ref: passenger.ref, data })
        toast.success('Route added.')
      }
      setDraft(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving route.'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteRoute.mutateAsync({ ref: passenger.ref, routeId: deleteTarget.id })
      toast.success('Route removed.')
      setDeleteTarget(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error removing route.'))
    }
  }

  const saving = addRoute.isPending || updateRoute.isPending

  // A saved address already has its own place to be looked at (the Addresses
  // section above) — the link here is for anything that ISN'T one, so a
  // typed or geocoded-but-not-saved address can still be visually confirmed
  // on a map before the route is relied on.
  const isPreferredAddress = (address: string) => (passenger.addresses ?? []).some((a) => a.address === address)
  const renderAddressCell = (address: string | null) => {
    if (!address) return '—'
    if (isPreferredAddress(address)) return address
    return (
      <a
        href={googleMapsLink(address)}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {address}
      </a>
    )
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Preferred routes & rates</h3>

      {(passenger.routes ?? []).length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup</TableHead>
              <TableHead>Drop-off</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(passenger.routes ?? []).map((route) => (
              <TableRow key={route.id}>
                <TableCell className="text-xs">{renderAddressCell(route.pickupLocation)}</TableCell>
                <TableCell className="text-xs">{renderAddressCell(route.dropoffLocation)}</TableCell>
                <TableCell className="text-xs">{route.vehicleType?.name ?? '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatMoney(Number(route.priceEur))}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(route)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(route)}>
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
        <div className="grid gap-2 rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <SearchCombobox
              icon={MapPin}
              value={draft.pickupLocation}
              onChange={(value) => setDraft({ ...draft, pickupLocation: value })}
              options={[
                ...(passenger.addresses ?? []).map((a) => ({ value: a.address, label: a.title, description: a.address })),
                ...pickupHits.map((hit) => ({ value: hit.displayName, label: hit.displayName })),
              ]}
              placeholder="Pickup location"
              searchPlaceholder="Search an address…"
              searchValue={pickupSearch}
              onSearchChange={setPickupSearch}
              loading={pickupQuery.length >= ADDRESS_MIN_CHARS && (pickupPending || pickupSuggestions.isFetching)}
              allowCustomValue
              customValueLabel={(typed) => `Use "${typed}"`}
              selectedLabel={draft.pickupLocation || undefined}
            />
            <SearchCombobox
              icon={MapPin}
              value={draft.dropoffLocation}
              onChange={(value) => setDraft({ ...draft, dropoffLocation: value })}
              options={[
                ...(passenger.addresses ?? []).map((a) => ({ value: a.address, label: a.title, description: a.address })),
                ...dropoffHits.map((hit) => ({ value: hit.displayName, label: hit.displayName })),
              ]}
              placeholder="Drop-off (optional)"
              searchPlaceholder="Search an address…"
              searchValue={dropoffSearch}
              onSearchChange={setDropoffSearch}
              loading={dropoffQuery.length >= ADDRESS_MIN_CHARS && (dropoffPending || dropoffSuggestions.isFetching)}
              allowCustomValue
              customValueLabel={(typed) => `Use "${typed}"`}
              selectedLabel={draft.dropoffLocation || undefined}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={draft.vehicleTypeRef} onValueChange={(v) => setDraft({ ...draft, vehicleTypeRef: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {(meta.data?.vehicleTypes ?? []).map((vt) => (
                  <SelectItem key={vt.ref} value={vt.ref}>
                    {vt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Price €"
              value={draft.priceEur}
              onChange={(e) => setDraft({ ...draft, priceEur: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={saving}>
                {draft.id ? 'Save' : 'Add'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(null)
                  setPickupSearch('')
                  setDropoffSearch('')
                }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setDraft(BLANK_DRAFT)}>
          <Plus className="size-3.5" />
          Add a route
        </Button>
      )}

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this route?"
        description={deleteTarget ? `${deleteTarget.pickupLocation} will no longer be a saved route for this passenger.` : ''}
        confirmLabel="Remove"
        pending={deleteRoute.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
