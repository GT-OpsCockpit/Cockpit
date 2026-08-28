import { useState } from 'react'
import { DateTime } from 'luxon'
import { CalendarDays, CircleCheck, Clock, Info, LocateFixed, MapPin, Plane, TriangleAlert, User } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import {
  geoControllerFboLookup,
  geoControllerFlightCheck,
  geoControllerFxRate,
  geoControllerGeocodeTz,
  TripEntityBilling,
  TripEntityService,
  useClientsControllerList,
  useDriversControllerList,
  useFleetVehiclesControllerList,
  useMetaControllerGetMeta,
} from '@cockpit/shared/api'
import type { TripEntity } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { TripFormValues } from './trip-form-schema'
import { asdTotal, isLocalTrip, marginPercent } from '@cockpit/shared'
import { clientDisplayName, driverDisplayName, PARIS_ZONE } from './trip-status'

const HOURS_OPTIONS = Array.from({ length: 47 }, (_, i) => i + 2) // 2..48
const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

export function TripFormFields({
  form,
  trip,
  disabled = false,
  priceDisabled = false,
  priceDisabledReason,
  clientFieldDisabled = false,
  clientSeedOption = null,
  driverSeedOption = null,
  partnerSeedOption = null,
  regNbrSeedOption = null,
}: {
  form: UseFormReturn<TripFormValues>
  /**
   * The trip being edited, if any (omit when creating a new booking). Seeds
   * the Customer/Driver/Partner/Reg Nbr comboboxes so the current selection's
   * label survives a fresh remote search that no longer includes it — these
   * are request-on-demand now (limit 20/query), not preloaded with the full
   * roster, see SearchCombobox's `selectedLabel`.
   */
  trip?: TripEntity | null
  /** Locks every field (edit dialog only — see docs/agents/permissions.md, trip:edit-past). */
  disabled?: boolean
  /** Locks just the price fields (edit dialog only — trip:edit-price). Redundant once `disabled` is set. */
  priceDisabled?: boolean
  priceDisabledReason?: string
  /** Locks just the Customer field (Events creation dialog, once an event is confirmed — see event-select-panel.tsx). */
  clientFieldDisabled?: boolean
  /**
   * Seeds the Customer combobox with an option outside the normal (non-Event)
   * client search — the Events creation dialog's confirmed event is an
   * Events-type client, deliberately excluded from that search. Ignored once
   * `trip` is set (the edit dialog's own seed takes priority).
   */
  clientSeedOption?: { value: string; label: string } | null
  /** Seeds the Driver/Partner/Reg Nbr comboboxes the same way — used by BookingCreateDialog's row-level prefill (Drivers/Vehicles pages). Ignored once `trip` is set. */
  driverSeedOption?: { value: string; label: string } | null
  partnerSeedOption?: { value: string; label: string } | null
  regNbrSeedOption?: { value: string; label: string } | null
}) {
  const meta = useMetaControllerGetMeta()

  const [clientSearch, setClientSearch] = useState('')
  const { debounced: debouncedClientSearch, pending: clientSearchPending } = useDebouncedSearch(clientSearch, PICKER_DEBOUNCE_MS)
  const clients = useClientsControllerList({ search: debouncedClientSearch || undefined, limit: PICKER_LIMIT })

  const [driverSearch, setDriverSearch] = useState('')
  const { debounced: debouncedDriverSearch, pending: driverSearchPending } = useDebouncedSearch(driverSearch, PICKER_DEBOUNCE_MS)

  const [partnerSearch, setPartnerSearch] = useState('')
  const { debounced: debouncedPartnerSearch, pending: partnerSearchPending } = useDebouncedSearch(partnerSearch, PICKER_DEBOUNCE_MS)
  const partners = useDriversControllerList({ search: debouncedPartnerSearch || undefined, limit: PICKER_LIMIT })

  const [regNbrSearch, setRegNbrSearch] = useState('')
  const { debounced: debouncedRegNbrSearch, pending: regNbrSearchPending } = useDebouncedSearch(regNbrSearch, PICKER_DEBOUNCE_MS)

  const service = form.watch('service')
  const subContractor = form.watch('subContractor')
  const countryCode = form.watch('countryCode')
  const vehicleType = form.watch('vehicleType')
  const clientRef = form.watch('clientRef')
  const area = form.watch('area')
  const pickupLocation = form.watch('pickupLocation')
  const dropoffLocation = form.watch('dropoffLocation')
  const pickupIata = form.watch('pickupIata')
  const dropoffIata = form.watch('dropoffIata')
  const pickupDate = form.watch('pickupDate')
  const pickupTime = form.watch('pickupTime')
  const pickupTimezone = form.watch('pickupTimezone')

  // Assignment rules (who may take this job, who's available today, which
  // cars can service this Category) are resolved by the API — see
  // apps/api/src/common/business/assignability.ts. The picker sends the
  // booking's current draft, exactly as the legacy's
  // draftTripForEligibility() fed its client-side filter.
  const drivers = useDriversControllerList({
    search: debouncedDriverSearch || undefined,
    limit: PICKER_LIMIT,
    availableOnly: true,
    tripClientRef: clientRef || undefined,
    tripArea: area || undefined,
    tripCountryCode: countryCode || undefined,
    tripPickupLocation: pickupLocation || undefined,
    tripDropoffLocation: dropoffLocation || undefined,
  })

  const fleetVehicles = useFleetVehiclesControllerList({
    search: debouncedRegNbrSearch || undefined,
    limit: PICKER_LIMIT,
    availableOnly: true,
    compatibleWith: vehicleType || undefined,
  })

  // Reg Nbr only makes sense for a local booking served by our own fleet — a
  // farmed-out job has no vehicle of ours attached (legacy
  // refreshFleetRegAvailability, common.js:1078).
  const regNbrApplies = isLocalTrip({ area, countryCode, pickupLocation, dropoffLocation })

  // Lets a Paris-based dispatcher read the pickup time without doing the
  // timezone math themselves — always shown in Paris regardless of the
  // trip's own timezone, the conversion can shift the day either way.
  const parisHint = (() => {
    if (!pickupTimezone || !pickupDate || !pickupTime) return 'Eq. 🕐 Paris'
    const local = DateTime.fromISO(`${pickupDate}T${pickupTime}`, { zone: pickupTimezone })
    if (!local.isValid) return 'Eq. 🕐 Paris'
    const paris = local.setZone(PARIS_ZONE)
    return `Eq. 🕐 Paris : ${paris.toFormat('HH:mm')} (${paris.toFormat('dd/MM')})`
  })()

  const countryOptions = (meta.data?.countries ?? []).map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
  }))
  const selectedCountry = meta.data?.countries.find((c) => c.code === countryCode)

  const clientResults = (clients.data?.data ?? [])
    .filter((c) => c.active && c.clientType !== 'EVENT')
    .map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))
  const clientOptions = clientResults
  const clientSelectedLabel = trip?.client
    ? `${clientDisplayName(trip.client)} (${trip.client.ref})`
    : (clientSeedOption?.label ?? undefined)

  const driverResults = (drivers.data?.data ?? []).map((d) => ({
    value: d.ref,
    label: `${d.name} (${d.ref})`,
  }))
  const driverOptions = driverResults
  const driverSelectedLabel = trip?.driver
    ? `${driverDisplayName(trip.driver)} (${trip.driver.ref})`
    : (driverSeedOption?.label ?? undefined)

  const partnerResults = (partners.data?.data ?? [])
    .filter((d) => d.active && d.company)
    .map((d) => ({ value: d.ref, label: `${d.name} — ${d.company}` }))
  const partnerOptions = partnerResults
  const partnerSelectedLabel = trip?.partner
    ? `${driverDisplayName(trip.partner)} — ${trip.partner.company ?? ''}`
    : (partnerSeedOption?.label ?? undefined)

  const selectedVehicleType = meta.data?.vehicleTypes.find((v) => v.name === vehicleType)
  // active / availability / category compatibility are all applied by the
  // API now (availableOnly + compatibleWith) — nothing left to re-filter here.
  const regNbrResults = (fleetVehicles.data?.data ?? []).map((v) => ({
    value: v.regNbr,
    label: `${v.regNbr} — ${v.category.name}`,
  }))
  const regNbrOptions = regNbrResults
  const regNbrSelectedLabel = trip?.fleetVehicle
    ? `${trip.fleetVehicle.regNbr} — ${trip.fleetVehicle.category.name}`
    : (regNbrSeedOption?.label ?? undefined)

  const priceEur = form.watch('priceEur')
  const partnerRateEur = form.watch('partnerRateEur')
  const hours = form.watch('hours')

  // Restored from the legacy (updateMarginHint / updateAsdTotalHints); the
  // formulas live in @cockpit/shared rather than behind an endpoint because
  // both are live hints recomputed as the dispatcher types — a round trip
  // per keystroke would be the wrong trade.
  const margin = marginPercent({ priceEur, partnerRateEur, countryCode })
  const formatTotal = (total: number | null) =>
    total === null ? undefined : `Total net: ${total.toFixed(2)} €`
  const retailAsdTotal = formatTotal(asdTotal({ rate: priceEur, hours, service }))
  const partnerAsdTotal = formatTotal(asdTotal({ rate: partnerRateEur, hours, service }))

  const showAirportInfo = !!pickupIata || !!dropoffIata

  return (
    <fieldset disabled={disabled} className="contents">
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <FormField
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Country</FormLabel>
              <FormControl>
                <SearchCombobox
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value)
                    const country = meta.data?.countries.find((c) => c.code === value)
                    if (country) form.setValue('pickupTimezone', country.tz)
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pickupDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <CalendarDays className="size-4" aria-hidden="true" />
                Date
              </FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pickupTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Clock className="size-4" aria-hidden="true" />
                PU (local)
              </FormLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Clock />
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput type="time" {...field} />
                </FormControl>
              </InputGroup>
              <p className="text-muted-foreground text-xs whitespace-nowrap">{parisHint}</p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="service"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={TripEntityService.TSF}>TSF</SelectItem>
                  <SelectItem value={TripEntityService.ASD}>ASD</SelectItem>
                  <SelectItem value={TripEntityService.SPEC}>SPEC</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {service === TripEntityService.ASD && (
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nb H</FormLabel>
                <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(Number(v))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HOURS_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <FormField
          control={form.control}
          name="vehicleType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  const vt = meta.data?.vehicleTypes.find((v) => v.name === value)
                  if (vt && form.getValues('paxCount') > vt.maxPax) form.setValue('paxCount', vt.maxPax)
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vehicle…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(meta.data?.vehicleTypes ?? []).map((v) => (
                    <SelectItem key={v.ref} value={v.name}>
                      {v.name}
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
          name="paxCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pax nb</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={selectedVehicleType?.maxPax ?? 50}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="clientRef"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Customer</FormLabel>
              <FormControl>
                <SearchCombobox
                  icon={User}
                  value={field.value}
                  onChange={field.onChange}
                  options={clientOptions}
                  placeholder="Ind. or Company…"
                  searchPlaceholder="Search customer…"
                  searchValue={clientSearch}
                  onSearchChange={setClientSearch}
                  loading={clientSearchPending || clients.isFetching}
                  selectedLabel={clientSelectedLabel}
                  disabled={clientFieldDisabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="billing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={TripEntityBilling.ACCOUNT}>Central</SelectItem>
                  <SelectItem value={TripEntityBilling.CARD}>Card</SelectItem>
                  <SelectItem value={TripEntityBilling.CASH}>Cash</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="passengerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pax Name</FormLabel>
              <FormControl>
                <Input placeholder="Sophie Durand" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LocationField form={form} name="pickupLocation" label="PU" iataField="pickupIata" />
        {service !== TripEntityService.ASD && (
          <LocationField form={form} name="dropoffLocation" label="DO" iataField="dropoffIata" />
        )}
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>
                <Info className="size-4" aria-hidden="true" />
                Info
              </FormLabel>
              <FormControl>
                <Textarea rows={1} placeholder="Instructions" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {showAirportInfo && <FlightInfoFields form={form} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          control={form.control}
          name="pocName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>POC Name</FormLabel>
              <FormControl>
                <Input placeholder="Contact name" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pocPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>POC Mobile</FormLabel>
              <FormControl>
                <Input placeholder="+33…" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          control={form.control}
          name="driverRef"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Driver</FormLabel>
              <FormControl>
                <SearchCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={driverOptions}
                  placeholder="Driver…"
                  searchPlaceholder="Search driver…"
                  searchValue={driverSearch}
                  onSearchChange={setDriverSearch}
                  loading={driverSearchPending || drivers.isFetching}
                  selectedLabel={driverSelectedLabel}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fleetRegNbr"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reg Nbr</FormLabel>
              <FormControl>
                <SearchCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={regNbrOptions}
                  disabled={!regNbrApplies}
                  placeholder={regNbrApplies ? '—' : 'Local bookings only'}
                  searchPlaceholder="Search reg nbr…"
                  searchValue={regNbrSearch}
                  onSearchChange={setRegNbrSearch}
                  loading={regNbrSearchPending || fleetVehicles.isFetching}
                  selectedLabel={regNbrSelectedLabel}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subContractor"
          render={({ field }) => (
            <FormItem className="flex flex-row items-end gap-2 pb-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="mb-0">Sub-contracted</FormLabel>
            </FormItem>
          )}
        />
        {subContractor && (
          <FormField
            control={form.control}
            name="partnerRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Partner</FormLabel>
                <FormControl>
                  <SearchCombobox
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={partnerOptions}
                    placeholder="Partner company…"
                    searchPlaceholder="Search partner…"
                    searchValue={partnerSearch}
                    onSearchChange={setPartnerSearch}
                    loading={partnerSearchPending || partners.isFetching}
                    selectedLabel={partnerSelectedLabel}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PriceField
          form={form}
          name="priceEur"
          label="Retail net"
          currency={selectedCountry?.currency}
          disabled={priceDisabled}
          disabledReason={priceDisabledReason}
          totalHint={retailAsdTotal}
        />
        {subContractor && (
          <PriceField
            form={form}
            name="partnerRateEur"
            label="Partner rate net"
            currency={selectedCountry?.currency}
            disabled={priceDisabled}
            disabledReason={priceDisabledReason}
            totalHint={partnerAsdTotal}
            marginHint={margin === null ? undefined : `% Margin: ${margin.toFixed(1)} %`}
          />
        )}
        <FormField
          control={form.control}
          name="tracking"
          render={({ field }) => (
            <FormItem className="flex flex-row items-end gap-2 pb-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="mb-0">Tracking (send WhatsApp updates)</FormLabel>
            </FormItem>
          )}
        />
      </div>
    </div>
    </fieldset>
  )
}

function LocationField({
  form,
  name,
  label,
  iataField,
}: {
  form: UseFormReturn<TripFormValues>
  name: 'pickupLocation' | 'dropoffLocation'
  label: string
  iataField: 'pickupIata' | 'dropoffIata'
}) {
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const resolve = async () => {
    const value = form.getValues(name)
    if (!value?.trim()) return
    setResolving(true)
    setHint(null)
    try {
      const result = await geoControllerGeocodeTz({ q: value })
      form.setValue(iataField, result.iata ?? '')
      if (name === 'pickupLocation') form.setValue('pickupTimezone', result.tz)

      // Airport pickup: pre-fill the handling agent's (FBO) address from the
      // directory, as the legacy's Flight info popup did (common.js:1544).
      // The endpoint existed but nothing called it. `found: false` just means
      // this airport isn't in the directory yet — the field stays editable,
      // and an address already typed is never overwritten.
      let fboName: string | null = null
      if (name === 'pickupLocation' && result.isAirport) {
        const fbo = await geoControllerFboLookup({ q: value })
        if (fbo.found && fbo.fbo && !form.getValues('fboAddress')?.trim()) {
          form.setValue('fboAddress', fbo.fbo)
          fboName = fbo.name
        }
      }

      setHint(
        result.isAirport
          ? `Airport detected${result.iata ? ` (${result.iata})` : ''} — ${result.tz}${fboName ? ` · FBO pre-filled (${fboName})` : ''}`
          : result.tz,
      )
    } catch (error) {
      setHint(getApiErrorMessage(error, 'Location lookup unavailable.'))
    } finally {
      setResolving(false)
    }
  }

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <MapPin className="size-4" aria-hidden="true" />
            {label}
          </FormLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <MapPin />
            </InputGroupAddon>
            <FormControl>
              <InputGroupInput placeholder="E.g. JFK, CDG, address…" {...field} />
            </FormControl>
            {/* Was a bare 📍 button floating next to the field, with nothing
                saying what it did. Same action, now inside the field and
                labelled: it geocodes what's typed to fill the IATA code and
                (for pickup) the trip's timezone. */}
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Detect airport code and timezone"
                title="Detect airport code and timezone from this address"
                disabled={resolving}
                onClick={resolve}
              >
                {resolving ? <Spinner /> : <LocateFixed />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function FlightInfoFields({ form }: { form: UseFormReturn<TripFormValues> }) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'warn' | 'info'; message: string } | null>(null)

  const checkFlight = async () => {
    const flightNumber = form.getValues('flightNumber')
    const pickupDate = form.getValues('pickupDate')
    const pickupTime = form.getValues('pickupTime')
    if (!flightNumber?.trim() || !pickupDate || !pickupTime) return
    setChecking(true)
    setResult(null)
    try {
      const response = await geoControllerFlightCheck({ flightNumber, pickupDate, pickupTime })
      if (!response.configured) {
        setResult({ tone: 'info', message: response.message ?? 'Flight verification is not configured.' })
      } else {
        setResult(
          response.match
            ? { tone: 'ok', message: 'Flight schedule matches the pickup time.' }
            : { tone: 'warn', message: 'Flight schedule does not match — double-check the pickup time.' },
        )
      }
    } catch (error) {
      setResult({ tone: 'info', message: getApiErrorMessage(error, 'Flight verification unavailable.') })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="bg-accent/40 grid grid-cols-2 gap-4 rounded-md border p-3 sm:grid-cols-4">
      <FormField
        control={form.control}
        name="flightNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <Plane className="size-4" aria-hidden="true" />
              Flight number
            </FormLabel>
            <div className="flex gap-1">
              <FormControl>
                <Input placeholder="AF1234" {...field} />
              </FormControl>
              <Button type="button" variant="outline" size="sm" disabled={checking} onClick={checkFlight}>
                {checking ? '…' : 'Check'}
              </Button>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="bufferTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Buffer (min)</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="fboAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>FBO address</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="tailNbr"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tail nbr</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      {/* The name to write on the pickup sign — the optional attached file
          (logo, photo of the board) is uploaded separately, see
          nameboard-upload-dialog.tsx. */}
      <FormField
        control={form.control}
        name="nameboard"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nameboard</FormLabel>
            <FormControl>
              <Input placeholder="Name on the sign" {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      {result && (
        <p
          className={cn(
            'col-span-full flex items-center gap-1.5 text-xs',
            result.tone === 'ok' && 'text-success',
            result.tone === 'warn' && 'text-warning',
            result.tone === 'info' && 'text-muted-foreground',
          )}
        >
          {result.tone === 'ok' && <CircleCheck className="size-3.5" aria-hidden="true" />}
          {result.tone === 'warn' && <TriangleAlert className="size-3.5" aria-hidden="true" />}
          {result.tone === 'info' && <Info className="size-3.5" aria-hidden="true" />}
          {result.message}
        </p>
      )}
    </div>
  )
}

function PriceField({
  form,
  name,
  label,
  currency,
  disabled = false,
  disabledReason,
  totalHint,
  marginHint,
}: {
  form: UseFormReturn<TripFormValues>
  name: 'priceEur' | 'partnerRateEur'
  label: string
  currency?: string
  disabled?: boolean
  disabledReason?: string
  /** ASD grand total (rate × Nb H) — the field holds an hourly rate for that service. */
  totalHint?: string
  /** Booking margin, shown under the Partner rate the legacy computed it beside. */
  marginHint?: string
}) {
  const [hint, setHint] = useState<string | null>(null)

  const showFxHint = async () => {
    if (!currency || currency === 'EUR') {
      setHint(null)
      return
    }
    const amount = form.getValues(name)
    if (amount === undefined) return
    try {
      const rate = await geoControllerFxRate({ currency })
      const eurPerUnit = Number(rate.eurPerUnit)
      setHint(`≈ ${(amount / eurPerUnit).toFixed(2)} ${currency}`)
    } catch {
      setHint(null)
    }
  }

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-1">
            <FormControl>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="150"
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                onBlur={() => {
                  field.onBlur()
                  void showFxHint()
                }}
              />
            </FormControl>
            <span className="text-muted-foreground text-sm">€</span>
          </div>
          {disabled && disabledReason ? (
            <p className="text-muted-foreground text-xs">{disabledReason}</p>
          ) : (
            hint && <p className="text-muted-foreground text-xs">{hint}</p>
          )}
          {totalHint && <p className="text-muted-foreground text-xs">{totalHint}</p>}
          {marginHint && <p className="text-xs font-medium">{marginHint}</p>}
        </FormItem>
      )}
    />
  )
}
