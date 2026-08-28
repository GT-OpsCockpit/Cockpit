import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { ClientsControllerListType, useClientsControllerList, useMetaControllerGetMeta } from '@cockpit/shared/api'
import type { FleetVehicleEntity } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { AreaField } from '@/components/area-field'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { defaultFleetPax } from './vehicle-status'
import type { VehicleFormValues } from './vehicle-form-schema'

const EVENT_PICKER_LIMIT = 20
const EVENT_PICKER_DEBOUNCE_MS = 300

function makesFor(category: string, categoryModels: Record<string, Record<string, string[]>>, fleetMakes: string[]): string[] {
  const models = categoryModels[category]
  return models ? Object.keys(models) : fleetMakes
}

function modelsFor(
  category: string,
  make: string,
  categoryModels: Record<string, Record<string, string[]>>,
  fleetModelsByMake: Record<string, string[]>,
): string[] {
  const models = categoryModels[category]
  return models ? (models[make] ?? []) : (fleetModelsByMake[make] ?? [])
}

export function VehicleFormFields({
  form,
  vehicle,
  disabled = false,
  /** Locks "Local" off — used by the "Link a vehicle to this partner" popup, where the vehicle is always External. */
  lockExternal = false,
}: {
  form: UseFormReturn<VehicleFormValues>
  /** The vehicle being edited, if any (omit when creating) — labels the Event combobox before any search has run. */
  vehicle?: FleetVehicleEntity | null
  disabled?: boolean
  lockExternal?: boolean
}) {
  const meta = useMetaControllerGetMeta()

  const [eventSearch, setEventSearch] = useState('')
  const { debounced: debouncedEventSearch, pending: eventSearchPending } = useDebouncedSearch(eventSearch, EVENT_PICKER_DEBOUNCE_MS)

  const category = form.watch('category')
  const make = form.watch('make')
  const model = form.watch('model')
  const isLocal = form.watch('isLocal')
  const eventsOnly = form.watch('eventsOnly')
  // A Local vehicle stores no country/area of its own, so it has no location
  // an Event could match — the legacy refused to open the link popup at all
  // in that case (openEventLinkModal, common.js:3034).
  const ownCountryCode = form.watch('countryCode') ?? ''
  const ownArea = form.watch('area') ?? ''
  const countryCode = isLocal ? '' : ownCountryCode
  const area = isLocal ? '' : ownArea

  // The link popup never let the operator choose where the Event was: it read
  // the record's own Country/Area and showed them greyed out. Mirroring them
  // here is what makes those read-only fields true, and moving the vehicle
  // invalidates a link to an event held elsewhere.
  useEffect(() => {
    if (!eventsOnly) return
    if (form.getValues('eventCountry') === countryCode && form.getValues('eventArea') === area) return
    form.setValue('eventCountry', countryCode)
    form.setValue('eventArea', area)
    form.setValue('eventRef', '')
  }, [eventsOnly, countryCode, area, form])

  // Only the Events this vehicle could actually be linked to: happening where
  // it is, and not over yet. Filtered server-side (see ListClientsQueryDto) —
  // the listing is paginated, so narrowing the page here would hide a
  // mismatched event without excluding it. EventLinkService rejects the same
  // cases on save.
  const eventClients = useClientsControllerList(
    {
      type: ClientsControllerListType.EVENT,
      search: debouncedEventSearch || undefined,
      limit: EVENT_PICKER_LIMIT,
      eventCountry: countryCode || undefined,
      eventArea: area || undefined,
      eventNotEnded: true,
    },
    { query: { enabled: !!countryCode && !!area } },
  )

  const categoryOptions = (meta.data?.vehicleTypes ?? []).map((t) => t.name)
  const categoryModels = meta.data?.categoryModels ?? {}
  const fleetModelsByMake = meta.data?.fleetModelsByMake ?? {}
  const fleetMakes = meta.data?.fleetMakes ?? []
  const makeOptions = makesFor(category, categoryModels, fleetMakes)
  const modelOptions = modelsFor(category, make, categoryModels, fleetModelsByMake)
  const years: number[] = []
  if (meta.data) {
    for (let y = meta.data.fleetMaxYear; y >= meta.data.fleetMinYear; y--) years.push(y)
  }

  const countryOptions = useCountryOptions()

  const eventOptions = (eventClients.data?.data ?? []).map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))
  const eventSelectedLabel = vehicle?.eventClient ? `${vehicle.eventClient.company} (${vehicle.eventClient.ref})` : undefined

  // Category -> Make -> Model are chained (same cascading-select idiom as the
  // Vehicle field in trip-form-fields.tsx): each onValueChange below recomputes
  // the next select's options and, when the current value no longer belongs to
  // that list, snaps it to the first valid entry. Nb Pax isn't editable: it's
  // recalculated on every Category/Model change (vehicle-status.ts, ported
  // from the legacy's defaultFleetPax).
  //
  // Make/Model are remounted (via `key` below) whenever their upstream
  // Category/Make changes, rather than relying on setValue() alone to move
  // a Radix <Select> to a value it has never rendered as a <SelectItem>
  // before: without the remount, the auto-picked make/model silently stayed
  // blank the moment their option list also narrowed in the same update
  // (confirmed live — the resolver then correctly flagged Model as missing
  // even though the computed value was right). A fresh Select instance's
  // very first render already has the correct narrowed options and value
  // together, which is the one case that reliably works.
  const onCategoryChange = (value: string) => {
    form.setValue('category', value)
    const nextMakes = makesFor(value, categoryModels, fleetMakes)
    const nextMake = nextMakes.includes(make) ? make : (nextMakes[0] ?? '')
    form.setValue('make', nextMake)
    const nextModels = modelsFor(value, nextMake, categoryModels, fleetModelsByMake)
    const nextModel = nextModels.includes(model) ? model : (nextModels[0] ?? '')
    form.setValue('model', nextModel)
    form.setValue('nbPax', defaultFleetPax(value, nextModel))
  }

  const onMakeChange = (value: string) => {
    form.setValue('make', value)
    const nextModels = modelsFor(category, value, categoryModels, fleetModelsByMake)
    const nextModel = nextModels.includes(model) ? model : (nextModels[0] ?? '')
    form.setValue('model', nextModel)
    form.setValue('nbPax', defaultFleetPax(category, nextModel))
  }

  const onModelChange = (value: string) => {
    form.reset({ ...form.getValues(), model: value, nbPax: defaultFleetPax(category, value) }, { keepDefaultValues: true })
  }

  const externalLocked = lockExternal
  const showLocationFields = !isLocal

  return (
    <fieldset disabled={disabled} className="contents">
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={onCategoryChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Category…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <Select key={category} value={field.value} onValueChange={onMakeChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Make…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {makeOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select key={`${category}:${make}`} value={field.value} onValueChange={onModelChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Model…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FormField
            control={form.control}
            name="regNbr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reg Nbr</FormLabel>
                <FormControl>
                  <Input placeholder="AB-123-CD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="acronym"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acr.</FormLabel>
                <FormControl>
                  <Input placeholder="ABC123" maxLength={6} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="yearOfBuild"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Year…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nbPax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nb Pax</FormLabel>
                <FormControl>
                  <Input readOnly disabled value={field.value} className="bg-muted" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Color</FormLabel>
                <Select value={field.value || meta.data?.fleetDefaultColor || ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Color…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(meta.data?.fleetColors ?? []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                          {c.value}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fourWD"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="mb-0">4WD</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isLocal"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    disabled={externalLocked || disabled}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      if (checked) {
                        form.setValue('countryCode', '')
                        form.setValue('area', '')
                        form.setValue('partnerCompany', '')
                      }
                    }}
                  />
                </FormControl>
                <FormLabel className="mb-0">Local</FormLabel>
              </FormItem>
            )}
          />
        </div>

        {showLocationFields && (
          <div className="bg-accent/40 grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="countryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <SearchCombobox
                      value={field.value ?? ''}
                      onChange={(value) => {
                        field.onChange(value)
                        // "Local" is France-only and a city belongs to one country,
                        // so an Area already on file is now invalid — force a fresh
                        // pick rather than let it silently rot (legacy
                        // resetAreaField, common.js:871).
                        form.setValue('area', '')
                      }}
                      options={countryOptions}
                      placeholder="Country…"
                      searchPlaceholder="Search country…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area</FormLabel>
                  <FormControl>
                    <AreaField countryCode={ownCountryCode} value={field.value ?? ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="partnerCompany"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <FormControl>
                    <Input placeholder="Partner company…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="eventsOnly"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="mb-0">Events-only vehicle (linked to a single Event account)</FormLabel>
            </FormItem>
          )}
        />

        {eventsOnly && (
          <div className="bg-accent/40 grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="eventCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event country</FormLabel>
                  <FormControl>
                    <Input readOnly value={field.value ?? ''} placeholder="—" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event area</FormLabel>
                  <FormControl>
                    <Input readOnly value={field.value ?? ''} placeholder="—" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event</FormLabel>
                  <FormControl>
                    <SearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={eventOptions}
                      placeholder="Select event…"
                      searchPlaceholder="Search event…"
                      searchValue={eventSearch}
                      onSearchChange={setEventSearch}
                      loading={eventSearchPending || eventClients.isFetching}
                      selectedLabel={eventSelectedLabel}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </fieldset>
  )
}
