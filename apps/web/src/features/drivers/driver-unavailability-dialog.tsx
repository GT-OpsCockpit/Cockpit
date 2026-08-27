import { useState } from 'react'
import { toast } from 'sonner'
import type { DriverEntity } from '@cockpit/shared/api'
import {
  DriverUnavailabilityEntityType,
  getDriversControllerListQueryKey,
  useDriversControllerSetUnavailability,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { unavailabilityLabel } from './driver-status'

const TYPE_OPTIONS: { value: DriverUnavailabilityEntityType; label: string }[] = [
  { value: DriverUnavailabilityEntityType.OFF, label: 'Day off' },
  { value: DriverUnavailabilityEntityType.HOLIDAYS, label: 'Holidays' },
  { value: DriverUnavailabilityEntityType.SICK, label: 'Sick leave' },
]

/**
 * "Type locked once chosen" (LEGACY_FEATURES.md §drivers.html): a driver with
 * an already-saved unavailability shows it read-only — switching to a
 * different type requires clearing first, not a free-form dropdown, matching
 * the legacy popup's behavior.
 */
export function DriverUnavailabilityDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [type, setType] = useState<DriverUnavailabilityEntityType | ''>('')
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const setUnavailability = useDriversControllerSetUnavailability()

  const resetForm = () => {
    setType('')
    setDate('')
    setStartDate('')
    setEndDate('')
  }

  const close = (open: boolean) => {
    if (!open) resetForm()
    onOpenChange(open)
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })
  }

  const save = async () => {
    if (!driver || !type) return
    if (type === DriverUnavailabilityEntityType.OFF && !date) {
      toast.error('Date is required for a day off.')
      return
    }
    if (type !== DriverUnavailabilityEntityType.OFF && (!startDate || !endDate)) {
      toast.error('Start date and end date are required.')
      return
    }
    if (type !== DriverUnavailabilityEntityType.OFF && endDate < startDate) {
      toast.error('End date must be on or after the start date.')
      return
    }
    try {
      await setUnavailability.mutateAsync({
        ref: driver.ref,
        data:
          type === DriverUnavailabilityEntityType.OFF
            ? { type, date }
            : { type, startDate, endDate },
      })
      toast.success(`Unavailability set for ${driver.ref}.`)
      invalidate()
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error setting unavailability.'))
    }
  }

  const clear = async () => {
    if (!driver) return
    try {
      await setUnavailability.mutateAsync({ ref: driver.ref, data: {} })
      toast.success(`Unavailability cleared for ${driver.ref}.`)
      invalidate()
      // Closes rather than staying open on the (now stale) `driver` prop —
      // its `unavailability` field won't reflect the clear until the list
      // refetches and the caller passes a fresh entity back in.
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error clearing unavailability.'))
    }
  }

  const existing = driver?.unavailability ?? null

  return (
    <Dialog open={!!driver} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unavailability{driver ? ` — ${driver.ref}` : ''}</DialogTitle>
        </DialogHeader>
        {driver && (
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
                  <Label htmlFor="unavailability-type">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as DriverUnavailabilityEntityType)}>
                    <SelectTrigger id="unavailability-type">
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
                {type === DriverUnavailabilityEntityType.OFF && (
                  <div className="grid gap-2">
                    <Label htmlFor="unavailability-date">Date</Label>
                    <Input id="unavailability-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                )}
                {(type === DriverUnavailabilityEntityType.HOLIDAYS || type === DriverUnavailabilityEntityType.SICK) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="unavailability-start">Start date</Label>
                      <Input
                        id="unavailability-start"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="unavailability-end">End date</Label>
                      <Input id="unavailability-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                )}
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
