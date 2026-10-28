import { useState } from 'react'
import { geoControllerGeocodeTz, useMetaControllerGetMeta, useTripsControllerCreate } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { applyBookingEdit, type BookingMeta } from './booking-draft'
import { canReturn, copyValues, MAX_COPIES, type CopyKind, type CopyOptions } from './booking-duplicate'
import { toCreateTripDto } from './trip-form-mapping'
import type { TripFormValues } from './trip-form-schema'

/**
 * Creates the copies a Duplicate / Return asks for and says which refs they got.
 * A return looks its new pickup up again first: the booking it was made from
 * carries the timezone and country of the other end.
 */
export function useCreateCopies() {
  const createTrip = useTripsControllerCreate()
  const meta = useMetaControllerGetMeta()
  const metaInput: BookingMeta = { countries: meta.data?.countries ?? [], vehicleTypes: meta.data?.vehicleTypes ?? [] }

  const createCopies = async (source: TripFormValues, options: CopyOptions): Promise<string[]> => {
    let values = copyValues(source, options)
    if (options.kind === 'return') {
      for (const field of ['pickupLocation', 'dropoffLocation'] as const) {
        const address = values[field]?.trim()
        if (!address) continue
        const result = await geoControllerGeocodeTz({ q: address })
        values = { ...values, ...applyBookingEdit(values, { kind: 'geocode', field, result }, metaInput) }
      }
      // The geocoder did not name a zone: fall back on the country's own.
      if (!values.pickupTimezone) {
        values = { ...values, pickupTimezone: metaInput.countries.find((c) => c.code === values.countryCode)?.tz ?? '' }
      }
    }
    const refs: string[] = []
    for (let i = 0; i < options.count; i++) {
      const trip = await createTrip.mutateAsync({ data: toCreateTripDto(values, { dispatch: false }) })
      refs.push(trip.ref)
    }
    return refs
  }

  return { createCopies, pending: createTrip.isPending }
}

/** The popup behind the Duplicate / Return button: what kind of copy, when, in which vehicle, and how many. */
export function DuplicateReturnDialog({
  source,
  pending,
  onOpenChange,
  onConfirm,
}: {
  /** The booking to copy; the dialog is open while there is one. */
  source: TripFormValues | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (options: CopyOptions) => void | Promise<void>
}) {
  const meta = useMetaControllerGetMeta()
  return (
    <Dialog open={!!source} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate / Return</DialogTitle>
          <DialogDescription>
            Creates new bookings from this one, unassigned. Client, passenger, route and price are carried over.
          </DialogDescription>
        </DialogHeader>
        {source && (
          <DuplicateFields
            // Each opening starts again from the booking it copies.
            key={`${source.clientRef}-${source.passengerName}-${source.pickupDate}-${source.pickupTime}`}
            source={source}
            vehicleTypes={(meta.data?.vehicleTypes ?? []).map((v) => v.name)}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DuplicateFields({
  source,
  vehicleTypes,
  pending,
  onCancel,
  onConfirm,
}: {
  source: TripFormValues
  vehicleTypes: string[]
  pending: boolean
  onCancel: () => void
  onConfirm: (options: CopyOptions) => void | Promise<void>
}) {
  const returnPossible = canReturn(source)
  const [kind, setKind] = useState<CopyKind>(returnPossible ? 'return' : 'duplicate')
  const [pickupDate, setPickupDate] = useState(source.pickupDate)
  const [pickupTime, setPickupTime] = useState(source.pickupTime)
  const [vehicleType, setVehicleType] = useState(source.vehicleType)
  const [count, setCount] = useState(1)

  const valid = !!pickupDate && !!pickupTime && !!vehicleType && count >= 1 && count <= MAX_COPIES

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="copy-kind">Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as CopyKind)}>
          <SelectTrigger id="copy-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="return" disabled={!returnPossible}>
              Return (pickup and drop-off swapped)
            </SelectItem>
            <SelectItem value="duplicate">Duplicate (same route)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="copy-date">Date</Label>
          <Input id="copy-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="copy-time">Time</Label>
          <Input id="copy-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="copy-vehicle">Vehicle</Label>
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger id="copy-vehicle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(vehicleTypes.includes(source.vehicleType) ? vehicleTypes : [source.vehicleType, ...vehicleTypes]).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="copy-count">Number of bookings</Label>
          <Input
            id="copy-count"
            type="number"
            min={1}
            max={MAX_COPIES}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!valid || pending}
          onClick={() => void onConfirm({ kind, pickupDate, pickupTime, vehicleType, count })}
        >
          {pending && <Spinner />}
          Create {count} booking{count === 1 ? '' : 's'}
        </Button>
      </DialogFooter>
    </div>
  )
}
