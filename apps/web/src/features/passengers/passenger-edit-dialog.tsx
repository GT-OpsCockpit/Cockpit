import {
  getPassengersControllerGetQueryKey,
  passengersControllerListQueryKeyPrefix,
  usePassengersControllerDelete,
  usePassengersControllerGet,
  usePassengersControllerUpdate,
} from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { PermanentDeleteAction } from '@/components/permanent-delete-action'
import { PassengerFormFields } from './passenger-form-fields'
import { PassengerRoutesSection } from './passenger-routes-section'
import { PassengerAddressesSection } from './passenger-addresses-section'
import { passengerFormDefaults, passengerFormSchema, type PassengerFormValues } from './passenger-form-schema'
import { passengerToFormValues, toUpdatePassengerDto } from './passenger-form-mapping'

/**
 * Fetches the passenger fresh by ref rather than trusting a row object
 * handed down from the table's own list query — that snapshot goes stale
 * the moment a route or address is added underneath it (the list
 * invalidation those trigger doesn't reach an object already sitting in
 * the page's own state), which is exactly why the dialog used to need a
 * close-and-reopen to show what was just added.
 */
export function PassengerEditDialog({
  passengerRef,
  onOpenChange,
}: {
  passengerRef: string | null
  onOpenChange: (open: boolean) => void
}) {
  const passengerQuery = usePassengersControllerGet(passengerRef ?? '', {
    query: { enabled: !!passengerRef },
  })
  const passenger = passengerQuery.data

  const updatePassenger = usePassengersControllerUpdate()
  const deletePassenger = usePassengersControllerDelete()

  const record = useRecordForm<PassengerFormValues, unknown>({
    schema: passengerFormSchema,
    values: passenger ? passengerToFormValues(passenger) : passengerFormDefaults(),
    submit: (values) => updatePassenger.mutateAsync({ ref: passenger!.ref, data: toUpdatePassengerDto(values) }),
    success: () => `Passenger ${passenger?.ref} updated.`,
    error: 'Error updating passenger.',
    invalidate: [passengersControllerListQueryKeyPrefix, ...(passengerRef ? [getPassengersControllerGetQueryKey(passengerRef)] : [])],
    close: () => onOpenChange(false),
    disabled: !passenger,
  })

  return (
    <RecordFormDialog
      open={!!passengerRef}
      onOpenChange={onOpenChange}
      title={`Edit passenger${passenger ? ` — ${passenger.ref}` : ''}`}
      record={record}
      layout="scroll-body"
      contentClassName="sm:max-w-6xl"
      actions={
        passenger && (
          <PermanentDeleteAction
            label={`passenger ${passenger.ref}`}
            description={`${passenger.name || passenger.ref} and their saved routes will be removed for good.`}
            onDelete={() => deletePassenger.mutateAsync({ ref: passenger.ref })}
            invalidateKey={passengersControllerListQueryKeyPrefix}
            onDeleted={() => onOpenChange(false)}
          />
        )
      }
    >
      <PassengerFormFields form={record.form} />
      {passenger && (
        <>
          <div className="border-t" />
          <PassengerAddressesSection passenger={passenger} />
          <div className="border-t" />
          <PassengerRoutesSection passenger={passenger} />
        </>
      )}
    </RecordFormDialog>
  )
}
