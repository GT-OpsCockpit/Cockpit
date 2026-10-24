import { useState, useEffect, type ChangeEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CalendarDays, CircleCheck, Clock, Info, MapPin, Plane, TriangleAlert, User, ArrowLeftRight } from 'lucide-react'
import { useFormState, type UseFormReturn } from 'react-hook-form'
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
  useGeoControllerGeocodeSearch,
  useMetaControllerGetMeta,
  usePartnersControllerList,
  usePassengersControllerList,
  useClientsControllerListPriceLists,
  useClientsControllerListContacts,
} from '@cockpit/shared/api'
import type { PassengerAddressEntity, PassengerRouteEntity, PriceListEntryEntity, TripEntity } from '@cockpit/shared/api'
import { formatPhoneDisplay, retailCurrency } from '@cockpit/shared'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox, type ComboboxOption } from '@/components/search-combobox'
import { AreaField } from '@/components/area-field'
import { PhoneInput } from '@/components/phone-input'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { TripFormValues } from './trip-form-schema'
import { flightCheckBlocker, tripFormRules } from './trip-form-rules'
import { MAX_FILE_SIZE, NameboardUploadDialog } from './nameboard-upload-dialog'
import { NameboardPreviewDialog } from './nameboard-preview-dialog'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { applyBookingEdit, type BookingChange, type BookingMeta, type LocatedAddress } from './booking-draft'
import { clientDisplayName, partnerLabel } from '@cockpit/shared'
import { driverOptionLabel } from '@/features/drivers/driver-status'

/**
 * Marks a field the schema rejects when empty — including the ones that only
 * become required for a given service (Nb H for ASD, Info for SPEC, DO outside
 * ASD, see trip-form-schema.ts).
 *
 * Drawn by CSS rather than by a `<span>*</span>`: a real text node would land
 * inside the label, turning every `getByLabel('Country', { exact: true })` in
 * the e2e suite into a miss — including the ones aimed at the Client, Vehicle
 * and Settings forms, whose own Country field carries no asterisk. The `-ml-1`
 * walks back the label's own `gap-2` so the asterisk hugs the text.
 */
const REQUIRED_MARK = "after:text-destructive after:-ml-1 after:content-['*']"

const HOURS_OPTIONS = Array.from({ length: 47 }, (_, i) => i + 2) // 2..48
const POC_LOCKED_REASON = 'The driver is already in position — the on-site contact can no longer be changed.'

