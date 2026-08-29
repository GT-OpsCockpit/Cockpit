import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  ClientEntityClientType,
  getClientsControllerListQueryKey,
  useClientsControllerCreate,
} from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { ClientFormFields } from './client-form-fields'
import { clientFormDefaults, clientFormSchema, type ClientFormValues } from './client-form-schema'
import { toCreateClientDto } from './client-form-mapping'
import { EventReactivationDialog } from '../events/event-reactivation-dialog'

export function ClientCreateDialog() {
  const [open, setOpen] = useState(false)
  const [reactivationTarget, setReactivationTarget] = useState<ClientEntity | null>(null)
  const createClient = useClientsControllerCreate()

  const record = useRecordForm<ClientFormValues, ClientEntity>({
    schema: clientFormSchema,
    defaultValues: clientFormDefaults(),
    submit: (values) => createClient.mutateAsync({ data: toCreateClientDto(values) }),
    success: (client) => `Account ${client.ref} created.`,
    error: 'Error creating account.',
    invalidate: [getClientsControllerListQueryKey()],
    close: () => setOpen(false),
    // A returning event often has a crew already on file from its previous
    // edition — offer to relink it (offerEventReactivation, common.js:3912).
    onSuccess: (client) => {
      if (client.clientType === ClientEntityClientType.EVENT) setReactivationTarget(client)
    },
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) record.reset()
  }

  return (
    <>
      <RecordFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="New account"
        trigger={
          <Button>
            <Plus className="size-4" />
            New account
          </Button>
        }
        record={record}
        submitLabel="Create"
      >
        <ClientFormFields form={record.form} />
      </RecordFormDialog>
      <EventReactivationDialog event={reactivationTarget} onClose={() => setReactivationTarget(null)} />
    </>
  )
}
