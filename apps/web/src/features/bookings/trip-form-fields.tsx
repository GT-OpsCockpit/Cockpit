import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
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
import { getApiErrorMessage } from '@/lib/api-error'
import { SearchCombobox } from '@/components/search-combobox'
import { Input } from '@/components/ui/input'
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

const HOURS_OPTIONS = Array.from({ length: 47 }, (_, i) => i + 2) // 2..48

export function TripFormFields({ form }: { form: UseFormReturn<TripFormValues> }) {
  const meta = useMetaControllerGetMeta()
  const clients = useClientsControllerList()
  const drivers = useDriversControllerList()
  const fleetVehicles = useFleetVehiclesControllerList()

  const service = form.watch('service')
  const subContractor = form.watch('subContractor')
  const countryCode = form.watch('countryCode')
  const vehicleType = form.watch('vehicleType')
  const pickupIata = form.watch('pickupIata')
  const dropoffIata = form.watch('dropoffIata')

  const countryOptions = (meta.data?.countries ?? []).map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
  }))
  const selectedCountry = meta.data?.countries.find((c) => c.code === countryCode)

  const clientOptions = (clients.data ?? [])
    .filter((c) => c.active && c.clientType !== 'EVENT')
    .map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))

  const driverOptions = (drivers.data ?? [])
    .filter((d) => d.active)
    .map((d) => ({ value: d.ref, label: `${d.name} (${d.ref})` }))
  const partnerOptions = (drivers.data ?? [])
    .filter((d) => d.active && d.company)
    .map((d) => ({ value: d.ref, label: `${d.name} — ${d.company}` }))

  const selectedVehicleType = meta.data?.vehicleTypes.find((v) => v.name === vehicleType)
  const compatibleCategories = vehicleType
    ? (meta.data?.vehicleCompatibility[vehicleType] ?? [vehicleType])
    : []
  const regNbrOptions = (fleetVehicles.data ?? [])
    .filter((v) => v.active && v.isLocal && (!vehicleType || compatibleCategories.includes(v.category.name)))
    .map((v) => ({ value: v.regNbr, label: `${v.regNbr} — ${v.category.name}` }))

  const showAirportInfo = !!pickupIata || !!dropoffIata

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <FormField
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Country</FormLabel>
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
              <FormLabel>📅 Date</FormLabel>
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
              <FormLabel>PU 🕐 (local)</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
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
                <Input type="number" min={1} max={selectedVehicleType?.maxPax ?? 50} {...field} />
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
              <SearchCombobox
                value={field.value}
                onChange={field.onChange}
                options={clientOptions}
                placeholder="Ind. or Company…"
                searchPlaceholder="Search customer…"
              />
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
        <LocationField form={form} name="pickupLocation" label="📍 PU" iataField="pickupIata" />
        {service !== TripEntityService.ASD && (
          <LocationField form={form} name="dropoffLocation" label="📍 DO" iataField="dropoffIata" />
        )}
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>📝 Info</FormLabel>
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
              <SearchCombobox
                value={field.value ?? ''}
                onChange={field.onChange}
                options={driverOptions}
                placeholder="Driver…"
                searchPlaceholder="Search driver…"
              />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fleetRegNbr"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reg Nbr</FormLabel>
              <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {regNbrOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <SearchCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={partnerOptions}
                  placeholder="Partner company…"
                  searchPlaceholder="Search partner…"
                />
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
        />
        {subContractor && (
          <PriceField
            form={form}
            name="partnerRateEur"
            label="Partner rate net"
            currency={selectedCountry?.currency}
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
      setHint(
        result.isAirport
          ? `✈️ Airport detected${result.iata ? ` (${result.iata})` : ''} — ${result.tz}`
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
          <FormLabel>{label}</FormLabel>
          <div className="flex gap-1">
            <FormControl>
              <Input placeholder="E.g. JFK, CDG, address…" {...field} />
            </FormControl>
            <Button type="button" variant="outline" size="sm" disabled={resolving} onClick={resolve}>
              {resolving ? '…' : '📍'}
            </Button>
          </div>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function FlightInfoFields({ form }: { form: UseFormReturn<TripFormValues> }) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

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
        setResult(response.message ?? 'Flight verification is not configured.')
      } else {
        setResult(
          response.match
            ? '✅ Flight schedule matches the pickup time.'
            : '⚠️ Flight schedule does not match — double-check the pickup time.',
        )
      }
    } catch (error) {
      setResult(getApiErrorMessage(error, 'Flight verification unavailable.'))
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
            <FormLabel>✈️ Flight number</FormLabel>
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
              <Input type="number" min={0} {...field} />
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
      {result && <p className="text-muted-foreground col-span-full text-xs">{result}</p>}
    </div>
  )
}

function PriceField({
  form,
  name,
  label,
  currency,
}: {
  form: UseFormReturn<TripFormValues>
  name: 'priceEur' | 'partnerRateEur'
  label: string
  currency?: string
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
                {...field}
                onBlur={() => {
                  field.onBlur()
                  void showFxHint()
                }}
              />
            </FormControl>
            <span className="text-muted-foreground text-sm">€</span>
          </div>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </FormItem>
      )}
    />
  )
}
