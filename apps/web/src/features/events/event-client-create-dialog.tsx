import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { ClientEntityClientType, getClientsControllerListQueryKey, useClientsControllerCreate } from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ClientFormFields } from '../clients/client-form-fields'
import { clientFormDefaults, clientFormSchema, type ClientFormValues } from '../clients/client-form-schema'
import { toCreateClientDto } from '../clients/client-form-mapping'

function eventClientDefaults(): ClientFormValues {
  return { ...clientFormDefaults(), clientType: ClientEntityClientType.EVENT }
}

/**
 * The "New" flow from the Select-event panel (events.html's "New" button) —
 * a single dialog rather than legacy's two-step modal chain (Event details,
 * then full account details): every field legacy's two steps collected is
 * already handled in one shot by the existing ClientFormFields/clientFormSchema,
 * which already fully supports clientType EVENT. The Account-type selector is
 * shown but locked to Events (mirrors the legacy's disabled "Type" input).
 */
export function EventClientCreateDialog({ onCreated }: { onCreated: (client: ClientEntity) => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: eventClientDefaults(),
  })

  const createClient = useClientsControllerCreate()

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset(eventClientDefaults())
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const client = await createClient.mutateAsync({ data: toCreateClientDto(values) })
      toast.success(`Event account ${client.ref} created.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getClientsControllerListQueryKey() })
      onCreated(client)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating event account.'))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <Plus className="size-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Events account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <ClientFormFields form={form} typeLocked />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createClient.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
