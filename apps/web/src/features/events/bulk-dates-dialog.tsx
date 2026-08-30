import { useState } from 'react'
import { toast } from 'sonner'
import type { ClientEntity } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey, useTripsControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TripFormValues } from '../bookings/trip-form-schema'
import { bulkLegForIndex, buildBulkTripDto, eachDateInRange } from './bulk-create'

/**
 * "Create bulk" (events.html:677-794) — the exact same booking (every New
 * booking bar field) created once per day in the event's date range, with
 * the day-to-day chaining rule in bulk-create.ts. Sequential, not parallel —
 * trip refs come from a shared server-side counter, concurrent POSTs would race.
 */
export function BulkDatesDialog({
  open,
  onOpenChange,
  confirmedEvent,
  formValues,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  confirmedEvent: ClientEntity
  formValues: TripFormValues
  onDone: () => void
}) {
  // eventStartDate/eventEndDate are Prisma DateTime columns, serialized as full
  // ISO instants — <input type="date"> needs just the date portion.
  const [dateStart, setDateStart] = useState(confirmedEvent.eventStartDate?.slice(0, 10) ?? '')
  const [dateEnd, setDateEnd] = useState(confirmedEvent.eventEndDate?.slice(0, 10) ?? '')
  const [reference, setReference] = useState('')
  const [instructions, setInstructions] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const createTrip = useTripsControllerCreate()

  const reset = () => {
    setDateStart(confirmedEvent.eventStartDate?.slice(0, 10) ?? '')
    setDateEnd(confirmedEvent.eventEndDate?.slice(0, 10) ?? '')
    setReference('')
    setInstructions('')
    setProgress(null)
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const onConfirm = async () => {
    if (!dateStart || !dateEnd || dateEnd < dateStart) {
      toast.error('Enter a valid date range (end on or after start).')
      return
    }
    const dates = eachDateInRange(dateStart, dateEnd)
    const templatePu = formValues.pickupLocation.trim()
    const templateDo = (formValues.dropoffLocation ?? '').trim()

    setSubmitting(true)
    let created = 0
    let failed = 0
    for (let i = 0; i < dates.length; i++) {
      setProgress(`Creating ${i + 1}/${dates.length}…`)
      const leg = bulkLegForIndex(i, dates.length - 1, templatePu, templateDo)
      const dto = buildBulkTripDto(formValues, dates[i], leg, {
        isLastLeg: i === dates.length - 1,
        reference: reference.trim() || undefined,
        instructions: instructions.trim() || undefined,
      })
      try {
        await createTrip.mutateAsync({ data: dto })
        created++
      } catch {
        failed++
      }
    }
    setSubmitting(false)

    toast[failed ? 'warning' : 'success'](
      failed
        ? `${created} booking(s) created, ${failed} failed — check required fields for this client.`
        : `${created} booking(s) created.`,
    )
    void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    close()
    onDone()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && (next ? onOpenChange(next) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create bulk — {confirmedEvent.company || confirmedEvent.name}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Same booking (all New booking fields above) created once per day in the range below. Day 1 uses the PU/DO
          typed above; every following day picks up from day 1&apos;s drop-off (client stays put); the last day
          becomes an at-disposal booking (4 h by default) ending where it starts.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="bulk-date-start">
              Date start
            </label>
            <Input
              id="bulk-date-start"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="bulk-date-end">
              Date end
            </label>
            <Input
              id="bulk-date-end"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="col-span-2 grid gap-2">
            <label className="text-sm font-medium" htmlFor="bulk-reference">
              Booking reference
            </label>
            <Input
              id="bulk-reference"
              placeholder="Optional"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="col-span-2 grid gap-2">
            <label className="text-sm font-medium" htmlFor="bulk-instructions">
              Instructions
            </label>
            <Textarea
              id="bulk-instructions"
              rows={2}
              placeholder="Optional — applied to every booking in this batch, otherwise the New booking bar's Info is kept"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
        {progress && <p className="text-muted-foreground text-sm">{progress}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={close}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={onConfirm}>
            Create bulk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
