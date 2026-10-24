import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPriceListsControllerGetQueryKey,
  priceListsControllerListQueryKeyPrefix,
  useGeoControllerGeocodeSearch,
  useMetaControllerGetMeta,
  usePriceListsControllerAddEntry,
  usePriceListsControllerDeleteEntry,
  usePriceListsControllerUpdateEntry,
  type PriceListEntity,
  type PriceListEntryEntity,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCombobox } from '@/components/search-combobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { formatMoney } from '@/features/finance/format-money'

const ADDRESS_DEBOUNCE_MS = 450
const ADDRESS_MIN_CHARS = 2

interface DraftEntry {
  id: string | null
  pickupLocation: string
  pickupPostalCountry: string
  pickupPostalCodes: string[]
  dropoffLocation: string
  dropoffPostalCountry: string
  dropoffPostalCodes: string[]
  bidirectional: boolean
  vehicleTypeRef: string
  priceEur: string
}

const BLANK_DRAFT: DraftEntry = {
  id: null,
  pickupLocation: '',
  pickupPostalCountry: '',
  pickupPostalCodes: [],
  dropoffLocation: '',
  dropoffPostalCountry: '',
  dropoffPostalCodes: [],
  bidirectional: false,
  vehicleTypeRef: '',
  priceEur: '',
}

function routeLabel(location: string | null, postalCodes: string[]): string {
  if (location) return location
  if (postalCodes.length > 0) return postalCodes.join(' / ')
  return '—'
}

/**
 * The exact-address side of a route, geocoded exactly like a trip's own
 * PU/DO (LocationField in trip-form-fields.tsx) or a passenger's saved
 * address — live search against the same Google-backed geocoder, which is
 * what makes a postal code typed here resolve to a real place rather than
 * being stored as opaque text.
 */
function GeocodedAddressInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [search, setSearch] = useState('')
  const { debounced, pending } = useDebouncedSearch(search, ADDRESS_DEBOUNCE_MS)
  const query = debounced.trim()
  const suggestions = useGeoControllerGeocodeSearch(
    { q: query, limit: '8' },
    { query: { enabled: query.length >= ADDRESS_MIN_CHARS } },
  )
  const hits = suggestions.data?.results ?? []

  return (
    <SearchCombobox
      icon={MapPin}
      value={value}
      onChange={onChange}
      options={hits.map((hit) => ({ value: hit.displayName, label: hit.displayName }))}
      placeholder={placeholder}
      searchPlaceholder="Search an address or postal code…"
      searchValue={search}
      onSearchChange={setSearch}
      loading={query.length >= ADDRESS_MIN_CHARS && (pending || suggestions.isFetching)}
      allowCustomValue
      customValueLabel={(typed) => `Use "${typed}"`}
      selectedLabel={value || undefined}
    />
  )
}

/**
 * One or several postal codes, not just one — "a fixed rate to 98000 OR
 * 06190 OR ..." is one entry, priced once, matching any of them, rather
 * than a separate identical-price row per destination.
 *
 * The country is picked first because a bare postal code is ambiguous on
 * its own (French 06190 vs some other country's own 06190) — it scopes
 * both the live city preview shown while typing and the query the preview
 * itself runs. Only the raw code is ever sent to the API (matching works by
 * substring against a trip's own address text); the resolved city name is
 * purely a this-session confirmation that what was typed is a real place.
 */
