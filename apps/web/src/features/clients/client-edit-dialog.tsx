import type { ClientEntity } from '@cockpit/shared/api'
import {
  getClientsControllerListQueryKey,
  useClientsControllerDelete,
  useClientsControllerUpdate,
} from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { PermanentDeleteAction } from '@/components/permanent-delete-action'
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
  const updateClient = useClientsControllerUpdate()
  const deleteClient = useClientsControllerDelete()

  // UX-layer mirror of the server-side gate (ClientsController.update,
  // client:edit — see docs/agents/permissions.md). The API enforces this
  // independently regardless of what's disabled here.
  const canEdit = usePermission('client:edit')

  const record = useRecordForm<ClientFormValues, unknown>({
    schema: clientFormSchema,
    values: client ? clientToFormValues(client) : clientFormDefaults(),
    submit: (values) => updateClient.mutateAsync({ ref: client!.ref, data: toUpdateClientDto(values) }),
    success: () => `Account ${client?.ref} updated.`,
    error: 'Error updating account.',
    invalidate: [getClientsControllerListQueryKey()],
    close: () => onOpenChange(false),
    disabled: !client || !canEdit,
  })

  return (
    <RecordFormDialog
      open={!!client}
      onOpenChange={onOpenChange}
      title={`Edit account${client ? ` — ${client.ref}` : ''}`}
      record={record}
      submitDisabled={!canEdit}
      actions={
        client && (
          <PermanentDeleteAction
            label={`account ${client.ref}`}
            description={`${client.name} will be removed for good. Deactivating keeps its history — this does not. Refused outright if any booking or invoice still refers to it.`}
            onDelete={() => deleteClient.mutateAsync({ ref: client.ref })}
            invalidateKey={getClientsControllerListQueryKey()}
            onDeleted={() => onOpenChange(false)}
          />
        )
      }
    >
      {!canEdit && <PermissionWarning>Editing an account requires the Admin role.</PermissionWarning>}
      <ClientFormFields form={record.form} disabled={!canEdit} />
    </RecordFormDialog>
  )
}
