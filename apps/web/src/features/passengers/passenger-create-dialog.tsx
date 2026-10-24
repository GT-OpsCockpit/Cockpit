import { useState } from 'react'
import { Plus } from 'lucide-react'
import { passengersControllerListQueryKeyPrefix, usePassengersControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { PassengerFormFields } from './passenger-form-fields'
import { passengerFormDefaults, passengerFormSchema, type PassengerFormValues } from './passenger-form-schema'
import { toCreatePassengerDto } from './passenger-form-mapping'

export function PassengerCreateDialog() {
  const [open, setOpen] = useState(false)
  const createPassenger = usePassengersControllerCreate()

  const record = useRecordForm<PassengerFormValues, unknown>({
    schema: passengerFormSchema,
    defaultValues: passengerFormDefaults(),
    submit: (values) => createPassenger.mutateAsync({ data: toCreatePassengerDto(values) }),
    success: () => 'Passenger created.',
    error: 'Error creating passenger.',
    invalidate: [passengersControllerListQueryKeyPrefix],
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
      title="New passenger"
      trigger={
        <Button>
          <Plus className="size-4" />
          New passenger
        </Button>
      }
      record={record}
      submitLabel="Create"
    >
      <PassengerFormFields form={record.form} />
    </RecordFormDialog>
  )
}