function PostalCodeMultiSelect({
  countryCode,
  onCountryChange,
  postalCodes,
  onPostalCodesChange,
  placeholder,
  onFirstCodeAdded,
}: {
  countryCode: string
  onCountryChange: (value: string) => void
  postalCodes: string[]
  onPostalCodesChange: (postalCodes: string[]) => void
  placeholder: string
  /** The exact-address box above is this side's "— or —" alternative, not a
   * companion to it — once a postal code exists, that address is redundant
   * (matching already happens on the code) and left filled in just looks
   * like unfinished cleanup. Fired only going from zero to one code, so it
   * clears the address once, the moment postal codes take over, rather than
   * fighting the dispatcher on every code added after. */
  onFirstCodeAdded?: () => void
}) {
  const countryOptions = useCountryOptions()
  const meta = useMetaControllerGetMeta()
  const countryName = meta.data?.countries.find((c) => c.code === countryCode)?.name ?? ''

  const [draftCode, setDraftCode] = useState('')
  const [cityLabels, setCityLabels] = useState<Record<string, string>>({})
  const { debounced, pending } = useDebouncedSearch(draftCode, ADDRESS_DEBOUNCE_MS)
  const query = debounced.trim()
  // Accepts either a postal code or a city name here — same geocode search
  // either way. What actually gets stored is always the *resolved* postal
  // code below (previewPostalCode), never the raw text typed: a city name
  // typed in this box must never silently become an unmatchable "postal
  // code" entry.
  const preview = useGeoControllerGeocodeSearch(
    { q: countryName ? `${query} ${countryName}` : query, limit: '1' },
    { query: { enabled: !!countryCode && query.length >= ADDRESS_MIN_CHARS } },
  )
  const previewHit = preview.data?.results[0]
  const previewCity = previewHit?.displayName
  const previewPostalCode = previewHit?.postalCode ?? null

  const addCode = () => {
    if (!query) return
    // The preview line is the one chance to catch a wrong match before it's
    // added — so adding is gated on it having actually resolved to a postal
    // code, whether what was typed was a code or a city name.
    if (!previewPostalCode) {
      toast.error('No postal code found for that — check the spelling, or type the exact postal code.')
      return
    }
    const code = previewPostalCode
    if (postalCodes.includes(code)) {
      setDraftCode('')
      return
    }
    if (previewCity) setCityLabels((labels) => ({ ...labels, [code]: previewCity }))
    if (postalCodes.length === 0) onFirstCodeAdded?.()
    onPostalCodesChange([...postalCodes, code])
    setDraftCode('')
  }
  const removeCode = (code: string) => onPostalCodesChange(postalCodes.filter((c) => c !== code))

  return (
    <div className="grid gap-1.5">
      {/* Clearing back to "no country" (SearchCombobox's built-in × — on by
          default) matters here specifically: an entry whose postal codes
          already span more than one country (e.g. French 06xxx alongside
          Monaco's 980xx) shouldn't be forced under either one. */}
      <SearchCombobox
        value={countryCode}
        onChange={onCountryChange}
        options={countryOptions}
        placeholder="Country"
        searchPlaceholder="Search a country…"
      />
      <div className="flex gap-1.5">
        <Input
          placeholder={placeholder}
          value={draftCode}
          disabled={!countryCode}
          onChange={(e) => setDraftCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCode()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addCode} disabled={!countryCode} title="Add postal code">
          <Plus className="size-4" />
        </Button>
      </div>
      {query.length >= ADDRESS_MIN_CHARS && (
        <div className="text-muted-foreground min-h-4 text-xs">
          {pending || preview.isFetching
            ? 'Looking up…'
            : previewPostalCode
              ? `→ ${previewPostalCode} — ${previewCity}`
              : 'No match found'}
        </div>
      )}
      {postalCodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {postalCodes.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1">
              {code}
              {cityLabels[code] && <span className="text-muted-foreground">— {cityLabels[code]}</span>}
              <button type="button" onClick={() => removeCode(code)}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

/** Same immediate-write pattern as PassengerRoutesSection — see its comment. */
export function PriceListEntriesSection({ priceList }: { priceList: PriceListEntity }) {
  const meta = useMetaControllerGetMeta()
  const [draft, setDraft] = useState<DraftEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PriceListEntryEntity | null>(null)

  const addEntry = usePriceListsControllerAddEntry()
  const updateEntry = usePriceListsControllerUpdateEntry()
  const deleteEntry = usePriceListsControllerDeleteEntry()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: priceListsControllerListQueryKeyPrefix })
    void queryClient.invalidateQueries({ queryKey: getPriceListsControllerGetQueryKey(priceList.ref) })
  }

  const startEdit = (entry: PriceListEntryEntity) =>
    setDraft({
      id: entry.id,
      pickupLocation: entry.pickupLocation ?? '',
      pickupPostalCountry: entry.pickupCountryCode ?? '',
      pickupPostalCodes: entry.pickupPostalCodes ?? [],
      dropoffLocation: entry.dropoffLocation ?? '',
      dropoffPostalCountry: entry.dropoffCountryCode ?? '',
      dropoffPostalCodes: entry.dropoffPostalCodes ?? [],
      bidirectional: entry.bidirectional,
      vehicleTypeRef: entry.vehicleType?.ref ?? '',
      priceEur: entry.priceEur,
    })

  /**
   * Saves the current draft. When `keepForAnotherVehicle` is set (the "+"
   * next to Save/Add), the pickup/drop-off/postal codes/bidirectional the
   * dispatcher just typed are kept and only the vehicle + price are cleared
   * — adding a second, third… category to the same route means picking a
   * different vehicle and price, not retyping the route each time. A plain
   * Save/Add closes the form as before.
   */
  const saveDraft = async (options?: { keepForAnotherVehicle?: boolean }) => {
    if (!draft) return
    if (!draft.pickupLocation.trim() && draft.pickupPostalCodes.length === 0) {
      toast.error('Enter a pickup address or at least one postal code.')
      return
    }
    const price = Number(draft.priceEur)
    if (!Number.isFinite(price)) {
      toast.error('Enter a valid price.')
      return
    }
    const data = {
      pickupLocation: draft.pickupLocation.trim() || undefined,
      pickupPostalCodes: draft.pickupPostalCodes,
      pickupCountryCode: draft.pickupPostalCountry || undefined,
      dropoffLocation: draft.dropoffLocation.trim() || undefined,
      dropoffPostalCodes: draft.dropoffPostalCodes,
      dropoffCountryCode: draft.dropoffPostalCountry || undefined,
      bidirectional: draft.bidirectional,
      vehicleTypeRef: draft.vehicleTypeRef || undefined,
      priceEur: price,
    }
    try {
      if (draft.id) {
        await updateEntry.mutateAsync({ ref: priceList.ref, entryId: draft.id, data })
        toast.success('Entry updated.')
      } else {
        await addEntry.mutateAsync({ ref: priceList.ref, data })
        toast.success('Entry added.')
      }
      if (options?.keepForAnotherVehicle) {
        setDraft({ ...draft, id: null, vehicleTypeRef: '', priceEur: '' })
      } else {
        setDraft(null)
      }
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving entry.'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteEntry.mutateAsync({ ref: priceList.ref, entryId: deleteTarget.id })
      toast.success('Entry removed.')
      setDeleteTarget(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error removing entry.'))
    }
  }

  const saving = addEntry.isPending || updateEntry.isPending

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Routes & rates</h3>

      {(priceList.entries ?? []).length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup</TableHead>
              <TableHead />
              <TableHead>Drop-off</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(priceList.entries ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs">{routeLabel(entry.pickupLocation, entry.pickupPostalCodes ?? [])}</TableCell>
                <TableCell className="text-muted-foreground text-xs" title={entry.bidirectional ? 'Bidirectional' : 'One way'}>
                  {entry.bidirectional ? '⇄' : '→'}
                </TableCell>
                <TableCell className="text-xs">{routeLabel(entry.dropoffLocation, entry.dropoffPostalCodes ?? [])}</TableCell>
                <TableCell className="text-xs">{entry.vehicleType?.name ?? '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatMoney(Number(entry.priceEur))}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(entry)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(entry)}>
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
        <div className="grid gap-3 rounded-md border p-3">
          <div className="grid items-start gap-x-3 gap-y-1.5 sm:grid-cols-2">
            <GeocodedAddressInput
              value={draft.pickupLocation}
              onChange={(v) => setDraft({ ...draft, pickupLocation: v })}
              placeholder="Pickup address (exact)"
            />
            <GeocodedAddressInput
              value={draft.dropoffLocation}
              onChange={(v) => setDraft({ ...draft, dropoffLocation: v })}
              placeholder="Drop-off address (optional)"
            />
            <div className="text-muted-foreground text-center text-xs">— or —</div>
            <div className="text-muted-foreground text-center text-xs">— or —</div>
            <PostalCodeMultiSelect
              countryCode={draft.pickupPostalCountry}
              onCountryChange={(v) => setDraft({ ...draft, pickupPostalCountry: v })}
              postalCodes={draft.pickupPostalCodes}
              onPostalCodesChange={(codes) => setDraft({ ...draft, pickupPostalCodes: codes })}
              placeholder="Pickup postal code or city"
              onFirstCodeAdded={() => setDraft((d) => (d ? { ...d, pickupLocation: '' } : d))}
            />
            <PostalCodeMultiSelect
              countryCode={draft.dropoffPostalCountry}
              onCountryChange={(v) => setDraft({ ...draft, dropoffPostalCountry: v })}
              postalCodes={draft.dropoffPostalCodes}
              onPostalCodesChange={(codes) => setDraft({ ...draft, dropoffPostalCodes: codes })}
              placeholder="Drop-off postal code or city"
              onFirstCodeAdded={() => setDraft((d) => (d ? { ...d, dropoffLocation: '' } : d))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.bidirectional}
              onCheckedChange={(checked) => setDraft({ ...draft, bidirectional: checked === true })}
            />
            Bidirectional — same rate applies in reverse (drop-off → pickup)
          </label>
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
              <Button type="button" variant="outline" size="icon" onClick={() => setDraft(null)} title="Cancel">
                <X className="size-4" />
              </Button>
              {/* Saves this category and immediately clears just Vehicle/Price
                  for the next one, keeping the route (pickup/drop-off/postal
                  codes/bidirectional) as typed — adding several vehicle
                  categories to one route without retyping it each time. */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void saveDraft({ keepForAnotherVehicle: true })}
                disabled={saving}
                title="Save and add another vehicle category for this route"
              >
                <Plus className="size-4" />
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
        title="Remove this entry?"
        description={
          deleteTarget
            ? `${routeLabel(deleteTarget.pickupLocation, deleteTarget.pickupPostalCodes ?? [])} will no longer be priced in this list.`
            : ''
        }
        confirmLabel="Remove"
        pending={deleteEntry.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
