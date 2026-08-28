import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { ClientEntity } from '@cockpit/shared/api'
import { getClientsControllerListQueryKey, useClientsControllerUpdate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermission } from '@/features/auth/use-permission'
import { PermissionWarning } from '@/components/permission-warning'
import { ClientFormFields } from './client-form-fields'
import { clientFormDefaults, clientFormSchema, type ClientFormValues } from './client-form-schema'
import { clientToFormValues, toUpdateClientDto } from './client-form-mapping'

export function ClientEditDialog({
  client,
  onOpenChange,
}: {
  client: ClientEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    values: client ? clientToFormValues(client) : clientFormDefaults(),
  })

  const updateClient = useClientsControllerUpdate()

  // UX-layer mirror of the server-side gate (ClientsController.update,
  // client:edit — see docs/agents/permissions.md). The API enforces this
  // independently regardless of what's disabled here.
  const canEdit = usePermission('client:edit')

  const onSubmit = form.handleSubmit(async (values) => {
    if (!client || !canEdit) return
    try {
      await updateClient.mutateAsync({ ref: client.ref, data: toUpdateClientDto(values) })
      toast.success(`Account ${client.ref} updated.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getClientsControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating account.'))
    }
  })

  return (
    <Dialog open={!!client} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit account{client ? ` — ${client.ref}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            {!canEdit && <PermissionWarning>Editing an account requires the Admin role.</PermissionWarning>}
            <ClientFormFields form={form} disabled={!canEdit} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateClient.isPending || !canEdit}>
                {updateClient.isPending && <Spinner />}
                Confirm
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
