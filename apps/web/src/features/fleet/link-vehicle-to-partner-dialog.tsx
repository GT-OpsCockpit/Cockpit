import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { DriverEntity } from '@cockpit/shared/api'
import { getFleetVehiclesControllerListQueryKey, useFleetVehiclesControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { driverLabel } from '@cockpit/shared'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VehicleFormFields } from './vehicle-form-fields'
import { vehicleFormDefaults, vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'
import { toCreateFleetVehicleDto } from './vehicle-form-mapping'

/**
 * Ported from the legacy's openLinkVehicleToPartnerModal (drivers.html) — a
 * shortcut offered right after creating a partner chauffeur, so their car
 * doesn't have to be added separately on the Vehicles page. Reuses the same
 * Fleet form as vehicle-create-dialog.tsx, with "Local" forced off (a
 * vehicle linked to a partner chauffeur is by definition External) and
 * "Partner" preseeded from the driver's company. Wired in from
 * features/drivers/driver-create-dialog.tsx.
 */
export function LinkVehicleToPartnerDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    values: driver
      ? { ...vehicleFormDefaults(), isLocal: false, partnerCompany: driver.company ?? '' }
      : vehicleFormDefaults(),
  })

  const createVehicle = useFleetVehiclesControllerCreate()

  const onSubmit = form.handleSubmit(async (values) => {
    if (!driver) return
    try {
      const vehicle = await createVehicle.mutateAsync({
        data: { ...toCreateFleetVehicleDto(values), driverRef: driver.ref },
      })
      toast.success(`Vehicle ${vehicle.ref} linked to ${driverLabel(driver)}.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error linking vehicle.'))
    }
  })

  return (
    <Dialog open={!!driver} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Link a vehicle{driver ? ` to ${driverLabel(driver)}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            <VehicleFormFields form={form} lockExternal />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Discard
              </Button>
              <Button type="submit" disabled={createVehicle.isPending}>
                {createVehicle.isPending && <Spinner />}
                Link
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
