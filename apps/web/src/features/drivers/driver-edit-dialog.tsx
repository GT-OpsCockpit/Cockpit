import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerUpdate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { DriverFormFields } from './driver-form-fields'
import { driverFormDefaults, driverFormSchema, type DriverFormValues } from './driver-form-schema'
import { driverToFormValues, toUpdateDriverDto } from './driver-form-mapping'

export function DriverEditDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const updateDriver = useDriversControllerUpdate()

  const record = useRecordForm<DriverFormValues, unknown>({
    schema: driverFormSchema,
    values: driver ? driverToFormValues(driver) : driverFormDefaults(),
    submit: (values) => updateDriver.mutateAsync({ ref: driver!.ref, data: toUpdateDriverDto(values) }),
    success: () => `Driver ${driver?.ref} updated.`,
    error: 'Error updating driver.',
    invalidate: [getDriversControllerListQueryKey()],
    close: () => onOpenChange(false),
    disabled: !driver,
  })

  return (
    <RecordFormDialog
      open={!!driver}
      onOpenChange={onOpenChange}
      title={`Edit driver${driver ? ` — ${driver.ref}` : ''}`}
      record={record}
      contentClassName="sm:max-w-2xl"
    >
      <DriverFormFields form={record.form} driver={driver} />
    </RecordFormDialog>
  )
}
