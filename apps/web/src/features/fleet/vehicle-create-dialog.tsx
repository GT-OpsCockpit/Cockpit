import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getFleetVehiclesControllerListQueryKey, useFleetVehiclesControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { VehicleFormFields } from './vehicle-form-fields'
import { vehicleFormDefaults, vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'
import { toCreateFleetVehicleDto } from './vehicle-form-mapping'

export function VehicleCreateDialog() {
  const [open, setOpen] = useState(false)
  const createVehicle = useFleetVehiclesControllerCreate()

  const record = useRecordForm<VehicleFormValues, { ref: string }>({
    schema: vehicleFormSchema,
    defaultValues: vehicleFormDefaults(),
    submit: (values) => createVehicle.mutateAsync({ data: toCreateFleetVehicleDto(values) }),
    success: (vehicle) => `Vehicle ${vehicle.ref} created.`,
    error: 'Error creating vehicle.',
    invalidate: [getFleetVehiclesControllerListQueryKey()],
    close: () => setOpen(false),
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) record.reset()
  }

  return (
    <RecordFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New vehicle"
      trigger={
        <Button>
          <Plus className="size-4" />
          New vehicle
        </Button>
      }
      record={record}
      submitLabel="Create"
    >
      <VehicleFormFields form={record.form} />
    </RecordFormDialog>
  )
}
