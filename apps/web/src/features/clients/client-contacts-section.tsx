import { toast } from 'sonner'
import {
  getClientsControllerListContactsQueryKey,
  useClientsControllerAddContact,
  useClientsControllerDeleteContact,
  useClientsControllerListContacts,
  useClientsControllerReorderContacts,
  useClientsControllerUpdateContact,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { ClientContactsList, type ContactValues, type ListedContact } from './client-contacts-list'

/**
 * This client's own POCs, numbered 1..N by their chosen order — a company
 * account can have several (ops desk, a specific EA, a duty manager). The
 * first one here is what a new booking's own POC field auto-fills with by
 * default (trip-form-fields.tsx), on top of the free-text override it's
 * always kept — drag a row to change who that default is.
 *
 * The list itself is ClientContactsList; this wires it to the saved contacts.
 */
export function ClientContactsSection({ clientRef }: { clientRef: string }) {
  const contacts = useClientsControllerListContacts(clientRef)
  const addContact = useClientsControllerAddContact()
  const updateContact = useClientsControllerUpdateContact()
  const deleteContact = useClientsControllerDeleteContact()
  const reorderContacts = useClientsControllerReorderContacts()

  // The generated key, not a hand-written one: the list only refreshes if this is exactly the key it was read under.
  const queryKey = getClientsControllerListContactsQueryKey(clientRef)
  const invalidate = () => void queryClient.invalidateQueries({ queryKey })

  const listed: ListedContact[] = (contacts.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? '',
  }))

  const save = async (id: string | null, values: ContactValues) => {
    const data = { name: values.name, phone: values.phone || undefined, email: values.email || undefined }
    try {
      if (id) {
        await updateContact.mutateAsync({ ref: clientRef, contactId: id, data })
        toast.success('Contact updated.')
      } else {
        await addContact.mutateAsync({ ref: clientRef, data })
        toast.success('Contact added.')
      }
      invalidate()
      return true
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving contact.'))
      return false
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteContact.mutateAsync({ ref: clientRef, contactId: id })
      toast.success('Contact removed.')
      invalidate()
      return true
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error removing contact.'))
      return false
    }
  }

  // Applied to the cached list first so the row doesn't snap back while the
  // request is in flight, then reconciled with whatever the server saved.
  const reorder = async (orderedIds: string[]) => {
    const byId = new Map((contacts.data ?? []).map((c) => [c.id, c]))
    queryClient.setQueryData(
      queryKey,
      orderedIds.map((id) => byId.get(id)).filter((c) => c !== undefined),
    )
    try {
      await reorderContacts.mutateAsync({ ref: clientRef, data: { contactIds: orderedIds } })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving the new order.'))
    } finally {
      invalidate()
    }
  }

  return <ClientContactsList contacts={listed} onSave={save} onRemove={remove} onReorder={reorder} />
}
