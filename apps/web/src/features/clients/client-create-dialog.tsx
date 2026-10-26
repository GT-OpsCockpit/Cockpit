import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  ClientEntityClientType,
  getClientsControllerListQueryKey,
  useClientsControllerAddContact,
  useClientsControllerCreate,
} from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { ClientFormFields } from './client-form-fields'
import { ClientContactsList, type ListedContact } from './client-contacts-list'
import { saveContactsInOrder } from './save-contacts'
import { clientFormDefaults, clientFormSchema, type ClientFormValues } from './client-form-schema'
import { toCreateClientDto } from './client-form-mapping'
import { EventReactivationDialog } from '../events/event-reactivation-dialog'

let nextLocalContactId = 0

export function ClientCreateDialog() {
  const [open, setOpen] = useState(false)
  const [reactivationTarget, setReactivationTarget] = useState<ClientEntity | null>(null)
  // The account doesn't exist yet, so there's nothing to attach contacts to:
  // they're kept here, listed as typed, and saved right after the account is.
  const [contacts, setContacts] = useState<ListedContact[]>([])
  const createClient = useClientsControllerCreate()
  const addContact = useClientsControllerAddContact()

  const saveContactsOf = async (clientRef: string) => {
    const failed = await saveContactsInOrder(contacts, (data) => addContact.mutateAsync({ ref: clientRef, data }))
    if (failed > 0) {
      toast.error(
        `Account created, but ${failed} contact${failed > 1 ? 's' : ''} could not be saved — add ${failed > 1 ? 'them' : 'it'} from the account's edit window.`,
      )
    }
  }

  const record = useRecordForm<ClientFormValues, ClientEntity>({
    schema: clientFormSchema,
    defaultValues: clientFormDefaults(),
    submit: async (values) => {
      const client = await createClient.mutateAsync({ data: toCreateClientDto(values) })
      await saveContactsOf(client.ref)
      return client
    },
    success: (client) => `Account ${client.ref} created.`,
    error: 'Error creating account.',
    invalidate: [getClientsControllerListQueryKey()],
    close: () => {
      setOpen(false)
      setContacts([])
    },
    // A returning event often has a crew already on file from its previous
    // edition — offer to relink it (offerEventReactivation, common.js:3912).
    onSuccess: (client) => {
      if (client.clientType === ClientEntityClientType.EVENT) setReactivationTarget(client)
    },
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      record.reset()
      setContacts([])
    }
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
        <div className="border-t" />
        <ClientContactsList
          contacts={contacts}
          hint="Saved together with the account."
          onSave={async (id, values) => {
            setContacts((list) =>
              id
                ? list.map((c) => (c.id === id ? { ...c, ...values } : c))
                : [...list, { id: `new-${nextLocalContactId++}`, ...values }],
            )
            return true
          }}
          onRemove={async (id) => {
            setContacts((list) => list.filter((c) => c.id !== id))
            return true
          }}
          onReorder={async (orderedIds) =>
            setContacts((list) => orderedIds.flatMap((id) => list.filter((c) => c.id === id)))
          }
        />
      </RecordFormDialog>
      <EventReactivationDialog event={reactivationTarget} onClose={() => setReactivationTarget(null)} />
    </>
  )
}
