import { toast } from 'sonner'
import type { DriverEntity } from '@cockpit/shared/api'
import {
  getDriversControllerListQueryKey,
  getFleetVehiclesControllerListQueryKey,
  useFleetVehiclesControllerSetDriver,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { driverLabel } from '@cockpit/shared'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'

/**
 * Ported from the legacy's unlinkVehicleFromDriver (common.js:3565) — clears
 * a reserved External vehicle's driverRef via PATCH /fleet-vehicles/:ref/driver,
 * undoing the auto-assignment it gets on the booking bar (see
 * DriverEntity.fleetReserved). The vehicle itself is untouched, only the link.
 */
export function UnlinkVehicleDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const setDriver = useFleetVehiclesControllerSetDriver()

  const onConfirm = async () => {
    if (!driver?.fleetReserved) return
    try {
      await setDriver.mutateAsync({ ref: driver.fleetReserved.ref, data: { driverRef: null } })
      toast.success(`Vehicle ${driver.fleetReserved.regNbr} unlinked.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error unlinking vehicle.'))
    }
  }

  return (
    <ConfirmActionDialog
      open={!!driver}
      onOpenChange={onOpenChange}
      title="Unlink this vehicle from the chauffeur?"
      description={
        driver?.fleetReserved &&
        `${driver.fleetReserved.regNbr} will no longer be reserved for ${driverLabel(driver)} — the vehicle itself is not deleted.`
      }
      confirmLabel="Unlink"
      pending={setDriver.isPending}
      onConfirm={onConfirm}
    />
  )
}
