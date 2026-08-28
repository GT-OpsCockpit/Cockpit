import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getClientsControllerListQueryKey,
  getDriversControllerListQueryKey,
  getFleetVehiclesControllerListQueryKey,
  useClientsControllerListReactivationCandidates,
  useClientsControllerReactivate,
} from '@cockpit/shared/api'
import type { ClientEntity, ReactivationCandidateEntity } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * "Reactivate existing Events drivers/vehicles?" — offered right after an
 * Events account is created (offerEventReactivation, common.js:3912).
 *
 * A venue or a region often hosts a returning event, and the crew set up for
 * the previous edition is still on file, scoped to it and therefore dormant.
 * Relinking them in one step beats re-entering them from scratch. Which
 * records qualify is the API's call (GET /clients/:ref/reactivation-candidates),
 * and it re-checks them on save — the list can go stale while the dialog is open.
 *
 * Silently absent when there is nothing to offer, exactly as in the legacy.
 */
export function EventReactivationDialog({
  event,
  onClose,
}: {
  /** The freshly created Events account, or null when there is nothing to offer. */
  event: ClientEntity | null
  onClose: () => void
}) {
  const candidates = useClientsControllerListReactivationCandidates(event?.ref ?? '', {
    query: { enabled: !!event },
  })
  const reactivate = useClientsControllerReactivate()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const drivers = candidates.data?.drivers ?? []
  const fleetVehicles = candidates.data?.fleetVehicles ?? []
  const total = drivers.length + fleetVehicles.length

  // Everything is checked by default, same as the legacy's `checked` markup:
  // the operator is being offered a batch, not asked to build one.
  useEffect(() => {
    setSelected(new Set([...drivers, ...fleetVehicles].map((c) => `${c.ref}`)))
    // Re-seeded whenever a new set of candidates arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.data])

  const toggle = (ref: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(ref)
      else next.delete(ref)
      return next
    })

  const onConfirm = async () => {
    if (!event) return
    try {
      const result = await reactivate.mutateAsync({
        ref: event.ref,
        data: {
          driverRefs: drivers.filter((d) => selected.has(d.ref)).map((d) => d.ref),
          fleetVehicleRefs: fleetVehicles.filter((v) => selected.has(v.ref)).map((v) => v.ref),
        },
      })
      toast.success(
        `${result.drivers} driver(s) and ${result.fleetVehicles} vehicle(s) linked to ${event.name}.`,
      )
      void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getClientsControllerListQueryKey() })
      onClose()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error reactivating the selected records.'))
    }
  }

  const row = (candidate: ReactivationCandidateEntity, kind: string) => (
    <label key={`${kind}-${candidate.ref}`} className="flex items-center gap-2 py-1 text-sm">
      <Checkbox
        checked={selected.has(candidate.ref)}
        onCheckedChange={(checked) => toggle(candidate.ref, checked === true)}
      />
      <span>
        {candidate.label}{' '}
        <span className="text-muted-foreground text-xs">— previously: {candidate.previousEventName}</span>
      </span>
    </label>
  )

  return (
    <Dialog open={!!event && total > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reactivate existing Events drivers/vehicles?</DialogTitle>
          <DialogDescription>
            Already set up for {event?.eventCountry} / {event?.eventArea} from a previous Event. Link them to “
            {event?.name}” now?
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto">
          {drivers.map((d) => row(d, 'driver'))}
          {fleetVehicles.map((v) => row(v, 'vehicle'))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button type="button" disabled={reactivate.isPending || selected.size === 0} onClick={() => void onConfirm()}>
            {reactivate.isPending && <Spinner />}
            Reactivate selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
