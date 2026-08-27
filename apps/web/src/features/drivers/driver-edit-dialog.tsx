import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { DriverEntity } from '@cockpit/shared/api'
import { getDriversControllerListQueryKey, useDriversControllerUpdate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    values: driver ? driverToFormValues(driver) : driverFormDefaults(),
  })

  const updateDriver = useDriversControllerUpdate()

  const onSubmit = form.handleSubmit(async (values) => {
    if (!driver) return
    try {
      await updateDriver.mutateAsync({ ref: driver.ref, data: toUpdateDriverDto(values) })
      toast.success(`Driver ${driver.ref} updated.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getDriversControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating driver.'))
    }
  })

  return (
    <Dialog open={!!driver} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit driver{driver ? ` — ${driver.ref}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <DriverFormFields form={form} driver={driver} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDriver.isPending}>
                Confirm
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
