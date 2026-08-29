import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ClientEntityClientType, getClientsControllerListQueryKey, useClientsControllerCreate } from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { ClientFormFields } from '../clients/client-form-fields'
import { EventReactivationDialog } from './event-reactivation-dialog'
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
  const [reactivationTarget, setReactivationTarget] = useState<ClientEntity | null>(null)
  const createClient = useClientsControllerCreate()

  const record = useRecordForm<ClientFormValues, ClientEntity>({
    schema: clientFormSchema,
    defaultValues: eventClientDefaults(),
    submit: (values) => createClient.mutateAsync({ data: toCreateClientDto(values) }),
    success: (client) => `Event account ${client.ref} created.`,
    error: 'Error creating event account.',
    invalidate: [getClientsControllerListQueryKey()],
    close: () => setOpen(false),
    onSuccess: (client) => {
      onCreated(client)
      // A returning event often has a crew already on file from its previous
      // edition — offer to relink it (offerEventReactivation, common.js:3912).
      setReactivationTarget(client)
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
        title="New Events account"
        trigger={
          <Button type="button" variant="secondary">
            <Plus className="size-4" />
            New
          </Button>
        }
        record={record}
        submitLabel="Create"
      >
        <ClientFormFields form={record.form} typeLocked />
      </RecordFormDialog>
      <EventReactivationDialog event={reactivationTarget} onClose={() => setReactivationTarget(null)} />
    </>
  )
}