const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300
// The address suggestions go out to Nominatim, so they wait longer than the
// in-house pickers do — the legacy's own address combobox used 450ms
// (makeAddressCombobox, common.js:1824). The endpoint needs two characters.
const ADDRESS_DEBOUNCE_MS = 450
const ADDRESS_MIN_CHARS = 2

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
  pendingNameboardFile = null,
  onPendingNameboardFileChange,
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
  /**
   * While creating a new booking (no `trip` yet, so no ref to attach a file
   * to), the Nameboard file picked here is held by the parent dialog and
   * uploaded right after the trip itself is created — one "Create" click
   * does both, rather than sending the user back to this form afterwards.
   */
  pendingNameboardFile?: File | null
  onPendingNameboardFileChange?: (file: File | null) => void
}) {
  const meta = useMetaControllerGetMeta()
  const [nameboardUploadOpen, setNameboardUploadOpen] = useState(false)
  const [nameboardPreviewOpen, setNameboardPreviewOpen] = useState(false)

  const [clientSearch, setClientSearch] = useState('')
  const { debounced: debouncedClientSearch, pending: clientSearchPending } = useDebouncedSearch(clientSearch, PICKER_DEBOUNCE_MS)
  const clients = useClientsControllerList({ search: debouncedClientSearch || undefined, limit: PICKER_LIMIT })

  const [driverSearch, setDriverSearch] = useState('')
  const { debounced: debouncedDriverSearch, pending: driverSearchPending } = useDebouncedSearch(driverSearch, PICKER_DEBOUNCE_MS)

  const [partnerSearch, setPartnerSearch] = useState('')
  const { debounced: debouncedPartnerSearch, pending: partnerSearchPending } = useDebouncedSearch(partnerSearch, PICKER_DEBOUNCE_MS)
  const partners = useDriversControllerList({ search: debouncedPartnerSearch || undefined, limit: PICKER_LIMIT })

  // "No specific driver" — farming the job straight out to a Partner
  // *company* (Trip.directPartnerId), with nobody named on file yet. Its own
  // picker, separate from the partner-driver combobox above: a company and
  // one of its own drivers are never the same option in the same list.
  const [directPartnerSearch, setDirectPartnerSearch] = useState('')
  // The Partners endpoint has no server-side search/limit (it's a short list
  // by nature — sub-contractors, not the whole Drivers roster) — filtered
  // client-side instead, same list either way.
  const directPartners = usePartnersControllerList()

  // Who to call on site is now this customer's own registered contacts
  // (ClientContactsSection) rather than a fuzzy search across every client
  // and past booking — that global search used to surface another
  // customer's contact by name-only coincidence, which is worse than not
  // suggesting anything.

  const [regNbrSearch, setRegNbrSearch] = useState('')
  const { debounced: debouncedRegNbrSearch, pending: regNbrSearchPending } = useDebouncedSearch(regNbrSearch, PICKER_DEBOUNCE_MS)

  const service = form.watch('service')
  const subContractor = form.watch('subContractor')
  const subContractorNoDriver = form.watch('subContractorNoDriver')
  const countryCode = form.watch('countryCode')
  const vehicleType = form.watch('vehicleType')
  const clientRef = form.watch('clientRef')

  // This customer's own registered contacts (Applicable clients' account
  // edit screen, ClientContactsSection) — offered as pickable options in the
  // POC Name combobox below. Never auto-filled: the dispatcher sees who's on
  // file and picks one (or types someone else) rather than the field silently
  // pre-filling and firing off a lookup the moment a client is set.
  const clientContacts = useClientsControllerListContacts(clientRef, {
    query: { enabled: !!clientRef },
  })

  const area = form.watch('area')
  const pickupLocation = form.watch('pickupLocation')
  const dropoffLocation = form.watch('dropoffLocation')
  const pickupPostalCode = form.watch('pickupPostalCode')
  const dropoffPostalCode = form.watch('dropoffPostalCode')
  const dropoffCountryCode = form.watch('dropoffCountryCode')
  const pickupIata = form.watch('pickupIata')
  const dropoffIata = form.watch('dropoffIata')
  const pickupIsAirport = form.watch('pickupIsAirport')
  const dropoffIsAirport = form.watch('dropoffIsAirport')
  const flightNumber = form.watch('flightNumber')
  const tailNbr = form.watch('tailNbr')
  const pickupDate = form.watch('pickupDate')
  const pickupTime = form.watch('pickupTime')
  const pickupTimezone = form.watch('pickupTimezone')
  const passengerRef = form.watch('passengerRef')

  // Scoped to the selected customer — "search the client's own passenger
  // roster" per the ask, not the whole database. Empty until a customer is
  // picked, same gating as the Driver/Reg Nbr pickers above.
  const passengers = usePassengersControllerList(
    { clientRef: clientRef || undefined },
    { query: { enabled: !!clientRef } },
  )
  // Named by their display name, not their ref: the field this feeds is
  // passengerName itself now (a single name field doubling as the lookup),
  // not a separate ref-only picker.
  const passengerOptions = (passengers.data ?? [])
    .filter((p) => p.name)
    .map((p) => ({ value: p.name, label: p.name }))
  const selectedPassenger = passengers.data?.find((p) => p.ref === passengerRef)

  // The client's own active rate cards — checked as the fallback once no
  // passenger-specific route matched (see findMatchingRoute below): a
  // negotiated per-passenger rate is more specific than the account's
  // general price list, so it wins when both would otherwise apply.
  const clientPriceLists = useClientsControllerListPriceLists(clientRef, {
    query: { enabled: !!clientRef },
  })
  const clientPriceListEntries: PriceListEntryEntity[] = (clientPriceLists.data ?? [])
    .filter((pl) => pl.active)
    .flatMap((pl) => pl.entries ?? [])
  // Handed to both PU and DO — a saved address doesn't say which end it's
  // for, the dispatcher picks it into whichever field needs it.
  const passengerAddressOptions = (selectedPassenger?.addresses ?? []).map((a: PassengerAddressEntity) => ({
    value: a.address,
    label: a.title,
    description: a.address,
  }))

  // A route is symmetric by default — "home to office" prices "office to
  // home" the same — unless the passenger has a *specific* route on file
  // for that other direction, which then wins for exactly that direction.
  // Checking the exact direction first, and only falling back to the
  // reverse, is what gives the specific route priority over the generic
  // reversed one when both exist.
  // Two geocoded addresses for the same place rarely come out byte-identical
  // (accents, punctuation, how much of the string got picked) — normalizing
  // and allowing either to contain the other is what lets a route saved once
  // still match a trip typed or picked slightly differently later.
  const normalizeAddress = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
  const addressesMatch = (a: string, b: string) => {
    const na = normalizeAddress(a)
    const nb = normalizeAddress(b)
    return na === nb || na.includes(nb) || nb.includes(na)
  }

  const findMatchingRoute = (pickup: string | undefined, dropoff: string | undefined, vehicleTypeName: string | undefined) => {
    if (!selectedPassenger || !pickup) return undefined
    const matches = (route: PassengerRouteEntity, from: string, to: string) =>
      addressesMatch(route.pickupLocation, from) &&
      addressesMatch(route.dropoffLocation ?? '', to ?? '') &&
      (!route.vehicleType || route.vehicleType.name === vehicleTypeName)
    const sameDirection = (selectedPassenger.routes ?? []).find((route) => matches(route, pickup, dropoff ?? ''))
    if (sameDirection) return sameDirection
    if (!dropoff) return undefined
    return (selectedPassenger.routes ?? []).find((route) => matches(route, dropoff, pickup))
  }

  // A price list entry's pickup/dropoff is either one exact address or a
  // set of postal codes — an empty descriptor on one end (no address, no
  // codes) is read as "doesn't care", which is how a flat one-way fee with
  // no fixed destination gets expressed. The postal code side compares
  // against the geocoder's own structured postcode (tripPostalCode), never
  // against the address text — many real addresses simply don't spell their
  // postal code out ("Allée du Touret, Villeneuve-Loubet, France" doesn't).
  const normalizePostalCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')
  const endpointMatches = (
    tripAddress: string | undefined,
    tripPostalCode: string | undefined,
    tripCountryCode: string | undefined,
    entryLocation: string | null,
    entryPostalCodes: string[],
    entryCountryCode: string | null,
  ) => {
    if (!entryLocation && entryPostalCodes.length === 0) return true
    const addressOk = !!entryLocation && !!tripAddress && addressesMatch(entryLocation, tripAddress)
    // A postal code alone is ambiguous across countries (e.g. Monaco's 980xx
    // vs a French 06xxx sharing digits by coincidence), so when the entry
    // itself names a country, the trip's own end must agree with it. An
    // entry left without a country (older ones, or a dispatcher who didn't
    // set one) keeps matching as before — this only tightens entries that
    // opted into a country.
    const countryOk = !entryCountryCode || (!!tripCountryCode && entryCountryCode === tripCountryCode)
    const postalOk =
      entryPostalCodes.length > 0 &&
      !!tripPostalCode &&
      countryOk &&
      entryPostalCodes.some((code) => normalizePostalCode(code) === normalizePostalCode(tripPostalCode))
    return addressOk || postalOk
  }

  // Checked only once no passenger-specific route matched — the account's
  // general rate card is the fallback, not the first thing consulted; a
  // passenger's own negotiated rate is always more specific. Same
  // same-direction-first-then-reverse priority as findMatchingRoute above,
  // except the reverse leg here also requires the entry to say
  // `bidirectional`, since a client price list — unlike a passenger's own
  // routes — is written by someone who may only have priced one direction
  // on purpose.
  const findMatchingPriceListEntry = (
    pickup: string | undefined,
    pickupPostal: string | undefined,
    pickupCountry: string | undefined,
    dropoff: string | undefined,
    dropoffPostal: string | undefined,
    dropoffCountry: string | undefined,
    vehicleTypeName: string | undefined,
  ) => {
    if (!pickup && !pickupPostal) return undefined
    const matches = (
      entry: PriceListEntryEntity,
      fromAddress: string | undefined,
      fromPostal: string | undefined,
      fromCountry: string | undefined,
      toAddress: string | undefined,
      toPostal: string | undefined,
      toCountry: string | undefined,
    ) =>
      endpointMatches(fromAddress, fromPostal, fromCountry, entry.pickupLocation, entry.pickupPostalCodes ?? [], entry.pickupCountryCode) &&
      endpointMatches(toAddress, toPostal, toCountry, entry.dropoffLocation, entry.dropoffPostalCodes ?? [], entry.dropoffCountryCode) &&
      (!entry.vehicleType || entry.vehicleType.name === vehicleTypeName)
    const sameDirectionEntry = clientPriceListEntries.find((entry) =>
      matches(entry, pickup, pickupPostal, pickupCountry, dropoff, dropoffPostal, dropoffCountry),
    )
    if (sameDirectionEntry) return sameDirectionEntry
    if (!dropoff && !dropoffPostal) return undefined
    return clientPriceListEntries.find(
      (entry) =>
        entry.bidirectional && matches(entry, dropoff, dropoffPostal, dropoffCountry, pickup, pickupPostal, pickupCountry),
    )
  }

  // The retail rate is whatever this passenger is already known to pay for
  // this exact route, when one is on file — same "what it carries says it"
  // reasoning as everywhere else the form defers to a saved record over a
  // manual re-entry. Only ever fills the price in; it never clears a rate
  // the dispatcher typed for a one-off address that matches nothing.
  useEffect(() => {
    const passengerMatch = findMatchingRoute(pickupLocation, dropoffLocation, vehicleType)
    if (passengerMatch) {
      form.setValue('priceEur', Number(passengerMatch.priceEur), { shouldDirty: true })
      return
    }
    const priceListMatch = findMatchingPriceListEntry(
      pickupLocation,
      pickupPostalCode,
      countryCode,
      dropoffLocation,
      dropoffPostalCode,
      dropoffCountryCode,
      vehicleType,
    )
    if (priceListMatch) form.setValue('priceEur', Number(priceListMatch.priceEur), { shouldDirty: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPassenger,
    clientPriceListEntries,
    pickupLocation,
    dropoffLocation,
    pickupPostalCode,
    dropoffPostalCode,
    countryCode,
    dropoffCountryCode,
    vehicleType,
  ])

  // Picking one of the passenger's saved addresses (either end) offers their
  // matching route outright, rather than silently waiting for the *other*
  // end to also be typed before the price above quietly fills in — a
  // popup here says plainly "this is a route this passenger already has".
  const [routeSuggestion, setRouteSuggestion] = useState<PassengerRouteEntity | null>(null)
  const offerRouteFor = (address: string) => {
    if (!selectedPassenger) return
    const route = (selectedPassenger.routes ?? []).find(
      (r) => r.pickupLocation === address || r.dropoffLocation === address,
    )
    if (route) setRouteSuggestion(route)
  }
  const applyRouteSuggestion = () => {
    if (!routeSuggestion) return
    form.setValue('pickupLocation', routeSuggestion.pickupLocation, { shouldDirty: true })
    form.setValue('dropoffLocation', routeSuggestion.dropoffLocation ?? '', { shouldDirty: true })
    form.setValue('priceEur', Number(routeSuggestion.priceEur), { shouldDirty: true })
    if (routeSuggestion.vehicleType) form.setValue('vehicleType', routeSuggestion.vehicleType.name, { shouldDirty: true })
    setRouteSuggestion(null)
  }

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

  const countryOptions = useCountryOptions()
  const selectedCountry = meta.data?.countries.find((c) => c.code === countryCode)

  // The one piece of plumbing the cascades need. What each edit does to the
  // rest of the draft is booking-draft.ts's answer; this only writes it down.
  const metaInput: BookingMeta = { countries: meta.data?.countries ?? [], vehicleTypes: meta.data?.vehicleTypes ?? [] }
  const applyEdit = (change: BookingChange): Partial<TripFormValues> => {
    const patch = applyBookingEdit(form.getValues(), change, metaInput)
    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key as keyof TripFormValues, value as never)
    }
    return patch
  }

  const clientResults = (clients.data?.data ?? [])
    .filter((c) => c.active && c.clientType !== 'EVENT')
    .map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))
  const clientOptions = clientResults
  const clientSelectedLabel = trip?.client
    ? `${clientDisplayName(trip.client)} (${trip.client.ref})`
    : (clientSeedOption?.label ?? undefined)

  const driverResults = (drivers.data?.data ?? []).map((d) => ({
    value: d.ref,
    label: driverOptionLabel(d),
  }))
  const driverOptions = driverResults
  const driverSelectedLabel = trip?.driver
    ? driverOptionLabel(trip.driver)
    : (driverSeedOption?.label ?? undefined)

  const partnerResults = (partners.data?.data ?? [])
    .filter((d) => d.active && d.partnerId)
    .map((d) => ({ value: d.ref, label: partnerLabel(d) }))
  const partnerOptions = partnerResults
  const partnerSelectedLabel = trip?.partner
    ? partnerLabel(trip.partner)
    : (partnerSeedOption?.label ?? undefined)

  const directPartnerSearchLower = directPartnerSearch.trim().toLowerCase()
  const directPartnerResults = (directPartners.data ?? [])
    .filter((p) => p.active)
    .map((p) => ({ value: p.ref, label: `${p.companyName || p.contactName} (${p.ref})` }))
    .filter((o) => !directPartnerSearchLower || o.label.toLowerCase().includes(directPartnerSearchLower))
  const directPartnerOptions = directPartnerResults
  const directPartnerSelectedLabel = trip?.directPartner
    ? `${trip.directPartner.companyName || trip.directPartner.contactName} (${trip.directPartner.ref})`
    : undefined

  const selectedVehicleType = meta.data?.vehicleTypes.find((v) => v.name === vehicleType)
  const paxCount = form.watch('paxCount')
  const overCapacity = !!selectedVehicleType && paxCount > selectedVehicleType.maxPax
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

  // What the form derives from what has been typed so far — see
  // trip-form-rules.ts. Fed the watched fields explicitly rather than
  // form.watch(), so this component re-renders on exactly the same set of
  // changes it always did.
  const rules = tripFormRules(
    { service, countryCode, area, pickupLocation, dropoffLocation, pickupIata, dropoffIata,
      pickupIsAirport, dropoffIsAirport, flightNumber, tailNbr,
      pickupDate, pickupTime, pickupTimezone, priceEur, partnerRateEur, hours },
    trip,
  )

  return (
    <>
    <fieldset disabled={disabled} className="contents">
      <div className="grid gap-5">
        {/* What is being sold, and when — the first thing a dispatcher is told. */}
        {/* Who the booking is billed to. */}
        <FormSection title="Customer">
          <FormField
            control={form.control}
            name="clientRef"
            render={({ field }) => (
              <FormItem className="col-span-6 lg:col-span-5">
                <FormLabel className={REQUIRED_MARK}>Customer</FormLabel>
                <FormControl>
                  <SearchCombobox
                    icon={User}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      // A looked-up/typed passenger and POC both belong to the
                      // customer they were picked or typed under — switching
                      // customers invalidates whichever ones were there for
                      // the previous one, rather than silently carrying them
                      // over. The new customer's own default POC (if any)
                      // fills back in once their contacts load, see the
                      // effect below.
                      form.setValue('passengerName', '')
                      form.setValue('passengerRef', '')
                      form.setValue('pocName', '')
                      form.setValue('pocPhone', '')
                    }}
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
              <FormItem className="col-span-3 lg:col-span-2">
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
        </FormSection>

        {/* Who is actually travelling — typed as a name, narrowed live against
            the customer's own saved passengers as each letter goes in; a
            name that matches none of them is simply a new, unregistered
            passenger for this booking. */}
        <FormSection title="Passenger">
          <FormField
            control={form.control}
            name="passengerName"
            render={({ field }) => (
              <FormItem className="col-span-6 lg:col-span-5">
                <FormLabel className={REQUIRED_MARK}>Pax Name</FormLabel>
                <FormControl>
                  <SearchCombobox
                    icon={User}
                    value={field.value ?? ''}
                    onChange={(value) => {
                      field.onChange(value)
                      // A name matching a saved passenger links this booking
                      // to them (unlocks their addresses/routes below); a
                      // free-typed name that matches none just clears that
                      // link rather than blocking the booking on it.
                      const picked = passengers.data?.find((p) => (p.name || p.ref) === value)
                      form.setValue('passengerRef', picked?.ref ?? '')
                    }}
                    options={passengerOptions}
                    placeholder="Sophie Durand"
                    searchPlaceholder="Search or type a name…"
                    loading={passengers.isFetching}
                    allowCustomValue
                    customValueLabel={(typed) => `Use "${typed}"`}
                    selectedLabel={field.value || undefined}
                  />
                </FormControl>
                {clientRef ? (
                  <FormDescription>Narrowed to this customer's saved passengers as you type.</FormDescription>
                ) : (
                  <FormDescription>Select a customer to search their saved passengers.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Order data, not fleet data — the customer states a headcount before
              a car is picked. The chosen Vehicle's capacity is enforced by the
              server (booking-fields.ts:172); the hint below is the client-side
              half the legacy also drew, live, as it was typed (common.js:1033). */}
          <FormField
            control={form.control}
            name="paxCount"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-2">
                <FormLabel>Pax nb</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    // No native min/max: the browser checks those before the
                    // submit event, so an out-of-range count aborted the whole
                    // submission — every other field's message disappeared with
                    // it. The range is the resolver's (PAX_RANGE), and the
                    // vehicle's own capacity is a server rule that comes back
                    // worded as the legacy worded it ("<Vehicle> accepts a
                    // maximum of N passengers.", booking-fields.ts:172).
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                {overCapacity && (
                  <p className="text-destructive text-xs">
                    {selectedVehicleType!.name} accepts a maximum of {selectedVehicleType!.maxPax} passengers.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pocName"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-6">
                <FormLabel>POC Name</FormLabel>
                <FormControl>
                  <SearchCombobox
                    icon={User}
                    value={field.value ?? ''}
                    onChange={(value) => {
                      field.onChange(value)
                      // Picking a known contact brings their number with them;
                      // a name typed freehand leaves whatever number is
                      // already there alone.
                      const hit = (clientContacts.data ?? []).find((c) => c.name === value)
                      if (hit?.phone) form.setValue('pocPhone', hit.phone, { shouldDirty: true })
                    }}
                    options={(clientContacts.data ?? []).map((c) => ({
                      value: c.name,
                      label: c.name,
                      description: c.phone ? formatPhoneDisplay(c.phone) : undefined,
                    }))}
                    placeholder="Contact name"
                    searchPlaceholder="Search a contact…"
                    loading={clientContacts.isFetching}
                    // A POC is whoever the customer says it is: this
                    // customer's own registered contacts are suggested, but
                    // the list never closes off a one-off name typed by hand.
                    allowCustomValue
                    customValueLabel={(typed) => `Use “${typed}”`}
                    selectedLabel={field.value || undefined}
                    disabled={rules.pocLocked}
                  />
                </FormControl>
                {rules.pocLocked && <FormDescription>{POC_LOCKED_REASON}</FormDescription>}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pocPhone"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-6">
                <FormLabel>POC Mobile</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    countryCode={countryCode}
                    disabled={rules.pocLocked}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking"
            render={({ field }) => (
              <FormItem className="col-span-6 flex flex-row items-center gap-2 lg:col-span-12">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Tracking (send WhatsApp updates)</FormLabel>
              </FormItem>
            )}
          />
        </FormSection>

        {/* Where from, where to, and when — plus the flight block the pickup
            itself reveals. */}
        <FormSection title="Route & Schedule">
          <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-2">
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
          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-4">
                <FormLabel className={REQUIRED_MARK}>Country</FormLabel>
                <FormControl>
                  <SearchCombobox
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      applyEdit({ kind: 'countryCode', value })
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
              <FormItem className="col-span-3 lg:col-span-6">
                <FormLabel className={REQUIRED_MARK}>Area</FormLabel>
                <FormControl>
                  <AreaField countryCode={countryCode} value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pickupDate"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-3">
                <FormLabel className={REQUIRED_MARK}>
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
          {/* The Paris equivalent sits beside the input rather than under it:
              as a caption it was the only one in the form, and made its cell
              taller than every neighbour on the row. */}
          <FormField
            control={form.control}
            name="pickupTime"
            render={({ field }) => (
              <FormItem className="col-span-6 lg:col-span-5">
                <FormLabel className={REQUIRED_MARK}>
                  <Clock className="size-4" aria-hidden="true" />
                  PU (local)
                </FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input type="time" className="w-32 shrink-0" {...field} />
                  </FormControl>
                  <span className="text-muted-foreground truncate text-xs">{rules.parisHint}</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {service === TripEntityService.ASD && (
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem className="col-span-3 lg:col-span-2">
                  <FormLabel className={REQUIRED_MARK}>Nb H</FormLabel>
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
          <LocationField
            form={form}
            name="pickupLocation"
            label="PU"
            applyEdit={applyEdit}
            required
            extraOptions={passengerAddressOptions}
            onExtraOptionPicked={offerRouteFor}
            className={rules.dropoffApplies ? 'col-span-6 lg:col-span-5' : 'col-span-6 lg:col-span-12'}
          />
          {rules.dropoffApplies && (
            <>
              <div className="col-span-6 flex flex-col lg:col-span-2">
                <span className="invisible flex items-center gap-2 text-sm leading-none font-medium">
                  <MapPin className="size-4" aria-hidden="true" />
                  PU
                </span>
                <div className="mt-2 flex h-9 items-center justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Swap pickup and drop-off"
                    onClick={() => {
                      const pickup = form.getValues('pickupLocation')
                      const dropoff = form.getValues('dropoffLocation')
                      const pickupIata = form.getValues('pickupIata')
                      const dropoffIata = form.getValues('dropoffIata')
                      const pickupIsAirport = form.getValues('pickupIsAirport')
                      const dropoffIsAirport = form.getValues('dropoffIsAirport')
                      const pickupPostal = form.getValues('pickupPostalCode')
                      const dropoffPostal = form.getValues('dropoffPostalCode')
                      // `countryCode` is the pickup side's country (drives area/
                      // timezone elsewhere); `dropoffCountryCode` only exists for
                      // price-list matching. Swapping PU/DO must swap these too,
                      // or the postal-code match silently checks the wrong end's
                      // country after a swap.
                      const pickupCountry = form.getValues('countryCode')
                      const dropoffCountry = form.getValues('dropoffCountryCode')
                      form.setValue('pickupLocation', dropoff, { shouldDirty: true })
                      form.setValue('dropoffLocation', pickup, { shouldDirty: true })
                      form.setValue('pickupIata', dropoffIata, { shouldDirty: true })
                      form.setValue('dropoffIata', pickupIata, { shouldDirty: true })
                      form.setValue('pickupIsAirport', dropoffIsAirport, { shouldDirty: true })
                      form.setValue('dropoffIsAirport', pickupIsAirport, { shouldDirty: true })
                      form.setValue('pickupPostalCode', dropoffPostal, { shouldDirty: true })
                      form.setValue('dropoffPostalCode', pickupPostal, { shouldDirty: true })
                      if (dropoffCountry && dropoffCountry !== pickupCountry) {
                        form.setValue('countryCode', dropoffCountry, { shouldDirty: true })
                        form.setValue('area', '', { shouldDirty: true })
                      }
                      form.setValue('dropoffCountryCode', pickupCountry, { shouldDirty: true })
                    }}
                  >
                    <ArrowLeftRight className="size-4" />
                  </Button>
                </div>
              </div>
              <LocationField
                form={form}
                name="dropoffLocation"
                label="DO"
                applyEdit={applyEdit}
                required
                extraOptions={passengerAddressOptions}
                onExtraOptionPicked={offerRouteFor}
                className="col-span-6 lg:col-span-5"
              />
            </>
          )}
          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem className="col-span-6 lg:col-span-12">
                <FormLabel className={cn(service === TripEntityService.SPEC && REQUIRED_MARK)}>
                  <Info className="size-4" aria-hidden="true" />
                  Info
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Instructions" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {rules.showAirportInfo && (
            <FlightInfoFields
              form={form}
              commercialFlight={rules.commercialFlight}
              tailNbrIncomplete={rules.tailNbrIncomplete}
              className="col-span-6 lg:col-span-12"
            />
          )}
          {/* Deliberately outside FlightInfoFields — a sign is just as much
              a train-station thing as an airport one, and this only needs
              "is this a meet-and-greet pickup" (rules.nameboardApplies), not
              anything else the flight block carries. Greyed out otherwise:
              a name/file with no pickup point to hold it up at would just be
              silently ignored on the day. */}
          <FormField
            control={form.control}
            name="nameboard"
            render={({ field }) => (
              <FormItem className="col-span-6 lg:col-span-12">
                <FormLabel>Nameboard</FormLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <FormControl>
                    <Input placeholder="Name on the sign" disabled={!rules.nameboardApplies} {...field} />
                  </FormControl>
                  {rules.nameboardApplies && trip && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={trip.nameboardUrl ? 'Replace file' : 'Upload file'}
                        onClick={() => setNameboardUploadOpen(true)}
                      >
                        <span aria-hidden="true">📁</span>
                      </Button>
                      {trip.nameboardUrl && (
                        <button
                          type="button"
                          className="text-primary text-sm underline"
                          onClick={() => setNameboardPreviewOpen(true)}
                        >
                          View file
                        </button>
                      )}
                    </>
                  )}
                  {rules.nameboardApplies && !trip && onPendingNameboardFileChange && (
                    <>
                      <Button type="button" variant="outline" size="icon" title="Attach file" asChild>
                        <label className="cursor-pointer">
                          <span aria-hidden="true">📁</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(event: ChangeEvent<HTMLInputElement>) => {
                              const picked = event.target.files?.[0] ?? null
                              if (picked && picked.size > MAX_FILE_SIZE) {
                                toast.error('File too large (10MB max).')
                                event.target.value = ''
                                onPendingNameboardFileChange(null)
                                return
                              }
                              onPendingNameboardFileChange(picked)
                            }}
                          />
                        </label>
                      </Button>
                      {pendingNameboardFile && (
                        <span className="text-muted-foreground text-sm">{pendingNameboardFile.name}</span>
                      )}
                    </>
                  )}
                </div>
                {!rules.nameboardApplies && (
                  <FormDescription>Only for an airport or train station pickup.</FormDescription>
                )}
                {rules.nameboardApplies && !trip && (
                  <FormDescription>The file is attached once the booking is created.</FormDescription>
                )}
              </FormItem>
            )}
          />
          {trip && (
            <NameboardUploadDialog
              trip={nameboardUploadOpen ? trip : null}
              onOpenChange={setNameboardUploadOpen}
            />
          )}
          <NameboardPreviewDialog
            url={nameboardPreviewOpen ? (trip?.nameboardUrl ?? null) : null}
            onOpenChange={setNameboardPreviewOpen}
          />
        </FormSection>

        {/* Who drives it. Sub-contracted heads the section because it decides
            which of the two exclusive branches below is even relevant. */}
        <FormSection title="Vehicle & assignment">
          <FormField
            control={form.control}
            name="vehicleType"
            render={({ field }) => (
              <FormItem className="col-span-3 lg:col-span-4">
                <FormLabel className={REQUIRED_MARK}>Vehicle</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    applyEdit({ kind: 'vehicleType', value })
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
            name="subContractor"
            render={({ field }) => (
              <FormItem className="col-span-3 flex flex-row items-center gap-2 lg:col-span-8 lg:self-end lg:pb-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      applyEdit({ kind: 'subContractor', value: checked === true })
                    }}
                  />
                </FormControl>
                <FormLabel className="font-normal whitespace-nowrap">Sub-contracted</FormLabel>
              </FormItem>
            )}
          />
          {subContractor ? (
            <>
              <FormField
                control={form.control}
                name="subContractorNoDriver"
                render={({ field }) => (
                  <FormItem className="col-span-6 flex flex-row items-center gap-2 lg:col-span-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked === true)
                          form.setValue('partnerRef', '')
                          form.setValue('directPartnerRef', '')
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal whitespace-nowrap">No specific driver — assign to the company only</FormLabel>
                  </FormItem>
                )}
              />
              {subContractorNoDriver ? (
                <FormField
                  control={form.control}
                  name="directPartnerRef"
                  render={({ field }) => (
                    <FormItem className="col-span-6 lg:col-span-6">
                      <FormLabel className={REQUIRED_MARK}>Partner company</FormLabel>
                      <FormControl>
                        <SearchCombobox
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={directPartnerOptions}
                          placeholder="Partner company…"
                          searchPlaceholder="Search partner…"
                          searchValue={directPartnerSearch}
                          onSearchChange={setDirectPartnerSearch}
                          loading={directPartners.isFetching}
                          selectedLabel={directPartnerSelectedLabel}
                        />
                      </FormControl>
                      <p className="text-muted-foreground text-xs">
                        Dispatched by email only — there's no driver to WhatsApp yet.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="partnerRef"
                  render={({ field }) => (
                    <FormItem className="col-span-6 lg:col-span-6">
                      <FormLabel className={REQUIRED_MARK}>Partner</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name="driverRef"
                render={({ field }) => (
                  <FormItem className="col-span-3 lg:col-span-6">
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
                  <FormItem className="col-span-3 lg:col-span-6">
                    <FormLabel>Reg Nbr</FormLabel>
                    <FormControl>
                      <SearchCombobox
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={regNbrOptions}
                        disabled={!rules.regNbrApplies}
                        placeholder={rules.regNbrApplies ? '—' : 'Local bookings only'}
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
            </>
          )}
        </FormSection>

        {/* Closes the booking: what we charge, what we pay, what's left. */}
        <FormSection title="Pricing">
          <PriceField
            form={form}
            name="priceEur"
            label="Retail net"
            // What we charge is quoted in one of four currencies whatever the
            // country's own (bookingCurrency, common.js:1193-1201) — unlike the
            // Partner rate below, quoted in the currency of the country the job
            // runs in. A booking in Japan is charged in USD and its partner
            // paid in JPY.
            currency={retailCurrency(selectedCountry?.currency) ?? undefined}
            disabled={priceDisabled}
            disabledReason={priceDisabledReason}
            totalHint={rules.retailAsdTotal}
            className="col-span-3 lg:col-span-4"
          />
          {subContractor && (
            <PriceField
              form={form}
              name="partnerRateEur"
              label="Partner rate net"
              currency={selectedCountry?.currency}
              disabled={priceDisabled}
              disabledReason={priceDisabledReason}
              totalHint={rules.partnerAsdTotal}
              marginHint={rules.marginHint}
              className="col-span-3 lg:col-span-4"
            />
          )}
        </FormSection>
      </div>
    </fieldset>
    <ConfirmActionDialog
      open={!!routeSuggestion}
      onOpenChange={(open) => !open && setRouteSuggestion(null)}
      title="Use this passenger's saved route?"
      description={
        routeSuggestion
          ? `${routeSuggestion.pickupLocation} → ${routeSuggestion.dropoffLocation ?? '—'}${routeSuggestion.vehicleType ? ` · ${routeSuggestion.vehicleType.name}` : ''} · ${Number(routeSuggestion.priceEur).toLocaleString('en-GB')} €. This fills PU, DO, vehicle and price to match.`
          : ''
      }
      confirmLabel="Use this route"
      onConfirm={() => void applyRouteSuggestion()}
    />
    </>
  )
}

/**
 * One business group of the booking form. Each owns its own 12-column grid, so
 * a conditional field appearing (Nb H, DO, Partner, the flight block) only
 * reflows its own section instead of shifting every field below it — which is
 * what the previous flat list of six sibling grids did.
 */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-muted-foreground border-b pb-1.5 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-6 items-start gap-x-4 gap-y-3 lg:grid-cols-12">{children}</div>
    </section>
  )
}


function LocationField({
  form,
  name,
  label,
  applyEdit,
  required = false,
  extraOptions,
  onExtraOptionPicked,
  className,
}: {
  form: UseFormReturn<TripFormValues>
  name: 'pickupLocation' | 'dropoffLocation'
  label: string
  /** Writes down what booking-draft.ts says this lookup does to the draft. */
  applyEdit: (change: BookingChange) => Partial<TripFormValues>
  required?: boolean
  /** The selected passenger's saved addresses (if any) — listed ahead of the
   * live geocode results, same field for PU and DO alike (a saved address
   * doesn't say which end it's for). Picking one still runs it through the
   * normal geocode-on-commit below, same as typing it by hand would. */
  extraOptions?: ComboboxOption[]
  /** Fired when the value picked is one of `extraOptions` (a passenger's
   * saved address), not a live geocode hit or free text — the parent uses
   * this to offer that passenger's matching pre-registered route. */
  onExtraOptionPicked?: (value: string) => void
  /** Column span inside the enclosing FormSection grid. */
  className?: string
}) {
  const [search, setSearch] = useState('')
  const { debounced, pending } = useDebouncedSearch(search, ADDRESS_DEBOUNCE_MS)
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  // Type "JFK" and get New York's airport back, as the legacy's address
  // combobox did (makeAddressCombobox, common.js:1824/1859) — the endpoint
  // existed in v2 from the start and nothing called it, so every address had
  // to be typed in full and then resolved by hand.
  const query = debounced.trim()
  const suggestions = useGeoControllerGeocodeSearch(
    { q: query, limit: '8' },
    { query: { enabled: query.length >= ADDRESS_MIN_CHARS } },
  )
  const hits = suggestions.data?.results ?? []

  // The two calls and the spinner belong here; which fields the answer fills
  // in — and that an FBO address already typed is never overwritten — is
  // applyBookingEdit's, so it can be asserted without rendering a form.
  const locate = async (result: LocatedAddress, address: string) => {
    // Airport pickup: the handling agent's (FBO) address comes from the
    // directory, as the legacy's Flight info popup did (common.js:1544).
    // `found: false` just means this airport isn't in the directory yet.
    const fbo = name === 'pickupLocation' && result.isAirport ? await geoControllerFboLookup({ q: address }) : undefined
    const patch = applyEdit({ kind: 'geocode', field: name, result, fbo })

    const fboName = patch.fboAddress === undefined ? null : (fbo?.name ?? null)
    setHint(
      result.isAirport
        ? `Airport detected${result.iata ? ` (${result.iata})` : ''}${result.tz ? ` — ${result.tz}` : ''}${fboName ? ` · FBO pre-filled (${fboName})` : ''}`
        : result.tz,
    )
  }

  /**
   * An address committed rather than picked. The legacy geocoded it too, on
   * blur, so a pasted or hand-typed airport still filled in its timezone and
   * IATA (detectPickupTz, common.js:1384/1852).
   */
  const resolveTyped = async (address: string) => {
    if (!address.trim()) {
      setHint(null)
      return
    }
    setResolving(true)
    setHint(null)
    try {
      await locate(await geoControllerGeocodeTz({ q: address }), address)
    } catch (error) {
      setHint(getApiErrorMessage(error, 'Location lookup unavailable.'))
    } finally {
      setResolving(false)
    }
  }

  const commit = (value: string, onChange: (value: string) => void) => {
    onChange(value)
    if (extraOptions?.some((o) => o.value === value)) onExtraOptionPicked?.(value)
    const hit = hits.find((h) => h.displayName === value)
    if (hit) {
      setResolving(true)
      setHint(null)
      void locate(hit, value)
        .catch((error: unknown) => setHint(getApiErrorMessage(error, 'Location lookup unavailable.')))
        .finally(() => setResolving(false))
      return
    }
    void resolveTyped(value)
  }

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={cn(required && REQUIRED_MARK)}>
            <MapPin className="size-4" aria-hidden="true" />
            {label}
          </FormLabel>
          <FormControl>
            <SearchCombobox
              icon={MapPin}
              value={field.value ?? ''}
              onChange={(value) => commit(value, field.onChange)}
              options={[
                ...(extraOptions ?? []),
                ...hits.map((hit) => ({
                  value: hit.displayName,
                  label: hit.displayName,
                  description: hit.isAirport && hit.iata ? `Airport · ${hit.iata}` : (hit.tz ?? undefined),
                })),
              ]}
              placeholder="E.g. JFK, CDG, address…"
              searchPlaceholder="Search an address or airport…"
              searchValue={search}
              onSearchChange={setSearch}
              loading={query.length >= ADDRESS_MIN_CHARS && (pending || suggestions.isFetching)}
              loadingText="Searching addresses…"
              // An address is whatever the dispatcher says it is: the list
              // suggests, it never closes the field — same as the legacy's,
              // which geocoded a typed address on blur rather than refusing it.
              allowCustomValue
              customValueLabel={(typed) => `Use “${typed}”`}
              selectedLabel={field.value || undefined}
            />
          </FormControl>
          {(resolving || hint) && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              {resolving && <Spinner />}
              {resolving ? 'Locating…' : hint}
            </p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function FlightInfoFields({
  form,
  commercialFlight,
  tailNbrIncomplete,
  className,
}: {
  form: UseFormReturn<TripFormValues>
  /** A flight number is entered, so FBO/Tail (private aviation) don't apply — see tripFormRules. */
  commercialFlight: boolean
  tailNbrIncomplete: boolean
  /** Column span inside the enclosing FormSection grid. */
  className?: string
}) {
  const [checking, setChecking] = useState(false)
  // The "flight details required" errors are shown on one full-width line under
  // the cells, never inside them: a message inside a cell makes it taller than
  // its neighbours and drags the whole row out of alignment.
  const { errors: detailErrors } = useFormState({ control: form.control, name: ['flightNumber', 'fboAddress'] })
  const detailMessages = [detailErrors.flightNumber?.message, detailErrors.fboAddress?.message].filter(
    (message): message is string => !!message,
  )
  const [fboSearch, setFboSearch] = useState('')
  const { debounced: debouncedFbo, pending: fboPending } = useDebouncedSearch(fboSearch, ADDRESS_DEBOUNCE_MS)
  const fboQuery = debouncedFbo.trim()
  const fboSuggestions = useGeoControllerGeocodeSearch(
    { q: fboQuery, limit: '8' },
    { query: { enabled: fboQuery.length >= ADDRESS_MIN_CHARS } },
  )
  const fboHits = fboSuggestions.data?.results ?? []
  const [result, setResult] = useState<{ tone: 'ok' | 'warn' | 'info'; message: string } | null>(null)

  const checkFlight = async () => {
    const flightNumber = form.getValues('flightNumber') ?? ''
    const pickupDate = form.getValues('pickupDate') ?? ''
    const pickupTime = form.getValues('pickupTime') ?? ''
    // Says what is missing rather than returning silently — a button that does
    // nothing at all reads as broken (see flightCheckBlocker).
    const blocker = flightCheckBlocker({ flightNumber, pickupDate, pickupTime })
    if (blocker) {
      setResult({ tone: 'warn', message: blocker })
      return
    }
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
    <div className={cn('bg-accent/40 grid grid-cols-2 gap-4 rounded-md border p-3 sm:grid-cols-4', className)}>
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
                // Native min removed for the same reason as Pax nb above. The
                // legacy could afford one (min="0", common.js:1570) because the
                // field sat in the Flight info popup, where a block stopped
                // that popup's Confirm and nothing else; inline it would stop
                // the booking itself.
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* A flight number is only ever a commercial one — private aviation has
          none to look up — and these two describe the private case. Locked out
          rather than left editable but meaningless, as the legacy locked them
          (applyCommercialFlightLock, common.js:1658). Geocoded the same way as
          a trip's own PU/DO (LocationField above) — an FBO is still a real,
          mappable address, just one auto-filled from the directory lookup
          more often than typed by hand. */}
      <FormField
        control={form.control}
        name="fboAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>FBO</FormLabel>
            <FormControl>
              <SearchCombobox
                icon={MapPin}
                value={field.value ?? ''}
                onChange={field.onChange}
                options={fboHits.map((hit) => ({ value: hit.displayName, label: hit.displayName }))}
                placeholder="FBO name or address…"
                searchPlaceholder="Search an address…"
                searchValue={fboSearch}
                onSearchChange={setFboSearch}
                loading={fboQuery.length >= ADDRESS_MIN_CHARS && (fboPending || fboSuggestions.isFetching)}
                allowCustomValue
                customValueLabel={(typed) => `Use "${typed}"`}
                selectedLabel={field.value || undefined}
                disabled={commercialFlight}
              />
            </FormControl>
            {commercialFlight && <FormDescription>Not applicable to a commercial flight.</FormDescription>}
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
              <Input {...field} disabled={commercialFlight} aria-invalid={tailNbrIncomplete || undefined} />
            </FormControl>
            {/* Flagged, not refused: the legacy highlighted a part-typed tail
                number and left the booking submittable (common.js:1649). */}
            {!commercialFlight && tailNbrIncomplete && (
              <FormDescription>A tail number is five characters.</FormDescription>
            )}
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
      {detailMessages.length > 0 && (
        <p role="alert" className="text-destructive col-span-full text-sm">
          {detailMessages.join(' ')}
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
  className,
}: {
  form: UseFormReturn<TripFormValues>
  name: 'priceEur' | 'partnerRateEur'
  label: string
  currency?: string
  disabled?: boolean
  disabledReason?: string
  /** Column span inside the enclosing FormSection grid. */
  className?: string
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
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-1">
            <FormControl>
              <Input
                type="number"
                // No `min` attribute on purpose: a native constraint is checked
                // by the browser *before* the submit event, so a negative price
                // silently aborted the whole submission — every other field's
                // message vanished with it and Create looked dead. Validation
                // belongs to the zod resolver (shouldUseNativeValidation is off,
                // its default), which reports it as A price cannot be negative.
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
          {/* Without this, "Partner rate net is required to sub-contract a
              booking." had nowhere to render: Create silently did nothing. */}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
