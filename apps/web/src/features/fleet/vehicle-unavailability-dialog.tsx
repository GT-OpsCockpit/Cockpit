import { useState } from 'react'
import { toast } from 'sonner'
import type { FleetVehicleEntity } from '@cockpit/shared/api'
import {
  FleetUnavailabilityEntityType,
  getFleetVehiclesControllerListQueryKey,
  useFleetVehiclesControllerSetUnavailability,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { unavailabilityLabel } from './vehicle-status'

const TYPE_OPTIONS: { value: FleetUnavailabilityEntityType; label: string }[] = [
  { value: FleetUnavailabilityEntityType.REPAIR, label: 'Repair shop' },
  { value: FleetUnavailabilityEntityType.SERVICE, label: 'Manufacturer service' },
  { value: FleetUnavailabilityEntityType.BODYWORK, label: 'Bodywork' },
]

/**
 * "Type locked once chosen" (LEGACY_FEATURES.md §vehicles.html, same rule as
 * Drivers): a vehicle with an already-saved unavailability shows it
 * read-only — switching to a different type requires clearing first.
 * Internal ("Local") vehicles only, all three types are start/end ranges
 * (no single-date type like Drivers' OFF).
 */
export function VehicleUnavailabilityDialog({
  vehicle,
  onOpenChange,
}: {
  vehicle: FleetVehicleEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [type, setType] = useState<FleetUnavailabilityEntityType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const setUnavailability = useFleetVehiclesControllerSetUnavailability()

  const resetForm = () => {
    setType('')
    setStartDate('')
    setEndDate('')
  }

  const close = (open: boolean) => {
    if (!open) resetForm()
    onOpenChange(open)
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
  }

  const save = async () => {
    if (!vehicle || !type) return
    if (!startDate || !endDate) {
      toast.error('Start date and end date are required.')
      return
    }
    if (endDate < startDate) {
      toast.error('End date must be on or after the start date.')
      return
    }
    try {
      await setUnavailability.mutateAsync({ ref: vehicle.ref, data: { type, startDate, endDate } })
      toast.success(`Unavailability set for ${vehicle.ref}.`)
      invalidate()
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error setting unavailability.'))
    }
  }

  const clear = async () => {
    if (!vehicle) return
    try {
      await setUnavailability.mutateAsync({ ref: vehicle.ref, data: {} })
      toast.success(`Unavailability cleared for ${vehicle.ref}.`)
      invalidate()
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error clearing unavailability.'))
    }
  }

  const existing = vehicle?.unavailability ?? null

  return (
    <Dialog open={!!vehicle} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unavailability{vehicle ? ` — ${vehicle.ref}` : ''}</DialogTitle>
        </DialogHeader>
        {vehicle && (
          <div className="grid gap-4">
            {existing ? (
              <div className="grid gap-3">
                <p className="text-sm">{unavailabilityLabel(existing)}</p>
                <p className="text-muted-foreground text-xs">
                  Clear it before setting a different kind of unavailability.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="vehicle-unavailability-type">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as FleetUnavailabilityEntityType)}>
                    <SelectTrigger id="vehicle-unavailability-type">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="vehicle-unavailability-start">Start date</Label>
                    <Input
                      id="vehicle-unavailability-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vehicle-unavailability-end">End date</Label>
                    <Input id="vehicle-unavailability-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Close
          </Button>
          {existing ? (
            <Button type="button" variant="destructive" disabled={setUnavailability.isPending} onClick={() => void clear()}>
              Clear
            </Button>
          ) : (
            <Button type="button" disabled={setUnavailability.isPending || !type} onClick={() => void save()}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
