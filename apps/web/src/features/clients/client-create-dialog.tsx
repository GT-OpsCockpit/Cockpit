import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  ClientEntityClientType,
  getClientsControllerListQueryKey,
  useClientsControllerCreate,
} from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ClientFormFields } from './client-form-fields'
import { clientFormDefaults, clientFormSchema, type ClientFormValues } from './client-form-schema'
import { toCreateClientDto } from './client-form-mapping'
import { EventReactivationDialog } from '../events/event-reactivation-dialog'

export function ClientCreateDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: clientFormDefaults(),
  })

  const createClient = useClientsControllerCreate()
  const [reactivationTarget, setReactivationTarget] = useState<ClientEntity | null>(null)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset(clientFormDefaults())
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const client = await createClient.mutateAsync({ data: toCreateClientDto(values) })
      toast.success(`Account ${client.ref} created.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getClientsControllerListQueryKey() })
      // A returning event often has a crew already on file from its previous
      // edition — offer to relink it (offerEventReactivation, common.js:3912).
      if (client.clientType === ClientEntityClientType.EVENT) setReactivationTarget(client)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating account.'))
    }
  })

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <ClientFormFields form={form} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createClient.isPending}>
                {createClient.isPending && <Spinner />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <EventReactivationDialog event={reactivationTarget} onClose={() => setReactivationTarget(null)} />
    </>
  )
}
