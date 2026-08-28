import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { FleetVehicleEntity } from '@cockpit/shared/api'
import { getFleetVehiclesControllerListQueryKey, useFleetVehiclesControllerUpdate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VehicleFormFields } from './vehicle-form-fields'
import { vehicleFormDefaults, vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'
import { vehicleToFormValues, toUpdateFleetVehicleDto } from './vehicle-form-mapping'

export function VehicleEditDialog({
  vehicle,
  onOpenChange,
}: {
  vehicle: FleetVehicleEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    values: vehicle ? vehicleToFormValues(vehicle) : vehicleFormDefaults(),
  })

  const updateVehicle = useFleetVehiclesControllerUpdate()

  const onSubmit = form.handleSubmit(async (values) => {
    if (!vehicle) return
    try {
      await updateVehicle.mutateAsync({ ref: vehicle.ref, data: toUpdateFleetVehicleDto(values) })
      toast.success(`Vehicle ${vehicle.ref} updated.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating vehicle.'))
    }
  })

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit vehicle{vehicle ? ` — ${vehicle.ref}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <VehicleFormFields form={form} vehicle={vehicle} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateVehicle.isPending}>
                {updateVehicle.isPending && <Spinner />}
                Confirm
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
