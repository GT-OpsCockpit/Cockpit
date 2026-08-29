import type { FleetVehicleEntity } from '@cockpit/shared/api'
import {
  getFleetVehiclesControllerListQueryKey,
  useFleetVehiclesControllerDelete,
  useFleetVehiclesControllerUpdate,
} from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { PermanentDeleteAction } from '@/components/permanent-delete-action'
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
  const updateVehicle = useFleetVehiclesControllerUpdate()
  const deleteVehicle = useFleetVehiclesControllerDelete()

  const record = useRecordForm<VehicleFormValues, unknown>({
    schema: vehicleFormSchema,
    values: vehicle ? vehicleToFormValues(vehicle) : vehicleFormDefaults(),
    submit: (values) => updateVehicle.mutateAsync({ ref: vehicle!.ref, data: toUpdateFleetVehicleDto(values) }),
    success: () => `Vehicle ${vehicle?.ref} updated.`,
    error: 'Error updating vehicle.',
    invalidate: [getFleetVehiclesControllerListQueryKey()],
    close: () => onOpenChange(false),
    disabled: !vehicle,
  })

  return (
    <RecordFormDialog
      open={!!vehicle}
      onOpenChange={onOpenChange}
      title={`Edit vehicle${vehicle ? ` — ${vehicle.ref}` : ''}`}
      record={record}
      actions={
        vehicle && (
          <PermanentDeleteAction
            label={`vehicle ${vehicle.ref}`}
            description={`${vehicle.regNbr} will be removed from the fleet for good. Retiring it keeps its history — this does not.`}
            onDelete={() => deleteVehicle.mutateAsync({ ref: vehicle.ref })}
            invalidateKey={getFleetVehiclesControllerListQueryKey()}
            onDeleted={() => onOpenChange(false)}
          />
        )
      }
    >
      <VehicleFormFields form={record.form} vehicle={vehicle} />
    </RecordFormDialog>
  )
}
