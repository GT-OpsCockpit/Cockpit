import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { getFleetVehiclesControllerListQueryKey, useFleetVehiclesControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { VehicleFormFields } from './vehicle-form-fields'
import { vehicleFormDefaults, vehicleFormSchema, type VehicleFormValues } from './vehicle-form-schema'
import { toCreateFleetVehicleDto } from './vehicle-form-mapping'

export function VehicleCreateDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicleFormDefaults(),
  })

  const createVehicle = useFleetVehiclesControllerCreate()

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset(vehicleFormDefaults())
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const vehicle = await createVehicle.mutateAsync({ data: toCreateFleetVehicleDto(values) })
      toast.success(`Vehicle ${vehicle.ref} created.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getFleetVehiclesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating vehicle.'))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New vehicle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <VehicleFormFields form={form} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createVehicle.isPending}>
                {createVehicle.isPending && <Spinner />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
