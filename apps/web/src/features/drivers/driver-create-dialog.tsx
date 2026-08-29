import { useState } from 'react'
import { Plus } from 'lucide-react'
import { driverLabel } from '@cockpit/shared'
import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { LinkVehicleToPartnerDialog } from '@/features/fleet/link-vehicle-to-partner-dialog'
import { DriverFormFields } from './driver-form-fields'
import { driverFormDefaults, driverFormSchema, type DriverFormValues } from './driver-form-schema'
import { toCreateDriverDto } from './driver-form-mapping'

export function DriverCreateDialog() {
  const [open, setOpen] = useState(false)
  // "Ind." shortcut (legacy drivers.html): once a Company is filled in, checking
  // this opens the "Link a vehicle" popup straight after creation — same popup
  // the Events branch below offers via a Yes/No prompt instead.
  const [linkVehicleChecked, setLinkVehicleChecked] = useState(false)
  const [offerLinkTarget, setOfferLinkTarget] = useState<DriverEntity | null>(null)
  const [linkTarget, setLinkTarget] = useState<DriverEntity | null>(null)

  const createDriver = useDriversControllerCreate()

  const record = useRecordForm<DriverFormValues, DriverEntity>({
    schema: driverFormSchema,
    defaultValues: driverFormDefaults(),
    submit: (values) => createDriver.mutateAsync({ data: toCreateDriverDto(values) }),
    success: (driver) => `Driver ${driver.ref} created.`,
    error: 'Error creating driver.',
    invalidate: [getDriversControllerListQueryKey()],
    close: () => setOpen(false),
    // Same precedence as the legacy submit handler: an Events partner chauffeur
    // gets the Yes/No prompt regardless of "Ind.", which only applies otherwise.
    onSuccess: (driver, values) => {
      const isPartnerEvents = values.eventsOnly && !!values.company?.trim()
      const isIndLink = !isPartnerEvents && linkVehicleChecked && !!values.company?.trim()
      if (isPartnerEvents) setOfferLinkTarget(driver)
      else if (isIndLink) setLinkTarget(driver)
    },
  })

  const company = record.form.watch('company')

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      record.reset()
      setLinkVehicleChecked(false)
    }
  }

  return (
    <>
      <RecordFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="New driver"
        trigger={
          <Button>
            <Plus className="size-4" />
            New driver
          </Button>
        }
        record={record}
        submitLabel="Create"
        contentClassName="sm:max-w-2xl"
      >
        <DriverFormFields form={record.form} />
        <div className="flex items-center gap-2">
          <Checkbox
            id="driver-link-vehicle"
            checked={linkVehicleChecked}
            disabled={!company?.trim()}
            onCheckedChange={(checked) => setLinkVehicleChecked(checked === true)}
          />
          <label htmlFor="driver-link-vehicle" className="text-sm">
            Link a vehicle to this partner once created
          </label>
        </div>
      </RecordFormDialog>

      <ConfirmActionDialog
        open={!!offerLinkTarget}
        onOpenChange={(open) => !open && setOfferLinkTarget(null)}
        title="Link a vehicle to this partner?"
        description={offerLinkTarget && `Do you wish to link ${driverLabel(offerLinkTarget)} to a vehicle now?`}
        cancelLabel="No"
        confirmLabel="Yes"
        onConfirm={() => {
          setLinkTarget(offerLinkTarget)
          setOfferLinkTarget(null)
        }}
      />

      <LinkVehicleToPartnerDialog driver={linkTarget} onOpenChange={(open) => !open && setLinkTarget(null)} />
    </>
  )
}
