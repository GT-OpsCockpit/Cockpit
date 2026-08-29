import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { LinkVehicleToPartnerDialog } from '@/features/fleet/link-vehicle-to-partner-dialog'
import { driverLabel } from '@/features/bookings/trip-status'
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

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: driverFormDefaults(),
  })

  const createDriver = useDriversControllerCreate()
  const company = form.watch('company')

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      form.reset(driverFormDefaults())
      setLinkVehicleChecked(false)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const driver = await createDriver.mutateAsync({ data: toCreateDriverDto(values) })
      toast.success(`Driver ${driver.ref} created.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })

      // Same precedence as the legacy submit handler: an Events partner chauffeur
      // gets the Yes/No prompt regardless of "Ind.", which only applies otherwise.
      const isPartnerEvents = values.eventsOnly && !!values.company?.trim()
      const isIndLink = !isPartnerEvents && linkVehicleChecked && !!values.company?.trim()
      if (isPartnerEvents) {
        setOfferLinkTarget(driver)
      } else if (isIndLink) {
        setLinkTarget(driver)
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating driver.'))
    }
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" />
            New driver
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New driver</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <DriverFormFields form={form} />
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDriver.isPending}>
                  {createDriver.isPending && <Spinner />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
